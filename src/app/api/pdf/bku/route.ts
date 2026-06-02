import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { isServerless } from '@/lib/serverless';
import { processPDF, processPDFBuffer, getPDFFiles, uploadToBlob, deleteFromBlob, getBlobInfo } from '@/lib/pdf-processor';
import { applyDOMPolyfills } from '@/lib/dom-polyfill';
import { db } from '@/lib/db';

const UPLOAD_DIR = path.join(process.cwd(), 'upload');
const CACHE_DIR = path.join(process.cwd(), '.pdf-cache');
if (!isServerless()) {
  try { if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true }); } catch (err) { console.error('Failed to create cache directory:', err); }
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

// --- DB helper functions ---
function dbRecordToBKUMonth(record: {
  fileName: string;
  bulan: string;
  tahun: string;
  sumberDana: string;
  namaSekolah: string;
  npsn: string;
  transactions: unknown;
  totalPenerimaan: number;
  totalPengeluaran: number;
  saldoAkhir: number;
  saldoAkhirBank: number;
  saldoAkhirTunai: number;
  tanggalTutup: string;
}): BKUMonth {
  return {
    fileName: record.fileName,
    bulan: record.bulan,
    tahun: record.tahun,
    sumberDana: record.sumberDana,
    namaSekolah: record.namaSekolah,
    npsn: record.npsn,
    transactions: record.transactions as BKUTransaction[],
    totalPenerimaan: record.totalPenerimaan,
    totalPengeluaran: record.totalPengeluaran,
    saldoAkhir: record.saldoAkhir,
    saldoAkhirBank: record.saldoAkhirBank,
    saldoAkhirTunai: record.saldoAkhirTunai,
    tanggalTutup: record.tanggalTutup,
  };
}

function dbCreateFromBKUMonth(data: BKUMonth) {
  return {
    fileName: data.fileName,
    bulan: data.bulan,
    tahun: data.tahun,
    sumberDana: data.sumberDana,
    namaSekolah: data.namaSekolah,
    npsn: data.npsn,
    totalPenerimaan: data.totalPenerimaan,
    totalPengeluaran: data.totalPengeluaran,
    saldoAkhir: data.saldoAkhir,
    saldoAkhirBank: data.saldoAkhirBank,
    saldoAkhirTunai: data.saldoAkhirTunai,
    tanggalTutup: data.tanggalTutup,
    transactions: data.transactions as unknown[],
  };
}

function getCacheKey(fileName: string): string {
  return path.join(CACHE_DIR, `${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}.bku.json`);
}

function getFileModTime(fileName: string): number {
  if (isServerless()) return 0;
  try { return fs.statSync(path.join(UPLOAD_DIR, fileName)).mtimeMs; } catch (err) { console.error('Failed to get file mod time:', err); return 0; }
}

function parseAmount(s: string | null | undefined): number {
  if (!s) return 0;
  return parseInt(s.replace(/\./g, '').replace(/,/g, '').trim()) || 0;
}

