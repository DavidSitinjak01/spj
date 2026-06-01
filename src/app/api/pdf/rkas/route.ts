import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const UPLOAD_DIR = path.join(process.cwd(), 'upload');
const CACHE_DIR = path.join(process.cwd(), '.pdf-cache');
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

// --- Interfaces ---
interface RKASItem {
  noUrut: string;
  kodeRekening: string;
  kodeProgram: string;
  uraian: string;
  volume: string;
  satuan: string;
  tarifHarga: number;
  jumlah: number;
}

interface RKASStandar {
  kode: string;
  nama: string;
  items: RKASItem[];
  total: number;
}

interface RKASPenerimaanItem {
  kode: string;
  nama: string;
  jumlah: number;
}

interface RKASMonth {
  fileName: string;
  judul: string;
  bulan: string;
  tahun: string;
  tipe: 'bulanan' | 'tahunan';
  sumberDana: string;
  namaSekolah: string;
  npsn: string;
  alamat: string;
  kabupaten: string;
  provinsi: string;
  totalPenerimaan: number;
  totalBelanja: number;
  penerimaan: RKASPenerimaanItem[];
  standarList: RKASStandar[];
  allItems: RKASItem[];
}

const MONTH_ORDER = ['JANUARI','FEBRUARI','MARET','APRIL','MEI','JUNI','JULI','AGUSTUS','SEPTEMBER','OKTOBER','NOVEMBER','DESEMBER'];

const STANDAR_MAP: Record<string, string> = {
  '02': 'Standar Isi',
  '03': 'Standar Proses',
  '04': 'Standar Tenaga Kependidikan',
  '05': 'Standar Sarana dan Prasarana',
  '06': 'Standar Pengelolaan',
  '07': 'Standar Pembiayaan',
  '08': 'Standar Penilaian Pendidikan',
};

// --- Helpers ---
function getCacheKey(fileName: string): string {
  return path.join(CACHE_DIR, `${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}.rkas.json`);
}

function getFileModTime(fileName: string): number {
  try { return fs.statSync(path.join(UPLOAD_DIR, fileName)).mtimeMs; } catch { return 0; }
}

function parseAmount(s: string | null | undefined): number {
  if (!s) return 0;
  return parseInt(s.replace(/\./g, '').replace(/,/g, '').replace(/\s/g, '').trim()) || 0;
}

function isRKASFile(fileName: string): boolean {
  return fileName.toLowerCase().endsWith('.pdf') && !fileName.toLowerCase().includes('bku');
}

// Extract the top-level standar code from kodeProgram
function extractStandarCode(kodeProgram: string): string {
  if (!kodeProgram) return '';
  const cleaned = kodeProgram.replace(/\s/g, '');
  const match = cleaned.match(/^(\d{2})\./);
  return match ? match[1] : '';
}

