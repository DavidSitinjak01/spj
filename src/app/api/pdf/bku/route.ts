import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const UPLOAD_DIR = path.join(process.cwd(), 'upload');
const CACHE_DIR = path.join(process.cwd(), '.pdf-cache');
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

interface BKUTransaction {
  tanggal: string;
  kodeKegiatan: string;
  kodeRekening: string;
  noBukti: string;
  uraian: string;
  penerimaan: number;
  pengeluaran: number;
  saldo: number;
}

interface BKUMonth {
  fileName: string;
  bulan: string;
  tahun: string;
  sumberDana: string;
  namaSekolah: string;
  npsn: string;
  transactions: BKUTransaction[];
  totalPenerimaan: number;
  totalPengeluaran: number;
  saldoAkhir: number;
  saldoAkhirBank: number;
  saldoAkhirTunai: number;
  tanggalTutup: string;
}

function getCacheKey(fileName: string): string {
  return path.join(CACHE_DIR, `${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}.bku.json`);
}

function getFileModTime(fileName: string): number {
  try { return fs.statSync(path.join(UPLOAD_DIR, fileName)).mtimeMs; } catch { return 0; }
}

function parseAmount(s: string | null | undefined): number {
  if (!s) return 0;
  return parseInt(s.replace(/\./g, '').replace(/,/g, '').trim()) || 0;
}

function parseBKUFile(fileName: string): BKUMonth | null {
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
  } catch {}

  // Use Python to extract tables from BKU PDF
  const pythonScript = `
import pdfplumber
import json
import sys

pdf = pdfplumber.open(sys.argv[1])
all_rows = []
header_info = {}

for i, page in enumerate(pdf.pages):
    text = page.extract_text() or ""
    
    # Extract header info from first page
    if i == 0:
        lines = text.split('\\n')
        for line in lines:
            if 'BULAN' in line and 'TAHUN' in line:
                parts = line.split(':')
                for p in parts:
                    p = p.strip()
                    if p in ['JANUARI','FEBRUARI','MARET','APRIL','MEI','JUNI','JULI','AGUSTUS','SEPTEMBER','OKTOBER','NOVEMBER','DESEMBER']:
                        header_info['bulan'] = p
                    elif p.isdigit() and len(p) == 4:
                        header_info['tahun'] = p
                # Try regex
                import re
                bulan_match = re.search(r'BULAN\\s*:\\s*(\\w+)', line)
                tahun_match = re.search(r'TAHUN\\s*:\\s*(\\d{4})', line)
                if bulan_match:
                    header_info['bulan'] = bulan_match.group(1)
                if tahun_match:
                    header_info['tahun'] = tahun_match.group(1)
            if 'Sumber Dana' in line:
                header_info['sumberDana'] = line.split(':')[-1].strip()
            if 'Nama Sekolah' in line:
                header_info['namaSekolah'] = line.split(':')[-1].strip()
            if 'NPSN' in line and 'npsn' not in header_info:
                header_info['npsn'] = line.split(':')[-1].strip()
    
    # Extract closing balance from last page
    if i == len(pdf.pages) - 1:
        import re
        saldo_match = re.search(r'Saldo Buku Kas Umum\\s*:?\\s*Rp\\.?\\s*([\\d\\.]+)', text)
        if saldo_match:
            header_info['saldoAkhir'] = saldo_match.group(1).replace('.', '')
        bank_match = re.search(r'Saldo Bank\\s*:?\\s*Rp\\.?\\s*([\\d\\.]+)', text)
        if bank_match:
            header_info['saldoAkhirBank'] = bank_match.group(1).replace('.', '')
        tunai_match = re.search(r'Saldo Kas Tunai\\s*:?\\s*Rp\\.?\\s*([\\d\\.]+)', text)
        if tunai_match:
            header_info['saldoAkhirTunai'] = tunai_match.group(1).replace('.', '')
        tanggal_match = re.search(r'(\\d{1,2}\\s+\\w+\\s+\\d{4})', text)
        if tanggal_match:
            header_info['tanggalTutup'] = tanggal_match.group(1)
    
    tables = page.extract_tables()
    for table in tables:
        for row in table:
            if row and row[0] and row[0].strip() not in ['TANGGAL', '1', 'Jumlah', None, '']:
                # Skip header rows
                if row[0].strip() == 'TANGGAL' or row[1] and row[1].strip() == '2':
                    continue
                all_rows.append([cell or '' for cell in row])

result = {'header': header_info, 'rows': all_rows}
print(json.dumps(result, ensure_ascii=False))
`;

  let result;
  try {
    const resultStr = execSync(`python3 -c '${pythonScript.replace(/'/g, "'\\''")}' "${filePath}"`, {
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024,
      timeout: 60000,
    });
    result = JSON.parse(resultStr.trim());
  } catch (err) {
    console.error(`Failed to parse BKU ${fileName}:`, err);
    return null;
  }

  const header = result.header || {};
  const rows = result.rows || [];
  
  const transactions: BKUTransaction[] = [];
  let totalPenerimaan = 0;
  let totalPengeluaran = 0;
  let lastSaldo = 0;

  for (const row of rows) {
    const isJumlah = row[0]?.trim() === 'Jumlah';
    
    const penerimaan = parseAmount(row[5]);
    const pengeluaran = parseAmount(row[6]);
    const saldo = parseAmount(row[7]);

    if (!isJumlah) {
      transactions.push({
        tanggal: row[0]?.trim() || '',
        kodeKegiatan: row[1]?.trim() || '',
        kodeRekening: row[2]?.trim() || '',
        noBukti: row[3]?.trim() || '',
        uraian: row[4]?.trim() || '',
        penerimaan,
        pengeluaran,
        saldo,
      });
      totalPenerimaan += penerimaan;
      totalPengeluaran += pengeluaran;
      lastSaldo = saldo;
    }
  }

  const bkuMonth: BKUMonth = {
    fileName,
    bulan: header.bulan || '',
    tahun: header.tahun || '',
    sumberDana: header.sumberDana || '',
    namaSekolah: header.namaSekolah || '',
    npsn: header.npsn || '',
    transactions,
    totalPenerimaan,
    totalPengeluaran,
    saldoAkhir: parseInt(header.saldoAkhir) || lastSaldo,
    saldoAkhirBank: parseInt(header.saldoAkhirBank) || 0,
    saldoAkhirTunai: parseInt(header.saldoAkhirTunai) || 0,
    tanggalTutup: header.tanggalTutup || '',
  };

  // Save to cache
  try {
    fs.writeFileSync(cachePath, JSON.stringify({ data: bkuMonth, fileModifiedAt: fileModTime, cachedAt: Date.now() }));
  } catch {}

  return bkuMonth;
}

