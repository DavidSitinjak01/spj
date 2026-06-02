/**
 * Shared database service for BKU, BKU Pajak, and RKAS data persistence.
 * 
 * KEY BEHAVIOR: Append-by-month (NOT replace-all)
 * - Uploading BKU Januari ADDS/UPDATES January data only
 * - Existing data for other months is NEVER touched
 * - If January data already exists, it is UPDATED (upsert)
 * - This applies to all three document types: BKU, BKU Pajak, RKAS
 */

import { db } from '@/lib/db';
import type {
  BKUMonth, BKUPajakMonth, RKASMonth,
} from '@/lib/types';

// ============================================================================
// BKU Database Service
// ============================================================================

function bkuMonthToDB(data: BKUMonth) {
  return {
    fileName: data.fileName,
    bulan: data.bulan,
    tahun: data.tahun,
    sumberDana: data.sumberDana,
    namaSekolah: data.namaSekolah,
    npsn: data.npsn,
    totalPenerimaan: BigInt(data.totalPenerimaan),
    totalPengeluaran: BigInt(data.totalPengeluaran),
    saldoAkhir: BigInt(data.saldoAkhir),
    saldoAkhirBank: BigInt(data.saldoAkhirBank),
    saldoAkhirTunai: BigInt(data.saldoAkhirTunai),
    tanggalTutup: data.tanggalTutup,
    transactions: data.transactions as unknown[],
  };
}

function dbToBKUMonth(record: {
  fileName: string; bulan: string; tahun: string; sumberDana: string;
  namaSekolah: string; npsn: string; transactions: unknown;
  totalPenerimaan: bigint; totalPengeluaran: bigint; saldoAkhir: bigint;
  saldoAkhirBank: bigint; saldoAkhirTunai: bigint; tanggalTutup: string;
}): BKUMonth {
  return {
    fileName: record.fileName,
    bulan: record.bulan,
    tahun: record.tahun,
    sumberDana: record.sumberDana,
    namaSekolah: record.namaSekolah,
    npsn: record.npsn,
    transactions: record.transactions as BKUMonth['transactions'],
    totalPenerimaan: Number(record.totalPenerimaan),
    totalPengeluaran: Number(record.totalPengeluaran),
    saldoAkhir: Number(record.saldoAkhir),
    saldoAkhirBank: Number(record.saldoAkhirBank),
    saldoAkhirTunai: Number(record.saldoAkhirTunai),
    tanggalTutup: record.tanggalTutup,
  };
}

export async function saveBKUToDB(data: BKUMonth): Promise<{ replaced: boolean }> {
  try {
    const dbData = bkuMonthToDB(data);
    // Check if record already exists for this bulan+tahun
    const existing = await db.bKUMonthDB.findUnique({
      where: { bulan_tahun: { bulan: data.bulan, tahun: data.tahun } },
    });
    await db.bKUMonthDB.upsert({
      where: { bulan_tahun: { bulan: data.bulan, tahun: data.tahun } },
      update: dbData,
      create: dbData,
    });
    return { replaced: !!existing };
  } catch (err) {
    console.error(`Failed to save BKU to DB (${data.bulan} ${data.tahun}):`, err);
    throw err;
  }
}

export async function getBKUFromDB(fileName: string): Promise<BKUMonth | null> {
  try {
    const record = await db.bKUMonthDB.findFirst({ where: { fileName } });
    if (record) return dbToBKUMonth(record);
    return null;
  } catch (err) {
    console.error(`Failed to read BKU from DB (${fileName}):`, err);
    return null;
  }
}

export async function getAllBKUFromDB(): Promise<BKUMonth[]> {
  try {
    const records = await db.bKUMonthDB.findMany({ orderBy: [{ tahun: 'asc' }, { bulan: 'asc' }] });
    return records.map(dbToBKUMonth);
  } catch (err) {
    console.error('Failed to read all BKU from DB:', err);
    return [];
  }
}

