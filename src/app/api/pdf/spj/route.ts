import { NextResponse } from 'next/server';
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
  uraian: string;           // Combined descriptions from RKAS sub-items
  uraianBKU: string;        // Description from BKU for reference
  anggaran: number;         // From RKAS (aggregated)
  realisasi: number;        // From BKU (aggregated)
  selisih: number;          // anggaran - realisasi
  persenRealisasi: number;  // realisasi / anggaran * 100
  status: 'lengkap' | 'sebagian' | 'belum' | 'lebih';
  jumlahItem: number;       // Number of RKAS sub-items aggregated
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
  return kode.replace(/[\s\n\r]/g, '').replace(/\.+$/, '').trim();
}

function extractStandarCode(kodeProgram: string): string {
  if (!kodeProgram) return '';
  const cleaned = kodeProgram.replace(/\s/g, '');
  const match = cleaned.match(/^(\d{2})\./);
  return match ? match[1] : '';
}

// Composite key: normalized kodeProgram + kodeRekening
function compositeKey(kodeProgram: string, kodeRekening: string): string {
  return `${normalizeKode(kodeProgram)}|${normalizeKode(kodeRekening)}`;
}

// --- Load BKU data from cache ---
function loadBKUData(): any[] {
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

// --- Load RKAS data from cache ---
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

// --- Aggregate RKAS items by composite key ---
// Multiple RKAS rows with same kodeProgram+kodeRekening are sub-items that should be summed
interface AggregatedRKAS {
  kodeProgram: string;
  kodeRekening: string;
  standarKode: string;
  standarNama: string;
  uraianList: string[];    // All sub-item descriptions
  totalAnggaran: number;  // Sum of all sub-item jumlah
  jumlahItem: number;     // Number of sub-items
}

function aggregateRKASItems(rkasItems: any[]): Map<string, AggregatedRKAS> {
  const aggMap = new Map<string, AggregatedRKAS>();

  for (const item of rkasItems) {
    const kp = normalizeKode(item.kodeProgram || '');
    const kr = normalizeKode(item.kodeRekening || '');
    if (!kp || !kr) continue;

    const key = compositeKey(kp, kr);
    const standarKode = extractStandarCode(kp);
    const jumlah = item.jumlah || 0;
    const uraian = (item.uraian || '').trim();

    if (aggMap.has(key)) {
      const existing = aggMap.get(key)!;
      existing.totalAnggaran += jumlah;
      existing.jumlahItem += 1;
      if (uraian && !existing.uraianList.includes(uraian)) {
        existing.uraianList.push(uraian);
      }
    } else {
      aggMap.set(key, {
        kodeProgram: kp,
        kodeRekening: kr,
        standarKode,
        standarNama: STANDAR_MAP[standarKode] || `Standar ${standarKode}`,
        uraianList: uraian ? [uraian] : [],
        totalAnggaran: jumlah,
        jumlahItem: 1,
      });
    }
  }

  return aggMap;
}

// --- Aggregate BKU spending by composite key ---
interface AggregatedBKU {
  totalRealisasi: number;
  uraian: string;  // Representative description
}

function aggregateBKUTransactions(transactions: any[]): Map<string, AggregatedBKU> {
  const aggMap = new Map<string, AggregatedBKU>();

  for (const t of transactions) {
    const kr = normalizeKode(t.kodeRekening || '');
    if (!kr) continue; // Skip entries without kodeRekening (like "Tarik Tunai")
    const pengeluaran = t.pengeluaran || 0;
    if (pengeluaran <= 0) continue;

    const kk = normalizeKode(t.kodeKegiatan || '');
    const uraian = (t.uraian || '').trim();

    const key = compositeKey(kk, kr);

    if (aggMap.has(key)) {
      const existing = aggMap.get(key)!;
      existing.totalRealisasi += pengeluaran;
    } else {
      aggMap.set(key, {
        totalRealisasi: pengeluaran,
        uraian,
      });
    }
  }

  return aggMap;
}

// --- Build SPJ items from aggregated data ---
function buildSPJItems(rkasItems: any[], bkuTransactions: any[]): {
  items: SPJItem[];
  matchedBKUKeys: Set<string>;
  bkuAgg: Map<string, AggregatedBKU>;
} {
  const rkasAgg = aggregateRKASItems(rkasItems);
  const bkuAgg = aggregateBKUTransactions(bkuTransactions);
  const matchedBKUKeys = new Set<string>();

  const items: SPJItem[] = [];

  for (const [key, rkas] of rkasAgg) {
    const bkuMatch = bkuAgg.get(key);
    const realisasi = bkuMatch?.totalRealisasi || 0;
    const uraianBKU = bkuMatch?.uraian || '';

    if (realisasi > 0) {
      matchedBKUKeys.add(key);
    }

    const anggaran = rkas.totalAnggaran;
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

    // Combine uraian list - limit to prevent overly long strings
    const uraianCombined = rkas.uraianList.length <= 5
      ? rkas.uraianList.join('; ')
      : rkas.uraianList.slice(0, 5).join('; ') + ` (+${rkas.uraianList.length - 5} lainnya)`;

    items.push({
      kodeRekening: rkas.kodeRekening,
      kodeProgram: rkas.kodeProgram,
      standarKode: rkas.standarKode,
      standarNama: rkas.standarNama,
      uraian: uraianCombined,
      uraianBKU,
      anggaran,
      realisasi,
      selisih,
      persenRealisasi,
      status,
      jumlahItem: rkas.jumlahItem,
    });
  }

  return { items, matchedBKUKeys, bkuAgg };
}

// --- Group items by standar ---
function groupByStandar(items: SPJItem[]): SPJStandarGroup[] {
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

  return standarGroups;
}

// --- Build SPJ for a single month (BKU vs RKAS Bulanan) ---
function buildSPJMonth(rkasMonth: any, bkuMonth: any): SPJMonth {
  const bulan = rkasMonth?.bulan || bkuMonth?.bulan || '';
  const tahun = rkasMonth?.tahun || bkuMonth?.tahun || '';

  const bkuTransactions = bkuMonth?.transactions || [];
  const rkasItems = rkasMonth?.allItems || [];

  const { items, matchedBKUKeys, bkuAgg } = buildSPJItems(rkasItems, bkuTransactions);
  const standarGroups = groupByStandar(items);

  // Unmatched BKU: spending without matching RKAS anggaran
  const unmatchedBKU: SPJMonth['unmatchedBKU'] = [];
  for (const [key, data] of bkuAgg) {
    if (!matchedBKUKeys.has(key)) {
      const parts = key.split('|');
      unmatchedBKU.push({
        kodeRekening: parts[1] || '',
        kodeKegiatan: parts[0] || '',
        uraian: data.uraian,
        jumlah: data.totalRealisasi,
      });
    }
  }

  // Unmatched RKAS: anggaran without any realisasi
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

// --- Build SPJ Tahunan (cumulative BKU vs RKAS Tahunan) ---
function buildSPJTahunan(rkasTahunan: any, bkuMonths: any[]): SPJSummary['tahunan'] {
  if (!rkasTahunan) return null;

  const tahun = rkasTahunan.tahun || '';
  const rkasItems = rkasTahunan.allItems || [];

  // Collect ALL BKU transactions across all months
  const allBkuTransactions: any[] = [];
  for (const bm of bkuMonths) {
    if (!bm.transactions) continue;
    allBkuTransactions.push(...bm.transactions);
  }

  const { items, matchedBKUKeys, bkuAgg } = buildSPJItems(rkasItems, allBkuTransactions);
  const standarGroups = groupByStandar(items);

  // Unmatched BKU
  const unmatchedBKU: SPJMonth['unmatchedBKU'] = [];
  for (const [key, data] of bkuAgg) {
    if (!matchedBKUKeys.has(key)) {
      const parts = key.split('|');
      unmatchedBKU.push({
        kodeRekening: parts[1] || '',
        kodeKegiatan: parts[0] || '',
        uraian: data.uraian,
        jumlah: data.totalRealisasi,
      });
    }
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