// GET: List all BKU files and their parsed data
export async function GET() {
  try {
    if (!fs.existsSync(UPLOAD_DIR)) {
      return NextResponse.json({ months: [], files: [] });
    }

    const files = fs.readdirSync(UPLOAD_DIR)
      .filter(f => f.toLowerCase().includes('bku') && !f.toLowerCase().includes('pajak') && f.endsWith('.pdf'))
      .sort();

    const months: BKUMonth[] = [];
    for (const file of files) {
      const data = parseBKUFile(file);
      if (data) months.push(data);
    }

    // Sort by month order
    const monthOrder = ['JANUARI','FEBRUARI','MARET','APRIL','MEI','JUNI','JULI','AGUSTUS','SEPTEMBER','OKTOBER','NOVEMBER','DESEMBER'];
    months.sort((a, b) => {
      if (a.tahun !== b.tahun) return a.tahun.localeCompare(b.tahun);
      return monthOrder.indexOf(a.bulan) - monthOrder.indexOf(b.bulan);
    });

    // Deduplicate by bulan+tahun (keep last/first, remove older duplicate files)
    const seen = new Map<string, BKUMonth>();
    const toDelete: string[] = [];
    for (const m of months) {
      const key = `${m.bulan}_${m.tahun}`;
      if (seen.has(key)) {
        // Duplicate found — keep the one already seen, mark the other for deletion
        toDelete.push(m.fileName);
      } else {
        seen.set(key, m);
      }
    }
    // Clean up duplicate files from disk
    for (const fn of toDelete) {
      const oldPath = path.join(UPLOAD_DIR, fn);
      const oldCache = getCacheKey(fn);
      try { fs.unlinkSync(oldPath); } catch {}
      try { fs.unlinkSync(oldCache); } catch {}
    }
    const dedupedMonths = Array.from(seen.values());

    return NextResponse.json({ months: dedupedMonths, files });
  } catch (error: any) {
    console.error('BKU list error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Import a new BKU file
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    if (!file.name.endsWith('.pdf')) return NextResponse.json({ error: 'Only PDF files allowed' }, { status: 400 });

    const filePath = path.join(UPLOAD_DIR, file.name);
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    const data = parseBKUFile(file.name);
    if (!data) return NextResponse.json({ error: 'Failed to parse BKU' }, { status: 500 });

    // Deduplicate: remove other BKU files with the same bulan+tahun
    if (data.bulan && data.tahun) {
      const existingFiles = fs.readdirSync(UPLOAD_DIR)
        .filter(f => f.toLowerCase().includes('bku') && !f.toLowerCase().includes('pajak') && f.endsWith('.pdf') && f !== file.name);
      for (const existing of existingFiles) {
        const existingData = parseBKUFile(existing);
        if (existingData && existingData.bulan === data.bulan && existingData.tahun === data.tahun) {
          // Delete the old file and its cache
          const oldPath = path.join(UPLOAD_DIR, existing);
          const oldCache = getCacheKey(existing);
          try { fs.unlinkSync(oldPath); } catch {}
          try { fs.unlinkSync(oldCache); } catch {}
        }
      }
      // Invalidate cache for new file since we need fresh parse
      const newCache = getCacheKey(file.name);
      try { fs.unlinkSync(newCache); } catch {}
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('BKU upload error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Remove a BKU file and its cache
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { fileName } = body;
    if (!fileName) return NextResponse.json({ error: 'fileName is required' }, { status: 400 });

    const filePath = path.join(UPLOAD_DIR, fileName);
    const cachePath = getCacheKey(fileName);

    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    if (fs.existsSync(cachePath)) fs.unlinkSync(cachePath);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('BKU delete error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function writeFile(filePath: string, buffer: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.writeFile(filePath, buffer, (err) => err ? reject(err) : resolve());
  });
}
