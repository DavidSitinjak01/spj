import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { isServerless } from '@/lib/serverless';
import { processPDF, processPDFBuffer, getPDFFiles, uploadToBlob, deleteFromBlob, getBlobInfo } from '@/lib/pdf-processor';
import { applyDOMPolyfills } from '@/lib/dom-polyfill';
import type { BKUPajakMonth } from '@/lib/types';
import { MONTH_ORDER } from '@/lib/types';
import { parseBKUPajakFromText } from '@/lib/services/pdf-parser';
import { saveBKUPajakToDB, getAllBKUPajakFromDB, deleteBKUPajakFromDB } from '@/lib/services/db-service';

const UPLOAD_DIR = path.join(process.cwd(), 'upload');
const CACHE_DIR = path.join(process.cwd(), '.pdf-cache');
if (!isServerless()) {
  try { if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true }); } catch (err) { console.error('Failed to create cache directory:', err); }
}

// --- Helpers ---
function isBKUPajakFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return lower.endsWith('.pdf') && (lower.includes('pajak') || lower.includes('bku-pajak'));
}

function getCacheKey(fileName: string): string {
  return path.join(CACHE_DIR, `${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}.bku-pajak.json`);
}

function getFileModTime(fileName: string): number {
  if (isServerless()) return 0;
  try { return fs.statSync(path.join(UPLOAD_DIR, fileName)).mtimeMs; } catch { return 0; }
}

function sortMonths(months: BKUPajakMonth[]): BKUPajakMonth[] {
  return months.sort((a, b) => {
    if (a.tahun !== b.tahun) return a.tahun.localeCompare(b.tahun);
    const ma = MONTH_ORDER.indexOf(a.bulan);
    const mb = MONTH_ORDER.indexOf(b.bulan);
    return (ma === -1 ? 99 : ma) - (mb === -1 ? 99 : mb);
  });
}

// --- Simplified Python script for local mode: just extract text (shared parser does the rest) ---
const PYTHON_SCRIPT = `
import pdfplumber
import json
import sys

pdf = pdfplumber.open(sys.argv[1])
all_text = []
for page in pdf.pages:
    text = page.extract_text() or ""
    all_text.append(text)
print(json.dumps({"text": "\\n".join(all_text)}, ensure_ascii=False))
`;

// --- Parse single BKU Pajak file (dual-mode) ---
async function parseBKUPajakFile(fileName: string, buffer?: Buffer): Promise<BKUPajakMonth | null> {
  if (isServerless()) {
    // Serverless: pdf2json extracts text → shared parser
    try {
      let info;
      if (buffer) {
        info = await processPDFBuffer(fileName, buffer);
      } else {
        const blobInfo = await getBlobInfo(fileName);
        if (!blobInfo) return null;
        info = await processPDF(fileName);
      }
      const fullText = info.extractedText.map(p => p.text).join('\n');
      return parseBKUPajakFromText(fullText, fileName);
    } catch (err) {
      console.error(`Failed to parse BKU Pajak ${fileName} (serverless):`, err);
      return null;
    }
  }

  // Local: Python text extraction → shared parser (with cache)
  const filePath = path.join(UPLOAD_DIR, fileName);
  if (!fs.existsSync(filePath)) return null;

  // Check cache
  const cachePath = getCacheKey(fileName);
  const fileModTime = getFileModTime(fileName);
  try {
    if (fs.existsSync(cachePath)) {
      const cached = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      if (cached.fileModifiedAt === fileModTime && cached.data) {
        return cached.data;
      }
    }
  } catch (err) { console.error(`Failed to read cache for ${fileName}:`, err); }

  // Extract text via Python
  let text: string;
  try {
    const escapedScript = PYTHON_SCRIPT.replace(/'/g, "'\\''");
    const resultStr = execSync(`python3 -c '${escapedScript}' "${filePath}"`, {
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024,
      timeout: 60000,
    });
    const result = JSON.parse(resultStr.trim());
    text = result.text || '';
  } catch (err) {
    console.error(`Failed to extract text from BKU Pajak ${fileName}:`, err);
    return null;
  }

  // Parse with shared parser
  const data = parseBKUPajakFromText(text, fileName);

  // Save to cache
  try {
    fs.writeFileSync(cachePath, JSON.stringify({ data, fileModifiedAt: fileModTime, cachedAt: Date.now() }));
  } catch (err) { console.error(`Failed to write cache for ${fileName}:`, err); }

  return data;
}

// --- API Handlers ---

// GET: List all BKU Pajak files and their parsed data
// OPTIMIZED: Trust the DB — don't re-parse PDFs from Blob on every request.
// Data is saved to DB on upload (POST), so GET just reads from DB.
export async function GET() {
  try {
    const dbMonths = await getAllBKUPajakFromDB();
    return NextResponse.json({ months: sortMonths(dbMonths), files: dbMonths.map(m => m.fileName) });
  } catch (error: any) {
    console.error('BKU Pajak list error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Import a new BKU Pajak file
export async function POST(request: Request) {
  applyDOMPolyfills();
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    if (!file.name.endsWith('.pdf')) return NextResponse.json({ error: 'Only PDF files allowed' }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (isServerless()) {
      // Serverless: upload to blob + parse directly from buffer
      await uploadToBlob(file.name, buffer);
      const data = await parseBKUPajakFile(file.name, buffer);
      if (!data) return NextResponse.json({ error: 'Failed to parse BKU Pajak' }, { status: 500 });

      const { replaced } = await saveBKUPajakToDB(data);
      return NextResponse.json({ success: true, data, replaced });
    }

    // Local: save to upload dir + process
    const filePath = path.join(UPLOAD_DIR, file.name);
    await writeFileLocal(filePath, buffer);

    const data = await parseBKUPajakFile(file.name);
    if (!data) return NextResponse.json({ error: 'Failed to parse BKU Pajak' }, { status: 500 });

    const { replaced } = await saveBKUPajakToDB(data);
    return NextResponse.json({ success: true, data, replaced });
  } catch (error: any) {
    console.error('BKU Pajak upload error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Remove a BKU Pajak file and its cache
export async function DELETE(request: Request) {
  applyDOMPolyfills();
  try {
    const body = await request.json();
    const { fileName } = body;
    if (!fileName) return NextResponse.json({ error: 'fileName is required' }, { status: 400 });

    // Always delete DB record
    await deleteBKUPajakFromDB(fileName);

    if (isServerless()) {
      // Serverless: delete from blob
      await deleteFromBlob(fileName);
      return NextResponse.json({ success: true });
    }

    // Local: delete from upload dir + cache
    const filePath = path.join(UPLOAD_DIR, fileName);
    const cachePath = getCacheKey(fileName);

    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    if (fs.existsSync(cachePath)) fs.unlinkSync(cachePath);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('BKU Pajak delete error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function writeFileLocal(filePath: string, buffer: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.writeFile(filePath, buffer, (err) => err ? reject(err) : resolve());
  });
}
