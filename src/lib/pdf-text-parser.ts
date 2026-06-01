/**
 * Shared text-based PDF parsing functions for serverless (Vercel) mode.
 * Used by BKU, BKU Pajak, RKAS, SPJ, BPU, BNU, and Sekolah routes
 * when running on serverless where Python/pdfplumber is unavailable.
 */

// --- Shared Types ---
export interface BKUTransaction {
  tanggal: string;
  kodeKegiatan: string;
  kodeRekening: string;
  noBukti: string;
  uraian: string;
  penerimaan: number;
  pengeluaran: number;
  saldo: number;
}

export interface BKUMonthData {
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

export interface BKUPajakTransaction {
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

export interface BKUPajakJenisPajak {
  kode: string;
  nama: string;
  totalPenerimaan: number;
  totalPengeluaran: number;
  jumlahTransaksi: number;
}

export interface BKUPajakMonthData {
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

export interface RKASItem {
  noUrut: string;
  kodeRekening: string;
  kodeProgram: string;
  uraian: string;
  volume: string;
  satuan: string;
  tarifHarga: number;
  jumlah: number;
}

export interface RKASMonthData {
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
  penerimaan: { kode: string; nama: string; jumlah: number }[];
  standarList: { kode: string; nama: string; items: RKASItem[]; total: number }[];
  allItems: RKASItem[];
}

// --- Helpers ---
function parseAmount(s: string | null | undefined): number {
  if (!s) return 0;
  const cleaned = s.replace(/\./g, '').replace(/,/g, '').replace(/\s/g, '').trim();
  if (!cleaned || cleaned === '-') return 0;
  return parseInt(cleaned) || 0;
}

function reMatch(pattern: RegExp, text: string): RegExpMatchArray | null {
  return text.match(pattern);
}

function reSearch(pattern: RegExp, text: string): boolean {
  return pattern.test(text);
}

// --- BKU Text Parser ---
export function parseBKUFromText(text: string, fileName: string): BKUMonthData {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const headerInfo: Record<string, string> = {};

  for (const line of lines) {
    const bulanMatch = line.match(/BULAN\s*:\s*(\w+)/i);
    if (bulanMatch) headerInfo.bulan = bulanMatch[1];

    const tahunMatch = line.match(/TAHUN\s*:\s*(\d{4})/i);
    if (tahunMatch) headerInfo.tahun = tahunMatch[1];

    const bulanTahun = line.match(/BULAN\s*:\s*(\w+)\s+(\d{4})/i);
    if (bulanTahun) {
      headerInfo.bulan = bulanTahun[1];
      headerInfo.tahun = bulanTahun[2];
    }

    if (line.includes('Sumber Dana')) {
      const sdMatch = line.match(/Sumber Dana\s*:?\s*(.+)/i);
      if (sdMatch) {
        const val = sdMatch[1].trim();
        if (val && val !== ':' && !val.includes('No.') && !val.includes('Kode')) {
          headerInfo.sumberDana = val;
        }
      }
    }

    const sekolahMatch = line.match(/Nama Sekolah\s*:\s*(.+)/i);
    if (sekolahMatch) headerInfo.namaSekolah = sekolahMatch[1].trim();

    const npsnMatch = line.match(/NPSN\s*:\s*(\d+)/i);
    if (npsnMatch && !headerInfo.npsn) headerInfo.npsn = npsnMatch[1];
  }

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

  // Transaction rows
  const transactions: BKUTransaction[] = [];
  let totalPenerimaan = 0;
  let totalPengeluaran = 0;
  let lastSaldo = 0;

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

  return {
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
}

// --- BKU Pajak Text Parser ---
export function parseBKUPajakFromText(text: string, fileName: string): BKUPajakMonthData {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const headerInfo: Record<string, string> = {};

  for (const line of lines) {
    const bulanMatch = line.match(/BULAN\s*:\s*(\w+)/i);
    if (bulanMatch) headerInfo.bulan = bulanMatch[1];

    const tahunMatch = line.match(/TAHUN\s*:\s*(\d{4})/i);
    if (tahunMatch) headerInfo.tahun = tahunMatch[1];

    const bulanTahun = line.match(/BULAN\s*:\s*(\w+)\s+(\d{4})/i);
    if (bulanTahun) {
      headerInfo.bulan = bulanTahun[1];
      headerInfo.tahun = bulanTahun[2];
    }

    const npsnMatch = line.match(/NPSN\s*:\s*(\d+)/i);
    if (npsnMatch && !headerInfo.npsn) headerInfo.npsn = npsnMatch[1];

    const sekolahMatch = line.match(/Nama Sekolah\s*:\s*(.+)/i);
    if (sekolahMatch) headerInfo.namaSekolah = sekolahMatch[1].trim();

    const alamatMatch = line.match(/Desa\/Kecamatan\s*:\s*(.+)/i);
    if (alamatMatch) headerInfo.alamat = alamatMatch[1].trim();

    const kabMatch = line.match(/Kabupaten\s*\/?\s*Kota\s*:\s*(.+)/i);
    if (kabMatch) headerInfo.kabupaten = kabMatch[1].trim();

    const provMatch = line.match(/Provinsi\s*:\s*(.+)/i);
    if (provMatch) headerInfo.provinsi = provMatch[1].trim();

    if (line.includes('Sumber Dana')) {
      const sdMatch = line.match(/Sumber Dana\s*:?\s*(.+)/i);
      if (sdMatch) {
        const val = sdMatch[1].trim();
        if (val && val !== ':' && !val.includes('No.') && !val.includes('Kode')) {
          headerInfo.sumberDana = val;
        }
      }
    }

    if (line.includes('Kepala Sekolah')) headerInfo.kepalaSekolah = 'Kepala Sekolah';
    if (line.includes('Bendahara') && headerInfo.kepalaSekolah) headerInfo.bendahara = 'Bendahara';

    const nameMatch = line.match(/^[A-Z][a-z]+.*(?:S\.Pd|S\.Kom|M\.M|M\.Si|S\.E|S\.S)/);
    if (nameMatch) {
      if (!headerInfo.kepalaSekolahName) {
        headerInfo.kepalaSekolahName = line.trim();
      } else if (!headerInfo.bendaharaName) {
        headerInfo.bendaharaName = line.trim();
      }
    }
  }

  if (!headerInfo.tahun) {
    const tahunM = text.match(/:\s*(\d{4})/);
    if (tahunM) headerInfo.tahun = tahunM[1];
  }

  const tanggalMatch = text.match(/(\d{1,2}\s+\w+\s+\d{4})/);
  if (tanggalMatch) headerInfo.tanggalTutup = tanggalMatch[1];

  // Transaction rows
  const transactions: BKUPajakTransaction[] = [];
  let totalPPN = 0, totalPPh21 = 0, totalPPh23 = 0, totalPPh4 = 0, totalSSPD = 0;
  let totalPenerimaan = 0, totalPengeluaran = 0, saldoAkhir = 0;

  const jenisPajakMap = new Map<string, { nama: string; totalPenerimaan: number; totalPengeluaran: number; jumlahTransaksi: number }>();

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

  const namaMap = new Map<string, BKUPajakJenisPajak>();
  for (const [kode, info] of jenisPajakMap) {
    const key = info.nama;
    const existing = namaMap.get(key);
    if (existing) {
      existing.totalPenerimaan += info.totalPenerimaan;
      existing.totalPengeluaran += info.totalPengeluaran;
      existing.jumlahTransaksi += info.jumlahTransaksi;
    } else {
      namaMap.set(key, { kode, ...info });
    }
  }
  const jenisPajak = Array.from(namaMap.values()).sort((a, b) => b.totalPenerimaan - a.totalPenerimaan);

  return {
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
    totalPPN, totalPPh21, totalPPh23, totalPPh4, totalSSPD,
    totalPenerimaan, totalPengeluaran, saldoAkhir,
    jenisPajak,
    tanggalTutup: headerInfo.tanggalTutup || '',
    kepalaSekolah: headerInfo.kepalaSekolahName || headerInfo.kepalaSekolah || '',
    bendahara: headerInfo.bendaharaName || headerInfo.bendahara || '',
  };
}

// --- RKAS Text Parser ---
export function parseRKASFromText(text: string, fileName: string): RKASMonthData {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const headerInfo: Record<string, string> = {};

  const judulParts: string[] = [];
  for (const line of lines.slice(0, 10)) {
    if (reSearch(/(NPSN|TAHUN ANGGARAN|Nama Sekolah|Alamat|Kabupaten|Provinsi|Bulan)\s*:/i, line)) break;
    if (reSearch(/Halaman.*dari/i, line)) continue;
    if (reSearch(/Kertas Kerja.*NPSN/i, line)) continue;
    judulParts.push(line);
  }
  headerInfo.judul = judulParts.join(' ');

  const judulUpper = headerInfo.judul.toUpperCase();
  if (judulUpper.includes('PERBULAN') || judulUpper.includes('BULANAN')) {
    headerInfo.tipeFromJudul = 'bulanan';
  } else if (judulUpper.includes('TAHUNAN') || (judulUpper.includes('RKAS') && !judulUpper.includes('PERBULAN'))) {
    headerInfo.tipeFromJudul = 'tahunan';
  }

  for (const line of lines) {
    if (line.includes('Halaman') && line.includes('dari')) continue;
    if (line.includes('Kertas Kerja') && line.includes('NPSN')) continue;

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
    if (sekolahMatch) headerInfo.namaSekolah = sekolahMatch[1].trim();

    const alamatMatch = reMatch(/Alamat\s*:\s*(.+)/i, line);
    if (alamatMatch) headerInfo.alamat = alamatMatch[1].trim();

    const kabMatch = reMatch(/Kabupaten\s*:\s*(.+)/i, line);
    if (kabMatch) headerInfo.kabupaten = kabMatch[1].trim();

    const provMatch = reMatch(/Provinsi\s*:\s*(.+)/i, line);
    if (provMatch) headerInfo.provinsi = provMatch[1].trim();

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

  if (!headerInfo.tahun) {
    const tahunM = reMatch(/:\s*(\d{4})/, text);
    if (tahunM) headerInfo.tahun = tahunM[1];
  }

  // Penerimaan
  const penerimaan: { kode: string; nama: string; jumlah: number }[] = [];
  let totalPenerimaan = 0;
  let inPenerimaan = false;

  for (const line of lines) {
    const upperLine = line.toUpperCase();
    if (upperLine.includes('PENERIMAAN') && (upperLine.includes('KODE') || upperLine.includes('NO'))) {
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
      if (upperLine.includes('BELANJA') || upperLine.includes('PENGELUARAN')) {
        inPenerimaan = false;
        continue;
      }
      const match = reMatch(/^(\d+\.\d+(?:\.\d+)?)\s+(.+?)\s+([\d.]+)$/, line);
      if (match) {
        penerimaan.push({ kode: match[1], nama: match[2].trim(), jumlah: parseAmount(match[3]) });
      }
    }
  }

  if (totalPenerimaan === 0 && penerimaan.length > 0) {
    totalPenerimaan = penerimaan.reduce((s, p) => s + p.jumlah, 0);
  }

  // Belanja
  const belanjaRaw: {
    noUrut: string; kodeRekening: string; kodeProgram: string; uraian: string;
    volume: string; satuan: string; tarifHarga: string; jumlah: string;
  }[] = [];

  let inBelanja = false;
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
        noUrut: fullMatch[1], kodeRekening: fullMatch[2], kodeProgram: fullMatch[3],
        uraian: fullMatch[4].trim(), volume: fullMatch[5], satuan: fullMatch[6],
        tarifHarga: fullMatch[7], jumlah: fullMatch[8],
      });
      continue;
    }

