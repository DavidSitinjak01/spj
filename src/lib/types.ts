/**
 * Shared types for the SPJ (Surat Pertanggungjawaban) application.
 * Used by both frontend (page.tsx / components) and backend (API routes / services).
 */

// ============================================================================
// BKU (Buku Kas Umum) Types
// ============================================================================

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

export interface BKUMonth {
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

// ============================================================================
// BKU Pajak Types
// ============================================================================

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

export interface BKUPajakMonth {
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

// ============================================================================
// RKAS (Rencana Kegiatan dan Anggaran Sekolah) Types
// ============================================================================

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

export interface RKASStandar {
  kode: string;
  nama: string;
  items: RKASItem[];
  total: number;
}

export interface RKASPenerimaanItem {
  kode: string;
  nama: string;
  jumlah: number;
}

export interface RKASMonth {
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

// ============================================================================
// SPJ (Surat Pertanggungjawaban) Types
// ============================================================================

export interface SPJItem {
  kodeRekening: string;
  kodeProgram: string;
  standarKode: string;
  standarNama: string;
  uraian: string;
  uraianBKU: string;
  anggaran: number;
  realisasi: number;
  selisih: number;
  persenRealisasi: number;
  status: 'lengkap' | 'sebagian' | 'belum' | 'lebih';
  jumlahItem: number;
}

export interface SPJStandarGroup {
  kode: string;
  nama: string;
  anggaran: number;
  realisasi: number;
  selisih: number;
  persenRealisasi: number;
  items: SPJItem[];
}

export interface SPJMonth {
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

export interface SPJSummary {
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

// ============================================================================
// Data Sekolah & KOP Types
// ============================================================================

export interface KopRowData {
  id: string;
  urutan: number;
  teks: string;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  bold: boolean;
  italic: boolean;
  uppercase: boolean;
}

// ============================================================================
// Budget / Dashboard Types
// ============================================================================

export interface BudgetData {
  profil: {
    namaSekolah: string;
    npsn: string;
    alamat: string;
    kabupaten: string;
    provinsi: string;
    tahunAnggaran: string;
    kepalaSekolah: string;
    bendahara: string;
    komiteSekolah: string;
  };
  penerimaan: {
    total: number;
    sumber: { nama: string; kode: string; jumlah: number }[];
  };
  alokasiStandar: { kode: string; nama: string; jumlah: number; persen: number }[];
  alokasiBelanja: { operasi: number; modal: number };
  belanjaTerbesar: { nama: string; jumlah: number; kategori: string }[];
  pegawai: { nama: string; jenis: string; honor: number }[];
  pengadaan: { nama: string; jumlah: number; kategori: string }[];
  sumberDanaDetail: {
    bospRegulerOperasi: number;
    bospRegulerModal: number;
    bospDaerahOperasi: number;
    bospDaerahModal: number;
  };
}

// ============================================================================
// PDF / Document Types
// ============================================================================

export interface PDFPage { page: number; text: string }
export interface PDFData { fileName: string; pageCount: number; pageImages: string[]; extractedText: PDFPage[] }
export interface Summary { title: string; type: string; summary: string; keyPoints: string[]; totalAmount: string; entity: string; period: string }
export interface ChatMessage { role: 'user' | 'assistant'; content: string }

export type SPJDocType = 'surat-pesanan' | 'surat-balasan' | 'bast' | 'dokumen-perencanaan' | 'surat-hasil-pemeriksaan' | 'kuitansi-pembayaran'

// ============================================================================
// Shared Constants
// ============================================================================

export const MONTH_ORDER = [
  'JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI',
  'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER',
] as const;

export const MONTH_NAMES: Record<string, string> = {
  'JANUARI': 'Jan', 'FEBRUARI': 'Feb', 'MARET': 'Mar', 'APRIL': 'Apr',
  'MEI': 'Mei', 'JUNI': 'Jun', 'JULI': 'Jul', 'AGUSTUS': 'Agu',
  'SEPTEMBER': 'Sep', 'OKTOBER': 'Okt', 'NOVEMBER': 'Nov', 'DESEMBER': 'Des',
};

export const STANDAR_MAP: Record<string, string> = {
  '02': 'Standar Isi',
  '03': 'Standar Proses',
  '04': 'Standar Tenaga Kependidikan',
  '05': 'Standar Sarana dan Prasarana',
  '06': 'Standar Pengelolaan',
  '07': 'Standar Pembiayaan',
  '08': 'Standar Penilaian Pendidikan',
};
