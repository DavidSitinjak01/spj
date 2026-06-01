import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4 MB

// POST: Upload a logo (posisi = 'kiri' or 'kanan')
// Stores the logo as a base64 data URL directly in the database
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const posisi = formData.get('posisi') as string | null; // 'kiri' or 'kanan'

    if (!file) {
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 });
    }

    if (!posisi || !['kiri', 'kanan'].includes(posisi)) {
      return NextResponse.json({ error: 'Posisi harus "kiri" atau "kanan"' }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `Ukuran file maksimal 4 MB. File Anda: ${(file.size / 1024 / 1024).toFixed(1)} MB` },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Format file tidak didukung. Gunakan PNG, JPG, WebP, atau SVG.' },
        { status: 400 }
      );
    }

    // Convert file to base64 data URL
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    const mimeType = file.type || 'image/png';
    const dataUrl = `data:${mimeType};base64,${base64}`;

    // Update or create database record
    const field = posisi === 'kiri' ? 'logoKiriUrl' : 'logoKananUrl';
    const existing = await db.dataSekolah.findFirst();

    if (existing) {
      await db.dataSekolah.update({
        where: { id: existing.id },
        data: { [field]: dataUrl },
      });
    } else {
      await db.dataSekolah.create({
        data: { [field]: dataUrl },
      });
    }

    return NextResponse.json({
      success: true,
      dataUrl,
      posisi,
    });
  } catch (error: any) {
    console.error('Logo upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Gagal mengupload logo' },
      { status: 500 }
    );
  }
}

// DELETE: Remove a logo (posisi = 'kiri' or 'kanan')
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const posisi = searchParams.get('posisi');

    if (!posisi || !['kiri', 'kanan'].includes(posisi)) {
      return NextResponse.json({ error: 'Posisi harus "kiri" atau "kanan"' }, { status: 400 });
    }

    const field = posisi === 'kiri' ? 'logoKiriUrl' : 'logoKananUrl';
    const existing = await db.dataSekolah.findFirst();

    if (existing) {
      await db.dataSekolah.update({
        where: { id: existing.id },
        data: { [field]: '' },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Logo delete error:', error);
    return NextResponse.json(
      { error: error.message || 'Gagal menghapus logo' },
      { status: 500 }
    );
  }
}
