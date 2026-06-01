import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const UPLOAD_DIR = path.join(process.cwd(), 'upload');
const PUBLIC_PAGES_DIR = path.join(process.cwd(), 'public', 'pdf-pages');
const CACHE_DIR = path.join(process.cwd(), '.pdf-cache');

// Ensure directories exist
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(PUBLIC_PAGES_DIR)) fs.mkdirSync(PUBLIC_PAGES_DIR, { recursive: true });
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

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
  const filePath = path.join(UPLOAD_DIR, fileName);
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return 0;
  }
}

function readCache(fileName: string): CachedData | null {
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
  try {
    fs.writeFileSync(getCachePath(fileName), JSON.stringify(data));
  } catch {
    // Cache write failed, non-critical
  }
}

export function getPDFFiles(): string[] {
  if (!fs.existsSync(UPLOAD_DIR)) return [];
  return fs.readdirSync(UPLOAD_DIR).filter(f => f.endsWith('.pdf'));
}

export function processPDF(fileName: string): PDFInfo {
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

export function renderPDFPages(fileName: string): string[] {
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
  const info = processPDF(fileName);
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

export function getExtractedText(fileName: string): { page: number; text: string }[] {
  const info = processPDF(fileName);
  return info.extractedText;
}
