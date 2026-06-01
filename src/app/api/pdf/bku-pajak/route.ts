import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const UPLOAD_DIR = path.join(process.cwd(), 'upload');
const CACHE_DIR = path.join(process.cwd(), '.pdf-cache');
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

// --- Interfaces ---
interface BKUPajakTransaction {
  tanggal: string;
  noKode: string;
  uraian: string;
  ppn: number;
  pph21: number;
  pph23: number;
  pph4: number;
  sspd: number;
  pengeluaran: number;
  saldo: number;
  jenisTransaksi: 'Terima' | 'Setor' | 'Lainnya';
}

interface BKUPajakJenisPajak {
  kode: string;
  nama: string;
  totalPenerimaan: number;
  totalPengeluaran: number;
  jumlahTransaksi: number;
}

interface BKUPajakMonth {
  fileName: string;
  bulan: string;
  tahun: string;
  sumberDana: string;
  namaSekolah: string;
  npsn: string;
  alamat: string;
  kabupaten: string;
  provinsi: string;
  transactions: BKUPajakTransaction[];
  totalPPN: number;
  totalPPh21: number;
  totalPPh23: number;
  totalPPh4: number;
  totalSSPD: number;
  totalPenerimaan: number;
  totalPengeluaran: number;
  saldoAkhir: number;
  jenisPajak: BKUPajakJenisPajak[];
  tanggalTutup: string;
  kepalaSekolah: string;
  bendahara: string;
}

const MONTH_ORDER = ['JANUARI','FEBRUARI','MARET','APRIL','MEI','JUNI','JULI','AGUSTUS','SEPTEMBER','OKTOBER','NOVEMBER','DESEMBER'];

// --- Helpers ---
function getCacheKey(fileName: string): string {
  return path.join(CACHE_DIR, `${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}.bku-pajak.json`);
}

function getFileModTime(fileName: string): number {
  try { return fs.statSync(path.join(UPLOAD_DIR, fileName)).mtimeMs; } catch { return 0; }
}

function parseAmount(s: string | null | undefined): number {
  if (!s) return 0;
  const cleaned = s.replace(/\./g, '').replace(/,/g, '').replace(/\s/g, '').trim();
  if (!cleaned || cleaned === '-') return 0;
  return parseInt(cleaned) || 0;
}

function isBKUPajakFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return lower.endsWith('.pdf') && (lower.includes('pajak') || lower.includes('bku-pajak'));
}

