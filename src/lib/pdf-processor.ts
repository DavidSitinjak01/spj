import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { isServerless } from '@/lib/serverless';

const UPLOAD_DIR = path.join(process.cwd(), 'upload');
const PUBLIC_PAGES_DIR = path.join(process.cwd(), 'public', 'pdf-pages');
const CACHE_DIR = path.join(process.cwd(), '.pdf-cache');
const BLOB_PREFIX = 'pdfs/';

// Ensure directories exist (only on non-serverless environments)
if (!isServerless()) {
  try {
    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    if (!fs.existsSync(PUBLIC_PAGES_DIR)) fs.mkdirSync(PUBLIC_PAGES_DIR, { recursive: true });
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  } catch {
    // Silently fail on read-only filesystems (e.g., Vercel)
  }
}

export interface PDFInfo {
  fileName: string;
  filePath: string;
  pageCount: number;
  title?: string;
  extractedText: { page: number; text: string }[];
}

interface CachedData {
  fileName: string;
  pageCount: number;
  extractedText: { page: number; text: string }[];
  pageImages: string[];
  renderedAt: number;
  fileModifiedAt: number;
}

// In-memory cache
const memoryCache = new Map<string, CachedData>();

function getCachePath(fileName: string): string {
  return path.join(CACHE_DIR, `${fileName}.json`);
}

function getFileModTime(fileName: string): number {
  if (isServerless()) return 0;
  const filePath = path.join(UPLOAD_DIR, fileName);
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return 0;
  }
}

function readCache(fileName: string): CachedData | null {
  if (isServerless()) return null;

  // Check memory cache first
  const memCached = memoryCache.get(fileName);
  if (memCached && memCached.fileModifiedAt === getFileModTime(fileName)) {
    return memCached;
  }

  // Check file cache
  const cachePath = getCachePath(fileName);
  try {
    if (fs.existsSync(cachePath)) {
      const cached = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      if (cached.fileModifiedAt === getFileModTime(fileName)) {
        memoryCache.set(fileName, cached);
        return cached;
      }
    }
  } catch {
    // Cache read failed, continue
  }
  return null;
}

function writeCache(fileName: string, data: CachedData): void {
  memoryCache.set(fileName, data);
  if (isServerless()) return;
  try {
    fs.writeFileSync(getCachePath(fileName), JSON.stringify(data));
  } catch {
    // Cache write failed, non-critical
  }
}

// --- Vercel Blob helpers ---

/**
 * Import the Vercel Blob SDK dynamically.
 */
async function getBlobModule() {
  const mod = await import('@vercel/blob');
  return mod;
}

/**
 * Upload a file to Vercel Blob storage.
 * Uses private access since the Blob store is configured as private.
 */
export async function uploadToBlob(fileName: string, buffer: Buffer, contentType?: string): Promise<{ url: string }> {
  const { put } = await getBlobModule();
  const blob = await put(`${BLOB_PREFIX}${fileName}`, buffer, {
    access: 'private',
    contentType: contentType || 'application/pdf',
    allowOverwrite: true,
  });
  return { url: blob.url };
}

/**
 * Helper: Convert a ReadableStream<Uint8Array> to a Buffer.
 * Used by @vercel/blob v2 get() which returns a stream instead of a Blob.
 */
async function streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}

/**
 * Download a file from Vercel Blob storage (private store).
 * Uses the @vercel/blob `get()` function which returns a stream.
 * In @vercel/blob v2, get() returns { stream, blob, headers } instead of a Blob.
 */
export async function downloadFromBlob(url: string): Promise<Buffer> {
  const { get } = await getBlobModule();
  const result = await get(url, { access: 'private' });
  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new Error(`Failed to download blob: ${url} (status: ${result?.statusCode || 'null'})`);
  }
  return streamToBuffer(result.stream);
}

/**
 * Download a file from Vercel Blob by pathname (for private store).
 * Uses pathname-based access which works without needing the full URL.
 */
export async function downloadFromBlobByPathname(pathname: string): Promise<Buffer> {
  const { get } = await getBlobModule();
  const result = await get(pathname, { access: 'private' });
  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new Error(`Failed to download blob by pathname: ${pathname} (status: ${result?.statusCode || 'null'})`);
  }
  return streamToBuffer(result.stream);
}

