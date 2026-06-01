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

async function getBlobModule() {
  const { put, head, list, del } = await import('@vercel/blob');
  return { put, head, list, del };
}

/**
 * Upload a file to Vercel Blob storage.
 */
export async function uploadToBlob(fileName: string, buffer: Buffer): Promise<{ url: string }> {
  const { put } = await getBlobModule();
  const blob = await put(`${BLOB_PREFIX}${fileName}`, buffer, {
    access: 'public',
    contentType: 'application/pdf',
  });
  return { url: blob.url };
}

/**
 * Download a file from Vercel Blob storage.
 */
export async function downloadFromBlob(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download from blob: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
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

// --- pdf-parse helper ---

async function extractTextWithPdfParse(buffer: Buffer): Promise<{
  text: string;
  numpages: number;
  info: Record<string, unknown>;
}> {
  const pdf = (await import('pdf-parse')).default;
  const data = await pdf(buffer);
  return {
    text: data.text,
    numpages: data.numpages,
    info: data.info,
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

export async function processPDF(fileName: string): Promise<PDFInfo> {
  if (isServerless()) {
    // Serverless: download from blob + pdf-parse
    const blobInfo = await getBlobInfo(fileName);
    if (!blobInfo) {
      throw new Error(`PDF file not found in blob storage: ${fileName}`);
    }

    const buffer = await downloadFromBlob(blobInfo.url);
    const parsed = await extractTextWithPdfParse(buffer);

    // pdf-parse gives us all text as one string; we split by pages heuristically
    // Since pdf-parse doesn't give per-page text easily, we put it all on "page 1"
    // For better per-page support, the API routes can re-process if needed
    const extractedText: { page: number; text: string }[] = [];

    // Try to split text by page breaks (form feed character)
    const pages = parsed.text.split('\f');
    if (pages.length > 1) {
      for (let i = 0; i < pages.length; i++) {
        if (pages[i].trim()) {
          extractedText.push({ page: i + 1, text: pages[i].trim() });
        }
      }
    }

    // If no form-feed splits, try to infer pages from numpages
    if (extractedText.length === 0 && parsed.text.trim()) {
      // If we can't split, put all text on individual pages based on numpages
      // Better approach: split by lines and distribute
      if (parsed.numpages <= 1) {
        extractedText.push({ page: 1, text: parsed.text.trim() });
      } else {
        // Put all text as page 1 with a note - downstream code can handle it
        extractedText.push({ page: 1, text: parsed.text.trim() });
      }
    }

    return {
      fileName,
      filePath: blobInfo.url,
      pageCount: parsed.numpages,
      extractedText,
    };
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
