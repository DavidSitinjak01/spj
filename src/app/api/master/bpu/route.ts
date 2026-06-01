import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import fs from 'fs';
import path from 'path';

// ─── Helpers ────────────────────────────────────────────────────────────────────

function toRoman(num: number): string {
  const romanMap: [number, string][] = [
    [12, 'XII'], [11, 'XI'], [10, 'X'], [9, 'IX'],
    [8, 'VIII'], [7, 'VII'], [6, 'VI'], [5, 'V'],
    [4, 'IV'], [3, 'III'], [2, 'II'], [1, 'I'],
  ];
  for (const [value, symbol] of romanMap) {
    if (num === value) return symbol;
  }
  return '';
}

function generateNomorSurat(noPesanan: string, tglPesan: string, suffix: string, middlePart: string): string {
  if (!noPesanan || !tglPesan) return '';
  try {
    const date = new Date(tglPesan);
    if (isNaN(date.getTime())) return '';
    const month = date.getMonth() + 1; // 1-12
    const year = date.getFullYear();
    const paddedNo = noPesanan.padStart(3, '0');
    const romanMonth = toRoman(month);
    if (!romanMonth) return '';
    return `421.3/${paddedNo}${suffix}/${middlePart}/${romanMonth}/${year}`;
  } catch {
    return '';
  }
}

function computeNomorSurat(noPesanan: string, tglPesan: string) {
  return {
    nomorSuratPesanan: generateNomorSurat(noPesanan, tglPesan, '-P', 'DB/SMANSATLD'),
    nomorSuratBAST: generateNomorSurat(noPesanan, tglPesan, '-BAST', 'SMANSA-TD'),
    nomorSuratSHP: generateNomorSurat(noPesanan, tglPesan, '-PB', 'SMANSA-TD'),
  };
}

// ─── BKU Cache Types ────────────────────────────────────────────────────────────

interface BKUTransaction {
  tanggal: string;
  kodeKegiatan: string;
  kodeRekening: string;
  noBukti: string;
  uraian: string;
  penerimaan: number;
  pengeluaran: number;
  saldo: number;
}

interface BKUCacheData {
  data: {
    fileName: string;
    bulan: string;
    tahun: string;
    transactions: BKUTransaction[];
  };
}

// ─── GET: List all BPUs with items, toko, and auto nomor surat ──────────────────