/**
 * Delete a file from Vercel Blob storage by URL.
 */
export async function deleteFromBlobByUrl(url: string): Promise<void> {
  const { del } = await getBlobModule();
  await del(url);
}

/**
 * Delete a file from Vercel Blob storage by fileName.
 */
export async function deleteFromBlob(fileName: string): Promise<void> {
  const blobInfo = await getBlobInfo(fileName);
  if (blobInfo) {
    await deleteFromBlobByUrl(blobInfo.url);
  }
}

/**
 * Get blob info for a file by fileName.
 */
export async function getBlobInfo(fileName: string): Promise<{ url: string; size: number; uploadedAt: string } | null> {
  const { list } = await getBlobModule();
  const { blobs } = await list({ prefix: `${BLOB_PREFIX}${fileName}` });
  if (blobs.length > 0) {
    const blob = blobs[0];
    return {
      url: blob.url,
      size: blob.size,
      uploadedAt: blob.uploadedAt.toISOString(),
    };
  }
  return null;
}

/**
 * Get the blob URL for a file by fileName.
 */
export async function getBlobUrl(fileName: string): Promise<string | null> {
  const info = await getBlobInfo(fileName);
  return info?.url || null;
}

// ============================================================================
// PDF TEXT EXTRACTION — pdf2json ONLY
// ============================================================================
// We use pdf2json as the SOLE extraction method because:
//   - It is a pure JavaScript PDF parser (no Web Workers needed)
//   - It works in Vercel serverless without any module resolution issues
//   - pdfjs-dist requires a Worker that cannot be found on Vercel serverless
//   - pdf-parse wraps pdfjs-dist and has the same Worker problem
// ============================================================================

/**
 * Extract text from a PDF buffer using pdf2json.
 * This is the ONLY extraction method — no fallbacks to pdfjs-dist.
 */
async function extractTextFromPDF(buffer: Buffer): Promise<{
  text: string;
  numpages: number;
  info: Record<string, unknown>;
  perPageText: { page: number; text: string }[];
}> {
  console.log('[pdf-processor] Starting PDF text extraction with pdf2json (sole method)');
  console.log('[pdf-processor] Buffer size:', buffer.length, 'bytes');

  try {
    const result = await extractTextWithPdf2Json(buffer);
    if (result.text.trim() || result.numpages === 0) {
      console.log('[pdf-processor] pdf2json extraction succeeded —', result.numpages, 'pages,', result.text.length, 'chars');
      return result;
    }
    // pdf2json parsed but got empty text
    const errMsg = `pdf2json extracted empty text from ${result.numpages} pages — the PDF may contain only images/scans`;
    console.error('[pdf-processor]', errMsg);
    throw new Error(errMsg);
  } catch (err: any) {
    console.error('[pdf-processor] pdf2json extraction FAILED:', err?.message || String(err));
    throw new Error(`PDF text extraction failed (pdf2json): ${err?.message || String(err)}`);
  }
}

// ============================================================================
// pdf2json extraction (Worker-free, pure JavaScript)
// ============================================================================

/**
 * Extract text using pdf2json — a pure JavaScript PDF parser that does NOT
 * require web workers, DOMMatrix, or any browser APIs.
 *
 * pdf2json returns text items with position info (x, y, w) which we use
 * to produce tab-separated text that preserves table structure.
 */
