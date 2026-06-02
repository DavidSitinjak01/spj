import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { isServerless } from '@/lib/serverless';
import { processPDF, processPDFBuffer, getPDFFiles, uploadToBlob, getBlobInfo, deleteFromBlob } from '@/lib/pdf-processor';

const UPLOAD_DIR = path.join(process.cwd(), 'upload');
const CACHE_DIR = path.join(process.cwd(), '.pdf-cache');
if (!isServerless()) {
  try { if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true }); } catch {}
}

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
  if (isServerless()) return 0;
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

// --- Serverless: Parse RKAS from extracted text using regex ---
// Handles BOTH pdfplumber format (local) and pdf-parse format (Vercel serverless)
// pdf-parse produces tab-separated columns in a different order than pdfplumber
function parseRKASFromText(text: string, fileName: string): RKASMonth | null {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const hasTabs = text.includes('\t');

  // --- Extract header info ---
  const headerInfo: Record<string, string> = {};

  // Extract judul from first meaningful lines
  const judulParts: string[] = [];
  for (const line of lines.slice(0, 15)) {
    if (reSearch(/(NPSN|TAHUN ANGGARAN|Nama Sekolah|Alamat|Kabupaten|Provinsi|Bulan|Sumber Dana)\s*:/i, line)) break;
    if (reSearch(/Halaman.*dari/i, line)) continue;
    if (reSearch(/Kertas Kerja.*NPSN/i, line)) continue;
    if (reSearch(/^A\.\s*PENERIMAAN/i, line)) break;
    if (reSearch(/^B\.\s*BELANJA/i, line)) break;
    if (line === ':' || line.trim() === '') continue;
    judulParts.push(line);
  }
  headerInfo.judul = judulParts.join(' ');

  // Detect tipe from judul
  const judulUpper = headerInfo.judul.toUpperCase();
  if (judulUpper.includes('PERBULAN') || judulUpper.includes('BULANAN')) {
    headerInfo.tipeFromJudul = 'bulanan';
  } else if (judulUpper.includes('TAHUNAN') || (judulUpper.includes('RKAS') && !judulUpper.includes('PERBULAN'))) {
    headerInfo.tipeFromJudul = 'tahunan';
  }

  // --- Header extraction ---
  // pdf-parse format: field name, colon, and value may be on separate lines
  // pdfplumber format: "Nama Sekolah : VALUE" on one line
  // We handle both formats

  // First pass: try single-line format (pdfplumber style)
  for (const line of lines) {
    if (line.includes('Halaman') && line.includes('dari')) continue;
    if (line.includes('Kertas Kerja') && line.includes('NPSN')) continue;
    if (line.includes('RKAS') && line.includes('NPSN')) continue;

    const bulanMatch = reMatch(/Bulan\s*:\s*(\w+)/i, line);
    if (bulanMatch) headerInfo.bulan = bulanMatch[1];

    const tahunMatch = reMatch(/TAHUN ANGGARAN\s*:\s*(\d{4})/i, line);
    if (tahunMatch) headerInfo.tahun = tahunMatch[1];

    const bulanTahun = reMatch(/Bulan\s*:\s*(\w+)\s+(\d{4})/i, line);
    if (bulanTahun) {
      headerInfo.bulan = bulanTahun[1];
      headerInfo.tahun = bulanTahun[2];
    }

    const npsnMatch = reMatch(/NPSN\s*:\s*(\d+)/i, line);
    if (npsnMatch && !headerInfo.npsn) headerInfo.npsn = npsnMatch[1];

    const sekolahMatch = reMatch(/Nama Sekolah\s*:\s*(.+)/i, line);
    if (sekolahMatch && sekolahMatch[1].trim()) headerInfo.namaSekolah = sekolahMatch[1].trim();

    const alamatMatch = reMatch(/Alamat\s*:\s*(.+)/i, line);
    if (alamatMatch && alamatMatch[1].trim()) headerInfo.alamat = alamatMatch[1].trim();

    const kabMatch = reMatch(/Kabupaten\s*:\s*(.+)/i, line);
    if (kabMatch && kabMatch[1].trim()) headerInfo.kabupaten = kabMatch[1].trim();

    const provMatch = reMatch(/Provinsi\s*:\s*(.+)/i, line);
    if (provMatch && provMatch[1].trim()) headerInfo.provinsi = provMatch[1].trim();

    if (line.includes('Sumber Dana') && !line.includes('dan Alokasi')) {
      const sdMatch = reMatch(/Sumber Dana\s*:?\s*(.+)/i, line);
      if (sdMatch) {
        const val = sdMatch[1].trim();
        if (val && val !== ':' && !val.includes('No.') && !val.includes('Kode') && !val.includes('Penerimaan')) {
          headerInfo.sumberDana = val;
        }
      }
    }
  }

  // Second pass: handle multi-line format (pdf-parse style)
   // In pdf-parse, ALL field names come first, then ALL colons, then ALL values
  // Pattern: "Nama Sekolah" \n "Alamat" \n ... \n ":" \n ":" \n ... \n "SMA NEGERI..." \n "JL...." \n ...
  // Values are in the same order as field names
  if (!headerInfo.namaSekolah || !headerInfo.alamat || !headerInfo.kabupaten || !headerInfo.provinsi) {
    // Find all field name positions in order
    const fieldOrder: { name: string; lineIdx: number }[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (reSearch(/^Nama Sekolah\s*:?\s*$/i, line)) fieldOrder.push({ name: 'namaSekolah', lineIdx: i });
      else if (reSearch(/^Alamat\s*:?\s*$/i, line)) fieldOrder.push({ name: 'alamat', lineIdx: i });
      else if (reSearch(/^Kabupaten\s*:?\s*$/i, line)) fieldOrder.push({ name: 'kabupaten', lineIdx: i });
      else if (reSearch(/^Provinsi\s*:?\s*$/i, line)) fieldOrder.push({ name: 'provinsi', lineIdx: i });
      else if (reSearch(/^Bulan\s*:?\s*$/i, line)) fieldOrder.push({ name: 'bulan', lineIdx: i });
    }

    if (fieldOrder.length >= 2) {
      // Find value lines after the field names
      // Two patterns:
      // 1. Bulanan: field names → colon lines → value lines
      // 2. Tahunan: "Nama Sekolah :" → value lines (colons on same line as field names)
      const lastFieldIdx = fieldOrder[fieldOrder.length - 1].lineIdx;
      
      // Find colon-only lines after the last field name (bulanan pattern)
      let colonEnd = -1;
      for (let i = lastFieldIdx + 1; i < Math.min(lastFieldIdx + 10, lines.length); i++) {
        if (lines[i].trim() === ':') {
          colonEnd = i;
        } else if (colonEnd !== -1 && lines[i].trim() !== ':') {
          break;
        }
      }

      // Value lines start after colons (or right after last field if no colon block)
      const valueStartIdx = colonEnd !== -1 ? colonEnd + 1 : lastFieldIdx + 1;
      const values: string[] = [];
      for (let i = valueStartIdx; i < Math.min(valueStartIdx + fieldOrder.length + 5, lines.length); i++) {
        const candidate = lines[i].trim();
        if (candidate === ':' || candidate === '') continue;
        // Stop if we hit another known section
        if (reSearch(/^(NPSN|A\.|B\.)/i, candidate)) break;
        values.push(candidate);
      }

      // Map values to fields by order
      for (let fi = 0; fi < fieldOrder.length && fi < values.length; fi++) {
        const fieldName = fieldOrder[fi].name;
        const value = values[fi];
        if (fieldName === 'namaSekolah' && !headerInfo.namaSekolah) headerInfo.namaSekolah = value;
        if (fieldName === 'alamat' && !headerInfo.alamat) headerInfo.alamat = value;
        if (fieldName === 'kabupaten' && !headerInfo.kabupaten) headerInfo.kabupaten = value;
        if (fieldName === 'provinsi' && !headerInfo.provinsi) headerInfo.provinsi = value;
        if (fieldName === 'bulan' && !headerInfo.bulan) {
          const bulanMatch = reMatch(/^(\w+)\s+\d{4}$/i, value);
          if (bulanMatch) headerInfo.bulan = bulanMatch[1];
          else headerInfo.bulan = value;
        }
      }
    }
  }

  // Try to extract Bulan from "Februari 2026" pattern on its own line
  if (!headerInfo.bulan) {
    const bulanNames = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    for (const line of lines) {
      for (const b of bulanNames) {
        const m = reMatch(new RegExp(`(${b})\\s+(\\d{4})`, 'i'), line);
        if (m) {
          headerInfo.bulan = m[1];
          if (!headerInfo.tahun) headerInfo.tahun = m[2];
          break;
        }
      }
      if (headerInfo.bulan) break;
    }
  }

  // If tahun not found, try generic
  if (!headerInfo.tahun) {
    const tahunM = reMatch(/:\s*(\d{4})/, text);
    if (tahunM) headerInfo.tahun = tahunM[1];
  }

  // Sumber Dana from tab-separated line (pdf-parse format)
  if (!headerInfo.sumberDana) {
    for (const line of lines) {
      if (line.includes('\t') && line.includes('Sumber Dana')) {
        const parts = line.split('\t');
        // In pdf-parse, "BOSP Reguler \t Sumber Dana" means sumber dana is the first part
        const sumberDanaPart = parts.find(p => p.trim() && !p.includes('Sumber Dana'));
        if (sumberDanaPart) {
          headerInfo.sumberDana = sumberDanaPart.trim();
        }
      }
    }
  }

  // --- Extract Penerimaan (revenue) table from text ---
  const penerimaan: RKASPenerimaanItem[] = [];
  let totalPenerimaan = 0;
  let inPenerimaan = false;

  for (const line of lines) {
    const upperLine = line.toUpperCase();
    // Detect penerimaan section - "A. PENERIMAAN" or "PENERIMAAN" with "KODE" or "NO"
    if (reSearch(/^A\.\s*PENERIMAAN/i, line) || (upperLine.includes('PENERIMAAN') && (upperLine.includes('KODE') || upperLine.includes('NO')))) {
      inPenerimaan = true;
      continue;
    }
    if (inPenerimaan) {
      if (upperLine.includes('TOTAL') && upperLine.includes('PENERIMAAN')) {
        const totalMatch = reMatch(/([\d.]+)/, line.replace(/TOTAL\s*PENERIMAAN/i, ''));
        if (totalMatch) totalPenerimaan = parseAmount(totalMatch[1]);
        inPenerimaan = false;
        continue;
      }
      if (upperLine.startsWith('B.') && upperLine.includes('BELANJA')) {
        inPenerimaan = false;
        continue;
      }
      const match = reMatch(/^(\d+\.\d+(?:\.\d+)*)\.?\s+(.+?)\s+([\d.]+)$/, line);
      if (match) {
        penerimaan.push({
          kode: match[1],
          nama: match[2].trim(),
          jumlah: parseAmount(match[3]),
        });
      }
    }
  }

  // Also check for "Total Penerimaan" anywhere (pdf-parse puts it after "B. BELANJA")
  if (totalPenerimaan === 0) {
    for (const line of lines) {
      if (line.toUpperCase().includes('TOTAL') && line.toUpperCase().includes('PENERIMAAN')) {
        const totalMatch = reMatch(/([\d.]+)/, line.replace(/TOTAL\s*PENERIMAAN/i, ''));
        if (totalMatch) totalPenerimaan = parseAmount(totalMatch[1]);
      }
    }
  }

  if (totalPenerimaan === 0 && penerimaan.length > 0) {
    totalPenerimaan = penerimaan.reduce((s, p) => s + p.jumlah, 0);
  }

  // --- Extract Belanja (expenditure) table from text ---
  const belanjaRaw: {
    noUrut: string; kodeRekening: string; kodeProgram: string; uraian: string;
    volume: string; satuan: string; tarifHarga: string; jumlah: string;
  }[] = [];

  let inBelanja = false;

  if (hasTabs) {
    // --- pdf-parse tab-separated format ---
    // Tab structure for bulanan:
    //   [kodeProgSuffix.] \t [noUrut. uraian jumlah] \t [volume satuan tarif] \t [kodeProg1.] \t [kodeProg2.] \t [kodeRekening]
    // Tab structure for tahunan:
    //   [noUrut kodeProgram] \t [kodeRekening uraian budgetNumbers...] \t [more budget numbers]
    
    let isTahunanTable = false;
    let belanjaHeaderLines = 0; // Count header lines to detect table type
    
    for (const line of lines) {
      const upperLine = line.toUpperCase();
      
      // Detect belanja section start
      // Match "B. BELANJA", "BELANJA" with "NO" or "URUT", or "KODE REKENING" with "URAIAN"
      if (reSearch(/^B\.\s*BELANJA/i, line) ||
          (upperLine.includes('BELANJA') && (upperLine.includes('NO') || upperLine.includes('URUT'))) ||
          (upperLine.includes('KODE REKENING') && upperLine.includes('URAIAN'))) {
        inBelanja = true;
        belanjaHeaderLines = 0;
        // Detect tahunan vs bulanan from header
        if (upperLine.includes('SUMBER DANA') || upperLine.includes('ALOKASI') || upperLine.includes('OPERASI')) {
          isTahunanTable = true;
        }
        continue;
      }
      if (!inBelanja) continue;

      // Count header lines and detect tahunan table type
      belanjaHeaderLines++;
      if (belanjaHeaderLines <= 20) {
        if (upperLine.includes('SUMBER DANA') || upperLine.includes('ALOKASI ANGGARAN') || 
            (upperLine.includes('BOSP') && upperLine.includes('REGULER')) ||
            upperLine.includes('SILPA')) {
          isTahunanTable = true;
        }
      }

      // Skip header/subheader rows
      // Skip "Total Penerimaan" line (pdf-parse puts it after B. BELANJA)
      if (upperLine.includes('TOTAL') && upperLine.includes('PENERIMAAN')) continue;
      if (upperLine.includes('VOLUME') && upperLine.includes('SATUAN')) continue;
      if (upperLine.includes('BELANJA') && upperLine.includes('OPERASI')) continue;
      if (upperLine.includes('SUMBER DANA') && upperLine.includes('ALOKASI')) continue;
      if (upperLine.includes('NO') && upperLine.includes('URUT')) continue;
      if (upperLine.includes('KODE') && upperLine.includes('REKENING')) continue;
      if (upperLine.includes('KODE') && upperLine.includes('KEGIATAN')) continue;
      if (upperLine.includes('BOSP') && (upperLine.includes('REGULER') || upperLine.includes('DAERAH'))) continue;
      if (upperLine.includes('Halaman') && upperLine.includes('dari')) continue;
      if (upperLine.includes('Kertas Kerja') || upperLine.includes('RKAS')) continue;
      if (upperLine.includes('MODAL') && upperLine.includes('OPERASI')) continue;
      if (upperLine.includes('SiLPA')) continue;
      if (upperLine.includes('Jumlah') && line.split('\t').length <= 2) continue;

      const tabs = line.split('\t');
      
      if (isTahunanTable) {
        // Tahunan format - handles BOTH pdf-parse and pdfjs-dist extraction formats:
        //
        // pdf-parse format:
        //   "1 02." \t "Pengembangan Standar Isi 19.530.000 19.530.000 0 0 0" \t "0 0 0 0 0 0"
        //   "4 02.02.01." \t "5.1.02.01.01.0052 Belanja Makanan 7.698.000 7.698.000 0 0 0" \t "0 0 0 0 0 0"
        //   "5 02.02.01." \t "5.1.02.01.01.0052 001. Snack Kotak-- 2.250.000 2.250.000 0 0 0" \t "0 0 0 0 0 0"
        //
        // pdfjs-dist format:
        //   "1 02. Pengembangan Standar Isi 19.530.000  19.530.000  0 0 0 0 0 0 0" \t "0 0"
        //   "4 5.1.02.01.01.0052 02.02.01." \t "Belanja Makanan dan Minuman Rapat 7.698.000  7.698.000  0 0 0 0 0 0 0" \t "0 0"
        //   "5 5.1.02.01.01.0052 02.02.01." \t "001. Snack Kotak-- 2.250.000  2.250.000  0 0 0 0 0 0 0" \t "0 0"
        
        if (tabs.length < 1) continue;
        
        const firstPart = tabs[0].trim();
        const secondPart = tabs[1]?.trim() || '';
        
        // Parse first part: noUrut + optional kodeRekening + kodeProgram
        let noUrut = '';
        let kodeProgram = '';
        let kodeRekening = '';
        
        // Try pdf-parse format: "4 02.02.01." (noUrut + kodeProgram only)
        let firstMatch = reMatch(/^(\d+)\s+([\d.]+\.?)$/, firstPart);
        if (firstMatch) {
          noUrut = firstMatch[1];
          kodeProgram = firstMatch[2];
        } else {
          // Try pdfjs-dist format: "4 5.1.02.01.01.0052 02.02.01." (noUrut + kodeRekening + kodeProgram)
          const pdfjsMatch = reMatch(/^(\d+)\s+(5\.\d+\.[\d.]+)\s+([\d.]+\.?)$/, firstPart);
          if (pdfjsMatch) {
            noUrut = pdfjsMatch[1];
            kodeRekening = pdfjsMatch[2];
            kodeProgram = pdfjsMatch[3];
          } else {
            // Try without kodeRekening: "1 02." or "1 02. Pengembangan..." (all in one line)
            // This happens with pdfjs-dist when kode program and uraian are close together
            const simpleMatch = reMatch(/^(\d+)\s+([\d.]+\.?)\s+(.+)$/, firstPart);
            if (simpleMatch) {
              noUrut = simpleMatch[1];
              kodeProgram = simpleMatch[2];
              // The rest might contain uraian + jumlah if it's all on one line
              // We'll handle this below
            } else {
              // One more try: "19 03. Standar Proses 76.004.000 ..."
              const noKodeRekMatch = reMatch(/^(\d+)\s+([\d.]+\.\s+)/, firstPart);
              if (noKodeRekMatch) {
                noUrut = noKodeRekMatch[1];
                kodeProgram = noKodeRekMatch[2].trim();
              } else {
                continue;
              }
            }
          }
        }
        
        // Determine the remaining text to parse for uraian + jumlah
        let uraianSource = secondPart;
        
        // If firstPart contains more than just noUrut+kodeProgram (pdfjs-dist format),
        // the extra text is the uraian + jumlah
        // Only apply firstPartExtra when using simpleMatch (not pdfjsMatch),
        // because when pdfjsMatch matched, the first part is exactly "noUrut kodeRekening kodeProgram"
        // with no extra uraian content
        if (!kodeRekening) {
          const firstPartExtra = reMatch(/^\d+\s+(?:5\.\d+\.[\d.]+\s+)?[\d.]+\.?\s+(.+)$/, firstPart);
          if (firstPartExtra) {
            uraianSource = firstPartExtra[1] + (secondPart ? '\t' + secondPart : '');
          }
        }
        
        // Parse uraian + jumlah from the source text
        let uraian = '';
        let jumlah = '';
        
        // Check if uraianSource starts with kode rekening (5.x.x.x pattern)
        const kodeRekMatch = reMatch(/^(\d+\.[\d.]+)\s+(.+)$/, uraianSource);
        if (kodeRekMatch && reMatch(/^5\./, kodeRekMatch[1]) && !kodeRekening) {
          kodeRekening = kodeRekMatch[1];
          const rest = kodeRekMatch[2];
          // Extract uraian and first jumlah from rest
          const uraianJumlahMatch = reMatch(/^(.+?)\s+([\d.]+)\s+[\d.]+\s+[\d.]+\s+[\d.]+\s+[\d.]+$/, rest);
          if (uraianJumlahMatch) {
            uraian = uraianJumlahMatch[1].trim();
            jumlah = uraianJumlahMatch[2];
          } else {
            const simpleUJ = reMatch(/^(.+?)\s+([\d.]+)\s/, rest);
            if (simpleUJ) {
              uraian = simpleUJ[1].trim();
              jumlah = simpleUJ[2];
            }
          }
        } else {
          // No kode rekening (or already extracted) - this is a category/sub row or uraian+jumlah directly
          // Try simpleUJ first (extracts first number as jumlah), then uraianJumlahMatch as fallback
          const simpleUJ = reMatch(/^(.+?)\s+([\d.]+)\s/, uraianSource);
          if (simpleUJ) {
            uraian = simpleUJ[1].trim();
            jumlah = simpleUJ[2];
          } else {
            const uraianJumlahMatch = reMatch(/^(.+?)\s+([\d.]+)\s+[\d.]+\s+[\d.]+\s+[\d.]+\s+[\d.]+$/, uraianSource);
            if (uraianJumlahMatch) {
              uraian = uraianJumlahMatch[1].trim();
              jumlah = uraianJumlahMatch[2];
            } else {
              uraian = uraianSource;
            }
          }
        }
        
        belanjaRaw.push({
          noUrut,
          kodeRekening,
          kodeProgram,
          uraian,
          volume: '',
          satuan: '',
          tarifHarga: '',
          jumlah,
        });
      } else {
        // Bulanan format with tabs:
        // Category: "1. Standar Proses 5.364.000 \t 03."
        // Sub-category: "2. Pelaksanaan... 5.364.000 \t 03. \t 03."
        // Sub-sub-cat: "08. \t 3. Program... 4.764.000 \t 03. \t 03."
        // Detail+VST: "08. \t 4. Nasi Bungkus-- 3.150.000 \t 90 per bungkus 35.000 \t 03. \t 03. \t 5.1.02.01.01.0052"
        // Detail only: "08. \t 3. Program... 4.764.000 \t 03. \t 03."
        
        // Skip lines that are clearly not data rows
        if (!reSearch(/^\d/, line.replace(/^\s*/, ''))) continue;
        if (upperLine.startsWith('HALAMAN')) continue;
        
        // Determine if first tab part is a kode program suffix (like "08.", "02.")
        // or part of noUrut+uraian+jumlah
        let kodeProgSuffix = '';
        let mainDataPart = '';
        let volumePart = '';
        let kodeRekening = '';
        let kodeProgParts: string[] = [];
        
        const firstPart = tabs[0].trim();
        
        // Check if first part is just a kode program suffix (like "08." or "02.")
        if (reMatch(/^(\d{2})\.\s*$/, firstPart)) {
          kodeProgSuffix = firstPart.trim();
          mainDataPart = tabs[1]?.trim() || '';
          // Remaining tabs: volume, kode prog parts, kode rekening
          const remaining = tabs.slice(2);
          
          // Check if second remaining part looks like volume/satuan/tarif
          // It contains things like "90 per bungkus 35.000" or "4 dus 66.000"
          let volIdx = 0;
          if (remaining.length > 0 && reSearch(/^\d[\d.]*\s+\w+/, remaining[0].trim())) {
            volumePart = remaining[0].trim();
            volIdx = 1;
          }
          
          // Parse remaining parts for kode program and kode rekening
          const kodeParts = remaining.slice(volIdx);
          for (const kp of kodeParts) {
            const trimmed = kp.trim();
            if (!trimmed) continue;
            // Kode rekening pattern: starts with "5." and has multiple dots
            if (reMatch(/^5\.\d+\.[\d.]+$/, trimmed)) {
              kodeRekening = trimmed;
            } else if (reMatch(/^\d{2}\.\s*$/, trimmed)) {
              kodeProgParts.push(trimmed);
            }
          }
        } else {
          // First part contains noUrut + uraian + jumlah (no kode prog suffix)
          mainDataPart = firstPart;
          const remaining = tabs.slice(1);
          
          let volIdx = 0;
          if (remaining.length > 0 && reSearch(/^\d[\d.]*\s+\w+/, remaining[0].trim())) {
            volumePart = remaining[0].trim();
            volIdx = 1;
          }
          
          const kodeParts = remaining.slice(volIdx);
          for (const kp of kodeParts) {
            const trimmed = kp.trim();
            if (!trimmed) continue;
            if (reMatch(/^5\.\d+\.[\d.]+$/, trimmed)) {
              kodeRekening = trimmed;
            } else if (reMatch(/^\d{2}\.\s*$/, trimmed)) {
              kodeProgParts.push(trimmed);
            }
          }
        }
        
        // Parse mainDataPart: "4. Nasi Bungkus-- 3.150.000" or "1. Standar Proses 5.364.000"
        const mainMatch = reMatch(/^(\d+)\.\s+(.+?)\s+([\d.]+)$/, mainDataPart);
        if (!mainMatch) {
          // Try with multi-line uraian (uraian might span to next line)
          // Skip for now, handle in a second pass
          continue;
        }
        
        const noUrut = mainMatch[1];
        const uraian = mainMatch[2].trim();
        const jumlah = mainMatch[3];
        
        // Build kode program from parts + suffix
        // kodeProgParts are the prefix parts (like ["03.", "03."])
        // kodeProgSuffix is the suffix (like "08.")
        const kodeProgram = [...kodeProgParts, kodeProgSuffix].join('').replace(/\s/g, '');
        
        // Parse volume part: "90 per bungkus 35.000" → volume=90, satuan="per bungkus", tarif=35000
        let volume = '';
        let satuan = '';
        let tarifHarga = '';
        if (volumePart) {
          const volMatch = reMatch(/^(\d[\d.]*)\s+(.+?)\s+([\d.]+)$/, volumePart);
          if (volMatch) {
            volume = volMatch[1];
            satuan = volMatch[2].trim();
            tarifHarga = volMatch[3];
          } else {
            // Maybe just volume + satuan without tarif
            const volMatch2 = reMatch(/^(\d[\d.]*)\s+(.+)$/, volumePart);
            if (volMatch2) {
              volume = volMatch2[1];
              satuan = volMatch2[2].trim();
            }
          }
        }
        
        belanjaRaw.push({
          noUrut,
          kodeRekening,
          kodeProgram,
          uraian,
          volume,
          satuan,
          tarifHarga,
          jumlah,
        });
      }
    }
  } else {
    // --- pdfplumber format (no tabs) ---
    // Original regex-based parsing
    for (const line of lines) {
      const upperLine = line.toUpperCase();
      if ((upperLine.includes('BELANJA') && (upperLine.includes('NO') || upperLine.includes('URUT'))) ||
          (upperLine.includes('KODE REKENING') && upperLine.includes('URAIAN'))) {
        inBelanja = true;
        continue;
      }
      if (!inBelanja) continue;

      if (upperLine.includes('VOLUME') && upperLine.includes('SATUAN')) continue;
      if (upperLine.includes('BELANJA') && upperLine.includes('OPERASI')) continue;
      if (upperLine.includes('SUMBER DANA') && upperLine.includes('ALOKASI')) continue;
      if (upperLine.includes('NO') && upperLine.includes('URUT')) continue;

      const fullMatch = reMatch(/^(\d+)\s+(\d+\.[\d.]+)\s+(\d{2}\.[\d.]+)\s+(.+?)\s+(\d[\d.]*)\s+(\w+)\s+(\d[\d.]*)\s+(\d[\d.]+)$/, line);
      if (fullMatch) {
        belanjaRaw.push({
          noUrut: fullMatch[1],
          kodeRekening: fullMatch[2],
          kodeProgram: fullMatch[3],
          uraian: fullMatch[4].trim(),
          volume: fullMatch[5],
          satuan: fullMatch[6],
          tarifHarga: fullMatch[7],
          jumlah: fullMatch[8],
        });
        continue;
      }

      const simpleMatch = reMatch(/^(\d+)\s+(\d+\.[\d.]+)\s+(\d{2}\.[\d.]+)\s+(.+?)\s+(\d[\d.]+)\s*$/, line);
      if (simpleMatch) {
        belanjaRaw.push({
          noUrut: simpleMatch[1],
          kodeRekening: simpleMatch[2],
          kodeProgram: simpleMatch[3],
          uraian: simpleMatch[4].trim(),
          volume: '',
          satuan: '',
          tarifHarga: '',
          jumlah: simpleMatch[5],
        });
        continue;
      }
    }
  }

  // Handle multi-line uraian for pdf-parse format
  // Some items have uraian spanning multiple lines:
  //   "08. \t 35. \n Pembelian Bahan Habis Pakai... \n administrasi sekolah) \n 11.906.000 \t 05. \t 06."
  // We need to merge these continuation lines with the previous item
  if (hasTabs) {
    const merged: typeof belanjaRaw = [];
    for (let i = 0; i < belanjaRaw.length; i++) {
      const item = belanjaRaw[i];
      // Check if this item has jumlah=0 and the next item has no noUrut pattern
      // (continuation of uraian)
      if (i > 0 && !item.kodeRekening && item.uraian && !reMatch(/^\d+/, item.noUrut)) {
        // This might be a continuation - append uraian to previous
        const prev = merged[merged.length - 1];
        if (prev) {
          prev.uraian += ' ' + item.uraian;
          if (!prev.jumlah && item.jumlah) prev.jumlah = item.jumlah;
          if (!prev.kodeRekening && item.kodeRekening) prev.kodeRekening = item.kodeRekening;
          if (!prev.kodeProgram && item.kodeProgram) prev.kodeProgram = item.kodeProgram;
          continue;
        }
      }
      merged.push(item);
    }
    belanjaRaw.length = 0;
    belanjaRaw.push(...merged);
  }

  // --- Build RKASMonth from parsed data ---
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

  const totalBelanja = allItems.reduce((s, item) => s + item.jumlah, 0);

  // Determine tipe
  const bulanValue = (headerInfo.bulan || '').toUpperCase();
  const tipeFromJudul = headerInfo.tipeFromJudul || '';
  let tipe: 'bulanan' | 'tahunan';

  if (tipeFromJudul === 'bulanan') {
    tipe = 'bulanan';
  } else if (tipeFromJudul === 'tahunan') {
    tipe = 'tahunan';
  } else {
    tipe = bulanValue ? 'bulanan' : 'tahunan';
  }

  const judul = headerInfo.judul || (tipe === 'bulanan' ? 'Rincian Kertas Kerja Perbulan' : 'Kertas Kerja RKAS');

  return {
    fileName,
    judul,
    bulan: bulanValue,
    tahun: headerInfo.tahun || '',
    tipe,
    sumberDana: headerInfo.sumberDana || '',
    namaSekolah: headerInfo.namaSekolah || '',
    npsn: headerInfo.npsn || '',
    alamat: headerInfo.alamat || '',
    kabupaten: headerInfo.kabupaten || '',
    provinsi: headerInfo.provinsi || '',
    totalPenerimaan,
    totalBelanja,
    penerimaan,
    standarList,
    allItems,
  };
}

