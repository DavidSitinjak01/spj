import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const UPLOAD_DIR = path.join(process.cwd(), 'upload');
const CACHE_DIR = path.join(process.cwd(), '.pdf-cache');
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

// --- Types ---
interface SPJItem {
  kodeRekening: string;
  kodeProgram: string;
  standarKode: string;
  standarNama: string;
  uraian: string;
  anggaran: number;       // From RKAS
  realisasi: number;      // From BKU
  selisih: number;        // anggaran - realisasi
  persenRealisasi: number; // realisasi / anggaran * 100
  status: 'lengkap' | 'sebagian' | 'belum' | 'lebih';
}

interface SPJStandarGroup {
  kode: string;
  nama: string;
  anggaran: number;
  realisasi: number;
  selisih: number;
  persenRealisasi: number;
  items: SPJItem[];
}

interface SPJMonth {
  bulan: string;
  tahun: string;
  rkasFileName: string;
  bkuFileName: string;
  totalAnggaran: number;
  totalRealisasi: number;
  totalSelisih: number;
  persenRealisasi: number;
  standarGroups: SPJStandarGroup[];
  unmatchedBKU: { kodeRekening: string; kodeKegiatan: string; uraian: string; jumlah: number }[];
  unmatchedRKAS: { kodeRekening: string; kodeProgram: string; uraian: string; jumlah: number }[];
}

interface SPJSummary {
  bulanan: SPJMonth[];
  tahunan: {
    tahun: string;
    totalAnggaran: number;
    totalRealisasi: number;
    totalSelisih: number;
    persenRealisasi: number;
    standarGroups: SPJStandarGroup[];
  } | null;
}

// --- Helpers ---
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

function normalizeKode(kode: string): string {
  return kode.replace(/[\s\n]/g, '').replace(/\.+$/, '').trim();
}

function extractStandarCode(kodeProgram: string): string {
  if (!kodeProgram) return '';
  const cleaned = kodeProgram.replace(/\s/g, '');
  const match = cleaned.match(/^(\d{2})\./);
  return match ? match[1] : '';
}

// --- Load BKU data ---
function loadBKUData(): { bulan: string; tahun: string; transactions: any[] }[] {
  const bkuCachePattern = /\.bku\.json$/;
  const months: any[] = [];

  if (!fs.existsSync(CACHE_DIR)) return months;

  const cacheFiles = fs.readdirSync(CACHE_DIR).filter(f => bkuCachePattern.test(f));
  for (const cf of cacheFiles) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, cf), 'utf-8'));
      const d = data.data;
      if (d) months.push(d);
    } catch {}
  }

  months.sort((a, b) => {
    if (a.tahun !== b.tahun) return a.tahun.localeCompare(b.tahun);
    return MONTH_ORDER.indexOf(a.bulan) - MONTH_ORDER.indexOf(b.bulan);
  });

  return months;
}

// --- Load RKAS data ---
function loadRKASData(): any[] {
  const rkasCachePattern = /\.rkas\.json$/;
  const months: any[] = [];

  if (!fs.existsSync(CACHE_DIR)) return months;

  const cacheFiles = fs.readdirSync(CACHE_DIR).filter(f => rkasCachePattern.test(f));
  for (const cf of cacheFiles) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, cf), 'utf-8'));
      const d = data.data;
      if (d) months.push(d);
    } catch {}
  }

  months.sort((a, b) => {
    if (a.tahun !== b.tahun) return a.tahun.localeCompare(b.tahun);
    if (a.tipe !== b.tipe) return a.tipe === 'tahunan' ? 1 : -1;
    return MONTH_ORDER.indexOf(a.bulan) - MONTH_ORDER.indexOf(b.bulan);
  });

  return months;
}

