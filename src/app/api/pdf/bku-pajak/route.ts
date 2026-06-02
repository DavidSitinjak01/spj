import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { isServerless } from '@/lib/serverless';
import { processPDF, processPDFBuffer, getPDFFiles, uploadToBlob, deleteFromBlob, getBlobInfo } from '@/lib/pdf-processor';
import { applyDOMPolyfills } from '@/lib/dom-polyfill';

const UPLOAD_DIR = path.join(process.cwd(), 'upload');
const CACHE_DIR = path.join(process.cwd(), '.pdf-cache');
if (!isServerless()) {
  try { if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true }); } catch {}
}

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
  if (isServerless()) return 0;
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

// --- Serverless: Parse BKU Pajak from extracted text using regex ---
// Handles BOTH pdfplumber format (local) and pdf2json format (Vercel serverless)
// pdf2json produces very long lines with many tab-separated values,
// so we need to scan through a flat token array to find row boundaries.
function parseBKUPajakFromText(text: string, fileName: string): BKUPajakMonth | null {
  // --- Extract header info ---
  const headerInfo: Record<string, string> = {};

  const bulanMatch = text.match(/BULAN\s*:\s*(\w+)/i);
  if (bulanMatch) headerInfo.bulan = bulanMatch[1];
  const tahunMatch = text.match(/TAHUN\s*:\s*(\d{4})/i);
  if (tahunMatch) headerInfo.tahun = tahunMatch[1];
  const bulanTahun = text.match(/BULAN\s*:\s*(\w+)\s+(\d{4})/i);
  if (bulanTahun) { headerInfo.bulan = bulanTahun[1]; headerInfo.tahun = bulanTahun[2]; }

  const npsnMatch = text.match(/NPSN\s*:?\s*(\d+)/i);
  if (npsnMatch && !headerInfo.npsn) headerInfo.npsn = npsnMatch[1];
  const sekolahMatch = text.match(/Nama Sekolah\s*:\s*([^\t\n]+)/i);
  if (sekolahMatch) headerInfo.namaSekolah = sekolahMatch[1].trim();
  const alamatMatch = text.match(/Desa\/Kecamatan\s*:\s*([^\t\n]+)/i);
  if (alamatMatch) headerInfo.alamat = alamatMatch[1].trim();
  const kabMatch = text.match(/Kabupaten\s*\/?\s*Kota\s*:\s*([^\t\n]+)/i);
  if (kabMatch) headerInfo.kabupaten = kabMatch[1].trim();
  const provMatch = text.match(/Provinsi\s*:\s*([^\t\n]+)/i);
  if (provMatch) headerInfo.provinsi = provMatch[1].trim();

  if (text.includes('Sumber Dana')) {
    const sdMatch = text.match(/Sumber Dana\s*:?\s*([^\t\n]+)/i);
    if (sdMatch) {
      const val = sdMatch[1].trim();
      if (val && val !== ':' && !val.includes('No.') && !val.includes('Kode')) headerInfo.sumberDana = val;
    }
  }

  // Kepala Sekolah / Bendahara names
  const nameMatches = text.match(/[A-Z][a-z]+[A-Z]?[a-z]*.*?(?:S\.Pd|S\.Kom|M\.M|M\.Si|S\.E|S\.S)/g);
  if (nameMatches) {
    if (!headerInfo.kepalaSekolahName && nameMatches[0]) headerInfo.kepalaSekolahName = nameMatches[0].trim();
    if (!headerInfo.bendaharaName && nameMatches[1]) headerInfo.bendaharaName = nameMatches[1].trim();
  }

  if (!headerInfo.tahun) {
    const tahunM = text.match(/:\s*(\d{4})/);
    if (tahunM) headerInfo.tahun = tahunM[1];
  }

  const tanggalMatch = text.match(/(\d{1,2}\s+\w+\s+\d{4})/);
  if (tanggalMatch) headerInfo.tanggalTutup = tanggalMatch[1];

  // --- Extract transaction rows ---
  const transactions: BKUPajakTransaction[] = [];
  let totalPPN = 0, totalPPh21 = 0, totalPPh23 = 0, totalPPh4 = 0, totalSSPD = 0;
  let totalPenerimaan = 0, totalPengeluaran = 0, saldoAkhir = 0;
  const jenisPajakMap = new Map<string, { nama: string; totalPenerimaan: number; totalPengeluaran: number; jumlahTransaksi: number }>();

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const isPdf2Json = lines.some(l => l.split('\t').length > 20);

  if (isPdf2Json) {
    // pdf2json format: scan through ALL tab-separated tokens
    // BKU Pajak row pattern:
    //   tanggal(DD-MM-YYYY) → noKode(xx.xx.xx.) → uraian(1-3 tokens) → ppn → pph21 → pph23 → pph4 → sspd → pengeluaran → saldo
    //   Multi-line uraians have continuation tokens between uraian start and the numeric values

    const allTokens: string[] = [];
    for (const line of lines) {
      allTokens.push(...line.split('\t'));
    }

    const dateRe = /^\d{2}-\d{2}-\d{4}$/;
    const noKodeRe = /^\d{2}\.\d{2}\.\d{2}\.?$/;   // 05.08.10. or 06.05.08.
    const amountRe = /^[\s\d.]+$/;
    const isAmount = (s: string) => {
      const t = s.trim();
      return amountRe.test(t) && t.length > 0 && (t === '0' || /^\d/.test(t));
    };

    // Skip tokens that are clearly header/footer
    const skipTokens = new Set(['TANGGAL', 'NO. KODE', 'URAIAN', 'SALDO', 'JUMLAH',
      'PENERIMAAN', 'DEBIT', 'PENGELUARAN', 'KREDIT', 'PPN', 'PPh 21', 'PPh 23', 'PPh 4', 'SSPD',
      'ARAN/KREDIT', 'KODE']);

    let i = 0;
    while (i < allTokens.length) {
      const token = allTokens[i].trim();

      // Skip known non-data tokens
      if (!token || skipTokens.has(token.toUpperCase()) ||
          token.toUpperCase().startsWith('HALAMAN') || token.toUpperCase().startsWith('BKU PEMBANTU') ||
          token.toUpperCase().includes('KODE') && token.toUpperCase().includes('URAIAN') ||
          token.toUpperCase().includes('BUKU PEMBANTU') || token.toUpperCase().includes('MENYETUJUI') ||
          token.toUpperCase().includes('KEPALA SEKOLAH') || token.toUpperCase().includes('BENDAHARA') ||
          token.toUpperCase().includes('NIP') || token.toUpperCase().includes('NPSN') ||
          token.toUpperCase().includes('NAMA SEKOLAH') || token.toUpperCase().includes('SUMBER DANA') ||
          token.toUpperCase().includes('DESA') || token.toUpperCase().includes('KABUPATEN') ||
          token.toUpperCase().includes('PROVINSI') || token.toUpperCase().includes('KEC.') ||
          token.toUpperCase().includes('KAB.') || token.toUpperCase().includes('PROV.') ||
          token.includes('Halaman') || token.includes('dari') ||
          token.match(/^[1-8]$/) // column numbers 1-8
      ) {
        i++;
        continue;
      }

      // Check for Jumlah row
      if (token.toUpperCase() === 'JUMLAH') {
        // Find the next 7 amount tokens after "Jumlah"
        const jumlahAmounts: number[] = [];
        let j = i + 1;
        while (j < allTokens.length && jumlahAmounts.length < 7) {
          const t = allTokens[j].trim();
          if (isAmount(t)) {
            jumlahAmounts.push(parseAmount(t));
          }
          j++;
        }
        if (jumlahAmounts.length >= 7) {
          totalPPN = jumlahAmounts[0];
          totalPPh21 = jumlahAmounts[1];
          totalPPh23 = jumlahAmounts[2];
          totalPPh4 = jumlahAmounts[3];
          totalSSPD = jumlahAmounts[4];
          totalPengeluaran = jumlahAmounts[5];
          saldoAkhir = jumlahAmounts[6];
          totalPenerimaan = totalPPN + totalPPh21 + totalPPh23 + totalPPh4 + totalSSPD;
        }
        i = j;
        continue;
      }

      // Check if current token is a date (start of a row)
      if (dateRe.test(token)) {
        const tanggal = token;
        let noKode = '';
        let j = i + 1;

        // Next should be noKode
        if (j < allTokens.length && noKodeRe.test(allTokens[j].trim())) {
          noKode = allTokens[j].trim();
          j++;
        }

        // Uraian: collect tokens until we hit a sequence of amounts
        // BKU Pajak has 7 amount columns: ppn, pph21, pph23, pph4, sspd, pengeluaran, saldo
        const uraianParts: string[] = [];
        let ppn = 0, pph21 = 0, pph23 = 0, pph4 = 0, sspd = 0, pengeluaran = 0, saldo = 0;

        // Scan ahead looking for 7 consecutive amount-like tokens
        // Try from different starting points to handle multi-line uraians
        let foundAmounts = false;
        while (j < allTokens.length && !foundAmounts) {
          // Check if the next 7 tokens from position j look like amounts
          if (j + 6 < allTokens.length) {
            const next7 = allTokens.slice(j, j + 7).map(t => t.trim());
            const allAmounts = next7.every(t => isAmount(t));
            if (allAmounts) {
              ppn = parseAmount(next7[0]);
              pph21 = parseAmount(next7[1]);
              pph23 = parseAmount(next7[2]);
              pph4 = parseAmount(next7[3]);
              sspd = parseAmount(next7[4]);
              pengeluaran = parseAmount(next7[5]);
              saldo = parseAmount(next7[6]);
              j += 7;
              foundAmounts = true;
              break;
            }
          }
          // Also try with 6 amounts (sometimes saldo is on a separate line)
          if (j + 5 < allTokens.length && !foundAmounts) {
            const next6 = allTokens.slice(j, j + 6).map(t => t.trim());
            const allAmounts6 = next6.every(t => isAmount(t));
            if (allAmounts6) {
              ppn = parseAmount(next6[0]);
              pph21 = parseAmount(next6[1]);
              pph23 = parseAmount(next6[2]);
              pph4 = parseAmount(next6[3]);
              sspd = parseAmount(next6[4]);
              pengeluaran = parseAmount(next6[5]);
              // saldo might be the next token
              if (j + 6 < allTokens.length && isAmount(allTokens[j + 6].trim())) {
                saldo = parseAmount(allTokens[j + 6].trim());
                j += 7;
              } else {
                j += 6;
              }
              foundAmounts = true;
              break;
            }
          }
          uraianParts.push(allTokens[j].trim());
          j++;
          if (uraianParts.length > 15) break; // Safety
        }

        const uraian = uraianParts.join(' ').trim();

        let jenisTransaksi: 'Terima' | 'Setor' | 'Lainnya' = 'Lainnya';
        if (uraian.toLowerCase().startsWith('terima')) jenisTransaksi = 'Terima';
        else if (uraian.toLowerCase().startsWith('setor')) jenisTransaksi = 'Setor';

        transactions.push({
          tanggal, noKode, uraian, ppn, pph21, pph23, pph4, sspd, pengeluaran, saldo, jenisTransaksi,
        });

        // Aggregate by noKode
        if (noKode) {
          const existing = jenisPajakMap.get(noKode);
          if (existing) {
            existing.totalPenerimaan += ppn + pph21 + pph23 + pph4 + sspd;
            existing.totalPengeluaran += pengeluaran;
            existing.jumlahTransaksi += 1;
          } else {
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

        i = j;
        continue;
      }

      i++;
    }
  } else {
    // pdfplumber format: each row is a separate line
    for (const line of lines) {
      const upperLine = line.toUpperCase();
      if (upperLine.startsWith('TANGGAL') || (upperLine.includes('KODE') && upperLine.includes('URAIAN'))) continue;
      if (upperLine.includes('PPN') && upperLine.includes('PPH') && !line.match(/^\d/)) continue;
      if (upperLine.startsWith('HALAMAN')) continue;

      const parts = line.split(/\s{2,}|\t/).filter(Boolean);
      if (parts.length < 5) continue;

      if (parts[0].trim().toUpperCase() === 'JUMLAH') {
        totalPPN = parseAmount(parts[3]);
        totalPPh21 = parseAmount(parts[4]);
        totalPPh23 = parseAmount(parts[5]);
        totalPPh4 = parseAmount(parts[6]);
        totalSSPD = parseAmount(parts[7]);
        totalPengeluaran = parseAmount(parts[parts.length - 2]);
        saldoAkhir = parseAmount(parts[parts.length - 1]);
        totalPenerimaan = totalPPN + totalPPh21 + totalPPh23 + totalPPh4 + totalSSPD;
        continue;
      }

      const firstPart = parts[0].trim();
      if (!firstPart || !firstPart.match(/^\d/)) continue;

      const tanggal = firstPart;
      const noKode = parts[1]?.trim() || '';
      const uraian = parts[2]?.trim() || '';
      const ppn = parseAmount(parts[3]);
      const pph21 = parseAmount(parts[4]);
      const pph23 = parseAmount(parts[5]);
      const pph4 = parseAmount(parts[6]);
      const sspd = parseAmount(parts[7]);
      const pengeluaran = parseAmount(parts[parts.length - 2]);
      const saldo = parseAmount(parts[parts.length - 1]);

      let jenisTransaksi: 'Terima' | 'Setor' | 'Lainnya' = 'Lainnya';
      if (uraian.toLowerCase().startsWith('terima')) jenisTransaksi = 'Terima';
      else if (uraian.toLowerCase().startsWith('setor')) jenisTransaksi = 'Setor';

      transactions.push({
        tanggal, noKode, uraian, ppn, pph21, pph23, pph4, sspd, pengeluaran, saldo, jenisTransaksi,
      });

      if (noKode) {
        const existing = jenisPajakMap.get(noKode);
        if (existing) {
          existing.totalPenerimaan += ppn + pph21 + pph23 + pph4 + sspd;
          existing.totalPengeluaran += pengeluaran;
          existing.jumlahTransaksi += 1;
        } else {
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

  // Build jenisPajak list
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
    bulan: (headerInfo.bulan || '').toUpperCase(),
    tahun: headerInfo.tahun || '',
    sumberDana: headerInfo.sumberDana || '',
    namaSekolah: headerInfo.namaSekolah || '',
    npsn: headerInfo.npsn || '',
    alamat: headerInfo.alamat || '',
    kabupaten: headerInfo.kabupaten || '',
    provinsi: headerInfo.provinsi || '',
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
    tanggalTutup: headerInfo.tanggalTutup || '',
    kepalaSekolah: headerInfo.kepalaSekolahName || headerInfo.kepalaSekolah || '',
    bendahara: headerInfo.bendaharaName || headerInfo.bendahara || '',
  };

  return bkuPajakMonth;
}

// --- Python PDF Parser (Local mode) ---
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

// --- Parse single BKU Pajak file (dual-mode) ---
async function parseBKUPajakFile(fileName: string, buffer?: Buffer): Promise<BKUPajakMonth | null> {
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
      return parseBKUPajakFromText(fullText, fileName);
    } catch (err) {
      console.error(`Failed to parse BKU Pajak ${fileName} (serverless):`, err);
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
  applyDOMPolyfills();
  try {
    if (isServerless()) {
      // Serverless: list from blob, process each with pdf-parse
      const allFiles = await getPDFFiles();
      const files = allFiles.filter(f => isBKUPajakFile(f)).sort();

      const months: BKUPajakMonth[] = [];
      for (const file of files) {
        try {
          const data = await parseBKUPajakFile(file);
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

      // Deduplicate in memory
      const seen = new Map<string, BKUPajakMonth>();
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
      .filter(f => isBKUPajakFile(f))
      .sort();

    const months: BKUPajakMonth[] = [];
    for (const file of files) {
      try {
        const data = await parseBKUPajakFile(file);
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

    // Deduplicate by bulan+tahun (keep first, remove older duplicate files)
    const seen = new Map<string, BKUPajakMonth>();
    const toDelete: string[] = [];
    for (const m of months) {
      const key = `${m.bulan}_${m.tahun}`;
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

    return NextResponse.json({ months: dedupedMonths, files });
  } catch (error: any) {
    console.error('BKU Pajak list error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Import a new BKU Pajak file
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
      const data = await parseBKUPajakFile(file.name, buffer);
      if (!data) return NextResponse.json({ error: 'Failed to parse BKU Pajak' }, { status: 500 });

      // Deduplicate: delete other blob BKU Pajak files with the same bulan+tahun
      let replacedFile: string | null = null;
      if (data.bulan && data.tahun) {
        const existingFiles = (await getPDFFiles()).filter(f => isBKUPajakFile(f) && f !== file.name);
        for (const existing of existingFiles) {
          try {
            const existingData = await parseBKUPajakFile(existing);
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

    const data = await parseBKUPajakFile(file.name);
    if (!data) return NextResponse.json({ error: 'Failed to parse BKU Pajak' }, { status: 500 });

    // Deduplicate: remove other BKU Pajak files with the same bulan+tahun
    let replacedFile: string | null = null;
    if (data.bulan && data.tahun) {
      const existingFiles = fs.readdirSync(UPLOAD_DIR)
        .filter(f => isBKUPajakFile(f) && f !== file.name);
      for (const existing of existingFiles) {
        try {
          const existingData = await parseBKUPajakFile(existing);
          if (existingData && existingData.bulan === data.bulan && existingData.tahun === data.tahun) {
            replacedFile = existing;
            const oldPath = path.join(UPLOAD_DIR, existing);
            const oldCache = getCacheKey(existing);
            try { fs.unlinkSync(oldPath); } catch {}
            try { fs.unlinkSync(oldCache); } catch {}
          }
        } catch {}
      }
      // Invalidate cache for new file
      const newCache = getCacheKey(file.name);
      try { fs.unlinkSync(newCache); } catch {}
    }

    return NextResponse.json({ success: true, data, replaced: replacedFile });
  } catch (error: any) {
    console.error('BKU Pajak upload error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Remove a BKU Pajak file and its cache
export async function DELETE(request: Request) {
  applyDOMPolyfills();
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
    console.error('BKU Pajak delete error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function writeFileLocal(filePath: string, buffer: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.writeFile(filePath, buffer, (err) => err ? reject(err) : resolve());
  });
}