export async function deleteBKUFromDB(fileName: string): Promise<void> {
  try {
    await db.bKUMonthDB.deleteMany({ where: { fileName } });
  } catch (err) {
    console.error(`Failed to delete BKU from DB (${fileName}):`, err);
  }
}

// ============================================================================
// BKU Pajak Database Service
// ============================================================================

function bkuPajakMonthToDB(data: BKUPajakMonth) {
  return {
    fileName: data.fileName,
    bulan: data.bulan,
    tahun: data.tahun,
    sumberDana: data.sumberDana,
    namaSekolah: data.namaSekolah,
    npsn: data.npsn,
    alamat: data.alamat,
    kabupaten: data.kabupaten,
    provinsi: data.provinsi,
    totalPPN: BigInt(data.totalPPN),
    totalPPh21: BigInt(data.totalPPh21),
    totalPPh23: BigInt(data.totalPPh23),
    totalPPh4: BigInt(data.totalPPh4),
    totalSSPD: BigInt(data.totalSSPD),
    totalPenerimaan: BigInt(data.totalPenerimaan),
    totalPengeluaran: BigInt(data.totalPengeluaran),
    saldoAkhir: BigInt(data.saldoAkhir),
    transactions: data.transactions as any,
    jenisPajak: data.jenisPajak as any,
    tanggalTutup: data.tanggalTutup,
    kepalaSekolah: data.kepalaSekolah,
    bendahara: data.bendahara,
  };
}

function dbToBKUPajakMonth(record: any): BKUPajakMonth {
  return {
    fileName: record.fileName,
    bulan: record.bulan,
    tahun: record.tahun,
    sumberDana: record.sumberDana,
    namaSekolah: record.namaSekolah,
    npsn: record.npsn,
    alamat: record.alamat,
    kabupaten: record.kabupaten,
    provinsi: record.provinsi,
    transactions: record.transactions as BKUPajakMonth['transactions'],
    totalPPN: Number(record.totalPPN),
    totalPPh21: Number(record.totalPPh21),
    totalPPh23: Number(record.totalPPh23),
    totalPPh4: Number(record.totalPPh4),
    totalSSPD: Number(record.totalSSPD),
    totalPenerimaan: Number(record.totalPenerimaan),
    totalPengeluaran: Number(record.totalPengeluaran),
    saldoAkhir: Number(record.saldoAkhir),
    jenisPajak: record.jenisPajak as BKUPajakMonth['jenisPajak'],
    tanggalTutup: record.tanggalTutup,
    kepalaSekolah: record.kepalaSekolah,
    bendahara: record.bendahara,
  };
}

export async function saveBKUPajakToDB(data: BKUPajakMonth): Promise<{ replaced: boolean }> {
  try {
    const dbData = bkuPajakMonthToDB(data);
    const existing = await db.bKUPajakMonthDB.findUnique({
      where: { bulan_tahun: { bulan: data.bulan, tahun: data.tahun } },
    });
    await db.bKUPajakMonthDB.upsert({
      where: { bulan_tahun: { bulan: data.bulan, tahun: data.tahun } },
      update: dbData,
      create: dbData,
    });
    return { replaced: !!existing };
  } catch (err) {
    console.error(`Failed to save BKU Pajak to DB (${data.bulan} ${data.tahun}):`, err);
    throw err;
  }
}

export async function getBKUPajakFromDB(fileName: string): Promise<BKUPajakMonth | null> {
  try {
    const record = await db.bKUPajakMonthDB.findFirst({ where: { fileName } });
    if (record) return dbToBKUPajakMonth(record);
    return null;
  } catch (err) {
    console.error(`Failed to read BKU Pajak from DB (${fileName}):`, err);
    return null;
  }
}

export async function getAllBKUPajakFromDB(): Promise<BKUPajakMonth[]> {
  try {
    const records = await db.bKUPajakMonthDB.findMany({ orderBy: [{ tahun: 'asc' }, { bulan: 'asc' }] });
    return records.map(dbToBKUPajakMonth);
  } catch (err) {
    console.error('Failed to read all BKU Pajak from DB:', err);
    return [];
  }
}

