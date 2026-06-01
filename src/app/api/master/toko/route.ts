import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - List all toko, sorted by namaToko, with BPU/BNU counts
export async function GET() {
  try {
    const tokoList = await db.toko.findMany({
      orderBy: { namaToko: 'asc' },
      include: {
        _count: {
          select: { bpus: true, bnus: true },
        },
      },
    })

    const result = tokoList.map((toko) => ({
      id: toko.id,
      namaToko: toko.namaToko,
      direktur: toko.direktur,
      noHp: toko.noHp,
      alamat: toko.alamat,
      kategori: toko.kategori,
      createdAt: toko.createdAt,
      updatedAt: toko.updatedAt,
      bpuCount: toko._count.bpus,
      bnuCount: toko._count.bnus,
    }))

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('GET /api/master/toko error:', error)
    return NextResponse.json(
      { success: false, error: 'Gagal memuat data toko' },
      { status: 500 }
    )
  }
}

// POST - Create a new toko
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { namaToko, direktur, noHp, alamat, kategori } = body

    if (!namaToko || typeof namaToko !== 'string' || namaToko.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'namaToko wajib diisi' },
        { status: 400 }
      )
    }

    const toko = await db.toko.create({
      data: {
        namaToko: namaToko.trim(),
        direktur: direktur ?? '',
        noHp: noHp ?? '',
        alamat: alamat ?? '',
        kategori: kategori ?? '',
      },
    })

    return NextResponse.json({ success: true, data: toko }, { status: 201 })
  } catch (error) {
    console.error('POST /api/master/toko error:', error)
    return NextResponse.json(
      { success: false, error: 'Gagal membuat toko baru' },
      { status: 500 }
    )
  }
}

// PUT - Update a toko
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, namaToko, direktur, noHp, alamat, kategori } = body

    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { success: false, error: 'ID toko wajib diisi' },
        { status: 400 }
      )
    }

    const existing = await db.toko.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Toko tidak ditemukan' },
        { status: 404 }
      )
    }

    const updateData: Record<string, string> = {}
    if (namaToko !== undefined) {
      if (typeof namaToko !== 'string' || namaToko.trim() === '') {
        return NextResponse.json(
          { success: false, error: 'namaToko tidak boleh kosong' },
          { status: 400 }
        )
      }
      updateData.namaToko = namaToko.trim()
    }
    if (direktur !== undefined) updateData.direktur = direktur
    if (noHp !== undefined) updateData.noHp = noHp
    if (alamat !== undefined) updateData.alamat = alamat
    if (kategori !== undefined) updateData.kategori = kategori

    const updated = await db.toko.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('PUT /api/master/toko error:', error)
    return NextResponse.json(
      { success: false, error: 'Gagal mengupdate toko' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a toko (with usage check)
export async function DELETE(request: Request) {
  try {
    const body = await request.json()
    const { id } = body

    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { success: false, error: 'ID toko wajib diisi' },
        { status: 400 }
      )
    }

    const existing = await db.toko.findUnique({
      where: { id },
      include: {
        _count: {
          select: { bpus: true, bnus: true },
        },
      },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Toko tidak ditemukan' },
        { status: 404 }
      )
    }

    if (existing._count.bpus > 0 || existing._count.bnus > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Toko tidak dapat dihapus karena masih digunakan oleh ${existing._count.bpus} BPU dan ${existing._count.bnus} BNU`,
          bpuCount: existing._count.bpus,
          bnuCount: existing._count.bnus,
        },
        { status: 409 }
      )
    }

    await db.toko.delete({ where: { id } })

    return NextResponse.json({
      success: true,
      data: { id, namaToko: existing.namaToko },
    })
  } catch (error) {
    console.error('DELETE /api/master/toko error:', error)
    return NextResponse.json(
      { success: false, error: 'Gagal menghapus toko' },
      { status: 500 }
    )
  }
}
