import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

const UPLOAD_DIR = path.join(process.cwd(), 'upload', 'spj-docs');
const CACHE_FILE = path.join(process.cwd(), '.pdf-cache', 'spj-docs.json');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(path.dirname(CACHE_FILE))) fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });

// --- Types ---
export type SPJDocType = 'surat-pesanan' | 'surat-balasan' | 'bast' | 'dokumen-perencanaan' | 'surat-hasil-pemeriksaan';

export interface SPJDocument {
  id: string;
  type: SPJDocType;
  fileName: string;
  originalName: string;
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

// --- GET: List all SPJ documents ---
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as SPJDocType | null;
    const bulan = searchParams.get('bulan');
    const tahun = searchParams.get('tahun');

    let docs = loadDocs();

    // Filter by type if specified
    if (type) {
      docs = docs.filter(d => d.type === type);
    }
    if (bulan) {
      docs = docs.filter(d => d.bulan === bulan);
    }
    if (tahun) {
      docs = docs.filter(d => d.tahun === tahun);
    }

    // Sort by date (newest first)
    docs.sort((a, b) => new Date(b.tanggalUpload).getTime() - new Date(a.tanggalUpload).getTime());

    // Also return summary counts per type
    const allDocs = loadDocs();
    const summary: Record<string, { count: number; totalSize: number; months: string[] }> = {};
    for (const dt of Object.keys(DOC_TYPE_LABELS) as SPJDocType[]) {
      const typeDocs = allDocs.filter(d => d.type === dt);
      const months = [...new Set(typeDocs.map(d => `${d.bulan} ${d.tahun}`))];
      summary[dt] = {
        count: typeDocs.length,
        totalSize: typeDocs.reduce((s, d) => s + d.fileSize, 0),
        months,
      };
    }

    return NextResponse.json({ docs, summary, typeLabels: DOC_TYPE_LABELS });
  } catch (error: any) {
    console.error('SPJ docs GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// --- POST: Upload new SPJ document ---
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as SPJDocType;
    const bulan = formData.get('bulan') as string || '';
    const tahun = formData.get('tahun') as string || '';
    const deskripsi = formData.get('deskripsi') as string || '';

    if (!file) {
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 });
    }
    if (!type || !DOC_TYPE_LABELS[type]) {
      return NextResponse.json({ error: 'Tipe dokumen tidak valid' }, { status: 400 });
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

    // Check for duplicate (same type + bulan + tahun)
    const docs = loadDocs();
    const duplicateIdx = docs.findIndex(d =>
      d.type === type && d.bulan === bulan && d.tahun === tahun && bulan && tahun
    );

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
      };
      replaced = true;
    } else {
      // Add new document
      docs.push({
        id,
        type,
        fileName: safeName,
        originalName: file.name,
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