export async function deleteBKUPajakFromDB(fileName: string): Promise<void> {
  try {
    await db.bKUPajakMonthDB.deleteMany({ where: { fileName } });
  } catch (err) {
    console.error(`Failed to delete BKU Pajak from DB (${fileName}):`, err);
  }
}

// ============================================================================
// RKAS Database Service
// ============================================================================

function rkasMonthToDB(data: RKASMonth) {
  return {
    fileName: data.fileName,
    judul: data.judul,
    bulan: data.bulan,
    tahun: data.tahun,
    tipe: data.tipe,
    sumberDana: data.sumberDana,
    namaSekolah: data.namaSekolah,
    npsn: data.npsn,
    alamat: data.alamat,
    kabupaten: data.kabupaten,
    provinsi: data.provinsi,
    totalPenerimaan: BigInt(data.totalPenerimaan),
    totalBelanja: BigInt(data.totalBelanja),
    penerimaan: data.penerimaan as any,
    standarList: data.standarList as any,
    allItems: data.allItems as any,
  };
}

function dbToRKASMonth(record: any): RKASMonth {
  return {
    fileName: record.fileName,
    judul: record.judul,
    bulan: record.bulan,
    tahun: record.tahun,
    tipe: record.tipe as 'bulanan' | 'tahunan',
    sumberDana: record.sumberDana,
    namaSekolah: record.namaSekolah,
    npsn: record.npsn,
    alamat: record.alamat,
    kabupaten: record.kabupaten,
    provinsi: record.provinsi,
    totalPenerimaan: Number(record.totalPenerimaan),
    totalBelanja: Number(record.totalBelanja),
    penerimaan: record.penerimaan as RKASMonth['penerimaan'],
    standarList: record.standarList as RKASMonth['standarList'],
    allItems: record.allItems as RKASMonth['allItems'],
  };
}

export async function saveRKASToDB(data: RKASMonth): Promise<{ replaced: boolean }> {
  try {
    const dbData = rkasMonthToDB(data);
    // RKAS unique key is (bulan, tahun, tipe) - supports both bulanan and tahunan
    const existing = await db.rKASMonthDB.findUnique({
      where: { bulan_tahun_tipe: { bulan: data.bulan, tahun: data.tahun, tipe: data.tipe } },
    });
    await db.rKASMonthDB.upsert({
      where: { bulan_tahun_tipe: { bulan: data.bulan, tahun: data.tahun, tipe: data.tipe } },
      update: dbData,
      create: dbData,
    });
    return { replaced: !!existing };
  } catch (err) {
    console.error(`Failed to save RKAS to DB (${data.bulan} ${data.tahun} ${data.tipe}):`, err);
    throw err;
  }
}

export async function getRKASFromDB(fileName: string): Promise<RKASMonth | null> {
  try {
    const record = await db.rKASMonthDB.findFirst({ where: { fileName } });
    if (record) return dbToRKASMonth(record);
    return null;
  } catch (err) {
    console.error(`Failed to read RKAS from DB (${fileName}):`, err);
    return null;
  }
}

export async function getAllRKASFromDB(): Promise<RKASMonth[]> {
  try {
    const records = await db.rKASMonthDB.findMany({ orderBy: [{ tahun: 'asc' }, { tipe: 'asc' }, { bulan: 'asc' }] });
    return records.map(dbToRKASMonth);
  } catch (err) {
    console.error('Failed to read all RKAS from DB:', err);
    return [];
  }
}

export async function deleteRKASFromDB(fileName: string): Promise<void> {
  try {
    await db.rKASMonthDB.deleteMany({ where: { fileName } });
  } catch (err) {
    console.error(`Failed to delete RKAS from DB (${fileName}):`, err);
  }
}
