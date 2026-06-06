import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { isServerless } from '@/lib/serverless';
import { processPDF, processPDFBuffer, getPDFFiles, uploadToBlob, getBlobInfo, deleteFromBlob } from '@/lib/pdf-processor';
import { applyDOMPolyfills } from '@/lib/dom-polyfill';
import type { RKASItem, RKASStandar, RKASPenerimaanItem, RKASMonth } from '@/lib/types';
import { MONTH_ORDER, STANDAR_MAP } from '@/lib/types';
import { parseRKASFromText } from '@/lib/services/pdf-parser';
import { saveRKASToDB, getRKASFromDB, getAllRKASFromDB, deleteRKASFromDB } from '@/lib/services/db-service';

const UPLOAD_DIR = path.join(process.cwd(), 'upload');
const CACHE_DIR = path.join(process.cwd(), '.pdf-cache');
if (!isServerless()) {
  try { if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true }); } catch (err) { console.error('Failed to create cache dir:', err); }
}

// --- Local helpers (for Python fallback) ---
function getCacheKey(fileName: string): string {
  return path.join(CACHE_DIR, `${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}.rkas.json`);
}

function getFileModTime(fileName: string): number {
  if (isServerless()) return 0;
  try { return fs.statSync(path.join(UPLOAD_DIR, fileName)).mtimeMs; } catch (err) { console.error('Failed to stat file', fileName, ':', err); return 0; }
}

function parseAmount(s: string | null | undefined): number {
  if (!s) return 0;
  const cleaned = s.replace(/\./g, '').replace(/,/g, '').replace(/\s/g, '').trim();
  if (!cleaned || cleaned === '-') return 0;
  return parseInt(cleaned) || 0;
}

function isRKASFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return lower.endsWith('.pdf') && !lower.includes('bku') && !lower.includes('pajak');
}

function extractStandarCode(kodeProgram: string): string {
  if (!kodeProgram) return '';
  const cleaned = kodeProgram.replace(/\s/g, '');
  const match = cleaned.match(/^(\d{2})\./);
  return match ? match[1] : '';
}