async function extractTextWithPdf2Json(buffer: Buffer): Promise<{
  text: string;
  numpages: number;
  info: Record<string, unknown>;
  perPageText: { page: number; text: string }[];
}> {
  console.log('[pdf-processor] Importing pdf2json...');
  const pdf2jsonModule = await import('pdf2json');
  const PDFParser = (pdf2jsonModule as any).default || pdf2jsonModule;
  console.log('[pdf-processor] pdf2json imported, PDFParser type:', typeof PDFParser);

  const pdfParser = new (PDFParser as any)(null, 1);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('pdf2json parse timeout (30s)'));
    }, 30000);

    pdfParser.on('pdfParser_dataError', (errData: any) => {
      clearTimeout(timeout);
      reject(new Error(errData?.parserError?.message || 'pdf2json parse error'));
    });

    pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
      clearTimeout(timeout);
      try {
        const perPageText: { page: number; text: string }[] = [];
        let fullText = '';

        if (!pdfData?.Pages || !Array.isArray(pdfData.Pages)) {
          reject(new Error('pdf2json returned no pages'));
          return;
        }

        for (let pageIdx = 0; pageIdx < pdfData.Pages.length; pageIdx++) {
          const page = pdfData.Pages[pageIdx];
          const pageText = extractPageTextFromPdf2Json(page);
          perPageText.push({ page: pageIdx + 1, text: pageText });
          fullText += pageText + '\n';
        }

        resolve({
          text: fullText.trim(),
          numpages: pdfData.Pages.length,
          info: pdfData?.Meta || {},
          perPageText,
        });
      } catch (err: any) {
        reject(new Error(`pdf2json result processing failed: ${err?.message || String(err)}`));
      }
    });

    // Parse from buffer
    pdfParser.parseBuffer(buffer);
  });
}

/**
 * Process a single page from pdf2json's output into tab-separated text.
 *
 * Strategy:
 * 1. Group text items by Y position into visual lines
 * 2. Detect column positions by analyzing x-position clusters across all lines
 * 3. Insert tabs between items that belong to different detected columns
 *
 * This approach is more robust than simple gap thresholds because it
 * automatically adapts to the PDF's actual column layout.
 */
function extractPageTextFromPdf2Json(page: any): string {
  if (!page?.Texts || !Array.isArray(page.Texts)) return '';

  const items: { str: string; x: number; y: number; w: number }[] = [];

  for (const text of page.Texts) {
    if (!text.R || !Array.isArray(text.R)) continue;
    let combinedStr = '';
    for (const run of text.R) {
      if (run.T !== undefined && run.T !== null) {
        try {
          combinedStr += decodeURIComponent(run.T);
        } catch {
          combinedStr += run.T;
        }
      }
    }
    if (combinedStr) {
      items.push({
        str: combinedStr,
        x: text.x || 0,
        y: text.y || 0,
        w: text.w || 0,
      });
    }
  }

  if (items.length === 0) return '';

  // --- Step 1: Group items by Y position into visual lines ---
  // Use adaptive tolerance: sort by Y first, then group items that are close
  const sortedByY = [...items].sort((a, b) => a.y - b.y);
  const LINE_TOLERANCE = 0.8; // Slightly more tolerant to handle subscripts/superscripts
  const lines: { y: number; items: typeof items }[] = [];

  for (const item of sortedByY) {
    let foundLine = false;
    for (const line of lines) {
      if (Math.abs(line.y - item.y) <= LINE_TOLERANCE) {
        line.items.push(item);
        foundLine = true;
        break;
      }
    }
    if (!foundLine) {
      lines.push({ y: item.y, items: [item] });
    }
  }

  lines.sort((a, b) => a.y - b.y);

  // --- Step 2: Detect column positions ---
  // Collect all x-positions where items start, then cluster them.
  // Items that start at similar x-positions across lines likely belong to the same column.
  const allXPositions: number[] = [];
  for (const line of lines) {
    for (const item of line.items) {
      allXPositions.push(item.x);
    }
  }

  // Sort and cluster x-positions: group positions that are within COLUMN_TOLERANCE of each other
  const COLUMN_TOLERANCE = 2.0; // Items within 2 units of x are in the same column
  const sortedX = [...allXPositions].sort((a, b) => a - b);
  const columnCenters: number[] = [];

  for (const x of sortedX) {
    let foundColumn = false;
    for (let i = 0; i < columnCenters.length; i++) {
      if (Math.abs(columnCenters[i] - x) <= COLUMN_TOLERANCE) {
        // Update running average
        columnCenters[i] = (columnCenters[i] + x) / 2;
        foundColumn = true;
        break;
      }
    }
    if (!foundColumn) {
      columnCenters.push(x);
    }
  }

  columnCenters.sort((a, b) => a - b);

  // Merge columns that are too close together (within 3 units)
  const mergedColumns: number[] = [];
  for (const col of columnCenters) {
    if (mergedColumns.length === 0 || col - mergedColumns[mergedColumns.length - 1] > 3.0) {
      mergedColumns.push(col);
    } else {
      // Too close - merge by averaging
      mergedColumns[mergedColumns.length - 1] = (mergedColumns[mergedColumns.length - 1] + col) / 2;
    }
  }

  // --- Step 3: Build lines with tab-separated columns ---
  const MIN_X_GAP_FOR_TAB = 1.5; // Minimum gap between text end and next text start to insert tab
  const pageLines: string[] = [];

  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x);

    // Assign each item to a column index
    const itemColumns: { item: typeof items[0]; colIdx: number }[] = [];
    for (const item of line.items) {
      // Find nearest column
      let nearestCol = 0;
      let minDist = Infinity;
      for (let ci = 0; ci < mergedColumns.length; ci++) {
        const dist = Math.abs(mergedColumns[ci] - item.x);
        if (dist < minDist) {
          minDist = dist;
          nearestCol = ci;
        }
      }
      itemColumns.push({ item, colIdx: nearestCol });
    }

    // Build line text with tabs between different columns
    let lineText = '';
    let lastColIdx = -1;

    for (const { item, colIdx } of itemColumns) {
      if (lastColIdx >= 0) {
        if (colIdx > lastColIdx) {
          // Different column - insert tab(s)
          // If there are skipped columns, insert extra tabs
          const tabCount = colIdx - lastColIdx;
          lineText += '\t'.repeat(tabCount);
        } else if (colIdx === lastColIdx) {
          // Same column - just add a space between items
          lineText += ' ';
        }
        // If colIdx < lastColIdx, items overlap - just concatenate
      }
      lineText += item.str;
      lastColIdx = colIdx;
    }

    pageLines.push(lineText);
  }

  // Log extraction summary for debugging
  console.log(`[pdf2json] Page extracted: ${lines.length} lines, ${mergedColumns.length} detected columns, ${items.length} text items`);
  if (mergedColumns.length > 0 && mergedColumns.length <= 20) {
    console.log(`[pdf2json] Column positions: ${mergedColumns.map(c => c.toFixed(1)).join(', ')}`);
  }

  return pageLines.join('\n');
}

