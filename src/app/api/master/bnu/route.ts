import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isServerless, serverlessErrorResponse } from '@/lib/serverless';
import fs from 'fs';
import path from 'path';

// ─── Helpers ────────────────────────────────────────────────────────────────

function toRoman(num: number): string {
  const romanMap: [number, string][] = [
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let result = '';
  for (const [value, symbol] of romanMap) {
    while (num >= value) {
      result += symbol;
      num -= value;
    }
  }
  return result;
}

function parseDateToMonthYear(dateStr: string): { month: number; year: number } {
  if (!dateStr) return { month: 0, year: 0 };
  try {
    // Try ISO format first (YYYY-MM-DD)
    const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return { month: parseInt(isoMatch[2]), year: parseInt(isoMatch[1]) };
    }
    // Try DD-MM-YYYY format
    const dmyMatch = dateStr.match(/^(\d{2})-(\d{2})-(\d{4})/);
    if (dmyMatch) {
      return { month: parseInt(dmyMatch[2]), year: parseInt(dmyMatch[3]) };
    }
  } catch {}
  return { month: 0, year: 0 };
}

function generateNomorSurat(noPesanan: string, tglPesan: string) {
  const paddedNo = noPesanan.padStart(3, '0');
  const { month, year } = parseDateToMonthYear(tglPesan);
  const romanMonth = month > 0 ? toRoman(month) : '';
  const yearStr = year > 0 ? String(year) : '';

  return {
    nomorSuratPesanan: `421.3/${paddedNo}-P/DB/SMANSATLD/${romanMonth}/${yearStr}`,
    nomorSuratBAST: `421.3/${paddedNo}-BAST/SMANSA-TD/${romanMonth}/${yearStr}`,
    nomorSuratSHP: `421.3/${paddedNo}-PB/SMANSA-TD/${romanMonth}/${yearStr}`,
  };
}

// ─── GET: List all BNUs ────────────────────────────────────────────────────

