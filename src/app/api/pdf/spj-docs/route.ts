import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { isServerless } from '@/lib/serverless';
import { uploadToBlob, deleteFromBlob, getBlobInfo, downloadFromBlob } from '@/lib/pdf-processor';

const UPLOAD_DIR = path.join(process.cwd(), 'upload', 'spj-docs');
const CACHE_FILE = path.join(process.cwd(), '.pdf-cache', 'spj-docs.json');
const SPJ_DOCS_BLOB_PREFIX = 'spj-docs/';
const SPJ_DOCS_META_BLOB_KEY = 'spj-docs/metadata.json';

if (!isServerless()) {
  try { if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true }); } catch {}
  try { if (!fs.existsSync(path.dirname(CACHE_FILE))) fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true }); } catch {}
}

// --- Types ---
export type SPJDocType = 'surat-pesanan' | 'surat-balasan' | 'bast' | 'dokumen-perencanaan' | 'surat-hasil-pemeriksaan';

export interface SPJDocument {
  id: string;
  type: SPJDocType;
  fileName: string;
  originalName: string;
  itemKey: string;
  kodeRekening: string;
  kodeProgram: string;
  uraian: string;
  bulan: string;
  tahun: string;
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

// --- Local mode: file-based metadata ---
function loadDocsLocal(): SPJDocument[] {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    }
  } catch {}
  return [];
}

function saveDocsLocal(docs: SPJDocument[]) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(docs, null, 2), 'utf-8');
}

// --- Serverless mode: blob-based metadata ---
async function loadDocsServerless(): Promise<SPJDocument[]> {
  try {
    const metaInfo = await getBlobInfo(SPJ_DOCS_META_BLOB_KEY);
    if (!metaInfo) return [];
    const buffer = await downloadFromBlob(metaInfo.url);
    return JSON.parse(buffer.toString('utf-8'));
  } catch {
    return [];
  }
}

async function saveDocsServerless(docs: SPJDocument[]) {
  try {
    const buffer = Buffer.from(JSON.stringify(docs, null, 2), 'utf-8');
    await uploadToBlob(SPJ_DOCS_META_BLOB_KEY, buffer);
  } catch (err) {
    console.error('Failed to save SPJ docs metadata to blob:', err);
  }
}

// --- Unified load/save ---
async function loadDocs(): Promise<SPJDocument[]> {
  return isServerless() ? await loadDocsServerless() : loadDocsLocal();
}

async function saveDocs(docs: SPJDocument[]) {
  if (isServerless()) {
    await saveDocsServerless(docs);
  } else {
    saveDocsLocal(docs);
  }
}

function generateId(): string {
  return `spj-doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

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
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as SPJDocType | null;
    const bulan = searchParams.get('bulan');
    const tahun = searchParams.get('tahun');
    const itemKey = searchParams.get('itemKey');

    let docs = await loadDocs();

    // Filter
    if (type) docs = docs.filter(d => d.type === type);
    if (bulan) docs = docs.filter(d => d.bulan === bulan);
    if (tahun) docs = docs.filter(d => d.tahun === tahun);
    if (itemKey) docs = docs.filter(d => d.itemKey === itemKey);

    // Sort by date (newest first)
    docs.sort((a, b) => new Date(b.tanggalUpload).getTime() - new Date(a.tanggalUpload).getTime());

    // Build completeness map from ALL docs (not filtered)
    const allDocs = await loadDocs();
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

    // Save file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (isServerless()) {
      // Serverless: upload to blob
      const blobFileName = `${SPJ_DOCS_BLOB_PREFIX}${safeName}`;
      await uploadToBlob(blobFileName, buffer);
    } else {
      // Local: save to upload dir
      const filePath = path.join(UPLOAD_DIR, safeName);
      fs.writeFileSync(filePath, buffer);
    }

    // Check for duplicate (same type + itemKey) — one doc per type per item
    const docs = await loadDocs();
    const duplicateIdx = docs.findIndex(d => d.type === type && d.itemKey === itemKey);

    let replaced = false;
    if (duplicateIdx >= 0) {
      // Delete old file
      const oldDoc = docs[duplicateIdx];
      if (isServerless()) {
        try { await deleteFromBlob(`${SPJ_DOCS_BLOB_PREFIX}${oldDoc.fileName}`); } catch {}
      } else {
        const oldPath = path.join(UPLOAD_DIR, oldDoc.fileName);
        if (fs.existsSync(oldPath)) {
          try { fs.unlinkSync(oldPath); } catch {}
        }
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

    await saveDocs(docs);

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
  try {
    const body = await request.json();
    const { id, fileName } = body;

    const docs = await loadDocs();
    const idx = docs.findIndex(d => d.id === id || d.fileName === fileName);
    if (idx < 0) {
      return NextResponse.json({ error: 'Dokumen tidak ditemukan' }, { status: 404 });
    }

    const doc = docs[idx];

    // Delete file
    if (isServerless()) {
      try { await deleteFromBlob(`${SPJ_DOCS_BLOB_PREFIX}${doc.fileName}`); } catch {}
    } else {
      const filePath = path.join(UPLOAD_DIR, doc.fileName);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch {}
      }
    }

    docs.splice(idx, 1);
    await saveDocs(docs);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('SPJ docs DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