// --- Core functions ---

export async function getPDFFiles(): Promise<string[]> {
  if (isServerless()) {
    // Serverless: list from Vercel Blob
    try {
      const { list } = await getBlobModule();
      const { blobs } = await list({ prefix: BLOB_PREFIX });
      return blobs
        .map(b => b.pathname.replace(BLOB_PREFIX, ''))
        .filter(f => f.endsWith('.pdf'));
    } catch {
      return [];
    }
  }

  // Local: read from upload dir
  try {
    if (!fs.existsSync(UPLOAD_DIR)) return [];
    return fs.readdirSync(UPLOAD_DIR).filter(f => f.endsWith('.pdf'));
  } catch {
    return [];
  }
}

/**
 * Process a PDF directly from a buffer (no need to download from Blob).
 * Use this after upload to avoid race conditions with Blob indexing.
 */
export async function processPDFBuffer(fileName: string, buffer: Buffer, filePath?: string): Promise<PDFInfo> {
  const parsed = await extractTextFromPDF(buffer);

  return {
    fileName,
    filePath: filePath || fileName,
    pageCount: parsed.numpages,
    extractedText: parsed.perPageText,
  };
}

export async function processPDF(fileName: string): Promise<PDFInfo> {
  if (isServerless()) {
    // Serverless: download from private blob using get() + text extraction
    // Use pathname-based download which handles private store authentication automatically
    const pathname = `${BLOB_PREFIX}${fileName}`;
    const buffer = await downloadFromBlobByPathname(pathname);
    return processPDFBuffer(fileName, buffer, pathname);
  }

  // Local: keep existing Python approach
  const filePath = path.join(UPLOAD_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`PDF file not found: ${fileName}`);
  }

  // Check cache
  const cached = readCache(fileName);
  if (cached) {
    return {
      fileName: cached.fileName,
      filePath,
      pageCount: cached.pageCount,
      extractedText: cached.extractedText,
    };
  }

  // Use Python to extract text
  const pythonScript = `
import pdfplumber
import json
import sys

pdf = pdfplumber.open(sys.argv[1])
result = {
    "pageCount": len(pdf.pages),
    "extractedText": []
}

for i, page in enumerate(pdf.pages):
    text = page.extract_text() or ""
    result["extractedText"].append({"page": i + 1, "text": text})

print(json.dumps(result))
`;

  const resultStr = execSync(`python3 -c '${pythonScript.replace(/'/g, "'\\''")}' "${filePath}"`, {
    encoding: 'utf-8',
    maxBuffer: 50 * 1024 * 1024,
    timeout: 60000,
  });

  const result = JSON.parse(resultStr.trim());

  return {
    fileName,
    filePath,
    pageCount: result.pageCount,
    extractedText: result.extractedText,
  };
}