// --- Python PDF Parser ---
const PYTHON_SCRIPT = `
import pdfplumber
import json
import sys
import re

pdf = pdfplumber.open(sys.argv[1])
header_info = {}
penerimaan_rows = []
belanja_rows = []

for i, page in enumerate(pdf.pages):
    text = page.extract_text() or ""

    # Extract header info from first page
    if i == 0:
        lines = text.split('\\n')

        # --- Extract judul (title) from first meaningful lines ---
        judul_parts = []
        for line in lines[:5]:
            stripped = line.strip()
            if not stripped:
                continue
            # Stop at header fields (NPSN, Tahun Anggaran, etc.)
            if re.search(r'(NPSN|TAHUN ANGGARAN|Nama Sekolah|Alamat|Kabupaten|Provinsi|Bulan)\\s*:', stripped):
                break
            # Skip footer lines
            if 'Halaman' in stripped and 'dari' in stripped:
                continue
            if 'Kertas Kerja' in stripped and ('NPSN' in stripped or 'Halaman' in stripped):
                continue
            judul_parts.append(stripped)
        header_info['judul'] = ' '.join(judul_parts)

        # --- Detect tipe from judul ---
        judul_upper = header_info.get('judul', '').upper()
        if 'PERBULAN' in judul_upper or 'BULANAN' in judul_upper:
            header_info['tipeFromJudul'] = 'bulanan'
        elif 'TAHUNAN' in judul_upper or ('RKAS' in judul_upper and 'PERBULAN' not in judul_upper):
            header_info['tipeFromJudul'] = 'tahunan'
        else:
            header_info['tipeFromJudul'] = ''

        for line in lines:
            # Skip footer lines (contains "Halaman" and "Kertas Kerja")
            if 'Halaman' in line and 'dari' in line:
                continue
            if 'Kertas Kerja' in line and 'NPSN' in line:
                continue

            # Bulan
            bulan_match = re.search(r'Bulan\\s*:\\s*(\\w+)', line)
            if bulan_match:
                header_info['bulan'] = bulan_match.group(1)
            # Tahun from "TAHUN ANGGARAN"
            tahun_match = re.search(r'TAHUN ANGGARAN\\s*:\\s*(\\d{4})', line)
            if tahun_match:
                header_info['tahun'] = tahun_match.group(1)
            # Also try "Bulan : Januari 2026" pattern
            bulan_tahun = re.search(r'Bulan\\s*:\\s*(\\w+)\\s+(\\d{4})', line)
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
            # Alamat
            alamat_match = re.search(r'Alamat\\s*:\\s*(.+)', line)
            if alamat_match:
                header_info['alamat'] = alamat_match.group(1).strip()
            # Kabupaten
            kab_match = re.search(r'Kabupaten\\s*:\\s*(.+)', line)
            if kab_match:
                header_info['kabupaten'] = kab_match.group(1).strip()
            # Provinsi
            prov_match = re.search(r'Provinsi\\s*:\\s*(.+)', line)
            if prov_match:
                header_info['provinsi'] = prov_match.group(1).strip()
            # Sumber Dana
            if 'Sumber Dana' in line and 'dan Alokasi' not in line:
                sd_match = re.search(r'Sumber Dana\\s*:?\\s*(.+)', line)
                if sd_match:
                    val = sd_match.group(1).strip()
                    if val and val != ':' and 'No.' not in val and 'Kode' not in val and 'Penerimaan' not in val:
                        header_info['sumberDana'] = val

        # If tahun not found in specific pattern, try generic
        if 'tahun' not in header_info:
            tahun_m = re.search(r':\\s*(\\d{4})', text)
            if tahun_m:
                header_info['tahun'] = tahun_m.group(1)

    # Extract tables
    tables = page.extract_tables()
    for table in tables:
        if not table or len(table) < 2:
            continue

        first_row = [c or '' for c in table[0]]
        first_row_text = ' '.join(first_row).upper()

        # Detect penerimaan table (3 cols: No. Kode, Penerimaan, Jumlah)
        if len(first_row) == 3 and ('PENERIMAAN' in first_row_text or 'KODE' in first_row_text):
            for row in table[1:]:
                r = [c or '' for c in row]
                if r[0] and 'TOTAL' not in r[0].upper():
                    penerimaan_rows.append({
                        'kode': r[0].strip(),
                        'nama': r[1].strip(),
                        'jumlah': r[2].strip()
                    })
                elif 'TOTAL' in r[0].upper():
                    header_info['totalPenerimaan'] = r[2].strip().replace('.', '')

        # Detect belanja table
        elif ('URUT' in first_row_text or 'NO' in first_row_text) and ('JUMLAH' in first_row_text):
            ncols = len(first_row)

            # Determine if this is a bulanan or tahunan table from header
            all_header_text = ''
            for hr in table[:3]:
                all_header_text += ' '.join([c or '' for c in hr]).upper() + ' '

            is_bulanan_table = 'RINCIAN' in all_header_text or 'VOLUME' in all_header_text or 'SATUAN' in all_header_text or 'TARIF' in all_header_text
            is_tahunan_table = 'SUMBER DANA' in all_header_text or 'ALOKASI' in all_header_text or ('OPERASI' in all_header_text and 'MODAL' in all_header_text)

            for row in table[1:]:
                r = [c or '' for c in row]

                # Skip sub-header rows
                row_text = ' '.join(r).upper()
                if 'VOLUME' in row_text and 'SATUAN' in row_text:
                    continue
                if 'BELANJA' in row_text and 'OPERASI' in row_text:
                    continue
                if 'SUMBER DANA' in row_text and 'ALOKASI' in row_text:
                    continue
                if not any(c.strip() for c in r):
                    continue

                no_urut = r[0].strip().rstrip('.')
                if not no_urut:
                    continue
                if no_urut.upper() in ['NO', 'URUT']:
                    continue

                # Parse based on detected table type
                if is_tahunan_table and ncols >= 10:
                    # Tahunan RKAS format:
                    # Cols: No.Urut, Kode Rekening, Kode Kegiatan, Uraian Kegiatan, Jumlah, + allocation cols
                    # The "jumlah" is the 5th col (index 4)
                    # After that are BOSP REGULER (Operasi, Modal), BOSP DAERAH, etc.
                    kp = r[2].strip() if len(r) > 2 else ''
                    uraian_val = r[3].strip().replace('\\n', ' ') if len(r) > 3 else ''
                    jumlah_val = r[4].strip() if len(r) > 4 else ''

                    belanja_rows.append({
                        'noUrut': no_urut,
                        'kodeRekening': r[1].strip() if len(r) > 1 else '',
                        'kodeProgram': kp,
                        'uraian': uraian_val,
                        'volume': '',
                        'satuan': '',
                        'tarifHarga': '',
                        'jumlah': jumlah_val,
                    })

                elif is_bulanan_table and ncols >= 10:
                    # Bulanan RKAS format with Rincian Perhitungan columns
                    # kodeProgram can span 2-3 columns, last 4 are volume, satuan, tarifHarga, jumlah
                    kp_parts = []
                    uraian_idx = -1
                    for ci in range(2, ncols - 4):
                        val = r[ci] if ci < len(r) else ''
                        prev_val = first_row[ci] if ci < len(first_row) else ''
                        if prev_val.upper().strip() in ['URAIAN', 'URAIAN KEGIATAN'] or 'URAIAN' in (prev_val or '').upper():
                            uraian_idx = ci
                            break
                        if val.strip():
                            kp_parts.append(val.strip())

                    if uraian_idx == -1:
                        kp_parts = [r[ci].strip() for ci in range(2, min(5, ncols - 4)) if r[ci].strip()]
                        uraian_idx = min(5, ncols - 4)

                    kp = ' '.join(kp_parts).strip()
                    uraian = r[uraian_idx].strip().replace('\\n', ' ') if uraian_idx < len(r) else ''
                    vol_idx = ncols - 4
                    sat_idx = ncols - 3
                    tarif_idx = ncols - 2
                    jumlah_idx = ncols - 1

                    belanja_rows.append({
                        'noUrut': no_urut,
                        'kodeRekening': r[1].strip() if len(r) > 1 else '',
                        'kodeProgram': kp,
                        'uraian': uraian,
                        'volume': r[vol_idx].strip() if vol_idx < len(r) else '',
                        'satuan': r[sat_idx].strip() if sat_idx < len(r) else '',
                        'tarifHarga': r[tarif_idx].strip() if tarif_idx < len(r) else '',
                        'jumlah': r[jumlah_idx].strip() if jumlah_idx < len(r) else '',
                    })

                elif ncols == 9:
                    # 9 cols: No.Urut, Kode Rekening, Kode Program (2 cols), Uraian, Volume, Satuan, Tarif Harga, Jumlah
                    kp = (r[2].strip() + ' ' + r[3].strip()).strip()
                    belanja_rows.append({
                        'noUrut': no_urut,
                        'kodeRekening': r[1].strip() if len(r) > 1 else '',
                        'kodeProgram': kp,
                        'uraian': r[4].strip().replace('\\n', ' ') if len(r) > 4 else '',
                        'volume': r[5].strip() if len(r) > 5 else '',
                        'satuan': r[6].strip() if len(r) > 6 else '',
                        'tarifHarga': r[7].strip() if len(r) > 7 else '',
                        'jumlah': r[8].strip() if len(r) > 8 else '',
                    })

                elif ncols <= 8:
                    # Compact: No.Urut, Kode Rekening, Kode Program, Uraian, Volume, Satuan, Tarif Harga, Jumlah
                    belanja_rows.append({
                        'noUrut': no_urut,
                        'kodeRekening': r[1].strip() if len(r) > 1 else '',
                        'kodeProgram': r[2].strip() if len(r) > 2 else '',
                        'uraian': r[3].strip().replace('\\n', ' ') if len(r) > 3 else '',
                        'volume': r[4].strip() if len(r) > 4 else '',
                        'satuan': r[5].strip() if len(r) > 5 else '',
                        'tarifHarga': r[6].strip() if len(r) > 6 else '',
                        'jumlah': r[7].strip() if len(r) > 7 else '',
                    })

result = {'header': header_info, 'penerimaan': penerimaan_rows, 'belanja': belanja_rows}
print(json.dumps(result, ensure_ascii=False))
`;