    const simpleMatch = reMatch(/^(\d+)\s+(\d+\.[\d.]+)\s+(\d{2}\.[\d.]+)\s+(.+?)\s+(\d[\d.]+)\s*$/, line);
    if (simpleMatch) {
      belanjaRaw.push({
        noUrut: simpleMatch[1], kodeRekening: simpleMatch[2], kodeProgram: simpleMatch[3],
        uraian: simpleMatch[4].trim(), volume: '', satuan: '', tarifHarga: '', jumlah: simpleMatch[5],
      });
      continue;
    }
  }

  // Build items
  const STANDAR_MAP: Record<string, string> = {
    '02': 'Standar Isi', '03': 'Standar Proses', '04': 'Standar Tenaga Kependidikan',
    '05': 'Standar Sarana dan Prasarana', '06': 'Standar Pengelolaan',
    '07': 'Standar Pembiayaan', '08': 'Standar Penilaian Pendidikan',
  };

  function extractStandarCode(kodeProgram: string): string {
    if (!kodeProgram) return '';
    const cleaned = kodeProgram.replace(/\s/g, '');
    const match = cleaned.match(/^(\d{2})\./);
    return match ? match[1] : '';
  }

  const rawItems: RKASItem[] = belanjaRaw
    .filter(r => r.kodeRekening && r.kodeRekening.trim() !== '')
    .map(r => ({
      noUrut: r.noUrut, kodeRekening: r.kodeRekening, kodeProgram: r.kodeProgram,
      uraian: r.uraian, volume: r.volume, satuan: r.satuan,
      tarifHarga: parseAmount(r.tarifHarga), jumlah: parseAmount(r.jumlah),
    }));