// --- Python PDF Parser ---
const PYTHON_SCRIPT = `
import pdfplumber
import json
import sys
import re

pdf = pdfplumber.open(sys.argv[1])
all_rows = []
header_info = {}

for i, page in enumerate(pdf.pages):
    text = page.extract_text() or ""

    # Extract header info from first page
    if i == 0:
        lines = text.split('\\n')
        for line in lines:
            # Bulan
            bulan_match = re.search(r'BULAN\\s*:\\s*(\\w+)', line)
            if bulan_match:
                header_info['bulan'] = bulan_match.group(1)
            # Tahun
            tahun_match = re.search(r'TAHUN\\s*:\\s*(\\d{4})', line)
            if tahun_match:
                header_info['tahun'] = tahun_match.group(1)
            # Also try "BULAN : Januari 2026" pattern
            bulan_tahun = re.search(r'BULAN\\s*:\\s*(\\w+)\\s+(\\d{4})', line)
            if bulan_tahun:
                header_info['bulan'] = bulan_tahun.group(1)
                header_info['tahun'] = bulan_tahun.group(2)
            # NPSN
            npsn_match = re.search(r'NPSN\\s*:\\s*(\\d+)', line)
            if npsn_match and 'npsn' not in header_info:
                header_info['npsn'] = npsn_match.group(1)
            # Nama Sekolah
            sekolah_match = re.search(r'Nama Sekolah\\s*:\\s*(.+)', line)
            if sekolah_match:
                header_info['namaSekolah'] = sekolah_match.group(1).strip()
            # Desa/Kecamatan -> alamat
            alamat_match = re.search(r'Desa/Kecamatan\\s*:\\s*(.+)', line)
            if alamat_match:
                header_info['alamat'] = alamat_match.group(1).strip()
            # Kabupaten
            kab_match = re.search(r'Kabupaten\\s*/?\\s*Kota\\s*:\\s*(.+)', line)
            if kab_match:
                header_info['kabupaten'] = kab_match.group(1).strip()
            # Provinsi
            prov_match = re.search(r'Provinsi\\s*:\\s*(.+)', line)
            if prov_match:
                header_info['provinsi'] = prov_match.group(1).strip()
            # Sumber Dana
            if 'Sumber Dana' in line:
                sd_match = re.search(r'Sumber Dana\\s*:?\\s*(.+)', line)
                if sd_match:
                    val = sd_match.group(1).strip()
                    if val and val != ':' and 'No.' not in val and 'Kode' not in val:
                        header_info['sumberDana'] = val

        # If tahun not found in specific pattern, try generic
        if 'tahun' not in header_info:
            tahun_m = re.search(r':\\s*(\\d{4})', text)
            if tahun_m:
                header_info['tahun'] = tahun_m.group(1)

    # Extract closing info from last page
    if i == len(pdf.pages) - 1:
        # Tanggal tutup
        tanggal_match = re.search(r'(\\d{1,2}\\s+\\w+\\s+\\d{4})', text)
        if tanggal_match:
            header_info['tanggalTutup'] = tanggal_match.group(1)
        # Kepala Sekolah - usually second to last name before NIP
        lines = text.split('\\n')
        for line in lines:
            if 'Kepala Sekolah' in line:
                header_info['kepalaSekolah'] = 'Kepala Sekolah'
            if 'Bendahara' in line and 'Bendahara' not in header_info.get('kepalaSekolah', ''):
                header_info['bendahara'] = 'Bendahara'
        # Try to get actual names (line after Kepala Sekolah / Bendahara)
        for li, line in enumerate(lines):
            name_match = re.match(r'^[A-Z][a-z]+.*(?:S\\.Pd|S\\.Kom|M\\.M|M\\.Si|S\\.E|S\\.S)', line.strip())
            if name_match:
                if 'kepalaSekolah' not in header_info or header_info.get('kepalaSekolah') == 'Kepala Sekolah':
                    # Check which column based on position in page
                    if li > 0 and 'Kepala Sekolah' not in lines[li-1] and 'Bendahara' not in lines[li-1]:
                        if 'kepalaSekolahName' not in header_info:
                            header_info['kepalaSekolahName'] = line.strip()
                        elif 'bendaharaName' not in header_info:
                            header_info['bendaharaName'] = line.strip()

    # Extract tables
    tables = page.extract_tables()
    for table in tables:
        if not table or len(table) < 3:
            continue

        first_row = [c or '' for c in table[0]]
        first_row_text = ' '.join(first_row).upper()

        # BKU Pajak has 10 columns: TANGGAL, NO. KODE, URAIAN, PPN, PPh21, PPh23, PPh4, SSPD, PENGELUARAN/KREDIT, SALDO
        if len(first_row) >= 9 and ('TANGGAL' in first_row_text or 'KODE' in first_row_text):
            for row in table:
                r = [c or '' for c in row]
                row_text = ' '.join(r).strip()

                # Skip header rows (TANGGAL row, PPN/PPh sub-header row, etc.)
                if r[0].strip() == 'TANGGAL':
                    continue
                # Sub-header row: empty first cells, contains PPN/PPh headers
                if not r[0].strip() and not r[1].strip() and not r[2].strip():
                    has_tax_header = any('PPN' in (c or '').upper() or 'PPH' in (c or '').upper() for c in r)
                    if has_tax_header:
                        continue

                # Check for Jumlah/total row
                if r[0].strip() == 'Jumlah':
                    all_rows.append({
                        'type': 'total',
                        'ppn': r[3].strip(),
                        'pph21': r[4].strip() if len(r) > 4 else '0',
                        'pph23': r[5].strip() if len(r) > 5 else '0',
                        'pph4': r[6].strip() if len(r) > 6 else '0',
                        'sspd': r[7].strip() if len(r) > 7 else '0',
                        'pengeluaran': r[8].strip() if len(r) > 8 else '0',
                        'saldo': r[9].strip() if len(r) > 9 else '0',
                    })
                    continue

                # Skip empty rows
                if not r[0].strip() and not r[2].strip():
                    continue

                # Data row
                all_rows.append({
                    'type': 'data',
                    'tanggal': r[0].strip(),
                    'noKode': r[1].strip() if len(r) > 1 else '',
                    'uraian': r[2].strip().replace('\\n', ' ') if len(r) > 2 else '',
                    'ppn': r[3].strip() if len(r) > 3 else '0',
                    'pph21': r[4].strip() if len(r) > 4 else '0',
                    'pph23': r[5].strip() if len(r) > 5 else '0',
                    'pph4': r[6].strip() if len(r) > 6 else '0',
                    'sspd': r[7].strip() if len(r) > 7 else '0',
                    'pengeluaran': r[8].strip() if len(r) > 8 else '0',
                    'saldo': r[9].strip() if len(r) > 9 else '0',
                })

result = {'header': header_info, 'rows': all_rows}
print(json.dumps(result, ensure_ascii=False))
`;