export async function renderPDFPages(fileName: string): Promise<string[]> {
  if (isServerless()) {
    // Serverless: PDF page rendering not available - return empty array
    // Client-side rendering will handle this
    return [];
  }

  const filePath = path.join(UPLOAD_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`PDF file not found: ${fileName}`);
  }

  // Check if we have cached page images
  const cached = readCache(fileName);
  if (cached && cached.pageImages.length > 0) {
    // Verify the images still exist
    const firstImageExists = cached.pageImages.every(img => {
      const fullPath = path.join(process.cwd(), 'public', img);
      return fs.existsSync(fullPath);
    });
    if (firstImageExists) {
      return cached.pageImages;
    }
  }

  const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const outputDir = path.join(PUBLIC_PAGES_DIR, safeName.replace('.pdf', ''));
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  // Check if pages are already rendered
  const info = await processPDF(fileName);
  const existingPages: string[] = [];
  let allExist = true;

  for (let i = 1; i <= info.pageCount; i++) {
    const pagePath = path.join(outputDir, `page-${i}.png`);
    if (fs.existsSync(pagePath)) {
      existingPages.push(`/pdf-pages/${safeName.replace('.pdf', '')}/page-${i}.png`);
    } else {
      allExist = false;
      break;
    }
  }

  if (allExist && existingPages.length === info.pageCount) {
    // All pages already rendered, update cache
    const cachedData: CachedData = {
      fileName,
      pageCount: info.pageCount,
      extractedText: info.extractedText,
      pageImages: existingPages,
      renderedAt: Date.now(),
      fileModifiedAt: getFileModTime(fileName),
    };
    writeCache(fileName, cachedData);
    return existingPages;
  }

  // Use Python pypdfium2 to render pages
  const pythonScript = `
import pypdfium2 as pdfium
import sys
import os

pdf = pdfium.PdfDocument(sys.argv[1])
output_dir = sys.argv[2]
pages = []

for i in range(len(pdf)):
    page = pdf[i]
    bitmap = page.render(scale=2)
    img = bitmap.to_pil()
    output_path = os.path.join(output_dir, f"page-{i+1}.png")
    img.save(output_path)
    pages.append(f"page-{i+1}.png")

print("\\n".join(pages))
`;

  const resultStr = execSync(`python3 -c '${pythonScript.replace(/'/g, "'\\''")}' "${filePath}" "${outputDir}"`, {
    encoding: 'utf-8',
    maxBuffer: 50 * 1024 * 1024,
    timeout: 120000,
  });

  const pages = resultStr.trim().split('\n').filter(Boolean);
  const pageImages = pages.map(p => `/pdf-pages/${safeName.replace('.pdf', '')}/${p}`);

  // Update cache
  const cachedData: CachedData = {
    fileName,
    pageCount: info.pageCount,
    extractedText: info.extractedText,
    pageImages,
    renderedAt: Date.now(),
    fileModifiedAt: getFileModTime(fileName),
  };
  writeCache(fileName, cachedData);

  return pageImages;
}

export async function getExtractedText(fileName: string): Promise<{ page: number; text: string }[]> {
  const info = await processPDF(fileName);
  return info.extractedText;
}