export async function GET() {
  try {
    const bpus = await db.bPU.findMany({
      include: {
        items: { orderBy: { createdAt: 'asc' } },
        toko: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const result = bpus.map((bpu) => {
      const { nomorSuratPesanan, nomorSuratBAST, nomorSuratSHP } = computeNomorSurat(
        bpu.noPesanan,
        bpu.tglPesan
      );
      return {
        ...bpu,
        nomorSuratPesanan,
        nomorSuratBAST,
        nomorSuratSHP,
      };
    });

    return NextResponse.json({ data: result });
  } catch (error: any) {
    console.error('BPU list error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── POST: Create a new BPU ────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { noBukti, noPesanan, tglPesan, tokoId, bkuFileName, items } = body;

    // Check required field
    if (!noBukti) {
      return NextResponse.json({ error: 'noBukti is required' }, { status: 400 });
    }

    // Check duplicate noBukti
    const existing = await db.bPU.findUnique({ where: { noBukti } });
    if (existing) {
      return NextResponse.json(
        { error: `BPU with noBukti "${noBukti}" already exists` },
        { status: 409 }
      );
    }

    // Create BPU with optional items
    const bpu = await db.bPU.create({
      data: {
        noBukti,
        noPesanan: noPesanan || '',
        tglPesan: tglPesan || '',
        tokoId: tokoId || null,
        bkuFileName: bkuFileName || '',
        items: items?.length
          ? {
              create: items.map((item: any) => ({
                uraian: item.uraian || '',
                kodeRekening: item.kodeRekening || '',
                jumlah: item.jumlah || 0,
                hargaToko2: item.hargaToko2 || 0,
                volume: item.volume || '',
                satuan: item.satuan || '',
                tarifHarga: item.tarifHarga || 0,
              })),
            }
          : undefined,
      },
      include: {
        items: { orderBy: { createdAt: 'asc' } },
        toko: true,
      },
    });

    const { nomorSuratPesanan, nomorSuratBAST, nomorSuratSHP } = computeNomorSurat(
      bpu.noPesanan,
      bpu.tglPesan
    );

    return NextResponse.json(
      { data: { ...bpu, nomorSuratPesanan, nomorSuratBAST, nomorSuratSHP } },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('BPU create error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── PUT: Update a BPU ─────────────────────────────────────────────────────────

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, noPesanan, tglPesan, tokoId, bkuFileName, items } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    // Verify BPU exists
    const existing = await db.bPU.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'BPU not found' }, { status: 404 });
    }

    // Build update data
    const updateData: any = {};
    if (noPesanan !== undefined) updateData.noPesanan = noPesanan;
    if (tglPesan !== undefined) updateData.tglPesan = tglPesan;
    if (tokoId !== undefined) updateData.tokoId = tokoId || null;
    if (bkuFileName !== undefined) updateData.bkuFileName = bkuFileName;

    // If items provided, replace all existing items
    if (items !== undefined) {
      // Delete existing items
      await db.bPItem.deleteMany({ where: { bpuId: id } });

      // Create new items
      if (items.length > 0) {
        updateData.items = {
          create: items.map((item: any) => ({
            uraian: item.uraian || '',
            kodeRekening: item.kodeRekening || '',
            jumlah: item.jumlah || 0,
            hargaToko2: item.hargaToko2 || 0,
            volume: item.volume || '',
            satuan: item.satuan || '',
            tarifHarga: item.tarifHarga || 0,
          })),
        };
      }
    }

    const bpu = await db.bPU.update({
      where: { id },
      data: updateData,
      include: {
        items: { orderBy: { createdAt: 'asc' } },
        toko: true,
      },
    });

    const { nomorSuratPesanan, nomorSuratBAST, nomorSuratSHP } = computeNomorSurat(
      bpu.noPesanan,
      bpu.tglPesan
    );

    return NextResponse.json({ data: { ...bpu, nomorSuratPesanan, nomorSuratBAST, nomorSuratSHP } });
  } catch (error: any) {
    console.error('BPU update error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── DELETE: Delete a BPU and its items ─────────────────────────────────────────

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    // Verify BPU exists
    const existing = await db.bPU.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'BPU not found' }, { status: 404 });
    }

    // Delete BPU (cascade will delete items)
    await db.bPU.delete({ where: { id } });

    return NextResponse.json({ success: true, deleted: { id, noBukti: existing.noBukti } });
  } catch (error: any) {
    console.error('BPU delete error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── PATCH: Sync BPU data from BKU cache files ─────────────────────────────────

export async function PATCH() {
  try {
    const CACHE_DIR = path.join(process.cwd(), '.pdf-cache');

    // Check if cache directory exists
    if (!fs.existsSync(CACHE_DIR)) {
      return NextResponse.json({
        data: [],
        message: 'No BKU cache directory found',
      });
    }

    // Read all .bku.json files
    const cacheFiles = fs.readdirSync(CACHE_DIR).filter((f) => f.endsWith('.bku.json'));

    if (cacheFiles.length === 0) {
      return NextResponse.json({
        data: [],
        message: 'No BKU cache files found',
      });
    }

    // Parse all BKU cache files and extract BPU transactions
    const bpuGroups: Record<
      string,
      {
        transactions: BKUTransaction[];
        fileName: string;
        bulan: string;
        tahun: string;
      }
    > = {};

    for (const cacheFile of cacheFiles) {
      try {
        const cachePath = path.join(CACHE_DIR, cacheFile);
        const raw = fs.readFileSync(cachePath, 'utf-8');
        const cacheData: BKUCacheData = JSON.parse(raw);

        if (!cacheData.data?.transactions) continue;

        const { transactions, fileName, bulan, tahun } = cacheData.data;

        for (const tx of transactions) {
          // Filter: pengeluaran > 0 and noBukti starts with "BPU"
          if (tx.pengeluaran > 0 && tx.noBukti && tx.noBukti.toUpperCase().startsWith('BPU')) {
            const key = tx.noBukti;
            if (!bpuGroups[key]) {
              bpuGroups[key] = { transactions: [], fileName, bulan, tahun };
            }
            bpuGroups[key].transactions.push(tx);
            // Keep the latest fileName info (prefer later months)
            bpuGroups[key].fileName = fileName;
            bpuGroups[key].bulan = bulan;
            bpuGroups[key].tahun = tahun;
          }
        }
      } catch (err) {
        console.error(`Failed to parse BKU cache file ${cacheFile}:`, err);
        continue;
      }
    }

    if (Object.keys(bpuGroups).length === 0) {
      return NextResponse.json({
        data: [],
        message: 'No BPU transactions found in BKU cache files',
      });
    }

    // Sync each BPU group to the database
    const results = [];

    for (const [noBukti, group] of Object.entries(bpuGroups)) {
      try {
        // Parse tanggal from first transaction for tglPesan
        let tglPesan = '';
        if (group.transactions.length > 0 && group.transactions[0].tanggal) {
          const rawDate = group.transactions[0].tanggal;
          // Handle formats: "05/01/2025", "05-01-2025", "05-03-2026"
          const normalized = rawDate.replace(/\//g, '-');
          const parts = normalized.split('-');
          if (parts.length === 3) {
            // Assume DD-MM-YYYY format
            const day = parts[0].padStart(2, '0');
            const month = parts[1].padStart(2, '0');
            const year = parts[2];
            if (year.length === 4) {
              tglPesan = `${year}-${month}-${day}`;
            }
          }
        }

        // Build items from transactions
        const itemsData = group.transactions.map((tx) => ({
          uraian: tx.uraian || '',
          kodeRekening: (tx.kodeRekening || '').replace(/\n/g, ' ').trim(),
          jumlah: tx.pengeluaran || 0,
          hargaToko2: 0,
          volume: '',
          satuan: '',
          tarifHarga: 0,
        }));

        // Upsert: check if BPU with this noBukti already exists
        const existingBPU = await db.bPU.findUnique({
          where: { noBukti },
          include: { items: true },
        });

        if (existingBPU) {
          // Update: replace items, keep user-edited fields (noPesanan, tokoId, hargaToko2, volume, satuan, tarifHarga)
          // For items, we need to merge: keep user-edited fields on existing items, add new items, remove items not in BKU

          // Delete all existing items first
          await db.bPItem.deleteMany({ where: { bpuId: existingBPU.id } });

          // Create new items from BKU data
          // Try to match by uraian to preserve user-edited fields
          const existingItemMap = new Map(
            existingBPU.items.map((item) => [item.uraian.trim().toLowerCase(), item])
          );

          const mergedItems = itemsData.map((newItem) => {
            const matched = existingItemMap.get(newItem.uraian.trim().toLowerCase());
            return {
              uraian: newItem.uraian,
              kodeRekening: newItem.kodeRekening,
              jumlah: newItem.jumlah,
              hargaToko2: matched?.hargaToko2 || 0,
              volume: matched?.volume || '',
              satuan: matched?.satuan || '',
              tarifHarga: matched?.tarifHarga || 0,
            };
          });

          const updated = await db.bPU.update({
            where: { id: existingBPU.id },
            data: {
              tglPesan: tglPesan || existingBPU.tglPesan,
              bkuFileName: group.fileName,
              items: {
                create: mergedItems,
              },
            },
            include: {
              items: { orderBy: { createdAt: 'asc' } },
              toko: true,
            },
          });

          const { nomorSuratPesanan, nomorSuratBAST, nomorSuratSHP } = computeNomorSurat(
            updated.noPesanan,
            updated.tglPesan
          );

          results.push({
            action: 'updated',
            data: { ...updated, nomorSuratPesanan, nomorSuratBAST, nomorSuratSHP },
          });
        } else {
          // Create new BPU
          const created = await db.bPU.create({
            data: {
              noBukti,
              noPesanan: '',
              tglPesan,
              bkuFileName: group.fileName,
              items: {
                create: itemsData,
              },
            },
            include: {
              items: { orderBy: { createdAt: 'asc' } },
              toko: true,
            },
          });

          const { nomorSuratPesanan, nomorSuratBAST, nomorSuratSHP } = computeNomorSurat(
            created.noPesanan,
            created.tglPesan
          );

          results.push({
            action: 'created',
            data: { ...created, nomorSuratPesanan, nomorSuratBAST, nomorSuratSHP },
          });
        }
      } catch (err) {
        console.error(`Failed to sync BPU ${noBukti}:`, err);
        results.push({
          action: 'error',
          noBukti,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      data: results,
      summary: {
        total: results.length,
        created: results.filter((r) => r.action === 'created').length,
        updated: results.filter((r) => r.action === 'updated').length,
        errors: results.filter((r) => r.action === 'error').length,
      },
    });
  } catch (error: any) {
    console.error('BPU sync error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
