import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { isServerless, serverlessErrorResponse } from '@/lib/serverless';

const UPLOAD_DIR = path.join(process.cwd(), 'upload', 'spj-docs');
const CACHE_FILE = path.join(process.cwd(), '.pdf-cache', 'spj-docs.json');

try { if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true }); } catch {}
try { if (!fs.existsSync(path.dirname(CACHE_FILE))) fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true }); } catch {}

// --- Types ---
export type SPJDocType = 'surat-pesanan' | 'surat-balasan' | 'bast' | 'dokumen-perencanaan' | 'surat-hasil-pemeriksaan';

// Each document is linked to a specific spending item (from RKAS+BKU matching)
export interface SPJDocument {
  id: string;
  type: SPJDocType;
  fileName: string;
  originalName: string;
  // Link to spending item
  itemKey: string;        // compositeKey: normalizeKode(kodeProgram)|normalizeKode(kodeRekening)
  kodeRekening: string;
  kodeProgram: string;
  uraian: string;          // description of the spending item
  // Period
  bulan: string;
  tahun: string;
  // Metadata
  deskripsi: string;
  tanggalUpload: string;
  fileSize: number;
}

const DOC_TYPE_LABELS: Record<SPJDocType, string> = {
  'surat-pesanan': 'Surat Pesanan',
  'surat-balasan': 'Surat Balasan Toko',
  'bast': 'BAST',
  'dokumen-perencanaan': 'Dokumen Perencanaan',
  'surat-hasil-pemeriksaan': 'Surat Hasil Pemeriksaan',
};

const ALL_DOC_TYPES = Object.keys(DOC_TYPE_LABELS) as SPJDocType[];

function loadDocs(): SPJDocument[] {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    }
  } catch {}
  return [];
}

function saveDocs(docs: SPJDocument[]) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(docs, null, 2), 'utf-8');
}

