import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { isServerless } from '@/lib/serverless';
import { applyDOMPolyfills } from '@/lib/dom-polyfill';

// Re-export for other modules that need to apply polyfills
export { applyDOMPolyfills as ensureDOMPolyfills };

// Apply polyfills immediately when this module is loaded
applyDOMPolyfills();

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
// PDF TEXT EXTRACTION
// ============================================================================
// Strategy for Vercel serverless:
//   1. pdf2json (worker-free, pure JS — most reliable on Vercel)
//   2. pdfjs-dist with position-aware extraction (needs serverExternalPackages)
//   3. pdfjs-dist simple extraction (last resort)
// ============================================================================

/**
 * Extract text from a PDF buffer.
 * Tries multiple methods with fallbacks for maximum reliability on Vercel.
 */
async function extractTextFromPDF(buffer: Buffer): Promise<{
  text: string;
  numpages: number;
  info: Record<string, unknown>;
  perPageText: { page: number; text: string }[];
}> {
  const errors: string[] = [];

  // Method 1: pdf2json — Worker-free, pure JS. Most reliable on Vercel.
  try {
    const result = await extractTextWithPdf2Json(buffer);
    if (result.text.trim() || result.numpages === 0) {
      console.log('pdf2json extraction succeeded');
      return result;
    }
    errors.push(`pdf2json: extracted empty text from ${result.numpages} pages`);
  } catch (err: any) {
    errors.push(`pdf2json: ${err?.message || String(err)}`);
    console.warn('pdf2json extraction failed:', err?.message || err);
  }

  // Method 2: pdfjs-dist with position-aware extraction
  try {
    const result = await extractTextWithPdfjsDist(buffer);
    if (result.text.trim() || result.numpages === 0) {
      console.log('pdfjs-dist extraction succeeded');
      return result;
    }
    errors.push(`pdfjs-dist: extracted empty text from ${result.numpages} pages`);
  } catch (err: any) {
    errors.push(`pdfjs-dist: ${err?.message || String(err)}`);
    console.warn('pdfjs-dist extraction failed:', err?.message || err);
  }

  // Method 3: pdfjs-dist simple (non-position-aware) extraction
  try {
    const result = await extractTextWithPdfjsSimple(buffer);
    if (result.text.trim()) {
      console.log('pdfjs-dist simple extraction succeeded as last fallback');
      return result;
    }
    errors.push('pdfjs-dist-simple: extracted empty text');
  } catch (err: any) {
    errors.push(`pdfjs-dist-simple: ${err?.message || String(err)}`);
  }

  console.error('All PDF text extraction methods failed:', errors.join('; '));
  throw new Error(`PDF text extraction failed. Tried: ${errors.join('; ')}`);
}

// ============================================================================
// Method 1: pdf2json (Worker-free)
// ============================================================================

/**
 * Extract text using pdf2json — a pure JavaScript PDF parser that does NOT
 * require web workers, DOMMatrix, or any browser APIs. This is the most
 * reliable method for Vercel serverless environments.
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
  const PDFParser = (await import('pdf2json')).default;

  const pdfParser = new (PDFParser as any)(null, 1);

  return new Promise((resolve, reject) => {
    pdfParser.on('pdfParser_dataError', (errData: any) => {
      reject(new Error(errData?.parserError?.message || 'pdf2json parse error'));
    });

    pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
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
 * Groups text items by Y position (same line), then sorts by X position
 * and inserts tabs when there's a significant horizontal gap.
 */