  // Filter intermediate rows
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
    if (!isIntermediate) allItems.push(item);
  }

  // Group by standar
  const standarMap = new Map<string, RKASItem[]>();
  for (const item of allItems) {
    const standarCode = extractStandarCode(item.kodeProgram);
    if (standarCode) {
      if (!standarMap.has(standarCode)) standarMap.set(standarCode, []);
      standarMap.get(standarCode)!.push(item);
    }
  }

  const standarList: { kode: string; nama: string; items: RKASItem[]; total: number }[] = [];
  const orderedCodes = ['02', '03', '04', '05', '06', '07', '08'];
  for (const code of orderedCodes) {
    const items = standarMap.get(code);
    if (items && items.length > 0) {
      standarList.push({ kode: code, nama: STANDAR_MAP[code] || `Standar ${code}`, items, total: items.reduce((s, item) => s + item.jumlah, 0) });
    }
  }
  for (const [code, items] of standarMap) {
    if (!orderedCodes.includes(code) && items.length > 0) {
      standarList.push({ kode: code, nama: STANDAR_MAP[code] || `Standar ${code}`, items, total: items.reduce((s, item) => s + item.jumlah, 0) });
    }
  }

  const totalBelanja = allItems.reduce((s, item) => s + item.jumlah, 0);

  const bulanValue = (headerInfo.bulan || '').toUpperCase();
  const tipeFromJudul = headerInfo.tipeFromJudul || '';
  let tipe: 'bulanan' | 'tahunan';
  if (tipeFromJudul === 'bulanan') tipe = 'bulanan';
  else if (tipeFromJudul === 'tahunan') tipe = 'tahunan';
  else tipe = bulanValue ? 'bulanan' : 'tahunan';

  const judul = headerInfo.judul || (tipe === 'bulanan' ? 'Rincian Kertas Kerja Perbulan' : 'Kertas Kerja RKAS');

  return {
    fileName, judul, bulan: bulanValue, tahun: headerInfo.tahun || '', tipe,
    sumberDana: headerInfo.sumberDana || '', namaSekolah: headerInfo.namaSekolah || '',
    npsn: headerInfo.npsn || '', alamat: headerInfo.alamat || '',
    kabupaten: headerInfo.kabupaten || '', provinsi: headerInfo.provinsi || '',
    totalPenerimaan, totalBelanja, penerimaan, standarList, allItems,
  };
}
