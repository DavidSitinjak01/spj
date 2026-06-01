import { NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import { processPDF } from '@/lib/pdf-processor';
import { isServerless } from '@/lib/serverless';
import fs from 'fs';
import path from 'path';

const CACHE_DIR = path.join(process.cwd(), '.pdf-cache');
if (!isServerless()) {
  try { if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true }); } catch {}
}

function getBudgetCachePath(fileName: string): string {
  return path.join(CACHE_DIR, `${fileName}.budget.json`);
}

function getFileModTime(fileName: string): number {
  if (isServerless()) return 0;
  try { return fs.statSync(path.join(process.cwd(), 'upload', fileName)).mtimeMs; } catch { return 0; }
}

export async function POST(request: Request) {
  try {
    const { fileName } = await request.json();
    if (!fileName) return NextResponse.json({ error: 'fileName is required' }, { status: 400 });

    // Check cache first (local only)
    if (!isServerless()) {
      const cachePath = getBudgetCachePath(fileName);
      const fileModTime = getFileModTime(fileName);
      try {
        if (fs.existsSync(cachePath)) {
          const cached = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
          if (cached.fileModifiedAt === fileModTime && cached.data) {
            return NextResponse.json({ data: cached.data, cached: true });
          }
        }
      } catch {}
    }

    const info = await processPDF(fileName);
    const fullText = info.extractedText
      .map(p => `--- Halaman ${p.page} ---\n${p.text}`)
      .join('\n\n');

    const zai = await ZAI.create();
    const response = await zai.chat.completions.create({
      messages: [
        {
          role: 'assistant',
          content: `Kamu adalah ahli analisis anggaran sekolah Indonesia. Berikan output dalam format JSON saja tanpa markdown code block.`
        },
        {
          role: 'user',
          content: `Analisis dokumen RKAS berikut dan ekstrak data terstruktur dalam JSON dengan format ini:

{
  "profil": {
    "namaSekolah": "", "npsn": "", "alamat": "", "kabupaten": "", "provinsi": "",
    "tahunAnggaran": "", "kepalaSekolah": "", "bendahara": "", "komiteSekolah": ""
  },
  "penerimaan": {
    "total": 0,
    "sumber": [{"nama": "", "kode": "", "jumlah": 0}]
  },
  "alokasiStandar": [
    {"kode": "", "nama": "", "jumlah": 0, "persen": 0}
  ],
  "alokasiBelanja": {"operasi": 0, "modal": 0},
  "belanjaTerbesar": [
    {"nama": "", "jumlah": 0, "kategori": ""}
  ],
  "pegawai": [
    {"nama": "", "jenis": "pendidik/tenaga kependidikan", "honor": 0}
  ],
  "pengadaan": [
    {"nama": "", "jumlah": 0, "kategori": ""}
  ],
  "sumberDanaDetail": {
    "bospRegulerOperasi": 0, "bospRegulerModal": 0,
    "bospDaerahOperasi": 0, "bospDaerahModal": 0
  }
}

Dokumen:
${fullText}

Berikan HANYA JSON tanpa penjelasan. Semua angka numerik tanpa pemisah ribuan.`
        }
      ],
      stream: false,
      thinking: { type: 'disabled' },
    });

    const reply = response.choices?.[0]?.message?.content || '{}';
    
    let budgetData;
    try {
      const jsonStr = reply.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      budgetData = JSON.parse(jsonStr);
    } catch {
      budgetData = { error: 'Failed to parse', raw: reply };
    }

    // Save to cache (local only)
    if (!isServerless()) {
      try {
        const cachePath = getBudgetCachePath(fileName);
        const fileModTime = getFileModTime(fileName);
        fs.writeFileSync(cachePath, JSON.stringify({ data: budgetData, fileModifiedAt: fileModTime, cachedAt: Date.now() }));
      } catch {}
    }

    return NextResponse.json({ data: budgetData });
  } catch (error: any) {
    console.error('Budget extract error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to extract budget data' },
      { status: 500 }
    );
  }
}