// --- Regex helpers ---
function reSearch(pattern: RegExp, text: string): boolean {
  return pattern.test(text);
}

function reMatch(pattern: RegExp, text: string): RegExpMatchArray | null {
  return text.match(pattern);
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
async function parseRKASFile(fileName: string, buffer?: Buffer): Promise<RKASMonth | null> {
  if (isServerless()) {
    // Serverless: parse with pdfjs-dist + regex
    // If buffer is provided (e.g., right after upload), use it directly
    // Otherwise, download from blob
    try {
      let info;
      if (buffer) {
        info = await processPDFBuffer(fileName, buffer);
      } else {
        const blobInfo = await getBlobInfo(fileName);
        if (!blobInfo) {
          console.error(`RKAS parse: blob not found for ${fileName}`);
          return null;
        }
        info = await processPDF(fileName);
      }
      const fullText = info.extractedText.map(p => p.text).join('\n');
      console.log(`RKAS parse: extracted ${fullText.length} chars from ${fileName}, pages: ${info.pageCount}`);
      if (!fullText.trim()) {
        console.error(`RKAS parse: no text extracted from ${fileName}`);
        return null;
      }
      const result = parseRKASFromText(fullText, fileName);
      if (!result) {
        console.error(`RKAS parse: parseRKASFromText returned null for ${fileName}`);
      } else if (result.allItems.length === 0) {
        console.warn(`RKAS parse: parsed ${fileName} but got 0 belanja items. Header: school=${result.namaSekolah}, npsn=${result.npsn}, penerimaan=${result.totalPenerimaan}, tipe=${result.tipe}`);
      } else {
        console.log(`RKAS parse: successfully parsed ${fileName} - ${result.allItems.length} items, tipe=${result.tipe}`);
      }
      return result;
    } catch (err: any) {
      console.error(`Failed to parse RKAS ${fileName} (serverless):`, err?.message || err);
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
    const files = (await getPDFFiles()).filter(f => isRKASFile(f)).sort();

    const months: RKASMonth[] = [];
    for (const file of files) {
      try {
        const data = await parseRKASFile(file);
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

    if (isServerless()) {
      // On serverless, we can't delete duplicates from blob easily, just dedup in memory
      const seen = new Map<string, RKASMonth>();
      for (const m of months) {
        const key = m.tipe === 'tahunan' ? `TAHUNAN_${m.tahun}` : `BULANAN_${m.bulan}_${m.tahun}`;
        if (!seen.has(key)) {
          seen.set(key, m);
        }
      }
      const dedupedMonths = Array.from(seen.values());
      const bulanan = dedupedMonths.filter(m => m.tipe === 'bulanan');
      const tahunan = dedupedMonths.filter(m => m.tipe === 'tahunan');
      return NextResponse.json({ months: dedupedMonths, bulanan, tahunan, files });
    }

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

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (isServerless()) {
      // Serverless: upload to blob + parse directly from buffer
      await uploadToBlob(file.name, buffer);
      const data = await parseRKASFile(file.name, buffer);
      if (!data) return NextResponse.json({
        error: 'Failed to parse RKAS',
        hint: 'PDF text extraction may have failed on Vercel serverless. Check Vercel function logs for details.',
        fileName: file.name,
        fileSize: buffer.length,
      }, { status: 500 });

      // Deduplicate: delete other blob files with same key
      let replacedFile: string | null = null;
      const existingFiles = (await getPDFFiles()).filter(f => isRKASFile(f) && f !== file.name);
      for (const existing of existingFiles) {
        try {
          const existingData = await parseRKASFile(existing);
          if (!existingData) continue;
          const isDuplicate = data.tipe === 'tahunan'
            ? existingData.tipe === 'tahunan' && existingData.tahun === data.tahun
            : existingData.tipe === 'bulanan' && existingData.bulan === data.bulan && existingData.tahun === data.tahun;
          if (isDuplicate) {
            replacedFile = existing;
            await deleteFromBlob(existing);
          }
        } catch {}
      }

      return NextResponse.json({ success: true, data, replaced: replacedFile, tipe: data.tipe, judul: data.judul });
    }

    // Local: save to upload dir + process with Python
    const filePath = path.join(UPLOAD_DIR, file.name);
    await writeFileLocal(filePath, buffer);

    const data = await parseRKASFile(file.name);
    if (!data) return NextResponse.json({ error: 'Failed to parse RKAS' }, { status: 500 });

    // Deduplicate: remove other RKAS files with the same key
    let replacedFile: string | null = null;
    const existingFiles = fs.readdirSync(UPLOAD_DIR)
      .filter(f => isRKASFile(f) && f !== file.name);
    for (const existing of existingFiles) {
      try {
        const existingData = await parseRKASFile(existing);
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