// --- Parse single RKAS file ---
function parseRKASFile(fileName: string): RKASMonth | null {
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

  // Use Python to extract tables from RKAS PDF
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
    console.error(`Failed to parse RKAS ${fileName}:`, err);
    return null;
  }

  const header = result.header || {};
  const penerimaanRaw: { kode: string; nama: string; jumlah: string }[] = result.penerimaan || [];
  const belanjaRaw: {
    noUrut: string; kodeRekening: string; kodeProgram: string; uraian: string;
    volume: string; satuan: string; tarifHarga: string; jumlah: string;
  }[] = result.belanja || [];

  // Parse penerimaan
  const penerimaan: RKASPenerimaanItem[] = penerimaanRaw.map(p => ({
    kode: p.kode,
    nama: p.nama,
    jumlah: parseAmount(p.jumlah),
  }));

  const totalPenerimaan = parseAmount(header.totalPenerimaan) || penerimaan.reduce((s, p) => s + p.jumlah, 0);

  // Parse belanja items - only keep leaf items (those with kodeRekening)
  const rawItems: RKASItem[] = belanjaRaw
    .filter(r => r.kodeRekening && r.kodeRekening.trim() !== '')
    .map(r => ({
      noUrut: r.noUrut,
      kodeRekening: r.kodeRekening,
      kodeProgram: r.kodeProgram,
      uraian: r.uraian,
      volume: r.volume,
      satuan: r.satuan,
      tarifHarga: parseAmount(r.tarifHarga),
      jumlah: parseAmount(r.jumlah),
    }));

  // Filter out intermediate "rekening header" rows (subtotals)
  const allItems: RKASItem[] = [];
  for (let idx = 0; idx < rawItems.length; idx++) {
    const item = rawItems[idx];
    const next = idx + 1 < rawItems.length ? rawItems[idx + 1] : null;
    const itemStartsWithNumber = /^\d{3}[.\s]/.test(item.uraian.trim());
    const isIntermediate = !itemStartsWithNumber
      && next
      && item.kodeRekening === next.kodeRekening
      && item.kodeProgram.replace(/\s/g, '') === next.kodeProgram.replace(/\s/g, '')
      && /^\d{3}[.\s]/.test(next.uraian.trim());
    if (!isIntermediate) {
      allItems.push(item);
    }
  }

  // Group items by standar category
  const standarMap = new Map<string, RKASItem[]>();
  for (const item of allItems) {
    const standarCode = extractStandarCode(item.kodeProgram);
    if (standarCode) {
      if (!standarMap.has(standarCode)) {
        standarMap.set(standarCode, []);
      }
      standarMap.get(standarCode)!.push(item);
    }
  }

  // Build standarList in order
  const standarList: RKASStandar[] = [];
  const orderedCodes = ['02', '03', '04', '05', '06', '07', '08'];
  for (const code of orderedCodes) {
    const items = standarMap.get(code);
    if (items && items.length > 0) {
      standarList.push({
        kode: code,
        nama: STANDAR_MAP[code] || `Standar ${code}`,
        items,
        total: items.reduce((s, item) => s + item.jumlah, 0),
      });
    }
  }

  // Also add any standar codes not in the predefined list
  for (const [code, items] of standarMap) {
    if (!orderedCodes.includes(code) && items.length > 0) {
      standarList.push({
        kode: code,
        nama: STANDAR_MAP[code] || `Standar ${code}`,
        items,
        total: items.reduce((s, item) => s + item.jumlah, 0),
      });
    }
  }

  // Calculate total belanja from leaf items
  const totalBelanja = allItems.reduce((s, item) => s + item.jumlah, 0);

  // Determine tipe: use judul-based detection first, fallback to bulan field
  const bulanValue = (header.bulan || '').toUpperCase();
  const tipeFromJudul = (header.tipeFromJudul || '') as string;
  let tipe: 'bulanan' | 'tahunan';

  if (tipeFromJudul === 'bulanan') {
    tipe = 'bulanan';
  } else if (tipeFromJudul === 'tahunan') {
    tipe = 'tahunan';
  } else {
    // Fallback: if bulan exists, it's bulanan; otherwise tahunan
    tipe = bulanValue ? 'bulanan' : 'tahunan';
  }

  const judul = header.judul || (tipe === 'bulanan' ? 'Rincian Kertas Kerja Perbulan' : 'Kertas Kerja RKAS');

  const rkasMonth: RKASMonth = {
    fileName,
    judul,
    bulan: bulanValue,
    tahun: header.tahun || '',
    tipe,
    sumberDana: header.sumberDana || '',
    namaSekolah: header.namaSekolah || '',
    npsn: header.npsn || '',
    alamat: header.alamat || '',
    kabupaten: header.kabupaten || '',
    provinsi: header.provinsi || '',
    totalPenerimaan,
    totalBelanja,
    penerimaan,
    standarList,
    allItems,
  };

  // Save to cache
  try {
    fs.writeFileSync(cachePath, JSON.stringify({ data: rkasMonth, fileModifiedAt: fileModTime, cachedAt: Date.now() }));
  } catch {}

  return rkasMonth;
}

