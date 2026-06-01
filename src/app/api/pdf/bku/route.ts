import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { isServerless } from '@/lib/serverless';
import { processPDF, getPDFFiles, uploadToBlob, deleteFromBlob, getBlobInfo } from '@/lib/pdf-processor';

const UPLOAD_DIR = path.join(process.cwd(), 'upload');
const CACHE_DIR = path.join(process.cwd(), '.pdf-cache');
if (!isServerless()) {
  try { if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true }); } catch {}
}

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
  if (isServerless()) return 0;
  try { return fs.statSync(path.join(UPLOAD_DIR, fileName)).mtimeMs; } catch { return 0; }
}

function parseAmount(s: string | null | undefined): number {
  if (!s) return 0;
  return parseInt(s.replace(/\./g, '').replace(/,/g, '').trim()) || 0;
}

// --- Serverless: Parse BKU from extracted text using regex ---
function parseBKUFromText(text: string, fileName: string): BKUMonth | null {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // --- Extract header info ---
  const headerInfo: Record<string, string> = {};

  for (const line of lines) {
    // Bulan
    const bulanMatch = line.match(/BULAN\s*:\s*(\w+)/i);
    if (bulanMatch) headerInfo.bulan = bulanMatch[1];

    // Tahun
    const tahunMatch = line.match(/TAHUN\s*:\s*(\d{4})/i);
    if (tahunMatch) headerInfo.tahun = tahunMatch[1];

    // "BULAN : Januari 2026" pattern
    const bulanTahun = line.match(/BULAN\s*:\s*(\w+)\s+(\d{4})/i);
    if (bulanTahun) {
      headerInfo.bulan = bulanTahun[1];
      headerInfo.tahun = bulanTahun[2];
    }

    // Sumber Dana
    if (line.includes('Sumber Dana')) {
      const sdMatch = line.match(/Sumber Dana\s*:?\s*(.+)/i);
      if (sdMatch) {
        const val = sdMatch[1].trim();
        if (val && val !== ':' && !val.includes('No.') && !val.includes('Kode')) {
          headerInfo.sumberDana = val;
        }
      }
    }

    // Nama Sekolah
    const sekolahMatch = line.match(/Nama Sekolah\s*:\s*(.+)/i);
    if (sekolahMatch) headerInfo.namaSekolah = sekolahMatch[1].trim();

    // NPSN
    const npsnMatch = line.match(/NPSN\s*:\s*(\d+)/i);
    if (npsnMatch && !headerInfo.npsn) headerInfo.npsn = npsnMatch[1];
  }

  // If tahun not found, try generic
  if (!headerInfo.tahun) {
    const tahunM = text.match(/:\s*(\d{4})/);
    if (tahunM) headerInfo.tahun = tahunM[1];
  }

  // --- Extract closing balance info from last page text ---
  const saldoMatch = text.match(/Saldo Buku Kas Umum\s*:?\s*Rp\.?\s*([\d.]+)/i);
  if (saldoMatch) headerInfo.saldoAkhir = saldoMatch[1].replace(/\./g, '');

  const bankMatch = text.match(/Saldo Bank\s*:?\s*Rp\.?\s*([\d.]+)/i);
  if (bankMatch) headerInfo.saldoAkhirBank = bankMatch[1].replace(/\./g, '');

  const tunaiMatch = text.match(/Saldo Kas Tunai\s*:?\s*Rp\.?\s*([\d.]+)/i);
  if (tunaiMatch) headerInfo.saldoAkhirTunai = tunaiMatch[1].replace(/\./g, '');

  const tanggalMatch = text.match(/(\d{1,2}\s+\w+\s+\d{4})/);
  if (tanggalMatch) headerInfo.tanggalTutup = tanggalMatch[1];

  // --- Extract transaction rows ---
  // BKU rows typically: TANGGAL  KODE_KEGIATAN  KODE_REKENING  NO_BUKTI  URAIAN  PENERIMAAN  PENGELUARAN  SALDO
  // Try to match lines that start with a date-like pattern
  const transactions: BKUTransaction[] = [];
  let totalPenerimaan = 0;
  let totalPengeluaran = 0;
  let lastSaldo = 0;

  // Date patterns: DD/MM/YYYY, DD-MM-YYYY, DD/MM, DD-MM, or just a number day
  const datePattern = /^(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?|\d{1,2})\s+/;

  for (const line of lines) {
    // Skip header rows
    const upperLine = line.toUpperCase();
    if (upperLine.startsWith('TANGGAL') || upperLine.startsWith('HALAMAN') || upperLine.startsWith('BULAN') || upperLine.startsWith('TAHUN')) continue;
    if (upperLine.includes('KODE KEGIATAN') || upperLine.includes('KODE REKENING') || upperLine.includes('NO BUKTI')) continue;
    if (upperLine.includes('Saldo Buku') || upperLine.includes('Saldo Bank') || upperLine.includes('Saldo Kas')) continue;

    // Try to match data rows with date pattern
    if (!datePattern.test(line)) continue;

    // Try to parse the row - split by multiple spaces
    const parts = line.split(/\s{2,}|\t/).filter(Boolean);
    if (parts.length < 5) continue;

    // Skip "Jumlah" total row
    if (parts[0].trim().toUpperCase() === 'JUMLAH') continue;

    const tanggal = parts[0]?.trim() || '';
    const kodeKegiatan = parts[1]?.trim() || '';
    const kodeRekening = parts[2]?.trim() || '';
    const noBukti = parts[3]?.trim() || '';
    const uraian = parts[4]?.trim() || '';

    // Last 3 parts should be penerimaan, pengeluaran, saldo
    const penerimaan = parseAmount(parts[parts.length - 3]);
    const pengeluaran = parseAmount(parts[parts.length - 2]);
    const saldo = parseAmount(parts[parts.length - 1]);

    // Only add if there's meaningful data
    if (penerimaan > 0 || pengeluaran > 0 || saldo > 0 || uraian) {
      transactions.push({
        tanggal,
        kodeKegiatan,
        kodeRekening,
        noBukti,
        uraian,
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
    bulan: headerInfo.bulan || '',
    tahun: headerInfo.tahun || '',
    sumberDana: headerInfo.sumberDana || '',
    namaSekolah: headerInfo.namaSekolah || '',
    npsn: headerInfo.npsn || '',
    transactions,
    totalPenerimaan,
    totalPengeluaran,
    saldoAkhir: parseInt(headerInfo.saldoAkhir) || lastSaldo,
    saldoAkhirBank: parseInt(headerInfo.saldoAkhirBank) || 0,
    saldoAkhirTunai: parseInt(headerInfo.saldoAkhirTunai) || 0,
    tanggalTutup: headerInfo.tanggalTutup || '',
  };

  return bkuMonth;
}

// --- Parse single BKU file (dual-mode) ---
async function parseBKUFile(fileName: string): Promise<BKUMonth | null> {
  if (isServerless()) {
    // Serverless: download from blob + parse with pdf-parse + regex
    const blobInfo = await getBlobInfo(fileName);
    if (!blobInfo) return null;

    try {
      const info = await processPDF(fileName);
      const fullText = info.extractedText.map(p => p.text).join('\n');
      return parseBKUFromText(fullText, fileName);
    } catch (err) {
      console.error(`Failed to parse BKU ${fileName} (serverless):`, err);
      return null;
    }
  }

  // Local: existing Python approach
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

function isBKUFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return lower.endsWith('.pdf') && lower.includes('bku') && !lower.includes('pajak');
}

// GET: List all BKU files and their parsed data
export async function GET() {
  try {
    const monthOrder = ['JANUARI','FEBRUARI','MARET','APRIL','MEI','JUNI','JULI','AGUSTUS','SEPTEMBER','OKTOBER','NOVEMBER','DESEMBER'];

    if (isServerless()) {
      // Serverless: list from blob, process each with pdf-parse
      const allFiles = await getPDFFiles();
      const files = allFiles.filter(f => isBKUFile(f)).sort();

      const months: BKUMonth[] = [];
      for (const file of files) {
        try {
          const data = await parseBKUFile(file);
          if (data) months.push(data);
        } catch (err) {
          console.error(`Error parsing BKU file ${file}:`, err);
        }
      }

      // Sort by month order
      months.sort((a, b) => {
        if (a.tahun !== b.tahun) return a.tahun.localeCompare(b.tahun);
        return monthOrder.indexOf(a.bulan) - monthOrder.indexOf(b.bulan);
      });

      // Deduplicate in memory (can't delete from blob easily during GET)
      const seen = new Map<string, BKUMonth>();
      for (const m of months) {
        const key = `${m.bulan}_${m.tahun}`;
        if (!seen.has(key)) {
          seen.set(key, m);
        }
      }
      const dedupedMonths = Array.from(seen.values());

      return NextResponse.json({ months: dedupedMonths, files });
    }

    // Local: read from upload dir
    if (!fs.existsSync(UPLOAD_DIR)) {
      return NextResponse.json({ months: [], files: [] });
    }

    const files = fs.readdirSync(UPLOAD_DIR)
      .filter(f => isBKUFile(f))
      .sort();

    const months: BKUMonth[] = [];
    for (const file of files) {
      const data = await parseBKUFile(file);
      if (data) months.push(data);
    }

    // Sort by month order
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

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (isServerless()) {
      // Serverless: upload to blob + parse
      await uploadToBlob(file.name, buffer);
      const data = await parseBKUFile(file.name);
      if (!data) return NextResponse.json({ error: 'Failed to parse BKU' }, { status: 500 });

      // Deduplicate: delete other blob BKU files with the same bulan+tahun
      let replacedFile: string | null = null;
      if (data.bulan && data.tahun) {
        const existingFiles = (await getPDFFiles()).filter(f => isBKUFile(f) && f !== file.name);
        for (const existing of existingFiles) {
          try {
            const existingData = await parseBKUFile(existing);
            if (existingData && existingData.bulan === data.bulan && existingData.tahun === data.tahun) {
              replacedFile = existing;
              await deleteFromBlob(existing);
            }
          } catch {}
        }
      }

      return NextResponse.json({ success: true, data, replaced: replacedFile });
    }

    // Local: save to upload dir + process with Python
    const filePath = path.join(UPLOAD_DIR, file.name);
    await writeFileLocal(filePath, buffer);

    const data = await parseBKUFile(file.name);
    if (!data) return NextResponse.json({ error: 'Failed to parse BKU' }, { status: 500 });

    // Deduplicate: remove other BKU files with the same bulan+tahun
    let replacedFile: string | null = null;
    if (data.bulan && data.tahun) {
      const existingFiles = fs.readdirSync(UPLOAD_DIR)
        .filter(f => isBKUFile(f) && f !== file.name);
      for (const existing of existingFiles) {
        const existingData = await parseBKUFile(existing);
        if (existingData && existingData.bulan === data.bulan && existingData.tahun === data.tahun) {
          replacedFile = existing;
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

    return NextResponse.json({ success: true, data, replaced: replacedFile });
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
    console.error('BKU delete error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function writeFileLocal(filePath: string, buffer: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.writeFile(filePath, buffer, (err) => err ? reject(err) : resolve());
  });
}
