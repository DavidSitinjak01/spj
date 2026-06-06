import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAllBKUPajakFromDB } from '@/lib/services/db-service';

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

/**
 * Read school data from BKU Pajak DB records.
 * Fast - no PDF re-parsing needed!
 */
async function readSchoolFromBKUPajakDB(): Promise<{
  namaSekolah: string;
  npsn: string;
  alamat: string;
  kabupaten: string;
  provinsi: string;
  kepalaSekolah: string;
  bendahara: string;
}> {
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
    const bkuPajakMonths = await getAllBKUPajakFromDB();
    for (const data of bkuPajakMonths) {
      if (!result.namaSekolah && data.namaSekolah) result.namaSekolah = data.namaSekolah;
      if (!result.npsn && data.npsn) result.npsn = data.npsn;
      if (!result.alamat && data.alamat) result.alamat = data.alamat;
      if (!result.kabupaten && data.kabupaten) result.kabupaten = data.kabupaten;
      if (!result.provinsi && data.provinsi) result.provinsi = data.provinsi;
      if (!result.kepalaSekolah && data.kepalaSekolah) result.kepalaSekolah = data.kepalaSekolah;
      if (!result.bendahara && data.bendahara) result.bendahara = data.bendahara;
    }
  } catch (error) {
    console.error('Error reading BKU Pajak from DB:', error);
  }

  return result;
}

// GET: Retrieve the single DataSekolah record
// If none exists, return a default empty record (no auto-creation)
// Query param ?initFromBKU=true will merge BKU Pajak DB data into the default
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const initFromBKU = searchParams.get('initFromBKU') === 'true';

    // Fetch the first (and only) DataSekolah record
    const record = await db.dataSekolah.findFirst();

    if (record) {
      return NextResponse.json({ data: record, exists: true });
    }

    // No record exists — return default
    let data = { ...defaultDataSekolah };

    if (initFromBKU) {
      // Populate from BKU Pajak DB data (fast, no PDF re-parsing)
      const bkuData = await readSchoolFromBKUPajakDB();
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

    // Find the existing record (should be at most one)
    const existing = await db.dataSekolah.findFirst({
      select: { id: true },
    });

    let record;

    // Fields to select in response (exclude large base64 logo data)
    const selectFields = {
      id: true, namaSekolah: true, npsn: true, alamat: true, kabupaten: true, provinsi: true,
      kepalaSekolah: true, nipKepala: true, bendahara: true, nipBendahara: true,
      pengurusBarang: true, nipPengurus: true, penerimaBarang: true, nipPenerima: true,
      logoKiriUrl: true, logoKananUrl: true,
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
