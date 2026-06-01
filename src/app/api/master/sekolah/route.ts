import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import fs from 'fs';
import path from 'path';

const CACHE_DIR = path.join(process.cwd(), '.pdf-cache');

// Default empty DataSekolah record (returned when no record exists)
const defaultDataSekolah = {
  id: '',
  namaSekolah: '',
  npsn: '',
  alamat: '',
  kabupaten: '',
  provinsi: '',
  kepalaSekolah: '',
  nipKepala: '',
  bendahara: '',
  nipBendahara: '',
  pengurusBarang: '',
  nipPengurus: '',
  penerimaBarang: '',
  nipPenerima: '',
  logoKiriUrl: '',
  logoKananUrl: '',
  logoKiriLebar: 2.5,
  logoKiriTinggi: 3.0,
  logoKananLebar: 2.5,
  logoKananTinggi: 3.0,
  garisBawahStyle: 'single-thick',
  garisBawahJarak: 4,
  createdAt: null as string | null,
  updatedAt: null as string | null,
};

// Interface for BKU Pajak cached data
interface BKUPajakCachedData {
  data: {
    namaSekolah?: string;
    npsn?: string;
    alamat?: string;
    kabupaten?: string;
    provinsi?: string;
    kepalaSekolah?: string;
    bendahara?: string;
  };
}

/**
 * Read school data from BKU Pajak cache files (.pdf-cache/*.bku-pajak.json)
 * Returns merged/first available school info from the cached BKU Pajak files.
 */
function readSchoolFromBKUCache(): {
  namaSekolah: string;
  npsn: string;
  alamat: string;
  kabupaten: string;
  provinsi: string;
  kepalaSekolah: string;
  bendahara: string;
} {
  const result = {
    namaSekolah: '',
    npsn: '',
    alamat: '',
    kabupaten: '',
    provinsi: '',
    kepalaSekolah: '',
    bendahara: '',
  };

  try {
    if (!fs.existsSync(CACHE_DIR)) return result;

    const cacheFiles = fs
      .readdirSync(CACHE_DIR)
      .filter((f) => f.endsWith('.bku-pajak.json'));

    for (const cacheFile of cacheFiles) {
      try {
        const filePath = path.join(CACHE_DIR, cacheFile);
        const raw = fs.readFileSync(filePath, 'utf-8');
        const cached: BKUPajakCachedData = JSON.parse(raw);

        if (cached?.data) {
          // Use first non-empty value found across all cache files
          if (!result.namaSekolah && cached.data.namaSekolah) {
            result.namaSekolah = cached.data.namaSekolah;
          }
          if (!result.npsn && cached.data.npsn) {
            result.npsn = cached.data.npsn;
          }
          if (!result.alamat && cached.data.alamat) {
            result.alamat = cached.data.alamat;
          }
          if (!result.kabupaten && cached.data.kabupaten) {
            result.kabupaten = cached.data.kabupaten;
          }
          if (!result.provinsi && cached.data.provinsi) {
            result.provinsi = cached.data.provinsi;
          }
          if (!result.kepalaSekolah && cached.data.kepalaSekolah) {
            result.kepalaSekolah = cached.data.kepalaSekolah;
          }
          if (!result.bendahara && cached.data.bendahara) {
            result.bendahara = cached.data.bendahara;
          }
        }
      } catch {
        // Skip malformed cache files
      }
    }
  } catch (error) {
    console.error('Error reading BKU Pajak cache:', error);
  }

  return result;
}