// --- Python PDF Parser (Local mode) ---
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
            if re.search(r'(NPSN|TAHUN ANGGARAN|Nama Sekolah|Alamat|Kabupaten|Provinsi|Bulan)\\s*:', stripped):
                break
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
            if 'Halaman' in line and 'dari' in line:
                continue
            if 'Kertas Kerja' in line and 'NPSN' in line:
                continue

            bulan_match = re.search(r'Bulan\\s*:\\s*(\\w+)', line)
            if bulan_match:
                header_info['bulan'] = bulan_match.group(1)
            tahun_match = re.search(r'TAHUN ANGGARAN\\s*:\\s*(\\d{4})', line)
            if tahun_match:
                header_info['tahun'] = tahun_match.group(1)
            bulan_tahun = re.search(r'Bulan\\s*:\\s*(\\w+)\\s+(\\d{4})', line)
            if bulan_tahun:
                header_info['bulan'] = bulan_tahun.group(1)
                header_info['tahun'] = bulan_tahun.group(2)
            npsn_match = re.search(r'NPSN\\s*:\\s*(\\d+)', line)
            if npsn_match and 'npsn' not in header_info:
                header_info['npsn'] = npsn_match.group(1)
            sekolah_match = re.search(r'Nama Sekolah\\s*:\\s*(.+)', line)
            if sekolah_match:
                header_info['namaSekolah'] = sekolah_match.group(1).strip()
            alamat_match = re.search(r'Alamat\\s*:\\s*(.+)', line)
            if alamat_match:
                header_info['alamat'] = alamat_match.group(1).strip()
            kab_match = re.search(r'Kabupaten\\s*:\\s*(.+)', line)
            if kab_match:
                header_info['kabupaten'] = kab_match.group(1).strip()
            prov_match = re.search(r'Provinsi\\s*:\\s*(.+)', line)
            if prov_match:
                header_info['provinsi'] = prov_match.group(1).strip()
            if 'Sumber Dana' in line and 'dan Alokasi' not in line:
                sd_match = re.search(r'Sumber Dana\\s*:?\\s*(.+)', line)
                if sd_match:
                    val = sd_match.group(1).strip()
                    if val and val != ':' and 'No.' not in val and 'Kode' not in val and 'Penerimaan' not in val:
                        header_info['sumberDana'] = val

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

        elif ('URUT' in first_row_text or 'NO' in first_row_text) and ('JUMLAH' in first_row_text):
            ncols = len(first_row)

            all_header_text = ''
            for hr in table[:3]:
                all_header_text += ' '.join([c or '' for c in hr]).upper() + ' '

            is_bulanan_table = 'RINCIAN' in all_header_text or 'VOLUME' in all_header_text or 'SATUAN' in all_header_text or 'TARIF' in all_header_text
            is_tahunan_table = 'SUMBER DANA' in all_header_text or 'ALOKASI' in all_header_text or ('OPERASI' in all_header_text and 'MODAL' in all_header_text)

            for row in table[1:]:
                r = [c or '' for c in row]

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

                if is_tahunan_table and ncols >= 10:
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
// Returns the parsed data, or null on failure.
// If throwDetails is true, throws with diagnostic info instead of returning null.
async function parseRKASFile(fileName: string, buffer?: Buffer, throwDetails?: boolean): Promise<RKASMonth | null> {
  if (isServerless()) {
    // Serverless: use shared parseRKASFromText (handles pdfjs-dist extraction)
    let diagnosticInfo: Record<string, any> = { fileName, step: 'init' };
    try {
      let info;
      diagnosticInfo.step = 'extract';
      if (buffer) {
        info = await processPDFBuffer(fileName, buffer);
      } else {
        const blobInfo = await getBlobInfo(fileName);
        if (!blobInfo) {
          console.error(`RKAS parse: blob not found for ${fileName}`);
          diagnosticInfo.error = 'blob_not_found';
          if (throwDetails) throw new Error(`Blob not found for ${fileName}`);
          return null;
        }
        info = await processPDF(fileName);
      }
      const fullText = info.extractedText.map(p => p.text).join('\n');
      diagnosticInfo.step = 'parse';
      diagnosticInfo.textLength = fullText.length;
      diagnosticInfo.pageCount = info.pageCount;
      diagnosticInfo.textPreview = fullText.substring(0, 200);
      console.log(`RKAS parse: extracted ${fullText.length} chars from ${fileName}, pages: ${info.pageCount}`);
      if (!fullText.trim()) {
        console.error(`RKAS parse: no text extracted from ${fileName}`);
        diagnosticInfo.error = 'empty_text';
        diagnosticInfo.perPageText = info.extractedText.map(p => ({ page: p.page, len: p.text.length, preview: p.text.substring(0, 50) }));
        if (throwDetails) throw new Error(`No text extracted from PDF. Pages: ${info.pageCount}, all pages empty. ${JSON.stringify(diagnosticInfo)}`);
        return null;
      }
      const result = parseRKASFromText(fullText, fileName);
      if (!result) {
        console.error(`RKAS parse: parseRKASFromText returned null for ${fileName}`);
        diagnosticInfo.error = 'parse_null';
        if (throwDetails) throw new Error(`parseRKASFromText returned null. ${JSON.stringify(diagnosticInfo)}`);
      } else if (result.allItems.length === 0) {
        console.warn(`RKAS parse: parsed ${fileName} but got 0 belanja items. Header: school=${result.namaSekolah}, npsn=${result.npsn}, penerimaan=${result.totalPenerimaan}, tipe=${result.tipe}`);
        diagnosticInfo.warning = '0_items';
        diagnosticInfo.parsedHeader = { school: result.namaSekolah, npsn: result.npsn, tipe: result.tipe, totalPenerimaan: result.totalPenerimaan };
      } else {
        console.log(`RKAS parse: successfully parsed ${fileName} - ${result.allItems.length} items, tipe=${result.tipe}`);
      }
      return result;
    } catch (err: any) {
      console.error(`Failed to parse RKAS ${fileName} (serverless):`, err?.message || err);
      diagnosticInfo.error = diagnosticInfo.error || 'exception';
      diagnosticInfo.errorMessage = err?.message || String(err);
      diagnosticInfo.errorStack = err?.stack?.substring(0, 500);
      if (throwDetails) {
        const detailedErr = new Error(`RKAS parse failed: ${err?.message || String(err)} | Diagnostic: ${JSON.stringify(diagnosticInfo)}`);
        (detailedErr as any).diagnostic = diagnosticInfo;
        throw detailedErr;
      }
      return null;
    }
  }

  // Local: Python pdfplumber approach with cache
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
  } catch (err) { console.error('Failed to read cache for', fileName, ':', err); }

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

  // Determine tipe
  const bulanValue = (header.bulan || '').toUpperCase();
  const tipeFromJudul = (header.tipeFromJudul || '') as string;
  let tipe: 'bulanan' | 'tahunan';

  if (tipeFromJudul === 'bulanan') {
    tipe = 'bulanan';
  } else if (tipeFromJudul === 'tahunan') {
    tipe = 'tahunan';
  } else {
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
  } catch (err) { console.error('Failed to write cache for', fileName, ':', err); }

  return rkasMonth;
}