// --- Build SPJ for a single month ---
function buildSPJMonth(rkasMonth: any, bkuMonth: any): SPJMonth {
  const bulan = rkasMonth?.bulan || bkuMonth?.bulan || '';
  const tahun = rkasMonth?.tahun || bkuMonth?.tahun || '';

  // Aggregate BKU spending by kodeRekening + kodeKegiatan
  const bkuByKodeRekening = new Map<string, { total: number; kodeKegiatan: string; uraian: string }[]>();
  if (bkuMonth?.transactions) {
    for (const t of bkuMonth.transactions) {
      const kr = normalizeKode(t.kodeRekening || '');
      if (!kr) continue; // Skip transactions without kodeRekening (like "Tarik Tunai")
      const pengeluaran = t.pengeluaran || 0;
      if (pengeluaran <= 0) continue; // Only count spending
      if (!bkuByKodeRekening.has(kr)) {
        bkuByKodeRekening.set(kr, []);
      }
      bkuByKodeRekening.get(kr)!.push({
        total: pengeluaran,
        kodeKegiatan: normalizeKode(t.kodeKegiatan || ''),
        uraian: t.uraian || '',
      });
    }
  }

  // Aggregate BKU spending totals per kodeRekening
  const bkuTotalsByKode = new Map<string, number>();
  const bkuUraianByKode = new Map<string, string>();
  for (const [kr, entries] of bkuByKodeRekening) {
    const total = entries.reduce((s, e) => s + e.total, 0);
    bkuTotalsByKode.set(kr, total);
    bkuUraianByKode.set(kr, entries[0]?.uraian || '');
  }

  // Track which BKU kodeRekening have been matched
  const matchedBKUKodes = new Set<string>();

  // Build SPJ items from RKAS
  const items: SPJItem[] = [];
  const rkasItems = rkasMonth?.allItems || [];

  for (const rkasItem of rkasItems) {
    const kr = normalizeKode(rkasItem.kodeRekening || '');
    const kp = normalizeKode(rkasItem.kodeProgram || '');
    const standarKode = extractStandarCode(kp);
    const anggaran = rkasItem.jumlah || 0;
    const realisasi = bkuTotalsByKode.get(kr) || 0;

    if (realisasi > 0) {
      matchedBKUKodes.add(kr);
    }

    const selisih = anggaran - realisasi;
    const persenRealisasi = anggaran > 0 ? Math.round((realisasi / anggaran) * 100) : (realisasi > 0 ? 999 : 0);

    let status: SPJItem['status'];
    if (realisasi === 0) {
      status = 'belum';
    } else if (persenRealisasi > 100) {
      status = 'lebih';
    } else if (persenRealisasi >= 95) {
      status = 'lengkap';
    } else {
      status = 'sebagian';
    }

    items.push({
      kodeRekening: kr,
      kodeProgram: kp,
      standarKode,
      standarNama: STANDAR_MAP[standarKode] || `Standar ${standarKode}`,
      uraian: rkasItem.uraian || '',
      anggaran,
      realisasi,
      selisih,
      persenRealisasi,
      status,
    });
  }

  // Group by standar
  const standarMap = new Map<string, SPJItem[]>();
  for (const item of items) {
    const code = item.standarKode || '00';
    if (!standarMap.has(code)) standarMap.set(code, []);
    standarMap.get(code)!.push(item);
  }

  const orderedCodes = ['02', '03', '04', '05', '06', '07', '08'];
  const standarGroups: SPJStandarGroup[] = [];

  for (const code of [...orderedCodes, ...Array.from(standarMap.keys()).filter(c => !orderedCodes.includes(c))]) {
    const groupItems = standarMap.get(code);
    if (!groupItems || groupItems.length === 0) continue;

    const anggaran = groupItems.reduce((s, i) => s + i.anggaran, 0);
    const realisasi = groupItems.reduce((s, i) => s + i.realisasi, 0);
    const selisih = anggaran - realisasi;
    const persenRealisasi = anggaran > 0 ? Math.round((realisasi / anggaran) * 100) : 0;

    standarGroups.push({
      kode: code,
      nama: STANDAR_MAP[code] || `Standar ${code}`,
      anggaran,
      realisasi,
      selisih,
      persenRealisasi,
      items: groupItems,
    });
  }

  // Unmatched BKU items (realisasi without RKAS planning)
  const unmatchedBKU: SPJMonth['unmatchedBKU'] = [];
  for (const [kr, entries] of bkuByKodeRekening) {
    if (!matchedBKUKodes.has(kr)) {
      const total = entries.reduce((s, e) => s + e.total, 0);
      unmatchedBKU.push({
        kodeRekening: kr,
        kodeKegiatan: entries[0]?.kodeKegiatan || '',
        uraian: entries[0]?.uraian || '',
        jumlah: total,
      });
    }
  }

  // Unmatched RKAS items (anggaran without any realisasi)
  const unmatchedRKAS: SPJMonth['unmatchedRKAS'] = [];
  for (const item of items) {
    if (item.realisasi === 0 && item.anggaran > 0) {
      unmatchedRKAS.push({
        kodeRekening: item.kodeRekening,
        kodeProgram: item.kodeProgram,
        uraian: item.uraian,
        jumlah: item.anggaran,
      });
    }
  }

  const totalAnggaran = items.reduce((s, i) => s + i.anggaran, 0);
  const totalRealisasi = items.reduce((s, i) => s + i.realisasi, 0);
  const totalSelisih = totalAnggaran - totalRealisasi;
  const persenRealisasi = totalAnggaran > 0 ? Math.round((totalRealisasi / totalAnggaran) * 100) : 0;

  return {
    bulan,
    tahun,
    rkasFileName: rkasMonth?.fileName || '',
    bkuFileName: bkuMonth?.fileName || '',
    totalAnggaran,
    totalRealisasi,
    totalSelisih,
    persenRealisasi,
    standarGroups,
    unmatchedBKU,
    unmatchedRKAS,
  };
}