// --- Serverless: Parse BKU from extracted text using regex ---
// Handles BOTH pdfplumber format (local) and pdf2json format (Vercel serverless)
// pdf2json now produces proper tab-separated columns per line (not all tokens on one line),
// so we parse tab-separated columns directly within each line.
function parseBKUFromText(text: string, fileName: string): BKUMonth | null {
  const headerInfo: Record<string, string> = {};

  // Header extraction
  const bulanMatch = text.match(/BULAN\s*:\s*(\w+)/i);
  if (bulanMatch) headerInfo.bulan = bulanMatch[1];
  const tahunMatch = text.match(/TAHUN\s*:\s*(\d{4})/i);
  if (tahunMatch) headerInfo.tahun = tahunMatch[1];
  const bulanTahun = text.match(/BULAN\s*:\s*(\w+)\s+(\d{4})/i);
  if (bulanTahun) { headerInfo.bulan = bulanTahun[1]; headerInfo.tahun = bulanTahun[2]; }

  if (text.includes('Sumber Dana')) {
    const sdMatch = text.match(/Sumber Dana\s*:?\s*([^\t\n]+)/i);
    if (sdMatch) {
      const val = sdMatch[1].trim();
      if (val && val !== ':' && !val.includes('No.') && !val.includes('Kode')) headerInfo.sumberDana = val;
    }
  }

  const sekolahMatch = text.match(/Nama Sekolah\s*:\s*([^\t\n]+)/i);
  if (sekolahMatch) {
    let val = sekolahMatch[1].trim();
    // Remove "Halaman X dari Y" that sometimes gets appended
    val = val.replace(/\s*Halaman\s+\d+\s+dari\s+\d+.*$/i, '').trim();
    headerInfo.namaSekolah = val;
  }
  const npsnMatch = text.match(/NPSN\s*:?\s*(\d+)/i);
  if (npsnMatch && !headerInfo.npsn) headerInfo.npsn = npsnMatch[1];

  if (!headerInfo.tahun) {
    const tahunM = text.match(/:\s*(\d{4})/);
    if (tahunM) headerInfo.tahun = tahunM[1];
  }

  // Closing balance
  const saldoMatch = text.match(/Saldo Buku Kas Umum\s*:?\s*Rp\.?\s*([\d.]+)/i);
  if (saldoMatch) headerInfo.saldoAkhir = saldoMatch[1].replace(/\./g, '');
  const bankMatch = text.match(/Saldo Bank\s*:?\s*Rp\.?\s*([\d.]+)/i);
  if (bankMatch) headerInfo.saldoAkhirBank = bankMatch[1].replace(/\./g, '');
  const tunaiMatch = text.match(/Saldo Kas Tunai\s*:?\s*Rp\.?\s*([\d.]+)/i);
  if (tunaiMatch) headerInfo.saldoAkhirTunai = tunaiMatch[1].replace(/\./g, '');
  const tanggalMatch = text.match(/(\d{1,2}\s+\w+\s+\d{4})/);
  if (tanggalMatch) headerInfo.tanggalTutup = tanggalMatch[1];

  // --- Extract transaction rows ---
  const transactions: BKUTransaction[] = [];
  let totalPenerimaan = 0;
  let totalPengeluaran = 0;
  let lastSaldo = 0;

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Detect format: pdf2json produces tab-separated columns with date at start
  // Also detect if text has significant tab separation (column detection mode)
  const isPdf2Json = lines.some(l => {
    const tabs = l.split('\t').filter(Boolean);
    if (tabs.length < 3) return false;
    const first = tabs[0]?.trim();
    // Match date patterns: dd-mm-yyyy, dd/mm/yyyy, or d-mm-yyyy
    return /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(first);
  }) || lines.some(l => {
    // Fallback: check for tab-separated lines with BKU-specific patterns
    const tabs = l.split('\t').filter(Boolean);
    return tabs.length >= 5 && tabs.some(t => /^(BPU|BNU|BBU)\d+$/i.test(t.trim()));
  });

  // Also treat as pdf2json if text has tabs but no clear pdfplumber format
  const hasTabs = text.includes('\t');
  const useTabParsing = isPdf2Json || (hasTabs && !lines.some(l => /^\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?\s+/.test(l) && !l.includes('\t')));

  console.log(`[BKU Parser] isPdf2Json=${isPdf2Json}, hasTabs=${hasTabs}, useTabParsing=${useTabParsing}, lines=${lines.length}`);

  if (isPdf2Json || useTabParsing) {
    // pdf2json format: tab-separated columns
    // Pattern 1 (with kode kegiatan): tanggal \t kodeKegiatan \t kodeRekening \t [splitPart] \t noBukti \t uraian \t penerimaan \t pengeluaran \t saldo
    // Pattern 2 (without kode kegiatan): tanggal \t uraian \t penerimaan \t pengeluaran \t saldo
    const dateRe = /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/;
    const kodeKegiatanRe = /^\d{2}\.\d{2}\.\d{2}\.?$/;
    const kodeRekeningRe = /^5\.\d+\.[\d.]+$/;
    const noBuktiRe = /^(BPU|BNU|BBU)\d+$/i;

    for (const line of lines) {
      const upperLine = line.toUpperCase();
      if (upperLine.startsWith('TANGGAL') || upperLine.startsWith('HALAMAN') || upperLine.startsWith('BULAN') || upperLine.startsWith('TAHUN')) continue;
      if (upperLine.includes('KODE KEGIATAN') || upperLine.includes('KODE REKENING') || upperLine.includes('NO BUKTI') || upperLine.includes('NO. BUKTI')) continue;
      if (upperLine.includes('Saldo Buku') || upperLine.includes('Saldo Bank') || upperLine.includes('Saldo Kas')) continue;
      if (upperLine.includes('KEPALA SEKOLAH') || upperLine.includes('BENDAHARA') || upperLine.includes('NIP')) continue;
      if (upperLine.includes('HALAMAN') && upperLine.includes('DARI')) continue;
      if (upperLine.includes('BUKU KAS') || upperLine.includes('MENYETUJUI')) continue;
      if (/^\d\s*$/.test(line) || /^[1-8]$/.test(line.trim())) continue; // column numbers

      const parts = line.split('\t').map(p => p.replace(/\n/g, '').trim()).filter(Boolean);
      if (parts.length < 3) continue;

      const firstPart = parts[0];

      // Skip Jumlah/total row
      if (firstPart.toUpperCase() === 'JUMLAH') continue;

      // Check if first part is a date
      if (!dateRe.test(firstPart)) continue;

      const tanggal = firstPart;
      let kodeKegiatan = '';
      let kodeRekening = '';
      let noBukti = '';
      let uraian = '';
      let penerimaan = 0;
      let pengeluaran = 0;
      let saldo = 0;

      // Determine the structure based on the second part
      let idx = 1;

      // Check if second part is kode kegiatan (xx.xx.xx.)
      if (idx < parts.length && kodeKegiatanRe.test(parts[idx])) {
        kodeKegiatan = parts[idx];
        idx++;
      }

      // Check if next part is kode rekening (5.x.x.x)
      if (idx < parts.length && kodeRekeningRe.test(parts[idx])) {
        kodeRekening = parts[idx];
        idx++;
        // Handle split kode rekening (e.g., "5.1.02.02.01.00" + "26")
        if (idx < parts.length && /^\d{2,4}$/.test(parts[idx]) && kodeRekening.endsWith('0')) {
          kodeRekening = kodeRekening + parts[idx];
          idx++;
        }
      }

      // Check if next part is no bukti (BPU/BNU/BBU + number)
      // Sometimes noBukti and uraian are in the same tab part (e.g., "BBU01 Terima Dana BOSP...")
      if (idx < parts.length) {
        const noBuktiMergedMatch = parts[idx].match(/^(BPU|BNU|BBU)(\d+)\s+(.+)$/i);
        if (noBuktiRe.test(parts[idx])) {
          noBukti = parts[idx];
          idx++;
        } else if (noBuktiMergedMatch) {
          // noBukti and uraian merged in one part
          noBukti = noBuktiMergedMatch[1] + noBuktiMergedMatch[2];
          // Replace current part with just the uraian portion
          parts[idx] = noBuktiMergedMatch[3];
          // Don't increment idx - the uraian will be picked up next
        }
      }

      // Uraian: next non-numeric part
      if (idx < parts.length && !/^[\d.\s]+$/.test(parts[idx])) {
        uraian = parts[idx];
        idx++;
      }

      // Remaining parts should be amounts (penerimaan, pengeluaran, saldo)
      // Amounts may be space-separated within a single tab part (e.g., "0  0")
      // Flatten: split each part by whitespace, then parse all numbers
      const rawAmountStrings = parts.slice(idx).filter(p => p.trim());
      const allAmounts: number[] = [];
      for (const rawPart of rawAmountStrings) {
        // Split by whitespace and try to parse each as a number
        const subParts = rawPart.trim().split(/\s+/);
        for (const sp of subParts) {
          const val = parseAmount(sp);
          if (val > 0 || sp.trim() === '0') {
            allAmounts.push(val);
          }
        }
      }

      // Map amounts to penerimaan, pengeluaran, saldo
      if (allAmounts.length >= 3) {
        penerimaan = allAmounts[0];
        pengeluaran = allAmounts[1];
        saldo = allAmounts[2];
      } else if (allAmounts.length === 2) {
        pengeluaran = allAmounts[0];
        saldo = allAmounts[1];
      } else if (allAmounts.length === 1) {
        saldo = allAmounts[0];
      }

      if (penerimaan > 0 || pengeluaran > 0 || saldo > 0 || uraian) {
        transactions.push({ tanggal, kodeKegiatan, kodeRekening, noBukti, uraian, penerimaan, pengeluaran, saldo });
        totalPenerimaan += penerimaan;
        totalPengeluaran += pengeluaran;
        lastSaldo = saldo;
      }
    }
  } else {
    // pdfplumber format: each row is a separate line, columns separated by spaces/tabs
    const datePattern = /^(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?|\d{1,2})\s+/;

    for (const line of lines) {
      const upperLine = line.toUpperCase();
      if (upperLine.startsWith('TANGGAL') || upperLine.startsWith('HALAMAN') || upperLine.startsWith('BULAN') || upperLine.startsWith('TAHUN')) continue;
      if (upperLine.includes('KODE KEGIATAN') || upperLine.includes('KODE REKENING') || upperLine.includes('NO BUKTI')) continue;
      if (upperLine.includes('Saldo Buku') || upperLine.includes('Saldo Bank') || upperLine.includes('Saldo Kas')) continue;
      if (!datePattern.test(line)) continue;

      const parts = line.split(/\s{2,}|\t/).filter(Boolean);
      if (parts.length < 5) continue;
      if (parts[0].trim().toUpperCase() === 'JUMLAH') continue;

      const tanggal = parts[0]?.trim() || '';
      const kodeKegiatan = parts[1]?.trim() || '';
      const kodeRekening = parts[2]?.trim() || '';
      const noBukti = parts[3]?.trim() || '';
      const uraian = parts[4]?.trim() || '';
      const penerimaan = parseAmount(parts[parts.length - 3]);
      const pengeluaran = parseAmount(parts[parts.length - 2]);
      const saldo = parseAmount(parts[parts.length - 1]);

      if (penerimaan > 0 || pengeluaran > 0 || saldo > 0 || uraian) {
        transactions.push({ tanggal, kodeKegiatan, kodeRekening, noBukti, uraian, penerimaan, pengeluaran, saldo });
        totalPenerimaan += penerimaan;
        totalPengeluaran += pengeluaran;
        lastSaldo = saldo;
      }
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

  console.log(`[BKU Parser] Parsed ${fileName}: ${transactions.length} transactions, bulan=${headerInfo.bulan}, tahun=${headerInfo.tahun}, namaSekolah=${headerInfo.namaSekolah}`);

  return bkuMonth;
}

// --- Parse single BKU file (dual-mode) ---
async function parseBKUFile(fileName: string, buffer?: Buffer): Promise<BKUMonth | null> {
  if (isServerless()) {
    // Serverless: parse with pdfjs-dist + regex
    // If buffer is provided (e.g., right after upload), use it directly
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

// GET: List all BKU files and their parsed data
export async function GET() {
  applyDOMPolyfills();
  try {
    const monthOrder = ['JANUARI','FEBRUARI','MARET','APRIL','MEI','JUNI','JULI','AGUSTUS','SEPTEMBER','OKTOBER','NOVEMBER','DESEMBER'];

    if (isServerless()) {
      // Serverless: list from blob, check DB first, only re-parse if no DB record
      const allFiles = await getPDFFiles();
      const files = allFiles.filter(f => isBKUFile(f)).sort();

      const months: BKUMonth[] = [];
      for (const file of files) {
        try {
          // Try DB first
          const dbRecord = await db.bKUMonthDB.findUnique({ where: { fileName: file } });
          if (dbRecord) {
            months.push(dbRecordToBKUMonth(dbRecord));
            continue;
          }
          // No DB record - parse from blob
          const data = await parseBKUFile(file);
          if (data) {
            months.push(data);
            // Save to DB for future requests
            try {
              await db.bKUMonthDB.upsert({
                where: { fileName: file },
                create: dbCreateFromBKUMonth(data),
                update: dbCreateFromBKUMonth(data),
              });
            } catch (dbErr) {
              console.error(`Failed to cache BKU ${file} to database:`, dbErr);
            }
          }
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
      // Try DB first
      try {
        const dbRecord = await db.bKUMonthDB.findUnique({ where: { fileName: file } });
        if (dbRecord) {
          months.push(dbRecordToBKUMonth(dbRecord));
          continue;
        }
      } catch (dbErr) {
        console.error(`Failed to read BKU ${file} from database:`, dbErr);
      }
      // No DB record - parse from file
      const data = await parseBKUFile(file);
      if (data) {
        months.push(data);
        // Save to DB for future requests
        try {
          await db.bKUMonthDB.upsert({
            where: { fileName: file },
            create: dbCreateFromBKUMonth(data),
            update: dbCreateFromBKUMonth(data),
          });
        } catch (dbErr) {
          console.error(`Failed to cache BKU ${file} to database:`, dbErr);
        }
      }
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
    // Clean up duplicate files from disk + DB
    for (const fn of toDelete) {
      const oldPath = path.join(UPLOAD_DIR, fn);
      const oldCache = getCacheKey(fn);
      try { fs.unlinkSync(oldPath); } catch (err) { console.error(`Failed to delete file ${fn}:`, err); }
      try { fs.unlinkSync(oldCache); } catch (err) { console.error(`Failed to delete cache ${fn}:`, err); }
      try { await db.bKUMonthDB.delete({ where: { fileName: fn } }); } catch (dbErr) { console.error(`Failed to delete BKU ${fn} from database:`, dbErr); }
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

      // Save to database
      try {
        await db.bKUMonthDB.upsert({
          where: { fileName: file.name },
          create: dbCreateFromBKUMonth(data),
          update: dbCreateFromBKUMonth(data),
        });
      } catch (dbErr) {
        console.error('Failed to save BKU to database:', dbErr);
      }

      // Deduplicate: delete other blob BKU files with the same bulan+tahun
      let replacedFile: string | null = null;
      if (data.bulan && data.tahun) {
        const existingFiles = (await getPDFFiles()).filter(f => isBKUFile(f) && f !== file.name);
        for (const existing of existingFiles) {
          try {
            // Try DB first to check month/year
            const existingDbRecord = await db.bKUMonthDB.findUnique({ where: { fileName: existing } });
            let matches = false;
            if (existingDbRecord) {
              matches = existingDbRecord.bulan === data.bulan && existingDbRecord.tahun === data.tahun;
            } else {
              const existingData = await parseBKUFile(existing);
              if (existingData && existingData.bulan === data.bulan && existingData.tahun === data.tahun) {
                matches = true;
              }
            }
            if (matches) {
              replacedFile = existing;
              await deleteFromBlob(existing);
              // Delete DB record for replaced file
              try {
                await db.bKUMonthDB.delete({ where: { fileName: existing } });
              } catch (dbErr) {
                console.error(`Failed to delete replaced BKU ${existing} from database:`, dbErr);
              }
            }
          } catch (err) {
            console.error(`Error checking existing BKU file ${existing}:`, err);
          }
        }
      }

      return NextResponse.json({ success: true, data, replaced: replacedFile });
    }

    // Local: save to upload dir + process with Python
    const filePath = path.join(UPLOAD_DIR, file.name);
    await writeFileLocal(filePath, buffer);

    const data = await parseBKUFile(file.name);
    if (!data) return NextResponse.json({ error: 'Failed to parse BKU' }, { status: 500 });

    // Save to database
    try {
      await db.bKUMonthDB.upsert({
        where: { fileName: file.name },
        create: dbCreateFromBKUMonth(data),
        update: dbCreateFromBKUMonth(data),
      });
    } catch (dbErr) {
      console.error('Failed to save BKU to database:', dbErr);
    }

    // Deduplicate: remove other BKU files with the same bulan+tahun
    let replacedFile: string | null = null;
    if (data.bulan && data.tahun) {
      const existingFiles = fs.readdirSync(UPLOAD_DIR)
        .filter(f => isBKUFile(f) && f !== file.name);
      for (const existing of existingFiles) {
        // Try DB first to check month/year
        let matches = false;
        try {
          const existingDbRecord = await db.bKUMonthDB.findUnique({ where: { fileName: existing } });
          if (existingDbRecord) {
            matches = existingDbRecord.bulan === data.bulan && existingDbRecord.tahun === data.tahun;
          }
        } catch (dbErr) {
          console.error(`Failed to check DB for existing BKU ${existing}:`, dbErr);
        }
        if (!matches) {
          const existingData = await parseBKUFile(existing);
          if (existingData && existingData.bulan === data.bulan && existingData.tahun === data.tahun) {
            matches = true;
          }
        }
        if (matches) {
          replacedFile = existing;
          // Delete the old file and its cache
          const oldPath = path.join(UPLOAD_DIR, existing);
          const oldCache = getCacheKey(existing);
          try { fs.unlinkSync(oldPath); } catch (err) { console.error(`Failed to delete file ${existing}:`, err); }
          try { fs.unlinkSync(oldCache); } catch (err) { console.error(`Failed to delete cache ${existing}:`, err); }
          // Delete DB record for replaced file
          try { await db.bKUMonthDB.delete({ where: { fileName: existing } }); } catch (dbErr) { console.error(`Failed to delete replaced BKU ${existing} from database:`, dbErr); }
        }
      }
      // Invalidate cache for new file since we need fresh parse
      const newCache = getCacheKey(file.name);
      try { fs.unlinkSync(newCache); } catch (err) { console.error(`Failed to delete cache for ${file.name}:`, err); }
    }

    return NextResponse.json({ success: true, data, replaced: replacedFile });
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
      // Serverless: delete from blob
      await deleteFromBlob(fileName);
      // Delete from database
      try {
        await db.bKUMonthDB.delete({ where: { fileName } });
      } catch (dbErr) {
        console.error(`Failed to delete BKU ${fileName} from database:`, dbErr);
      }
      return NextResponse.json({ success: true });
    }

    // Local: delete from upload dir + cache
    const filePath = path.join(UPLOAD_DIR, fileName);
    const cachePath = getCacheKey(fileName);

    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    if (fs.existsSync(cachePath)) fs.unlinkSync(cachePath);

    // Delete from database
    try {
      await db.bKUMonthDB.delete({ where: { fileName } });
    } catch (dbErr) {
      console.error(`Failed to delete BKU ${fileName} from database:`, dbErr);
    }

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