export async function GET() {
  try {
    const bnus = await db.bNU.findMany({
      include: {
        toko: true,
        items: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const result = bnus.map((bnu) => ({
      ...bnu,
      ...generateNomorSurat(bnu.noPesanan, bnu.tglPesan),
    }));

    return NextResponse.json({ data: result });
  } catch (error: any) {
    console.error('BNU list error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── POST: Create a new BNU ────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Check for sync endpoint
    if (body.action === 'sync') {
      return handleSync();
    }

    const { noBukti, noPesanan, tglPesan, tokoId, bkuFileName, items } = body;

    if (!noBukti) {
      return NextResponse.json({ error: 'noBukti is required' }, { status: 400 });
    }

    // Check uniqueness of noBukti
    const existing = await db.bNU.findUnique({ where: { noBukti } });
    if (existing) {
      return NextResponse.json({ error: 'noBukti already exists' }, { status: 409 });
    }

    const bnu = await db.bNU.create({
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
        toko: true,
        items: true,
      },
    });

    return NextResponse.json({
      data: {
        ...bnu,
        ...generateNomorSurat(bnu.noPesanan, bnu.tglPesan),
      },
    });
  } catch (error: any) {
    console.error('BNU create error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── PUT: Update a BNU ─────────────────────────────────────────────────────

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, noPesanan, tglPesan, tokoId, bkuFileName, items } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const existing = await db.bNU.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'BNU not found' }, { status: 404 });
    }

    // Build update data
    const updateData: any = {};
    if (noPesanan !== undefined) updateData.noPesanan = noPesanan;
    if (tglPesan !== undefined) updateData.tglPesan = tglPesan;
    if (tokoId !== undefined) updateData.tokoId = tokoId || null;
    if (bkuFileName !== undefined) updateData.bkuFileName = bkuFileName;

    // Handle items replacement
    if (items !== undefined) {
      // Delete existing items and create new ones
      updateData.items = {
        deleteMany: {},
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

    const bnu = await db.bNU.update({
      where: { id },
      data: updateData,
      include: {
        toko: true,
        items: { orderBy: { createdAt: 'asc' } },
      },
    });

    return NextResponse.json({
      data: {
        ...bnu,
        ...generateNomorSurat(bnu.noPesanan, bnu.tglPesan),
      },
    });
  } catch (error: any) {
    console.error('BNU update error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── DELETE: Delete a BNU ──────────────────────────────────────────────────

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const existing = await db.bNU.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'BNU not found' }, { status: 404 });
    }

    // Cascade delete will remove items automatically
    await db.bNU.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('BNU delete error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── Sync: Sync BNU data from BKU cache files ──────────────────────────────

async function handleSync() {
  if (isServerless()) {
    return serverlessErrorResponse('Sync BNU');
  }
  try {
    const CACHE_DIR = path.join(process.cwd(), '.pdf-cache');

    if (!fs.existsSync(CACHE_DIR)) {
      return NextResponse.json({ data: [], message: 'No BKU cache found' });
    }

    // Read all .bku.json cache files
    const cacheFiles = fs.readdirSync(CACHE_DIR).filter((f) => f.endsWith('.bku.json'));

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

    interface BKUCache {
      data: {
        fileName: string;
        bulan: string;
        tahun: string;
        transactions: BKUTransaction[];
      };
    }

    // Collect all BNU transactions (pengeluaran > 0, noBukti starts with "BNU")
    const bnuTransactionMap = new Map<
      string,
      {
        transactions: BKUTransaction[];
        fileName: string;
      }
    >();

    for (const cacheFile of cacheFiles) {
      try {
        const cachePath = path.join(CACHE_DIR, cacheFile);
        const raw = fs.readFileSync(cachePath, 'utf-8');
        const cache: BKUCache = JSON.parse(raw);
        const bkuData = cache.data;
        if (!bkuData || !bkuData.transactions) continue;

        for (const tx of bkuData.transactions) {
          if (tx.pengeluaran > 0 && tx.noBukti && tx.noBukti.startsWith('BNU')) {
            if (!bnuTransactionMap.has(tx.noBukti)) {
              bnuTransactionMap.set(tx.noBukti, {
                transactions: [],
                fileName: bkuData.fileName,
              });
            }
            bnuTransactionMap.get(tx.noBukti)!.transactions.push(tx);
          }
        }
      } catch (err) {
        console.error(`Failed to read cache file ${cacheFile}:`, err);
      }
    }

    // Process each BNU group
    const results: any[] = [];
    const errors: string[] = [];

    for (const [noBukti, group] of bnuTransactionMap) {
      try {
        // Check if BNU already exists
        const existing = await db.bNU.findUnique({
          where: { noBukti },
          include: { items: true },
        });

        // Get first transaction date as tglPesan
        const firstTx = group.transactions[0];
        const tglPesan = firstTx?.tanggal || '';

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

        if (existing) {
          // Update existing BNU — replace items with latest from BKU
          const bnu = await db.bNU.update({
            where: { id: existing.id },
            data: {
              tglPesan,
              bkuFileName: group.fileName,
              items: {
                deleteMany: {},
                create: itemsData,
              },
            },
            include: {
              toko: true,
              items: { orderBy: { createdAt: 'asc' } },
            },
          });
          results.push({
            ...bnu,
            ...generateNomorSurat(bnu.noPesanan, bnu.tglPesan),
          });
        } else {
          // Create new BNU
          const bnu = await db.bNU.create({
            data: {
              noBukti,
              tglPesan,
              bkuFileName: group.fileName,
              items: {
                create: itemsData,
              },
            },
            include: {
              toko: true,
              items: { orderBy: { createdAt: 'asc' } },
            },
          });
          results.push({
            ...bnu,
            ...generateNomorSurat(bnu.noPesanan, bnu.tglPesan),
          });
        }
      } catch (err: any) {
        errors.push(`Failed to sync ${noBukti}: ${err.message}`);
      }
    }

    return NextResponse.json({
      data: results,
      synced: results.length,
      errors: errors.length ? errors : undefined,
    });
  } catch (error: any) {
    console.error('BNU sync error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
