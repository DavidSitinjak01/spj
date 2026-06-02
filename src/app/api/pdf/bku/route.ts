import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { isServerless } from '@/lib/serverless';
import { processPDF, processPDFBuffer, getPDFFiles, uploadToBlob, deleteFromBlob, getBlobInfo } from '@/lib/pdf-processor';
import { applyDOMPolyfills } from '@/lib/dom-polyfill';
import type { BKUMonth, BKUTransaction } from '@/lib/types';
import { MONTH_ORDER } from '@/lib/types';
import { parseBKUFromText } from '@/lib/services/pdf-parser';
import { saveBKUToDB, getAllBKUFromDB, deleteBKUFromDB } from '@/lib/services/db-service';

const UPLOAD_DIR = path.join(process.cwd(), 'upload');
const CACHE_DIR = path.join(process.cwd(), '.pdf-cache');
if (!isServerless()) {
  try { if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true }); } catch (err) { console.error('Failed to create cache directory:', err); }
}

// --- Cache helpers (local mode only) ---

function getCacheKey(fileName: string): string {
  return path.join(CACHE_DIR, `${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}.bku.json`);
}

function getFileModTime(fileName: string): number {
  if (isServerless()) return 0;
  try { return fs.statSync(path.join(UPLOAD_DIR, fileName)).mtimeMs; } catch { return 0; }
}

// --- Local helper for Python fallback row parsing ---
function parseAmount(s: string | null | undefined): number {
  if (!s) return 0;
  return parseInt(s.replace(/\./g, '').replace(/,/g, '').trim()) || 0;
}

// --- Parse single BKU file (dual-mode) ---
async function parseBKUFile(fileName: string, buffer?: Buffer): Promise<BKUMonth | null> {
  if (isServerless()) {
    // Serverless: parse with pdfjs-dist + shared text parser
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
      return parseBKUFromText(fullText, fileName);
    } catch (err) {
      console.error(`Failed to parse BKU ${fileName} (serverless):`, err);
      return null;
    }
  }

  // Local: Python pdfplumber approach with caching
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
  } catch (err) {
    console.error(`Failed to read cache for ${fileName}:`, err);
  }

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
  } catch (err) {
    console.error(`Failed to write cache for ${fileName}:`, err);
  }

  return bkuMonth;
}

function isBKUFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return lower.endsWith('.pdf') && lower.includes('bku') && !lower.includes('pajak');
}

function writeFileLocal(filePath: string, buffer: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.writeFile(filePath, buffer, (err) => err ? reject(err) : resolve());
  });
}

// GET: List all BKU files and their parsed data
export async function GET() {
  applyDOMPolyfills();
  try {
    if (isServerless()) {
      const allFiles = await getPDFFiles();
      const files = allFiles.filter(f => isBKUFile(f)).sort();

      // Try DB first - bulk fetch
      const dbMonths = await getAllBKUFromDB();
      const dbMap = new Map(dbMonths.map(m => [m.fileName, m]));

      const months: BKUMonth[] = [];
      const parseErrors: string[] = [];
      for (const file of files) {
        const dbRecord = dbMap.get(file);
        if (dbRecord) {
          months.push(dbRecord);
          continue;
        }
        // No DB record - parse from blob
        try {
          const data = await parseBKUFile(file);
          if (data) {
            months.push(data);
            try {
              await saveBKUToDB(data);
            } catch (dbErr: any) {
              console.error(`Failed to cache BKU ${file} to database:`, dbErr?.message);
              parseErrors.push(`DB save failed: ${dbErr?.message}`);
            }
          } else {
            parseErrors.push(`parseBKUFile returned null for ${file}`);
          }
        } catch (err: any) {
          console.error(`Error parsing BKU file ${file}:`, err);
        }
      }

      // Sort by month order
      months.sort((a, b) => {
        if (a.tahun !== b.tahun) return a.tahun.localeCompare(b.tahun);
        return MONTH_ORDER.indexOf(a.bulan as typeof MONTH_ORDER[number]) - MONTH_ORDER.indexOf(b.bulan as typeof MONTH_ORDER[number]);
      });

      return NextResponse.json({ months, files, parseErrors: parseErrors.length > 0 ? parseErrors : undefined });
    }

    // Local: read from upload dir
    if (!fs.existsSync(UPLOAD_DIR)) {
      return NextResponse.json({ months: [], files: [] });
    }

    const files = fs.readdirSync(UPLOAD_DIR)
      .filter(f => isBKUFile(f))
      .sort();

    // Try DB first - bulk fetch
    const dbMonths = await getAllBKUFromDB();
    const dbMap = new Map(dbMonths.map(m => [m.fileName, m]));

    const months: BKUMonth[] = [];
    for (const file of files) {
      const dbRecord = dbMap.get(file);
      if (dbRecord) {
        months.push(dbRecord);
        continue;
      }
      // No DB record - parse from file
      const data = await parseBKUFile(file);
      if (data) {
        months.push(data);
        try {
          await saveBKUToDB(data);
        } catch (dbErr) {
          console.error(`Failed to cache BKU ${file} to database:`, dbErr);
        }
      }
    }

    // Sort by month order
    months.sort((a, b) => {
      if (a.tahun !== b.tahun) return a.tahun.localeCompare(b.tahun);
      return MONTH_ORDER.indexOf(a.bulan as typeof MONTH_ORDER[number]) - MONTH_ORDER.indexOf(b.bulan as typeof MONTH_ORDER[number]);
    });

    return NextResponse.json({ months, files });
  } catch (error: any) {
    console.error('BKU list error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Import a new BKU file
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
      const data = await parseBKUFile(file.name, buffer);
      if (!data) return NextResponse.json({ error: 'Failed to parse BKU' }, { status: 500 });

      let replaced = false;
      try {
        const result = await saveBKUToDB(data);
        replaced = result.replaced;
      } catch (dbErr) {
        console.error('Failed to save BKU to database:', dbErr);
      }

      return NextResponse.json({ success: true, data, replaced });
    }

    // Local: save to upload dir + process with Python
    const filePath = path.join(UPLOAD_DIR, file.name);
    await writeFileLocal(filePath, buffer);

    const data = await parseBKUFile(file.name);
    if (!data) return NextResponse.json({ error: 'Failed to parse BKU' }, { status: 500 });

    let replaced = false;
    try {
      const result = await saveBKUToDB(data);
      replaced = result.replaced;
    } catch (dbErr) {
      console.error('Failed to save BKU to database:', dbErr);
    }

    return NextResponse.json({ success: true, data, replaced });
  } catch (error: any) {
    console.error('BKU upload error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Remove a BKU file and its cache
export async function DELETE(request: Request) {
  applyDOMPolyfills();
  try {
    const body = await request.json();
    const { fileName } = body;
    if (!fileName) return NextResponse.json({ error: 'fileName is required' }, { status: 400 });

    if (isServerless()) {
      await deleteFromBlob(fileName);
      await deleteBKUFromDB(fileName);
      return NextResponse.json({ success: true });
    }

    // Local: delete from upload dir + cache
    const filePath = path.join(UPLOAD_DIR, fileName);
    const cachePath = getCacheKey(fileName);

    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    if (fs.existsSync(cachePath)) fs.unlinkSync(cachePath);

    await deleteBKUFromDB(fileName);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('BKU delete error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