// --- Parse single BKU Pajak file ---
function parseBKUPajakFile(fileName: string): BKUPajakMonth | null {
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

  // Use Python to extract tables
  let result;
  try {
    const escapedScript = PYTHON_SCRIPT.replace(/'/g, "'\\''");
    const resultStr = execSync(`python3 -c '${escapedScript}' "${filePath}"`, {
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024,
      timeout: 60000,
    });
    result = JSON.parse(resultStr.trim());
  } catch (err) {
    console.error(`Failed to parse BKU Pajak ${fileName}:`, err);
    return null;
  }

  const header = result.header || {};
  const rows = result.rows || [];

  const transactions: BKUPajakTransaction[] = [];
  let totalPPN = 0, totalPPh21 = 0, totalPPh23 = 0, totalPPh4 = 0, totalSSPD = 0;
  let totalPenerimaan = 0, totalPengeluaran = 0, saldoAkhir = 0;

  // Track jenis pajak by noKode
  const jenisPajakMap = new Map<string, { nama: string; totalPenerimaan: number; totalPengeluaran: number; jumlahTransaksi: number }>();

  for (const row of rows) {
    if (row.type === 'total') {
      totalPPN = parseAmount(row.ppn);
      totalPPh21 = parseAmount(row.pph21);
      totalPPh23 = parseAmount(row.pph23);
      totalPPh4 = parseAmount(row.pph4);
      totalSSPD = parseAmount(row.sspd);
      totalPengeluaran = parseAmount(row.pengeluaran);
      saldoAkhir = parseAmount(row.saldo);
      totalPenerimaan = totalPPN + totalPPh21 + totalPPh23 + totalPPh4 + totalSSPD;
      continue;
    }

    // Data row
    const ppn = parseAmount(row.ppn);
    const pph21 = parseAmount(row.pph21);
    const pph23 = parseAmount(row.pph23);
    const pph4 = parseAmount(row.pph4);
    const sspd = parseAmount(row.sspd);
    const pengeluaran = parseAmount(row.pengeluaran);
    const saldo = parseAmount(row.saldo);

    const uraian = row.uraian || '';
    let jenisTransaksi: 'Terima' | 'Setor' | 'Lainnya' = 'Lainnya';
    if (uraian.toLowerCase().startsWith('terima')) jenisTransaksi = 'Terima';
    else if (uraian.toLowerCase().startsWith('setor')) jenisTransaksi = 'Setor';

    const noKode = row.noKode || '';

    transactions.push({
      tanggal: row.tanggal || '',
      noKode,
      uraian,
      ppn,
      pph21,
      pph23,
      pph4,
      sspd,
      pengeluaran,
      saldo,
      jenisTransaksi,
    });

    // Aggregate by noKode
    if (noKode) {
      const existing = jenisPajakMap.get(noKode);
      if (existing) {
        existing.totalPenerimaan += ppn + pph21 + pph23 + pph4 + sspd;
        existing.totalPengeluaran += pengeluaran;
        existing.jumlahTransaksi += 1;
      } else {
        // Extract a short name from the uraian (remove "Terima PPN " / "Setor " prefix)
        let cleanNama = uraian
          .replace(/^Terima\s+(PPN\s+|PPh\s+)?/i, '')
          .replace(/^Setor\s+(PPN\s+|PPh\s+)?/i, '')
          .replace(/\s*\(.*?\)\s*/g, '')
          .trim();
        if (!cleanNama) cleanNama = uraian.trim();
        jenisPajakMap.set(noKode, {
          nama: cleanNama,
          totalPenerimaan: ppn + pph21 + pph23 + pph4 + sspd,
          totalPengeluaran: pengeluaran,
          jumlahTransaksi: 1,
        });
      }
    }
  }

  // If no total row found, compute from transactions
  if (totalPenerimaan === 0 && totalPengeluaran === 0) {
    totalPPN = transactions.reduce((s, t) => s + t.ppn, 0);
    totalPPh21 = transactions.reduce((s, t) => s + t.pph21, 0);
    totalPPh23 = transactions.reduce((s, t) => s + t.pph23, 0);
    totalPPh4 = transactions.reduce((s, t) => s + t.pph4, 0);
    totalSSPD = transactions.reduce((s, t) => s + t.sspd, 0);
    totalPenerimaan = totalPPN + totalPPh21 + totalPPh23 + totalPPh4 + totalSSPD;
    totalPengeluaran = transactions.reduce((s, t) => s + t.pengeluaran, 0);
    saldoAkhir = transactions.length > 0 ? transactions[transactions.length - 1].saldo : 0;
  }

  // Build jenisPajak list, merging same-name entries with different noKode
  const namaMap = new Map<string, BKUPajakJenisPajak>();
  for (const [kode, info] of jenisPajakMap) {
    const key = info.nama;
    const existing = namaMap.get(key);
    if (existing) {
      existing.totalPenerimaan += info.totalPenerimaan;
      existing.totalPengeluaran += info.totalPengeluaran;
      existing.jumlahTransaksi += info.jumlahTransaksi;
    } else {
      namaMap.set(key, {
        kode,
        nama: info.nama,
        totalPenerimaan: info.totalPenerimaan,
        totalPengeluaran: info.totalPengeluaran,
        jumlahTransaksi: info.jumlahTransaksi,
      });
    }
  }
  const jenisPajak = Array.from(namaMap.values()).sort((a, b) => b.totalPenerimaan - a.totalPenerimaan);

  const bkuPajakMonth: BKUPajakMonth = {
    fileName,
    bulan: (header.bulan || '').toUpperCase(),
    tahun: header.tahun || '',
    sumberDana: header.sumberDana || '',
    namaSekolah: header.namaSekolah || '',
    npsn: header.npsn || '',
    alamat: header.alamat || '',
    kabupaten: header.kabupaten || '',
    provinsi: header.provinsi || '',
    transactions,
    totalPPN,
    totalPPh21,
    totalPPh23,
    totalPPh4,
    totalSSPD,
    totalPenerimaan,
    totalPengeluaran,
    saldoAkhir,
    jenisPajak,
    tanggalTutup: header.tanggalTutup || '',
    kepalaSekolah: header.kepalaSekolahName || header.kepalaSekolah || '',
    bendahara: header.bendaharaName || header.bendahara || '',
  };

  // Save to cache
  try {
    fs.writeFileSync(cachePath, JSON.stringify({ data: bkuPajakMonth, fileModifiedAt: fileModTime, cachedAt: Date.now() }));
  } catch {}

  return bkuPajakMonth;
}

// --- API Handlers ---

// GET: List all BKU Pajak files and their parsed data
export async function GET() {
  try {
    if (!fs.existsSync(UPLOAD_DIR)) {
      return NextResponse.json({ months: [], files: [] });
    }

    const files = fs.readdirSync(UPLOAD_DIR)
      .filter(f => isBKUPajakFile(f))
      .sort();

    const months: BKUPajakMonth[] = [];
    for (const file of files) {
      try {
        const data = parseBKUPajakFile(file);
        if (data) months.push(data);
      } catch (err) {
        console.error(`Error parsing BKU Pajak file ${file}:`, err);
      }
    }

    // Sort by month order
    months.sort((a, b) => {
      if (a.tahun !== b.tahun) return a.tahun.localeCompare(b.tahun);
      const ma = MONTH_ORDER.indexOf(a.bulan);
      const mb = MONTH_ORDER.indexOf(b.bulan);
      const ia = ma === -1 ? 99 : ma;
      const ib = mb === -1 ? 99 : mb;
      return ia - ib;
    });

    return NextResponse.json({ months, files });
  } catch (error: any) {
    console.error('BKU Pajak list error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Import a new BKU Pajak file
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

    const data = parseBKUPajakFile(file.name);
    if (!data) return NextResponse.json({ error: 'Failed to parse BKU Pajak' }, { status: 500 });

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('BKU Pajak upload error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Remove a BKU Pajak file and its cache
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
    console.error('BKU Pajak delete error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function writeFile(filePath: string, buffer: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.writeFile(filePath, buffer, (err) => err ? reject(err) : resolve());
  });
}