// --- API Handlers ---

// GET: List all RKAS files and their parsed data
export async function GET() {
  try {
    if (!fs.existsSync(UPLOAD_DIR)) {
      return NextResponse.json({ months: [], bulanan: [], tahunan: [], files: [] });
    }

    const files = fs.readdirSync(UPLOAD_DIR)
      .filter(f => isRKASFile(f))
      .sort();

    const months: RKASMonth[] = [];
    for (const file of files) {
      try {
        const data = parseRKASFile(file);
        if (data) months.push(data);
      } catch (err) {
        console.error(`Error parsing RKAS file ${file}:`, err);
      }
    }

    // Sort: bulanan by month order first, then tahunan after, both by year
    months.sort((a, b) => {
      if (a.tahun !== b.tahun) return a.tahun.localeCompare(b.tahun);
      if (a.tipe !== b.tipe) return a.tipe === 'tahunan' ? 1 : -1;
      const ma = MONTH_ORDER.indexOf(a.bulan);
      const mb = MONTH_ORDER.indexOf(b.bulan);
      const ia = ma === -1 ? 99 : ma;
      const ib = mb === -1 ? 99 : mb;
      return ia - ib;
    });

    // Deduplicate: bulanan by bulan+tahun, tahunan by tahun only
    const seen = new Map<string, RKASMonth>();
    const toDelete: string[] = [];
    for (const m of months) {
      const key = m.tipe === 'tahunan' ? `TAHUNAN_${m.tahun}` : `BULANAN_${m.bulan}_${m.tahun}`;
      if (seen.has(key)) {
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

    // Separate into bulanan and tahunan
    const bulanan = dedupedMonths.filter(m => m.tipe === 'bulanan');
    const tahunan = dedupedMonths.filter(m => m.tipe === 'tahunan');

    return NextResponse.json({ months: dedupedMonths, bulanan, tahunan, files });
  } catch (error: any) {
    console.error('RKAS list error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Import a new RKAS file
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

    const data = parseRKASFile(file.name);
    if (!data) return NextResponse.json({ error: 'Failed to parse RKAS' }, { status: 500 });

    // Deduplicate: remove other RKAS files with the same key
    // Bulanan: dedup by bulan+tahun, Tahunan: dedup by tahun only
    let replacedFile: string | null = null;
    const existingFiles = fs.readdirSync(UPLOAD_DIR)
      .filter(f => isRKASFile(f) && f !== file.name);
    for (const existing of existingFiles) {
      try {
        const existingData = parseRKASFile(existing);
        if (!existingData) continue;
        const isDuplicate = data.tipe === 'tahunan'
          ? existingData.tipe === 'tahunan' && existingData.tahun === data.tahun
          : existingData.tipe === 'bulanan' && existingData.bulan === data.bulan && existingData.tahun === data.tahun;
        if (isDuplicate) {
          replacedFile = existing;
          const oldPath = path.join(UPLOAD_DIR, existing);
          const oldCache = getCacheKey(existing);
          try { fs.unlinkSync(oldPath); } catch {}
          try { fs.unlinkSync(oldCache); } catch {}
        }
      } catch {}
    }
    // Invalidate cache for new file so next GET parses fresh
    const newCache = getCacheKey(file.name);
    try { fs.unlinkSync(newCache); } catch {}

    return NextResponse.json({ success: true, data, replaced: replacedFile, tipe: data.tipe, judul: data.judul });
  } catch (error: any) {
    console.error('RKAS upload error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Remove an RKAS file and its cache
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { fileName } = body;
    if (!fileName) return NextResponse.json({ error: 'fileName is required' }, { status: 400 });

    const filePath = path.join(UPLOAD_DIR, fileName);
    const cachePath = getCacheKey(fileName);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    if (fs.existsSync(cachePath)) {
      fs.unlinkSync(cachePath);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('RKAS delete error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function writeFile(filePath: string, buffer: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.writeFile(filePath, buffer, (err) => err ? reject(err) : resolve());
  });
}