// --- Build SPJ Tahunan ---
function buildSPJTahunan(rkasTahunan: any, bkuMonths: any[]): SPJSummary['tahunan'] {
  if (!rkasTahunan) return null;

  const tahun = rkasTahunan.tahun || '';

  // Aggregate ALL BKU spending by kodeRekening
  const bkuTotalsByKode = new Map<string, number>();
  for (const bm of bkuMonths) {
    if (!bm.transactions) continue;
    for (const t of bm.transactions) {
      const kr = normalizeKode(t.kodeRekening || '');
      if (!kr) continue;
      const pengeluaran = t.pengeluaran || 0;
      if (pengeluaran <= 0) continue;
      bkuTotalsByKode.set(kr, (bkuTotalsByKode.get(kr) || 0) + pengeluaran);
    }
  }

  const matchedBKUKodes = new Set<string>();
  const items: SPJItem[] = [];

  for (const rkasItem of (rkasTahunan.allItems || [])) {
    const kr = normalizeKode(rkasItem.kodeRekening || '');
    const kp = normalizeKode(rkasItem.kodeProgram || '');
    const standarKode = extractStandarCode(kp);
    const anggaran = rkasItem.jumlah || 0;
    const realisasi = bkuTotalsByKode.get(kr) || 0;

    if (realisasi > 0) matchedBKUKodes.add(kr);

    const selisih = anggaran - realisasi;
    const persenRealisasi = anggaran > 0 ? Math.round((realisasi / anggaran) * 100) : (realisasi > 0 ? 999 : 0);

    let status: SPJItem['status'];
    if (realisasi === 0) status = 'belum';
    else if (persenRealisasi > 100) status = 'lebih';
    else if (persenRealisasi >= 95) status = 'lengkap';
    else status = 'sebagian';

    items.push({
      kodeRekening: kr,
      kodeProgram: kp,
      standarKode,
      standarNama: STANDAR_MAP[standarKode] || `Standar ${standarKode}`,
      uraian: rkasItem.uraian || '',
      anggaran,
      realisasi,
      selisih,
      persenRealisasi,
      status,
    });
  }

  // Group by standar
  const standarMap = new Map<string, SPJItem[]>();
  for (const item of items) {
    const code = item.standarKode || '00';
    if (!standarMap.has(code)) standarMap.set(code, []);
    standarMap.get(code)!.push(item);
  }

  const orderedCodes = ['02', '03', '04', '05', '06', '07', '08'];
  const standarGroups: SPJStandarGroup[] = [];

  for (const code of [...orderedCodes, ...Array.from(standarMap.keys()).filter(c => !orderedCodes.includes(c))]) {
    const groupItems = standarMap.get(code);
    if (!groupItems || groupItems.length === 0) continue;

    const anggaran = groupItems.reduce((s, i) => s + i.anggaran, 0);
    const realisasi = groupItems.reduce((s, i) => s + i.realisasi, 0);
    const selisih = anggaran - realisasi;
    const persenRealisasi = anggaran > 0 ? Math.round((realisasi / anggaran) * 100) : 0;

    standarGroups.push({
      kode: code,
      nama: STANDAR_MAP[code] || `Standar ${code}`,
      anggaran,
      realisasi,
      selisih,
      persenRealisasi,
      items: groupItems,
    });
  }

  const totalAnggaran = items.reduce((s, i) => s + i.anggaran, 0);
  const totalRealisasi = items.reduce((s, i) => s + i.realisasi, 0);
  const totalSelisih = totalAnggaran - totalRealisasi;
  const persenRealisasi = totalAnggaran > 0 ? Math.round((totalRealisasi / totalAnggaran) * 100) : 0;

  return {
    tahun,
    totalAnggaran,
    totalRealisasi,
    totalSelisih,
    persenRealisasi,
    standarGroups,
  };
}

// --- API Handler ---
export async function GET() {
  try {
    const rkasMonths = loadRKASData();
    const bkuMonths = loadBKUData();

    const rkasBulanan = rkasMonths.filter((m: any) => m.tipe === 'bulanan');
    const rkasTahunan = rkasMonths.filter((m: any) => m.tipe === 'tahunan');

    // Build monthly SPJ by matching RKAS Bulanan with BKU
    const bulanan: SPJMonth[] = [];

    for (const rkas of rkasBulanan) {
      const rkasBulan = (rkas.bulan || '').toUpperCase().trim();
      const rkasTahun = rkas.tahun || '';
      const matchingBKU = bkuMonths.find((b: any) =>
        (b.bulan || '').toUpperCase().trim() === rkasBulan && b.tahun === rkasTahun
      );

      bulanan.push(buildSPJMonth(rkas, matchingBKU));
    }

    // Also add BKU months that have no matching RKAS
    for (const bku of bkuMonths) {
      const bkuBulan = (bku.bulan || '').toUpperCase().trim();
      const bkuTahun = bku.tahun || '';
      const hasRKAS = rkasBulanan.some((r: any) =>
        (r.bulan || '').toUpperCase().trim() === bkuBulan && r.tahun === bkuTahun
      );
      if (!hasRKAS) {
        bulanan.push(buildSPJMonth(null, bku));
      }
    }

    // Sort by year then month
    bulanan.sort((a, b) => {
      if (a.tahun !== b.tahun) return a.tahun.localeCompare(b.tahun);
      return MONTH_ORDER.indexOf(a.bulan) - MONTH_ORDER.indexOf(b.bulan);
    });

    // Build tahunan SPJ
    const tahunan = buildSPJTahunan(
      rkasTahunan.length > 0 ? rkasTahunan[0] : null,
      bkuMonths
    );

    const result: SPJSummary = { bulanan, tahunan };
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('SPJ error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
