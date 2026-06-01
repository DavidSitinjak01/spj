import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET: List all KopRows ordered by urutan
export async function GET() {
  try {
    // Only select id to avoid loading large base64 logo data
    const sekolah = await db.dataSekolah.findFirst({ select: { id: true } });
    if (!sekolah) {
      return NextResponse.json({ data: [] });
    }

    const rows = await db.kopRow.findMany({
      where: { dataSekolahId: sekolah.id },
      orderBy: { urutan: 'asc' },
    });

    return NextResponse.json({ data: rows });
  } catch (error: any) {
    console.error('KopRow GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch KopRow' },
      { status: 500 }
    );
  }
}

// POST: Create a new KopRow
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Ensure DataSekolah exists - only select id to avoid loading large base64 logos
    let sekolah = await db.dataSekolah.findFirst({ select: { id: true } });
    if (!sekolah) {
      sekolah = await db.dataSekolah.create({ data: {} });
    }

    // Get next urutan
    const maxRow = await db.kopRow.findFirst({
      where: { dataSekolahId: sekolah.id },
      orderBy: { urutan: 'desc' },
      select: { urutan: true },
    });
    const nextUrutan = (maxRow?.urutan || 0) + 1;

    const row = await db.kopRow.create({
      data: {
        dataSekolahId: sekolah.id,
        urutan: body.urutan ?? nextUrutan,
        teks: typeof body.teks === 'string' ? body.teks : '',
        fontFamily: typeof body.fontFamily === 'string' ? body.fontFamily : 'Times New Roman',
        fontSize: typeof body.fontSize === 'number' ? body.fontSize : 12,
        bold: typeof body.bold === 'boolean' ? body.bold : false,
        italic: typeof body.italic === 'boolean' ? body.italic : false,
        uppercase: typeof body.uppercase === 'boolean' ? body.uppercase : false,
      },
    });

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (error: any) {
    console.error('KopRow POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create KopRow' },
      { status: 500 }
    );
  }
}

// PUT: Update a KopRow
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const fields: Record<string, any> = {};
    if (typeof updates.teks === 'string') fields.teks = updates.teks;
    if (typeof updates.fontFamily === 'string') fields.fontFamily = updates.fontFamily;
    if (typeof updates.fontSize === 'number') fields.fontSize = updates.fontSize;
    if (typeof updates.bold === 'boolean') fields.bold = updates.bold;
    if (typeof updates.italic === 'boolean') fields.italic = updates.italic;
    if (typeof updates.uppercase === 'boolean') fields.uppercase = updates.uppercase;
    if (typeof updates.urutan === 'number') fields.urutan = updates.urutan;

    const row = await db.kopRow.update({
      where: { id },
      data: fields,
    });

    return NextResponse.json({ data: row });
  } catch (error: any) {
    console.error('KopRow PUT error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update KopRow' },
      { status: 500 }
    );
  }
}

// DELETE: Delete a KopRow
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    await db.kopRow.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('KopRow DELETE error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete KopRow' },
      { status: 500 }
    );
  }
}

// PATCH: Reorder KopRows (accepts array of {id, urutan})
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const orders: { id: string; urutan: number }[] = body.orders;

    if (!Array.isArray(orders)) {
      return NextResponse.json({ error: 'orders array is required' }, { status: 400 });
    }

    // Update each row's urutan
    for (const item of orders) {
      await db.kopRow.update({
        where: { id: item.id },
        data: { urutan: item.urutan },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('KopRow PATCH error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to reorder KopRow' },
      { status: 500 }
    );
  }
}