function generateId(): string {
  return `spj-doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Build completeness map: itemKey -> { docType: doc }
function buildCompletenessMap(docs: SPJDocument[]): Record<string, Record<SPJDocType, SPJDocument | null>> {
  const map: Record<string, Record<SPJDocType, SPJDocument | null>> = {};
  for (const doc of docs) {
    if (!map[doc.itemKey]) {
      map[doc.itemKey] = {
        'surat-pesanan': null, 'surat-balasan': null, 'bast': null,
        'dokumen-perencanaan': null, 'surat-hasil-pemeriksaan': null,
      };
    }
    map[doc.itemKey][doc.type] = doc;
  }
  return map;
}

// --- GET: List all SPJ documents with completeness info ---
export async function GET(request: Request) {
  if (isServerless()) {
    return serverlessErrorResponse('SPJ Dokumen');
  }
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as SPJDocType | null;
    const bulan = searchParams.get('bulan');
    const tahun = searchParams.get('tahun');
    const itemKey = searchParams.get('itemKey');

    let docs = loadDocs();

    // Filter
    if (type) docs = docs.filter(d => d.type === type);
    if (bulan) docs = docs.filter(d => d.bulan === bulan);
    if (tahun) docs = docs.filter(d => d.tahun === tahun);
    if (itemKey) docs = docs.filter(d => d.itemKey === itemKey);

    // Sort by date (newest first)
    docs.sort((a, b) => new Date(b.tanggalUpload).getTime() - new Date(a.tanggalUpload).getTime());

    // Build completeness map from ALL docs (not filtered)
    const allDocs = loadDocs();
    const completenessMap = buildCompletenessMap(allDocs);

    // Summary per type
    const summary: Record<string, { count: number; totalSize: number; itemKeys: string[] }> = {};
    for (const dt of ALL_DOC_TYPES) {
      const typeDocs = allDocs.filter(d => d.type === dt);
      summary[dt] = {
        count: typeDocs.length,
        totalSize: typeDocs.reduce((s, d) => s + d.fileSize, 0),
        itemKeys: [...new Set(typeDocs.map(d => d.itemKey))],
      };
    }

    // Count items with complete vs incomplete docs
    const totalItems = Object.keys(completenessMap).length;
    const completeItems = Object.values(completenessMap).filter(
      itemDocs => ALL_DOC_TYPES.every(dt => itemDocs[dt] !== null)
    ).length;

    return NextResponse.json({
      docs,
      summary,
      completenessMap,
      typeLabels: DOC_TYPE_LABELS,
      stats: { totalItems, completeItems, incompleteItems: totalItems - completeItems },
    });
  } catch (error: any) {
    console.error('SPJ docs GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// --- POST: Upload SPJ document linked to a spending item ---
export async function POST(request: Request) {
  if (isServerless()) {
    return serverlessErrorResponse('SPJ Dokumen');
  }
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as SPJDocType;
    const bulan = (formData.get('bulan') as string) || '';
    const tahun = (formData.get('tahun') as string) || '';
    const deskripsi = (formData.get('deskripsi') as string) || '';
    const itemKey = (formData.get('itemKey') as string) || '';
    const kodeRekening = (formData.get('kodeRekening') as string) || '';
    const kodeProgram = (formData.get('kodeProgram') as string) || '';
    const uraian = (formData.get('uraian') as string) || '';

    if (!file) {
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 });
    }
    if (!type || !DOC_TYPE_LABELS[type]) {
      return NextResponse.json({ error: 'Tipe dokumen tidak valid' }, { status: 400 });
    }
    if (!itemKey) {
      return NextResponse.json({ error: 'Item key diperlukan (pilih pos belanja)' }, { status: 400 });
    }

    // Generate unique filename
    const id = generateId();
    const ext = path.extname(file.name) || '.pdf';
    const safeName = `${id}${ext}`;
    const filePath = path.join(UPLOAD_DIR, safeName);

    // Save file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    fs.writeFileSync(filePath, buffer);

    // Check for duplicate (same type + itemKey) — one doc per type per item
    const docs = loadDocs();
    const duplicateIdx = docs.findIndex(d => d.type === type && d.itemKey === itemKey);

    let replaced = false;
    if (duplicateIdx >= 0) {
      // Delete old file
      const oldDoc = docs[duplicateIdx];
      const oldPath = path.join(UPLOAD_DIR, oldDoc.fileName);
      if (fs.existsSync(oldPath)) {
        try { fs.unlinkSync(oldPath); } catch {}
      }
      // Replace with new
      docs[duplicateIdx] = {
        ...oldDoc,
        fileName: safeName,
        originalName: file.name,
        deskripsi: deskripsi || oldDoc.deskripsi,
        tanggalUpload: new Date().toISOString(),
        fileSize: file.size,
        bulan: bulan || oldDoc.bulan,
        tahun: tahun || oldDoc.tahun,
      };
      replaced = true;
    } else {
      // Add new document
      docs.push({
        id,
        type,
        fileName: safeName,
        originalName: file.name,
        itemKey,
        kodeRekening,
        kodeProgram,
        uraian,
        bulan,
        tahun,
        deskripsi,
        tanggalUpload: new Date().toISOString(),
        fileSize: file.size,
      });
    }

    saveDocs(docs);

    return NextResponse.json({
      success: true,
      replaced,
      doc: replaced ? docs[duplicateIdx] : docs[docs.length - 1],
    });
  } catch (error: any) {
    console.error('SPJ docs POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// --- DELETE: Remove SPJ document ---
export async function DELETE(request: Request) {
  if (isServerless()) {
    return serverlessErrorResponse('SPJ Dokumen');
  }
  try {
    const body = await request.json();
    const { id, fileName } = body;

    const docs = loadDocs();
    const idx = docs.findIndex(d => d.id === id || d.fileName === fileName);
    if (idx < 0) {
      return NextResponse.json({ error: 'Dokumen tidak ditemukan' }, { status: 404 });
    }

    const doc = docs[idx];

    // Delete file
    const filePath = path.join(UPLOAD_DIR, doc.fileName);
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch {}
    }

    docs.splice(idx, 1);
    saveDocs(docs);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('SPJ docs DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