// --- API Handlers ---

// GET: List all RKAS files and their parsed data
// OPTIMIZED: Trust the DB — don't re-parse PDFs from Blob on every request.
// Data is saved to DB on upload (POST), so GET just reads from DB.
export async function GET() {
  try {
    const months = await getAllRKASFromDB();

    // Sort: bulanan by month order first, then tahunan after, both by year
    months.sort((a, b) => {
      if (a.tahun !== b.tahun) return a.tahun.localeCompare(b.tahun);
      if (a.tipe !== b.tipe) return a.tipe === 'tahunan' ? 1 : -1;
      const ma = MONTH_ORDER.indexOf(a.bulan as any);
      const mb = MONTH_ORDER.indexOf(b.bulan as any);
      const ia = ma === -1 ? 99 : ma;
      const ib = mb === -1 ? 99 : mb;
      return ia - ib;
    });

    const bulanan = months.filter(m => m.tipe === 'bulanan');
    const tahunan = months.filter(m => m.tipe === 'tahunan');

    return NextResponse.json({ months, bulanan, tahunan, files: months.map(m => m.fileName) });
  } catch (error: any) {
    console.error('RKAS list error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Import a new RKAS file
export async function POST(request: Request) {
  // Apply DOM polyfills before any pdfjs-dist imports (required for Vercel serverless)
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

      // Try parsing with detailed error info
      let data: RKASMonth | null = null;
      let parseError: Record<string, any> | null = null;

      try {
        data = await parseRKASFile(file.name, buffer, true);
      } catch (err: any) {
        parseError = {
          message: err?.message || String(err),
          diagnostic: (err as any)?.diagnostic || null,
        };
        // Try once more without throwDetails to see if it returns data anyway
        try {
          data = await parseRKASFile(file.name, buffer);
        } catch (err2) { console.error('RKAS second parse attempt failed:', err2); }
      }

      if (!data) return NextResponse.json({
        error: 'Failed to parse RKAS',
        detail: parseError?.message || 'Unknown error',
        diagnostic: parseError?.diagnostic || null,
        fileName: file.name,
        fileSize: buffer.length,
        hint: 'PDF text extraction may have failed. The diagnostic info above shows which step failed.',
      }, { status: 500 });

      // Save parsed data to DB using shared service (returns { replaced })
      let replaced = false;
      try {
        const saveResult = await saveRKASToDB(data);
        replaced = saveResult.replaced;
      } catch (dbErr) {
        console.error('Failed to save RKAS to DB:', dbErr);
      }

      return NextResponse.json({ success: true, data, tipe: data.tipe, judul: data.judul, replaced });
    }

    // Local: save to upload dir + process with Python
    const filePath = path.join(UPLOAD_DIR, file.name);
    await writeFileLocal(filePath, buffer);

    const data = await parseRKASFile(file.name);
    if (!data) return NextResponse.json({ error: 'Failed to parse RKAS' }, { status: 500 });

    // Save parsed data to DB using shared service (returns { replaced })
    let replaced = false;
    try {
      const saveResult = await saveRKASToDB(data);
      replaced = saveResult.replaced;
    } catch (dbErr) {
      console.error('Failed to save RKAS to DB:', dbErr);
    }

    return NextResponse.json({ success: true, data, tipe: data.tipe, judul: data.judul, replaced });
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

    // Delete DB record using shared service
    await deleteRKASFromDB(fileName);

    if (isServerless()) {
      await deleteFromBlob(fileName);
      return NextResponse.json({ success: true });
    }

    const filePath = path.join(UPLOAD_DIR, fileName);
    const cachePath = getCacheKey(fileName);

    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    if (fs.existsSync(cachePath)) fs.unlinkSync(cachePath);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('RKAS delete error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function writeFileLocal(filePath: string, buffer: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.writeFile(filePath, buffer, (err) => err ? reject(err) : resolve());
  });
}