function extractPageTextFromPdf2Json(page: any): string {
  if (!page?.Texts || !Array.isArray(page.Texts)) return '';

  // pdf2json text items: { x, y, w, R: [{ T: "base64text", S: styleIdx }] }
  // The T values are URI-encoded (not base64 despite the name in some docs)
  const items: { str: string; x: number; y: number; w: number }[] = [];

  for (const text of page.Texts) {
    if (!text.R || !Array.isArray(text.R)) continue;
    let combinedStr = '';
    for (const run of text.R) {
      if (run.T !== undefined && run.T !== null) {
        // pdf2json encodes text with encodeURIComponent
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

  // Group items into lines by Y position (within tolerance)
  const LINE_TOLERANCE = 1.5; // pdf2json uses smaller units than pdfjs-dist
  const lines: { y: number; items: typeof items }[] = [];

  for (const item of items) {
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

  // Sort lines by Y position (ascending — pdf2json Y is top-down)
  lines.sort((a, b) => a.y - b.y);

  // For each line, sort items by X position and join with tabs
  const MIN_GAP_FOR_TAB = 3; // smaller gap threshold for pdf2json coordinates
  const pageLines: string[] = [];

  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x);

    let lineText = '';
    let lastX = -Infinity;
    let lastWidth = 0;

    for (const item of line.items) {
      const gap = item.x - (lastX + lastWidth);
      if (lastX > -Infinity && gap > MIN_GAP_FOR_TAB) {
        lineText += '\t';
      } else if (lastX > -Infinity && gap > 0) {
        lineText += ' ';
      }
      lineText += item.str;
      lastX = item.x;
      lastWidth = item.w;
    }

    pageLines.push(lineText);
  }

  return pageLines.join('\n');
}

// ============================================================================
// Method 2: pdfjs-dist with position-aware extraction
// ============================================================================

/**
 * Configure pdfjs-dist worker for the current environment.
 * - On Vercel serverless: With serverExternalPackages in next.config.ts,
 *   pdfjs-dist is NOT bundled, so the fake worker's dynamic import
 *   should resolve correctly from node_modules.
 * - As a safety net, we also try require.resolve and path construction.
 */
async function configurePdfjsWorker(pdfjs: any): void {
  // If workerSrc is already set, don't override
  if (pdfjs.GlobalWorkerOptions.workerSrc) return;

  // Try to find the worker module path
  try {
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    const workerPath = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = workerPath;
    console.log('pdfjs worker path set via require.resolve:', workerPath);
    return;
  } catch (e: any) {
    console.warn('require.resolve for pdfjs worker failed:', e?.message);
  }

  try {
    const possiblePaths = [
      path.join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'),
      path.join(process.cwd(), '.next/standalone/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'),
    ];
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        pdfjs.GlobalWorkerOptions.workerSrc = p;
        console.log('pdfjs worker path set via file search:', p);
        return;
      }
    }
  } catch (e: any) {
    console.warn('File search for pdfjs worker failed:', e?.message);
  }

  // If we can't find the worker, leave workerSrc empty.
  // With serverExternalPackages in next.config.ts, the fake worker's
  // dynamic import should resolve correctly from node_modules.
  console.log('pdfjs worker path not explicitly set — relying on fake worker auto-detection');
}

/**
 * Extract text using pdfjs-dist directly with position-aware text extraction.
 * This produces tab-separated text that preserves table structure, which is
 * critical for parsing RKAS/BKU tables.
 */