// GET: Retrieve the single DataSekolah record
// If none exists, return a default empty record (no auto-creation)
// Query param ?initFromBKU=true will merge BKU Pajak cached data into the default
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const initFromBKU = searchParams.get('initFromBKU') === 'true';

    // Fetch the first (and only) DataSekolah record (include logo URLs since they're needed for KOP display)
    const record = await db.dataSekolah.findFirst();

    if (record) {
      return NextResponse.json({ data: record, exists: true });
    }

    // No record exists — return default
    let data = { ...defaultDataSekolah };

    if (initFromBKU) {
      // Attempt to populate from BKU Pajak cache files
      const bkuData = readSchoolFromBKUCache();
      data = {
        ...data,
        ...bkuData,
      };
    }

    return NextResponse.json({ data, exists: false });
  } catch (error: any) {
    console.error('DataSekolah GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch DataSekolah' },
      { status: 500 }
    );
  }
}

// POST: Create or update (upsert) the single DataSekolah record
// Since there should only be one record, always upsert to the first record found
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const fields: Record<string, any> = {
      namaSekolah: typeof body.namaSekolah === 'string' ? body.namaSekolah : '',
      npsn: typeof body.npsn === 'string' ? body.npsn : '',
      alamat: typeof body.alamat === 'string' ? body.alamat : '',
      kabupaten: typeof body.kabupaten === 'string' ? body.kabupaten : '',
      provinsi: typeof body.provinsi === 'string' ? body.provinsi : '',
      kepalaSekolah: typeof body.kepalaSekolah === 'string' ? body.kepalaSekolah : '',
      nipKepala: typeof body.nipKepala === 'string' ? body.nipKepala : '',
      bendahara: typeof body.bendahara === 'string' ? body.bendahara : '',
      nipBendahara: typeof body.nipBendahara === 'string' ? body.nipBendahara : '',
      pengurusBarang: typeof body.pengurusBarang === 'string' ? body.pengurusBarang : '',
      nipPengurus: typeof body.nipPengurus === 'string' ? body.nipPengurus : '',
      penerimaBarang: typeof body.penerimaBarang === 'string' ? body.penerimaBarang : '',
      nipPenerima: typeof body.nipPenerima === 'string' ? body.nipPenerima : '',
    };

    // Logo dimensions (optional — only update if provided)
    if (typeof body.logoKiriLebar === 'number') fields.logoKiriLebar = body.logoKiriLebar;
    if (typeof body.logoKiriTinggi === 'number') fields.logoKiriTinggi = body.logoKiriTinggi;
    if (typeof body.logoKananLebar === 'number') fields.logoKananLebar = body.logoKananLebar;
    if (typeof body.logoKananTinggi === 'number') fields.logoKananTinggi = body.logoKananTinggi;

    // Garis bawah KOP (optional)
    if (typeof body.garisBawahStyle === 'string') fields.garisBawahStyle = body.garisBawahStyle;
    if (typeof body.garisBawahJarak === 'number') fields.garisBawahJarak = body.garisBawahJarak;

    // Find the existing record (should be at most one) — exclude large logo base64 from the lookup
    const existing = await db.dataSekolah.findFirst({
      select: { id: true },
    });

    let record;

    // Fields to select in response (exclude large base64 logo data)
    const selectFields = {
      id: true, namaSekolah: true, npsn: true, alamat: true, kabupaten: true, provinsi: true,
      kepalaSekolah: true, nipKepala: true, bendahara: true, nipBendahara: true,
      pengurusBarang: true, nipPengurus: true, penerimaBarang: true, nipPenerima: true,
      logoKiriLebar: true, logoKiriTinggi: true, logoKananLebar: true, logoKananTinggi: true,
      garisBawahStyle: true, garisBawahJarak: true,
      createdAt: true, updatedAt: true,
    };

    if (existing) {
      // Update the existing record
      record = await db.dataSekolah.update({
        where: { id: existing.id },
        data: fields,
        select: selectFields,
      });
    } else {
      // Create a new record
      record = await db.dataSekolah.create({
        data: fields,
        select: selectFields,
      });
    }

    return NextResponse.json({ data: record, created: !existing });
  } catch (error: any) {
    console.error('DataSekolah POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save DataSekolah' },
      { status: 500 }
    );
  }
}