async function extractTextWithPdfjsDist(buffer: Buffer): Promise<{
  text: string;
  numpages: number;
  info: Record<string, unknown>;
  perPageText: { page: number; text: string }[];
}> {
  // Ensure polyfills are applied before importing pdfjs-dist
  applyDOMPolyfills();
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

  // Configure worker
  await configurePdfjsWorker(pdfjs);

  const uint8 = new Uint8Array(buffer);
  const loadingTask = pdfjs.getDocument({
    data: uint8,
    verbosity: 0,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  });

  const doc = await loadingTask.promise;
  const perPageText: { page: number; text: string }[] = [];
  let fullText = '';

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1 });

    // Position-aware text extraction: group items by Y position (same line),
    // then sort by X position and join with tabs when there's significant gap
    const items = textContent.items
      .filter((item: any) => item.str !== undefined && item.str !== '')
      .map((item: any) => ({
        str: item.str,
        x: item.transform[4],     // X position
        y: item.transform[5],     // Y position (PDF Y-axis is bottom-up)
        width: item.width || 0,
        height: item.height || 0,
        fontName: item.fontName || '',
      }));

    // Group items into lines by Y position (within tolerance)
    const LINE_TOLERANCE = 2; // pixels tolerance for same line
    const lines: { y: number; items: typeof items }[] = [];

    for (const item of items) {
      // Find existing line within tolerance
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

    // Sort lines by Y position (descending because PDF Y-axis is bottom-up)
    lines.sort((a, b) => b.y - a.y);

    // For each line, sort items by X position and join with tabs
    const MIN_GAP_FOR_TAB = 8; // minimum gap in pixels to insert a tab
    const pageLines: string[] = [];

    for (const line of lines) {
      line.items.sort((a, b) => a.x - b.x);

      let lineText = '';
      let lastX = -Infinity;
      let lastWidth = 0;

      for (const item of line.items) {
        const gap = item.x - (lastX + lastWidth);
        if (lastX > -Infinity && gap > MIN_GAP_FOR_TAB) {
          lineText += '\t';
        } else if (lastX > -Infinity && gap > 0) {
          lineText += ' ';
        }
        lineText += item.str;
        lastX = item.x;
        lastWidth = item.width;
      }

      pageLines.push(lineText);
    }

    const pageText = pageLines.join('\n');
    perPageText.push({ page: pageNum, text: pageText });
    fullText += pageText + '\n';
    page.cleanup();
  }

  // Get document metadata
  let info: Record<string, unknown> = {};
  try {
    const metadata = await doc.getMetadata();
    if (metadata?.info) info = metadata.info as Record<string, unknown>;
  } catch {
    // Metadata not available, continue
  }

  try { doc.destroy(); } catch {}

  return {
    text: fullText.trim(),
    numpages: perPageText.length,
    info,
    perPageText,
  };
}

// ============================================================================
// Method 3: pdfjs-dist simple extraction (no position-aware grouping)
// ============================================================================

/**
 * Fallback: Simple pdfjs-dist extraction without position-aware grouping.
 * This is the simplest possible extraction - just concatenate all text items
 * per page in order. Useful as a last resort when position-aware extraction fails.
 */
async function extractTextWithPdfjsSimple(buffer: Buffer): Promise<{
  text: string;
  numpages: number;
  info: Record<string, unknown>;
  perPageText: { page: number; text: string }[];
}> {
  // Ensure polyfills are applied before importing pdfjs-dist
  applyDOMPolyfills();
  let pdfjs: any;
  try {
    pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  } catch {
    try {
      pdfjs = await import('pdfjs-dist/build/pdf.mjs');
    } catch {
      throw new Error('Cannot import pdfjs-dist from any path');
    }
  }

  // Configure worker (same as main method)
  await configurePdfjsWorker(pdfjs);

  const uint8 = new Uint8Array(buffer);
  const loadingTask = pdfjs.getDocument({
    data: uint8,
    verbosity: 0,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  });

  const doc = await loadingTask.promise;
  const perPageText: { page: number; text: string }[] = [];
  let fullText = '';

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .filter((item: any) => item.str !== undefined && item.str !== '')
      .map((item: any) => item.str)
      .join(' ');
    perPageText.push({ page: pageNum, text: pageText });
    fullText += pageText + '\n';
    page.cleanup();
  }

  let info: Record<string, unknown> = {};
  try {
    const metadata = await doc.getMetadata();
    if (metadata?.info) info = metadata.info as Record<string, unknown>;
  } catch {}

  try { doc.destroy(); } catch {}

  return {
    text: fullText.trim(),
    numpages: perPageText.length,
    info,
    perPageText,
  };
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
  if (isServerless()) {
    const info = await processPDF(fileName);
    return info.extractedText;
  }
  const info = await processPDF(fileName);
  return info.extractedText;
}
