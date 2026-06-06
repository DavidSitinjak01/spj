'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Store, Building2, ClipboardList, Users, FileSpreadsheet,
  Package, FileCheck, ClipboardPaste, ShieldCheck, Receipt,
  Search, Plus, Trash2, FilePlus2, Loader2, Database,
  ChevronUp, ChevronDown, CheckCircle2, AlertCircle, X,
  TrendingUp, Minus, Calendar, Landmark, Printer,
  ImagePlus, Image as ImageIcon, Bold, Italic, Type,
  GripVertical, ArrowUp, ArrowDown, AlignCenter,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  type SPJSummary, type SPJDocType, type KopRowData,
  MONTH_NAMES,
} from '@/lib/types'
import { fmt, fmtRp, terbilang, CHART_COLORS, STANDAR_ICONS, renderGarisBawah } from '@/lib/helpers'

type AnyRecord = Record<string, any>

interface SPJTabProps {
  spjSubTab: string
  setSpjSubTab: (v: string) => void
  spjData: SPJSummary | null
  spjLoading: boolean
  selectedSpjMonth: number
  setSelectedSpjMonth: (v: number) => void
  spjSearchTerm: string
  setSpjSearchTerm: (v: string) => void
  docType: 'bpu' | 'bnu'
  setDocType: (v: 'bpu' | 'bnu') => void
  docSelectedBpuId: string
  setDocSelectedBpuId: (v: string) => void
  docSelectedBnuId: string
  setDocSelectedBnuId: (v: string) => void
  // Toko
  tokoList: AnyRecord[]
  tokoLoading: boolean
  tokoDialog: { open: boolean; mode: 'add' | 'edit'; data: AnyRecord }
  setTokoDialog: (v: { open: boolean; mode: 'add' | 'edit'; data: AnyRecord }) => void
  tokoSearch: string
  setTokoSearch: (v: string) => void
  saveToko: (toko: AnyRecord) => void
  deleteToko: (id: string) => void
  // Sekolah
  sekolahData: AnyRecord
  setSekolahData: (v: AnyRecord | ((prev: AnyRecord) => AnyRecord)) => void
  sekolahLoading: boolean
  sekolahSaving: boolean
  saveSekolah: () => void
  logoUploading: 'kiri' | 'kanan' | null
  handleLogoUpload: (posisi: 'kiri' | 'kanan', file: File) => void
  handleLogoDelete: (posisi: 'kiri' | 'kanan') => void
  // KOP Rows
  kopRows: KopRowData[]
  kopRowLoading: boolean
  kopRowSaving: string | null
  addKopRow: () => void
  updateKopRow: (id: string, updates: Partial<KopRowData>) => void
  deleteKopRow: (id: string) => void
  moveKopRow: (id: string, direction: 'up' | 'down') => void
  // BPU
  bpuList: AnyRecord[]
  bpuLoading: boolean
  bpuSyncing: boolean
  selectedBpu: string | null
  setSelectedBpu: (v: string | null) => void
  bpuEditFields: Record<string, { noPesanan: string; tglPesan: string; tokoId: string }>
  setBpuEditFields: (v: Record<string, { noPesanan: string; tglPesan: string; tokoId: string }> | ((prev: Record<string, { noPesanan: string; tglPesan: string; tokoId: string }>) => Record<string, { noPesanan: string; tglPesan: string; tokoId: string }>)) => void
  syncBPU: () => void
  updateBPU: (id: string, fields: { noPesanan?: string; tglPesan?: string; tokoId?: string }) => void
  deleteBPU: (id: string) => void
  updateBPItemHargaToko2: (bpuId: string, items: AnyRecord[]) => void
  setBpuList: (v: AnyRecord[] | ((prev: AnyRecord[]) => AnyRecord[])) => void
  // BNU
  bnuList: AnyRecord[]
  bnuLoading: boolean
  bnuSyncing: boolean
  selectedBnu: string | null
  setSelectedBnu: (v: string | null) => void
  bnuEditFields: Record<string, { noPesanan: string; tglPesan: string; tokoId: string }>
  setBnuEditFields: (v: Record<string, { noPesanan: string; tglPesan: string; tokoId: string }> | ((prev: Record<string, { noPesanan: string; tglPesan: string; tokoId: string }>) => Record<string, { noPesanan: string; tglPesan: string; tokoId: string }>)) => void
  syncBNU: () => void
  updateBNU: (id: string, fields: { noPesanan?: string; tglPesan?: string; tokoId?: string }) => void
  deleteBNU: (id: string) => void
  updateBNUItemHargaToko2: (bnuId: string, items: AnyRecord[]) => void
  setBnuList: (v: AnyRecord[] | ((prev: AnyRecord[]) => AnyRecord[])) => void
  // Print
  handlePrintDoc: (docType: string) => void
}

export default function SPJTab(props: SPJTabProps) {
  const {
    spjSubTab, setSpjSubTab, spjData, spjLoading,
    selectedSpjMonth, setSelectedSpjMonth, spjSearchTerm, setSpjSearchTerm,
    docType, setDocType, docSelectedBpuId, setDocSelectedBpuId,
    docSelectedBnuId, setDocSelectedBnuId,
    tokoList, tokoLoading, tokoDialog, setTokoDialog, tokoSearch, setTokoSearch,
    saveToko, deleteToko,
    sekolahData, setSekolahData, sekolahLoading, sekolahSaving, saveSekolah,
    logoUploading, handleLogoUpload, handleLogoDelete,
    kopRows, kopRowLoading, kopRowSaving, addKopRow, updateKopRow, deleteKopRow, moveKopRow,
    bpuList, bpuLoading, bpuSyncing, selectedBpu, setSelectedBpu, bpuEditFields, setBpuEditFields,
    syncBPU, updateBPU, deleteBPU, updateBPItemHargaToko2, setBpuList,
    bnuList, bnuLoading, bnuSyncing, selectedBnu, setSelectedBnu, bnuEditFields, setBnuEditFields,
    syncBNU, updateBNU, deleteBNU, updateBNUItemHargaToko2, setBnuList,
    handlePrintDoc,
  } = props

  const logoKiriInputRef = useRef<HTMLInputElement>(null)
  const logoKananInputRef = useRef<HTMLInputElement>(null)

  const hasLogoKiri = !!sekolahData.logoKiriUrl
  const hasLogoKanan = !!sekolahData.logoKananUrl
  const logoCount = (hasLogoKiri ? 1 : 0) + (hasLogoKanan ? 1 : 0)

  // KOP surat renderer for documents
  const renderKopSurat = (forPrint = false) => {
    const kopTextRows = (rows: KopRowData[]) =>
      [...rows].sort((a, b) => a.urutan - b.urutan).map((row) => (
        <p
          key={row.id}
          style={{
            fontFamily: row.fontFamily,
            fontSize: `${row.fontSize}pt`,
            fontWeight: row.bold ? 'bold' : 'normal',
            fontStyle: row.italic ? 'italic' : 'normal',
            textTransform: row.uppercase ? 'uppercase' : 'none',
            lineHeight: row.lineHeight || 1.3,
            ...(forPrint ? { color: '#000' } : {}),
          }}
        >
          {row.teks || '........................'}
        </p>
      ))

    const fallbackText = (
      <>
        <p className="text-[13px] font-bold uppercase">{sekolahData.namaSekolah || '........................'}</p>
        <p className="text-[10px]">NPSN: {sekolahData.npsn || '............'}</p>
        <p className="text-[10px]">{sekolahData.alamat || '............'}</p>
      </>
    )

    const logoImg = (posisi: 'kiri' | 'kanan') => {
      const url = posisi === 'kiri' ? sekolahData.logoKiriUrl : sekolahData.logoKananUrl
      const lebar = posisi === 'kiri' ? (sekolahData.logoKiriLebar || 2.5) : (sekolahData.logoKananLebar || 2.5)
      const tinggi = posisi === 'kiri' ? (sekolahData.logoKiriTinggi || 3) : (sekolahData.logoKananTinggi || 3)
      return (
        <div style={{ width: `${lebar * 10}mm`, flexShrink: 0 }}>
          <img src={url} alt={`Logo ${posisi === 'kiri' ? 'Kiri' : 'Kanan'}`} style={{ height: `${tinggi * 10}mm`, width: `${lebar * 10}mm`, objectFit: 'contain' }} />
        </div>
      )
    }

    const textCenter = (
      <div className="text-center flex-1 min-w-0 px-2">
        {kopRows.length > 0 ? kopTextRows(kopRows) : fallbackText}
        {kopRows.length === 0 && <p className="text-gray-400 text-[10px]">Belum ada baris teks</p>}
      </div>
    )

    return (
      <div style={{ paddingBottom: `${sekolahData.garisBawahJarak || 4}pt`, marginBottom: '16px' }}>
        {logoCount === 0 && <div className="text-center">{textCenter}</div>}
        {logoCount === 1 && hasLogoKiri && !hasLogoKanan && <div className="flex items-center">{logoImg('kiri')}{textCenter}</div>}
        {logoCount === 1 && !hasLogoKiri && hasLogoKanan && <div className="flex items-center">{textCenter}{logoImg('kanan')}</div>}
        {logoCount === 2 && <div className="flex items-center justify-between">{logoImg('kiri')}{textCenter}{logoImg('kanan')}</div>}
        {renderGarisBawah(sekolahData.garisBawahStyle || 'single-thick')}
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4">
      {/* Sub-Tab Navigation */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {[
          { key: 'master-toko', label: 'Master Toko', icon: Store },
          { key: 'data-sekolah', label: 'Data Sekolah', icon: Building2 },
          { key: 'master-bpu', label: 'Master BPU', icon: ClipboardList },
          { key: 'master-bnu', label: 'Master BNU', icon: Users },
          { key: 'rekapitulasi', label: 'Rekapitulasi', icon: FileSpreadsheet },
          { key: 'surat-pesanan', label: 'Surat Pesanan', icon: Package },
          { key: 'surat-balasan', label: 'Dok. Perbanding', icon: Store },
          { key: 'bast', label: 'BAST', icon: FileCheck },
          { key: 'dokumen-perencanaan', label: 'Dok. Perencanaan', icon: ClipboardPaste },
          { key: 'surat-hasil-pemeriksaan', label: 'Surat Hasil Periksa', icon: ShieldCheck },
          { key: 'kuitansi-pembayaran', label: 'Kuitansi', icon: Receipt },
        ].map(tab => (
          <Button key={tab.key} variant={spjSubTab === tab.key ? 'default' : 'outline'} size="sm" className="h-7 text-[11px] gap-1 shrink-0" onClick={() => setSpjSubTab(tab.key)}>
            <tab.icon className="h-3 w-3" />{tab.label}
          </Button>
        ))}
      </div>

      {/* ===== MASTER TOKO SUB-TAB ===== */}
      {spjSubTab === 'master-toko' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div><h3 className="text-sm font-semibold">Master Toko</h3><p className="text-[11px] text-muted-foreground">Kelola database toko/penyedia</p></div>
            <div className="flex items-center gap-2">
              <div className="relative"><Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" /><Input className="h-7 text-[11px] pl-7 w-48" placeholder="Cari toko..." value={tokoSearch} onChange={e => setTokoSearch(e.target.value)} /></div>
              <Button size="sm" className="h-7 text-[11px] gap-1" onClick={() => setTokoDialog({open: true, mode: 'add', data: {namaToko: '', direktur: '', noHp: '', alamat: '', kategori: ''}})}><Plus className="h-3 w-3" /> Tambah Toko</Button>
            </div>
          </div>
          {tokoLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
          ) : tokoList.length === 0 ? (
            <Card className="border-dashed"><CardContent className="py-12 text-center"><Store className="h-10 w-10 text-muted-foreground mx-auto mb-2" /><h3 className="text-sm font-semibold">Belum ada data toko</h3><p className="text-xs text-muted-foreground mt-1">Tambahkan toko/penyedia untuk keperluan SPJ</p></CardContent></Card>
          ) : (
            <div className="grid gap-3">
              {tokoList.filter((t: any) => !tokoSearch || t.namaToko.toLowerCase().includes(tokoSearch.toLowerCase()) || t.direktur.toLowerCase().includes(tokoSearch.toLowerCase())).map((toko: any) => (
                <Card key={toko.id} className="overflow-hidden"><CardContent className="py-3 px-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2"><span className="text-sm font-semibold truncate">{toko.namaToko}</span>{toko.kategori && <Badge variant="outline" className="text-[9px] h-4">{toko.kategori}</Badge>}</div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground">{toko.direktur && <span>Direktur: {toko.direktur}</span>}{toko.noHp && <span>HP: {toko.noHp}</span>}</div>
                      {toko.alamat && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{toko.alamat}</p>}
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setTokoDialog({open: true, mode: 'edit', data: toko})}><FilePlus2 className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteToko(toko.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                </CardContent></Card>
              ))}
            </div>
          )}
          {tokoDialog.open && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <Card className="w-full max-w-md mx-4"><CardHeader className="pb-3"><div className="flex items-center justify-between"><CardTitle className="text-sm">{tokoDialog.mode === 'add' ? 'Tambah Toko' : 'Edit Toko'}</CardTitle><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setTokoDialog(prev => ({...prev, open: false}))}><X className="h-3.5 w-3.5" /></Button></div></CardHeader>
              <CardContent className="space-y-3">
                <div><label className="text-[11px] font-medium text-muted-foreground">Nama Toko *</label><Input className="h-8 text-xs mt-1" value={tokoDialog.data.namaToko} onChange={e => setTokoDialog(prev => ({...prev, data: {...prev.data, namaToko: e.target.value}}))} placeholder="Nama toko/penyedia" /></div>
                <div><label className="text-[11px] font-medium text-muted-foreground">Direktur/Pengusaha</label><Input className="h-8 text-xs mt-1" value={tokoDialog.data.direktur} onChange={e => setTokoDialog(prev => ({...prev, data: {...prev.data, direktur: e.target.value}}))} /></div>
                <div className="grid grid-cols-2 gap-3"><div><label className="text-[11px] font-medium text-muted-foreground">No. HP</label><Input className="h-8 text-xs mt-1" value={tokoDialog.data.noHp} onChange={e => setTokoDialog(prev => ({...prev, data: {...prev.data, noHp: e.target.value}}))} /></div><div><label className="text-[11px] font-medium text-muted-foreground">Kategori</label><Input className="h-8 text-xs mt-1" value={tokoDialog.data.kategori} onChange={e => setTokoDialog(prev => ({...prev, data: {...prev.data, kategori: e.target.value}}))} placeholder="Barang/Jasa" /></div></div>
                <div><label className="text-[11px] font-medium text-muted-foreground">Alamat</label><textarea className="w-full mt-1 rounded-md border border-input bg-transparent px-3 py-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[60px]" value={tokoDialog.data.alamat} onChange={e => setTokoDialog(prev => ({...prev, data: {...prev.data, alamat: e.target.value}}))} /></div>
                <div className="flex justify-end gap-2 pt-2"><Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setTokoDialog(prev => ({...prev, open: false}))}>Batal</Button><Button size="sm" className="h-7 text-xs" onClick={() => saveToko(tokoDialog.data)} disabled={!tokoDialog.data.namaToko.trim()}>{tokoDialog.mode === 'add' ? 'Tambah' : 'Simpan'}</Button></div>
              </CardContent></Card>
            </div>
          )}
        </div>
      )}

      {/* ===== DATA SEKOLAH SUB-TAB ===== */}
      {spjSubTab === 'data-sekolah' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div><h3 className="text-sm font-semibold">Data Sekolah</h3><p className="text-[11px] text-muted-foreground">Informasi sekolah untuk keperluan dokumen SPJ</p></div>
            <Button size="sm" className="h-7 text-[11px] gap-1" onClick={saveSekolah} disabled={sekolahSaving}>{sekolahSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}Simpan Semua</Button>
          </div>
          {sekolahLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
          ) : (
            <div className="grid gap-4">
              {/* KOP Editor */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div><CardTitle className="text-xs flex items-center gap-1.5"><AlignCenter className="h-3.5 w-3.5" />KOP Sekolah</CardTitle><p className="text-[10px] text-muted-foreground mt-0.5">Atur logo, ukuran, dan baris teks untuk kop surat dokumen SPJ</p></div>
                    <Button size="sm" className="h-7 text-[11px] gap-1" onClick={saveSekolah} disabled={sekolahSaving}>{sekolahSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}Simpan Ukuran</Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Logo Section */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Logo Kiri */}
                    <div className="space-y-2">
                      <label className="text-[11px] font-medium text-muted-foreground">Logo Kiri (Lambang Negara)</label>
                      <div className="relative group border-2 border-dashed rounded-lg overflow-hidden transition-colors hover:border-primary/50 bg-muted/30" style={{ minHeight: '100px' }}>
                        {sekolahData.logoKiriUrl ? (
                          <div className="flex flex-col items-center justify-center p-3 h-full">
                            <img src={sekolahData.logoKiriUrl} alt="Logo Kiri" style={{ height: `${(sekolahData.logoKiriTinggi || 3) * 20}px`, width: `${(sekolahData.logoKiriLebar || 2.5) * 20}px`, objectFit: 'contain' }} />
                            <div className="mt-2 flex gap-1.5">
                              <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1" onClick={() => logoKiriInputRef.current?.click()} disabled={logoUploading === 'kiri'}>{logoUploading === 'kiri' ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImagePlus className="h-3 w-3" />}Ganti</Button>
                              <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1 text-destructive hover:text-destructive" onClick={() => handleLogoDelete('kiri')}><Trash2 className="h-3 w-3" /> Hapus</Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center p-4 cursor-pointer h-full" style={{ minHeight: '100px' }} onClick={() => logoKiriInputRef.current?.click()}>
                            {logoUploading === 'kiri' ? <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /> : <><ImagePlus className="h-8 w-8 text-muted-foreground/50 mb-2" /><p className="text-[10px] text-muted-foreground text-center">Klik untuk upload logo kiri</p><p className="text-[9px] text-muted-foreground/60 mt-0.5">Maks. 4 MB</p></>}
                          </div>
                        )}
                      </div>
                      <input ref={logoKiriInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleLogoUpload('kiri', file); e.target.value = '' }} />
                      <div className="grid grid-cols-2 gap-2">
                        <div><label className="text-[10px] text-muted-foreground">Lebar (cm)</label><Input type="number" step="0.1" min="0.5" max="10" className="h-7 text-[11px] mt-0.5" value={sekolahData.logoKiriLebar ?? 2.5} onChange={e => setSekolahData(prev => ({...prev, logoKiriLebar: parseFloat(e.target.value) || 2.5}))} /></div>
                        <div><label className="text-[10px] text-muted-foreground">Tinggi (cm)</label><Input type="number" step="0.1" min="0.5" max="10" className="h-7 text-[11px] mt-0.5" value={sekolahData.logoKiriTinggi ?? 3} onChange={e => setSekolahData(prev => ({...prev, logoKiriTinggi: parseFloat(e.target.value) || 3}))} /></div>
                      </div>
                    </div>
                    {/* Logo Kanan */}
                    <div className="space-y-2">
                      <label className="text-[11px] font-medium text-muted-foreground">Logo Kanan (Logo Sekolah)</label>
                      <div className="relative group border-2 border-dashed rounded-lg overflow-hidden transition-colors hover:border-primary/50 bg-muted/30" style={{ minHeight: '100px' }}>
                        {sekolahData.logoKananUrl ? (
                          <div className="flex flex-col items-center justify-center p-3 h-full">
                            <img src={sekolahData.logoKananUrl} alt="Logo Kanan" style={{ height: `${(sekolahData.logoKananTinggi || 3) * 20}px`, width: `${(sekolahData.logoKananLebar || 2.5) * 20}px`, objectFit: 'contain' }} />
                            <div className="mt-2 flex gap-1.5">
                              <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1" onClick={() => logoKananInputRef.current?.click()} disabled={logoUploading === 'kanan'}>{logoUploading === 'kanan' ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImagePlus className="h-3 w-3" />}Ganti</Button>
                              <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1 text-destructive hover:text-destructive" onClick={() => handleLogoDelete('kanan')}><Trash2 className="h-3 w-3" /> Hapus</Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center p-4 cursor-pointer h-full" style={{ minHeight: '100px' }} onClick={() => logoKananInputRef.current?.click()}>
                            {logoUploading === 'kanan' ? <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /> : <><ImagePlus className="h-8 w-8 text-muted-foreground/50 mb-2" /><p className="text-[10px] text-muted-foreground text-center">Klik untuk upload logo kanan</p><p className="text-[9px] text-muted-foreground/60 mt-0.5">Maks. 4 MB</p></>}
                          </div>
                        )}
                      </div>
                      <input ref={logoKananInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleLogoUpload('kanan', file); e.target.value = '' }} />
                      <div className="grid grid-cols-2 gap-2">
                        <div><label className="text-[10px] text-muted-foreground">Lebar (cm)</label><Input type="number" step="0.1" min="0.5" max="10" className="h-7 text-[11px] mt-0.5" value={sekolahData.logoKananLebar ?? 2.5} onChange={e => setSekolahData(prev => ({...prev, logoKananLebar: parseFloat(e.target.value) || 2.5}))} /></div>
                        <div><label className="text-[10px] text-muted-foreground">Tinggi (cm)</label><Input type="number" step="0.1" min="0.5" max="10" className="h-7 text-[11px] mt-0.5" value={sekolahData.logoKananTinggi ?? 3} onChange={e => setSekolahData(prev => ({...prev, logoKananTinggi: parseFloat(e.target.value) || 3}))} /></div>
                      </div>
                    </div>
                  </div>
                  <Separator />
                  {/* KOP Text Rows */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div><h4 className="text-[11px] font-semibold">Baris Teks KOP</h4><p className="text-[10px] text-muted-foreground">Atur teks yang tampil di kop surat (baris per baris)</p></div>
                      <Button size="sm" className="h-7 text-[11px] gap-1" onClick={addKopRow} disabled={kopRowLoading}><Plus className="h-3 w-3" /> Tambah Baris</Button>
                    </div>
                    {kopRows.length === 0 ? (
                      <div className="border-2 border-dashed rounded-lg py-8 text-center bg-muted/20"><Type className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" /><p className="text-[11px] text-muted-foreground">Belum ada baris teks KOP</p><p className="text-[10px] text-muted-foreground/60 mt-0.5">Klik &quot;Tambah Baris&quot; untuk menambahkan teks kop surat</p></div>
                    ) : (
                      <div className="space-y-2">
                        {[...kopRows].sort((a, b) => a.urutan - b.urutan).map((row, idx, arr) => (
                          <div key={row.id} className="border rounded-lg p-3 bg-card space-y-2">
                            <div className="flex items-center gap-2">
                              <GripVertical className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
                              <span className="text-[10px] font-medium text-muted-foreground w-6">#{idx + 1}</span>
                              <div className="flex-1"><Input className="h-8 text-xs" placeholder="Teks baris KOP (misal: PEMERINTAH KABUPATEN TANGERANG)" value={row.teks} onChange={e => updateKopRow(row.id, { teks: e.target.value })} style={{ fontFamily: row.fontFamily, fontSize: `${row.fontSize}pt`, fontWeight: row.bold ? 'bold' : 'normal', fontStyle: row.italic ? 'italic' : 'normal', textTransform: row.uppercase ? 'uppercase' : 'none' }} /></div>
                              <div className="flex items-center gap-0.5 flex-shrink-0">
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => moveKopRow(row.id, 'up')} disabled={idx === 0}><ArrowUp className="h-3.5 w-3.5" /></Button>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => moveKopRow(row.id, 'down')} disabled={idx === arr.length - 1}><ArrowDown className="h-3.5 w-3.5" /></Button>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => deleteKopRow(row.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap pl-8">
                              <div className="flex items-center gap-1"><label className="text-[9px] text-muted-foreground">Font:</label><select className="h-6 text-[10px] border rounded px-1 bg-background" value={row.fontFamily} onChange={e => updateKopRow(row.id, { fontFamily: e.target.value })}>{['Times New Roman','Arial','Courier New','Georgia','Verdana','Trebuchet MS','Calibri','Cambria','Garamond','Comic Sans MS','Impact','Palatino Linotype','Tahoma'].map(f => <option key={f} value={f}>{f}</option>)}</select></div>
                              <div className="flex items-center gap-1"><label className="text-[9px] text-muted-foreground">Ukuran:</label><Input type="number" min="6" max="72" step="0.5" className="h-6 w-14 text-[10px] px-1" value={row.fontSize} onChange={e => updateKopRow(row.id, { fontSize: parseFloat(e.target.value) || 12 })} /><span className="text-[9px] text-muted-foreground">pt</span></div>
                              <div className="flex items-center gap-0.5"><label className="text-[9px] text-muted-foreground mr-0.5">Jarak:</label><Button variant="outline" size="sm" className="h-6 w-6 p-0 text-[11px]" onClick={() => updateKopRow(row.id, { lineHeight: Math.max(0.5, Math.round((row.lineHeight - 0.1) * 10) / 10) })} disabled={row.lineHeight <= 0.5}>↓</Button><span className="text-[10px] w-6 text-center font-mono">{row.lineHeight?.toFixed(1) || '1.3'}</span><Button variant="outline" size="sm" className="h-6 w-6 p-0 text-[11px]" onClick={() => updateKopRow(row.id, { lineHeight: Math.min(3.0, Math.round((row.lineHeight + 0.1) * 10) / 10) })} disabled={row.lineHeight >= 3.0}>↑</Button></div>
                              <Button variant={row.bold ? 'default' : 'outline'} size="sm" className={`h-6 w-7 p-0 ${row.bold ? '' : 'text-muted-foreground'}`} onClick={() => updateKopRow(row.id, { bold: !row.bold })}><Bold className="h-3 w-3" /></Button>
                              <Button variant={row.italic ? 'default' : 'outline'} size="sm" className={`h-6 w-7 p-0 ${row.italic ? '' : 'text-muted-foreground'}`} onClick={() => updateKopRow(row.id, { italic: !row.italic })}><Italic className="h-3 w-3" /></Button>
                              <Button variant={row.uppercase ? 'default' : 'outline'} size="sm" className={`h-6 px-1.5 p-0 text-[9px] ${row.uppercase ? '' : 'text-muted-foreground'}`} onClick={() => updateKopRow(row.id, { uppercase: !row.uppercase })}>AA</Button>
                              {kopRowSaving === row.id && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <Separator />
                  {/* Garis Bawah KOP */}
                  <div className="space-y-2">
                    <h4 className="text-[11px] font-semibold">Garis Bawah KOP</h4>
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-1.5"><label className="text-[9px] text-muted-foreground">Gaya Garis:</label><select className="h-6 text-[10px] border rounded px-1 bg-background" value={sekolahData.garisBawahStyle || 'single-thick'} onChange={e => setSekolahData(prev => ({...prev, garisBawahStyle: e.target.value}))}><option value="single-thin">Garis 1 (tipis)</option><option value="single-thick">Garis 1 (tebal)</option><option value="double">Garis 2 (tipis-tipis)</option><option value="double-thick-thin">Garis 2 (tebal-tipis)</option><option value="double-thin-thick">Garis 2 (tipis-tebal)</option><option value="none">Tanpa Garis</option></select></div>
                      <div className="flex items-center gap-0.5"><label className="text-[9px] text-muted-foreground mr-0.5">Jarak:</label><Button variant="outline" size="sm" className="h-6 w-6 p-0 text-[11px]" onClick={() => setSekolahData(prev => ({...prev, garisBawahJarak: Math.max(0, (prev.garisBawahJarak || 4) - 1)}))} disabled={(sekolahData.garisBawahJarak || 4) <= 0}>↓</Button><span className="text-[10px] w-6 text-center font-mono">{sekolahData.garisBawahJarak ?? 4}</span><Button variant="outline" size="sm" className="h-6 w-6 p-0 text-[11px]" onClick={() => setSekolahData(prev => ({...prev, garisBawahJarak: Math.min(20, (prev.garisBawahJarak || 4) + 1)}))} disabled={(sekolahData.garisBawahJarak || 4) >= 20}>↑</Button><span className="text-[9px] text-muted-foreground">pt</span></div>
                    </div>
                    <div className="border rounded p-2 bg-white">{renderGarisBawah(sekolahData.garisBawahStyle || 'single-thick')}</div>
                  </div>
                  <Separator />
                  {/* KOP Preview */}
                  <div className="space-y-1">
                    <h4 className="text-[11px] font-semibold">Pratinjau KOP</h4>
                    <div className="border rounded-lg p-4 bg-white">{renderKopSurat(true)}</div>
                  </div>
                </CardContent>
              </Card>
              {/* Identitas Sekolah */}
              <Card><CardHeader className="pb-2"><CardTitle className="text-xs">Identitas Sekolah</CardTitle></CardHeader><CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><div><label className="text-[11px] font-medium text-muted-foreground">Nama Sekolah</label><Input className="h-8 text-xs mt-1" value={sekolahData.namaSekolah || ''} onChange={e => setSekolahData(prev => ({...prev, namaSekolah: e.target.value}))} /></div><div><label className="text-[11px] font-medium text-muted-foreground">NPSN</label><Input className="h-8 text-xs mt-1" value={sekolahData.npsn || ''} onChange={e => setSekolahData(prev => ({...prev, npsn: e.target.value}))} /></div></div>
                <div><label className="text-[11px] font-medium text-muted-foreground">Alamat</label><Input className="h-8 text-xs mt-1" value={sekolahData.alamat || ''} onChange={e => setSekolahData(prev => ({...prev, alamat: e.target.value}))} /></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><div><label className="text-[11px] font-medium text-muted-foreground">Kabupaten</label><Input className="h-8 text-xs mt-1" value={sekolahData.kabupaten || ''} onChange={e => setSekolahData(prev => ({...prev, kabupaten: e.target.value}))} /></div><div><label className="text-[11px] font-medium text-muted-foreground">Provinsi</label><Input className="h-8 text-xs mt-1" value={sekolahData.provinsi || ''} onChange={e => setSekolahData(prev => ({...prev, provinsi: e.target.value}))} /></div></div>
              </CardContent></Card>
              {/* Pejabat Sekolah */}
              <Card><CardHeader className="pb-2"><CardTitle className="text-xs">Pejabat Sekolah</CardTitle></CardHeader><CardContent className="space-y-3">
                {[{label: 'Kepala Sekolah', nameKey: 'kepalaSekolah', nipKey: 'nipKepala'},{label: 'Bendahara', nameKey: 'bendahara', nipKey: 'nipBendahara'},{label: 'Pengurus Barang', nameKey: 'pengurusBarang', nipKey: 'nipPengurus'},{label: 'Penerima Barang', nameKey: 'penerimaBarang', nipKey: 'nipPenerima'},].map(field => (
                  <div key={field.nameKey} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><label className="text-[11px] font-medium text-muted-foreground">{field.label}</label><Input className="h-8 text-xs mt-1" value={sekolahData[field.nameKey] || ''} onChange={e => setSekolahData(prev => ({...prev, [field.nameKey]: e.target.value}))} /></div>
                    <div><label className="text-[11px] font-medium text-muted-foreground">NIP</label><Input className="h-8 text-xs mt-1" value={sekolahData[field.nipKey] || ''} onChange={e => setSekolahData(prev => ({...prev, [field.nipKey]: e.target.value}))} /></div>
                  </div>
                ))}
              </CardContent></Card>
            </div>
          )}
        </div>
      )}

      {/* ===== MASTER BPU SUB-TAB ===== */}
      {spjSubTab === 'master-bpu' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div><h3 className="text-sm font-semibold">Master BPU</h3><p className="text-[11px] text-muted-foreground">Bukti Pengeluaran Uang — barang/jasa</p></div>
            <div className="flex items-center gap-2"><Badge variant="outline" className="text-[10px]">{bpuList.length} BPU</Badge><Button size="sm" className="h-7 text-[11px] gap-1" onClick={syncBPU} disabled={bpuSyncing}>{bpuSyncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Database className="h-3 w-3" />}Sinkron dari BKU</Button></div>
          </div>
          {bpuLoading ? (<div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}</div>
          ) : bpuList.length === 0 ? (<Card className="border-dashed"><CardContent className="py-12 text-center"><ClipboardList className="h-10 w-10 text-muted-foreground mx-auto mb-2" /><h3 className="text-sm font-semibold">Belum ada data BPU</h3><p className="text-xs text-muted-foreground mt-1">Klik &quot;Sinkron dari BKU&quot; untuk mengambil data BPU dari file BKU yang sudah diimpor</p></CardContent></Card>
          ) : (
            <div className="space-y-3">
              {bpuList.map((bpu: any) => {
                const isSelected = selectedBpu === bpu.id
                const totalJumlah = bpu.items?.reduce((s: number, i: any) => s + i.jumlah, 0) || 0
                const editFields = bpuEditFields[bpu.id] || { noPesanan: bpu.noPesanan, tglPesan: bpu.tglPesan, tokoId: bpu.tokoId || '' }
                return (
                  <Card key={bpu.id} className={`overflow-hidden ${isSelected ? 'ring-2 ring-primary' : ''}`}>
                    <div className="px-4 py-3 cursor-pointer hover:bg-muted/50" onClick={() => setSelectedBpu(isSelected ? null : bpu.id)}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3"><div><div className="flex items-center gap-2"><span className="text-sm font-semibold">{bpu.noBukti}</span>{bpu.noPesanan && <Badge className="text-[9px] h-4 px-1.5 bg-teal-600">No. {bpu.noPesanan.padStart(3, '0')}</Badge>}{!bpu.noPesanan && <Badge variant="outline" className="text-[9px] h-4 px-1.5 text-amber-600 border-amber-300">Belum ada pesanan</Badge>}</div><div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">{bpu.tglPesan && <span>{new Date(bpu.tglPesan).toLocaleDateString('id-ID')}</span>}<span>{bpu.items?.length || 0} item</span>{bpu.toko && <span>Toko: {bpu.toko.namaToko}</span>}</div></div></div>
                        <div className="flex items-center gap-3"><span className="text-sm font-bold">{fmtRp(totalJumlah)}</span>{isSelected ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}</div>
                      </div>
                    </div>
                    {isSelected && (
                      <CardContent className="px-4 pb-3 pt-0 space-y-3 border-t">
                        <div className="pt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div><label className="text-[10px] font-medium text-muted-foreground">No Pesanan (3 digit)</label><Input className="h-7 text-[11px] mt-1" value={editFields.noPesanan} onChange={e => setBpuEditFields(prev => ({...prev, [bpu.id]: {...(prev[bpu.id] || {noPesanan: bpu.noPesanan, tglPesan: bpu.tglPesan, tokoId: bpu.tokoId || ''}), noPesanan: e.target.value}}))} placeholder="001" /></div>
                          <div><label className="text-[10px] font-medium text-muted-foreground">Tanggal Pesan</label><Input type="date" className="h-7 text-[11px] mt-1" value={editFields.tglPesan ? editFields.tglPesan.split('T')[0] : ''} onChange={e => setBpuEditFields(prev => ({...prev, [bpu.id]: {...(prev[bpu.id] || {noPesanan: bpu.noPesanan, tglPesan: bpu.tglPesan, tokoId: bpu.tokoId || ''}), tglPesan: e.target.value}}))} /></div>
                          <div><label className="text-[10px] font-medium text-muted-foreground">Toko</label><select className="w-full h-7 text-[11px] mt-1 rounded-md border border-input bg-transparent px-2" value={editFields.tokoId} onChange={e => setBpuEditFields(prev => ({...prev, [bpu.id]: {...(prev[bpu.id] || {noPesanan: bpu.noPesanan, tglPesan: bpu.tglPesan, tokoId: bpu.tokoId || ''}), tokoId: e.target.value}}))}><option value="">-- Pilih Toko --</option>{tokoList.map((t: any) => <option key={t.id} value={t.id}>{t.namaToko}</option>)}</select></div>
                        </div>
                        <div className="flex items-center gap-2"><Button size="sm" className="h-6 text-[10px] gap-1" onClick={() => { updateBPU(bpu.id, editFields); setBpuEditFields(prev => { const next = {...prev}; delete next[bpu.id]; return next }) }}><CheckCircle2 className="h-3 w-3" /> Simpan</Button><Button variant="outline" size="sm" className="h-6 text-[10px] gap-1" onClick={() => setBpuEditFields(prev => { const next = {...prev}; delete next[bpu.id]; return next })}>Batal</Button><div className="ml-auto"><Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-destructive" onClick={() => deleteBPU(bpu.id)}><Trash2 className="h-3 w-3" /> Hapus</Button></div></div>
                        {(bpu.nomorSuratPesanan || bpu.nomorSuratBAST || bpu.nomorSuratSHP) && (<div className="bg-teal-50 dark:bg-teal-950/30 rounded-md p-2.5 space-y-1"><p className="text-[10px] font-semibold text-teal-700 dark:text-teal-300">Nomor Surat (Auto-generated)</p>{bpu.nomorSuratPesanan && <p className="text-[10px] text-teal-600 dark:text-teal-400">Pesanan: {bpu.nomorSuratPesanan}</p>}{bpu.nomorSuratBAST && <p className="text-[10px] text-teal-600 dark:text-teal-400">BAST: {bpu.nomorSuratBAST}</p>}{bpu.nomorSuratSHP && <p className="text-[10px] text-teal-600 dark:text-teal-400">SHP: {bpu.nomorSuratSHP}</p>}</div>)}
                        <div className="overflow-x-auto"><table className="w-full text-[11px]"><thead><tr className="border-b bg-muted/50"><th className="px-2 py-1.5 text-center w-10">No</th><th className="px-2 py-1.5 text-left">Uraian</th><th className="px-2 py-1.5 text-left w-28">Kode Rekening</th><th className="px-2 py-1.5 text-right w-24">Jumlah</th><th className="px-2 py-1.5 text-right w-28">Harga Toko 2</th></tr></thead><tbody>
                          {bpu.items?.map((item: any, idx: number) => (<tr key={item.id || idx} className="border-b last:border-0 hover:bg-muted/30"><td className="px-2 py-1.5 text-center text-muted-foreground">{idx + 1}</td><td className="px-2 py-1.5">{item.uraian || '-'}</td><td className="px-2 py-1.5 font-mono text-[10px]">{item.kodeRekening || '-'}</td><td className="px-2 py-1.5 text-right font-medium">{fmtRp(item.jumlah)}</td><td className="px-2 py-1.5 text-right"><Input className="h-6 text-[10px] text-right w-24 ml-auto" value={item.hargaToko2 || ''} onBlur={e => { const newItems = bpu.items.map((i: any, fi: number) => fi === idx ? {...i, hargaToko2: parseFloat(e.target.value) || 0} : i); updateBPItemHargaToko2(bpu.id, newItems) }} onChange={e => { const newItems = bpu.items.map((i: any, fi: number) => fi === idx ? {...i, hargaToko2: parseFloat(e.target.value) || 0} : i); setBpuList(prev => prev.map((b: any) => b.id === bpu.id ? {...b, items: newItems} : b)) }} placeholder="0" /></td></tr>))}
                          <tr className="bg-muted/50 font-semibold"><td colSpan={3} className="px-2 py-1.5 text-right">Total</td><td className="px-2 py-1.5 text-right">{fmtRp(totalJumlah)}</td><td></td></tr>
                        </tbody></table></div>
                      </CardContent>
                    )}
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ===== MASTER BNU SUB-TAB ===== */}
      {spjSubTab === 'master-bnu' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div><h3 className="text-sm font-semibold">Master BNU</h3><p className="text-[11px] text-muted-foreground">Belanja Honor/Gaji</p></div>
            <div className="flex items-center gap-2"><Badge variant="outline" className="text-[10px]">{bnuList.length} BNU</Badge><Button size="sm" className="h-7 text-[11px] gap-1" onClick={syncBNU} disabled={bnuSyncing}>{bnuSyncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Database className="h-3 w-3" />}Sinkron dari BKU</Button></div>
          </div>
          {bnuLoading ? (<div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}</div>
          ) : bnuList.length === 0 ? (<Card className="border-dashed"><CardContent className="py-12 text-center"><Users className="h-10 w-10 text-muted-foreground mx-auto mb-2" /><h3 className="text-sm font-semibold">Belum ada data BNU</h3><p className="text-xs text-muted-foreground mt-1">Klik &quot;Sinkron dari BKU&quot; untuk mengambil data BNU dari file BKU yang sudah diimpor</p></CardContent></Card>
          ) : (
            <div className="space-y-3">
              {bnuList.map((bnu: any) => {
                const isSelected = selectedBnu === bnu.id
                const totalJumlah = bnu.items?.reduce((s: number, i: any) => s + i.jumlah, 0) || 0
                const editFields = bnuEditFields[bnu.id] || { noPesanan: bnu.noPesanan, tglPesan: bnu.tglPesan, tokoId: bnu.tokoId || '' }
                return (
                  <Card key={bnu.id} className={`overflow-hidden ${isSelected ? 'ring-2 ring-primary' : ''}`}>
                    <div className="px-4 py-3 cursor-pointer hover:bg-muted/50" onClick={() => setSelectedBnu(isSelected ? null : bnu.id)}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3"><div><div className="flex items-center gap-2"><span className="text-sm font-semibold">{bnu.noBukti}</span>{bnu.noPesanan && <Badge className="text-[9px] h-4 px-1.5 bg-teal-600">No. {bnu.noPesanan.padStart(3, '0')}</Badge>}{!bnu.noPesanan && <Badge variant="outline" className="text-[9px] h-4 px-1.5 text-amber-600 border-amber-300">Belum ada pesanan</Badge>}</div><div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">{bnu.tglPesan && <span>{new Date(bnu.tglPesan).toLocaleDateString('id-ID')}</span>}<span>{bnu.items?.length || 0} item</span>{bnu.toko && <span>Toko: {bnu.toko.namaToko}</span>}</div></div></div>
                        <div className="flex items-center gap-3"><span className="text-sm font-bold">{fmtRp(totalJumlah)}</span>{isSelected ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}</div>
                      </div>
                    </div>
                    {isSelected && (
                      <CardContent className="px-4 pb-3 pt-0 space-y-3 border-t">
                        <div className="pt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div><label className="text-[10px] font-medium text-muted-foreground">No Pesanan (3 digit)</label><Input className="h-7 text-[11px] mt-1" value={editFields.noPesanan} onChange={e => setBnuEditFields(prev => ({...prev, [bnu.id]: {...(prev[bnu.id] || {noPesanan: bnu.noPesanan, tglPesan: bnu.tglPesan, tokoId: bnu.tokoId || ''}), noPesanan: e.target.value}}))} placeholder="001" /></div>
                          <div><label className="text-[10px] font-medium text-muted-foreground">Tanggal Pesan</label><Input type="date" className="h-7 text-[11px] mt-1" value={editFields.tglPesan ? editFields.tglPesan.split('T')[0] : ''} onChange={e => setBnuEditFields(prev => ({...prev, [bnu.id]: {...(prev[bnu.id] || {noPesanan: bnu.noPesanan, tglPesan: bnu.tglPesan, tokoId: bnu.tokoId || ''}), tglPesan: e.target.value}}))} /></div>
                          <div><label className="text-[10px] font-medium text-muted-foreground">Toko</label><select className="w-full h-7 text-[11px] mt-1 rounded-md border border-input bg-transparent px-2" value={editFields.tokoId} onChange={e => setBnuEditFields(prev => ({...prev, [bnu.id]: {...(prev[bnu.id] || {noPesanan: bnu.noPesanan, tglPesan: bnu.tglPesan, tokoId: bnu.tokoId || ''}), tokoId: e.target.value}}))}><option value="">-- Pilih Toko --</option>{tokoList.map((t: any) => <option key={t.id} value={t.id}>{t.namaToko}</option>)}</select></div>
                        </div>
                        <div className="flex items-center gap-2"><Button size="sm" className="h-6 text-[10px] gap-1" onClick={() => { updateBNU(bnu.id, editFields); setBnuEditFields(prev => { const next = {...prev}; delete next[bnu.id]; return next }) }}><CheckCircle2 className="h-3 w-3" /> Simpan</Button><Button variant="outline" size="sm" className="h-6 text-[10px] gap-1" onClick={() => setBnuEditFields(prev => { const next = {...prev}; delete next[bnu.id]; return next })}>Batal</Button><div className="ml-auto"><Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-destructive" onClick={() => deleteBNU(bnu.id)}><Trash2 className="h-3 w-3" /> Hapus</Button></div></div>
                        {(bnu.nomorSuratPesanan || bnu.nomorSuratBAST || bnu.nomorSuratSHP) && (<div className="bg-teal-50 dark:bg-teal-950/30 rounded-md p-2.5 space-y-1"><p className="text-[10px] font-semibold text-teal-700 dark:text-teal-300">Nomor Surat (Auto-generated)</p>{bnu.nomorSuratPesanan && <p className="text-[10px] text-teal-600 dark:text-teal-400">Pesanan: {bnu.nomorSuratPesanan}</p>}{bnu.nomorSuratBAST && <p className="text-[10px] text-teal-600 dark:text-teal-400">BAST: {bnu.nomorSuratBAST}</p>}{bnu.nomorSuratSHP && <p className="text-[10px] text-teal-600 dark:text-teal-400">SHP: {bnu.nomorSuratSHP}</p>}</div>)}
                        <div className="overflow-x-auto"><table className="w-full text-[11px]"><thead><tr className="border-b bg-muted/50"><th className="px-2 py-1.5 text-center w-10">No</th><th className="px-2 py-1.5 text-left">Uraian</th><th className="px-2 py-1.5 text-left w-28">Kode Rekening</th><th className="px-2 py-1.5 text-right w-24">Jumlah</th><th className="px-2 py-1.5 text-right w-28">Harga Toko 2</th></tr></thead><tbody>
                          {bnu.items?.map((item: any, idx: number) => (<tr key={item.id || idx} className="border-b last:border-0 hover:bg-muted/30"><td className="px-2 py-1.5 text-center text-muted-foreground">{idx + 1}</td><td className="px-2 py-1.5">{item.uraian || '-'}</td><td className="px-2 py-1.5 font-mono text-[10px]">{item.kodeRekening || '-'}</td><td className="px-2 py-1.5 text-right font-medium">{fmtRp(item.jumlah)}</td><td className="px-2 py-1.5 text-right"><Input className="h-6 text-[10px] text-right w-24 ml-auto" value={item.hargaToko2 || ''} onBlur={e => { const newItems = bnu.items.map((i: any, fi: number) => fi === idx ? {...i, hargaToko2: parseFloat(e.target.value) || 0} : i); updateBNUItemHargaToko2(bnu.id, newItems) }} onChange={e => { const newItems = bnu.items.map((i: any, fi: number) => fi === idx ? {...i, hargaToko2: parseFloat(e.target.value) || 0} : i); setBnuList(prev => prev.map((b: any) => b.id === bnu.id ? {...b, items: newItems} : b)) }} placeholder="0" /></td></tr>))}
                          <tr className="bg-muted/50 font-semibold"><td colSpan={3} className="px-2 py-1.5 text-right">Total</td><td className="px-2 py-1.5 text-right">{fmtRp(totalJumlah)}</td><td></td></tr>
                        </tbody></table></div>
                      </CardContent>
                    )}
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ===== REKAPITULASI SUB-TAB ===== */}
      {spjSubTab === 'rekapitulasi' && (
        spjLoading ? (
          <div className="space-y-4"><div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}</div><Skeleton className="h-64 rounded-lg" /></div>
        ) : !spjData || (spjData.bulanan.length === 0 && !spjData.tahunan) ? (
          <Card className="border-dashed"><CardContent className="py-16 text-center space-y-3"><div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto"><FileSpreadsheet className="h-8 w-8 text-muted-foreground" /></div><div><h3 className="text-sm font-semibold">Belum ada data SPJ</h3><p className="text-xs text-muted-foreground mt-1">Import file RKAS dan BKU untuk melihat pencocokan Surat Pertanggungjawaban</p></div><div className="flex flex-col sm:flex-row gap-2 justify-center mt-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><ClipboardList className="h-3.5 w-3.5" /><span>1. Import RKAS (Bulanan & Tahunan)</span></div><div className="flex items-center gap-2 text-xs text-muted-foreground"><Receipt className="h-3.5 w-3.5" /><span>2. Import BKU per bulan</span></div></div></CardContent></Card>
        ) : (
          <>
            <Card><CardContent className="py-2.5 px-3"><div className="flex items-center gap-2 flex-wrap"><span className="text-[10px] text-muted-foreground font-medium shrink-0">Periode:</span>{spjData.tahunan && (<Button variant={selectedSpjMonth === -1 ? 'default' : 'outline'} size="sm" className="h-7 text-[11px] gap-1" onClick={() => setSelectedSpjMonth(-1)}><Calendar className="h-3 w-3" /> Tahunan {spjData.tahunan.tahun}</Button>)}{spjData.bulanan.map((m, idx) => (<Button key={idx} variant={selectedSpjMonth === idx ? 'default' : 'outline'} size="sm" className="h-7 text-[11px] gap-1" onClick={() => setSelectedSpjMonth(idx)}><Calendar className="h-3 w-3" /> {MONTH_NAMES[m.bulan] || m.bulan.slice(0,3)} {m.tahun}{m.persenRealisasi > 0 && (<span className={`ml-0.5 text-[9px] ${m.persenRealisasi >= 95 ? 'text-emerald-600' : m.persenRealisasi >= 50 ? 'text-amber-600' : 'text-red-500'}`}>({m.persenRealisasi}%)</span>)}</Button>))}{spjLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}</div></CardContent></Card>
            {/* SPJ Summary KPI */}
            {(() => {
              const src = selectedSpjMonth === -1 ? spjData.tahunan : spjData.bulanan[selectedSpjMonth]
              if (!src) return null
              const allItems = src.standarGroups.flatMap(g => g.items)
              const statusCounts = { lengkap: allItems.filter(i => i.status === 'lengkap').length, sebagian: allItems.filter(i => i.status === 'sebagian').length, belum: allItems.filter(i => i.status === 'belum').length, lebih: allItems.filter(i => i.status === 'lebih').length }
              return (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Card className="border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30"><CardContent className="pt-3 pb-2 px-3"><div className="flex items-center gap-2 mb-1"><ClipboardList className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /><p className="text-[10px] text-muted-foreground">Anggaran (RKAS)</p></div><p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{fmtRp(src.totalAnggaran)}</p></CardContent></Card>
                    <Card className="border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30"><CardContent className="pt-3 pb-2 px-3"><div className="flex items-center gap-2 mb-1"><Receipt className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" /><p className="text-[10px] text-muted-foreground">Realisasi (BKU)</p></div><p className="text-sm font-bold text-amber-700 dark:text-amber-300">{fmtRp(src.totalRealisasi)}</p></CardContent></Card>
                    <Card className={src.totalSelisih >= 0 ? 'border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-sky-50 dark:from-blue-950/30 dark:to-sky-950/30' : 'border-red-200 dark:border-red-800 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30'}><CardContent className="pt-3 pb-2 px-3"><div className="flex items-center gap-2 mb-1">{src.totalSelisih >= 0 ? <Minus className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" /> : <AlertCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />}<p className="text-[10px] text-muted-foreground">{src.totalSelisih >= 0 ? 'Sisa Anggaran' : 'Defisit'}</p></div><p className={`text-sm font-bold ${src.totalSelisih >= 0 ? 'text-blue-700 dark:text-blue-300' : 'text-red-700 dark:text-red-300'}`}>{fmtRp(Math.abs(src.totalSelisih))}</p></CardContent></Card>
                    <Card className="border-violet-200 dark:border-violet-800 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30"><CardContent className="pt-3 pb-2 px-3"><div className="flex items-center gap-2 mb-1"><TrendingUp className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" /><p className="text-[10px] text-muted-foreground">% Pertanggungjawaban</p></div><p className="text-sm font-bold text-violet-700 dark:text-violet-300">{src.persenRealisasi}%</p></CardContent></Card>
                  </div>
                  <Card><CardContent className="py-3 px-4 space-y-2"><div className="flex items-center justify-between"><span className="text-xs font-medium">Tingkat Pertanggungjawaban</span><span className="text-xs font-bold">{fmtRp(src.totalRealisasi)} / {fmtRp(src.totalAnggaran)}</span></div><div className="h-4 bg-muted rounded-full overflow-hidden relative"><div className={`h-full rounded-full transition-all duration-500 ${src.persenRealisasi >= 95 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : src.persenRealisasi >= 50 ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-gradient-to-r from-red-400 to-red-500'}`} style={{ width: `${Math.min(src.persenRealisasi, 100)}%` }} /><div className="absolute inset-0 flex items-center justify-center"><span className="text-[11px] font-bold text-white drop-shadow-sm">{src.persenRealisasi}%</span></div></div><div className="flex items-center gap-3 text-[10px] flex-wrap"><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Lengkap: {statusCounts.lengkap}</span><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> Sebagian: {statusCounts.sebagian}</span><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-400" /> Belum: {statusCounts.belum}</span><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-600" /> Lebih: {statusCounts.lebih}</span><span className="text-muted-foreground ml-auto">{allItems.length} pos total</span></div></CardContent></Card>
                </>
              )
            })()}
            {/* SPJ Detail Table */}
            {(() => {
              const src = selectedSpjMonth === -1 ? spjData.tahunan : spjData.bulanan[selectedSpjMonth]
              if (!src) return <div className="text-center py-8 text-muted-foreground text-sm">Pilih periode untuk melihat SPJ</div>
              const filteredGroups = src.standarGroups.map(g => ({...g, items: g.items.filter(item => !spjSearchTerm || item.uraian.toLowerCase().includes(spjSearchTerm.toLowerCase()) || item.kodeRekening.includes(spjSearchTerm) || item.kodeProgram.includes(spjSearchTerm) || item.standarNama.toLowerCase().includes(spjSearchTerm.toLowerCase()) || item.uraianBKU.toLowerCase().includes(spjSearchTerm.toLowerCase()))})).filter(g => g.items.length > 0)
              return (
                <>
                  <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" /><Input placeholder="Cari uraian, kode rekening, kode program, atau standar..." value={spjSearchTerm} onChange={e => setSpjSearchTerm(e.target.value)} className="pl-9 h-8 text-xs" /></div>
                  {filteredGroups.map(group => {
                    const IconComp = STANDAR_ICONS[group.kode] || FileText
                    const colorIdx = (['02','03','04','05','06','07','08'].indexOf(group.kode))
                    const color = CHART_COLORS[colorIdx >= 0 ? colorIdx : 7]
                    const matchedCount = group.items.filter(i => i.realisasi > 0).length
                    return (
                      <Card key={group.kode}><CardHeader className="pb-2"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}20` }}><IconComp className="h-4 w-4" style={{ color }} /></div><div><CardTitle className="text-xs">{group.nama}</CardTitle><p className="text-[10px] text-muted-foreground">{group.items.length} pos · {matchedCount} terealisasi</p></div></div><div className="text-right"><div className="flex items-center gap-2 text-[11px]"><span className="text-muted-foreground">Anggaran:</span><span className="font-semibold text-emerald-600">{fmtRp(group.anggaran)}</span></div><div className="flex items-center gap-2 text-[11px]"><span className="text-muted-foreground">Realisasi:</span><span className="font-semibold text-amber-600">{fmtRp(group.realisasi)}</span></div></div></div><div className="mt-2"><div className="h-2.5 bg-muted rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all ${group.persenRealisasi >= 95 ? 'bg-emerald-500' : group.persenRealisasi >= 50 ? 'bg-amber-500' : group.persenRealisasi > 0 ? 'bg-red-400' : 'bg-gray-300'}`} style={{ width: `${Math.min(group.persenRealisasi, 100)}%` }} /></div><div className="flex items-center justify-between text-[10px] text-muted-foreground mt-0.5"><span>{group.persenRealisasi}% terealisasi</span><span>Selisih: {fmtRp(Math.abs(group.selisih))} {group.selisih >= 0 ? '(sisa)' : '(defisit)'}</span></div></div></CardHeader>
                        <CardContent className="pt-0"><div className="overflow-x-auto"><table className="w-full text-[11px]"><thead><tr className="border-b"><th className="text-left py-1.5 px-1 font-medium text-muted-foreground w-6">#</th><th className="text-left py-1.5 px-1 font-medium text-muted-foreground">Kode Program</th><th className="text-left py-1.5 px-1 font-medium text-muted-foreground">Kode Rekening</th><th className="text-left py-1.5 px-1 font-medium text-muted-foreground">Uraian</th><th className="text-right py-1.5 px-1 font-medium text-muted-foreground">Anggaran</th><th className="text-right py-1.5 px-1 font-medium text-muted-foreground">Realisasi</th><th className="text-right py-1.5 px-1 font-medium text-muted-foreground">Selisih</th><th className="text-center py-1.5 px-1 font-medium text-muted-foreground w-14">%</th><th className="text-center py-1.5 px-1 font-medium text-muted-foreground w-20">Status</th></tr></thead>
                          <tbody>{group.items.map((item, idx) => (<tr key={idx} className={`border-b last:border-0 ${item.status === 'lebih' ? 'bg-rose-50/50 dark:bg-rose-950/20' : item.status === 'lengkap' ? 'bg-emerald-50/30 dark:bg-emerald-950/10' : 'hover:bg-muted/50'}`}><td className="py-1.5 px-1 text-muted-foreground">{idx + 1}</td><td className="py-1.5 px-1 font-mono text-[10px] text-muted-foreground" title={item.kodeProgram}>{item.kodeProgram.length > 10 ? item.kodeProgram.slice(0, 10) + '…' : item.kodeProgram}</td><td className="py-1.5 px-1 font-mono text-[10px]">{item.kodeRekening}</td><td className="py-1.5 px-1 max-w-[180px]"><div className="truncate" title={item.uraian}>{item.uraian}</div>{item.jumlahItem > 1 && <span className="text-[9px] text-muted-foreground">({item.jumlahItem} sub-item)</span>}{item.uraianBKU && item.realisasi > 0 && <div className="text-[9px] text-amber-600 dark:text-amber-400 truncate" title={`BKU: ${item.uraianBKU}`}>BKU: {item.uraianBKU}</div>}</td><td className="py-1.5 px-1 text-right font-medium text-emerald-700 dark:text-emerald-300">{fmtRp(item.anggaran)}</td><td className="py-1.5 px-1 text-right font-medium text-amber-700 dark:text-amber-300">{item.realisasi > 0 ? fmtRp(item.realisasi) : '-'}</td><td className={`py-1.5 px-1 text-right font-medium ${item.selisih >= 0 ? 'text-blue-700 dark:text-blue-300' : 'text-red-700 dark:text-red-300'}`}>{item.realisasi > 0 ? fmtRp(item.selisih) : '-'}</td><td className="py-1.5 px-1 text-center font-medium">{item.persenRealisasi > 0 ? `${item.persenRealisasi}%` : '-'}</td><td className="py-1.5 px-1 text-center"><Badge variant="outline" className={`text-[9px] h-4 px-1 ${item.status === 'lengkap' ? 'border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300' : item.status === 'sebagian' ? 'border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300' : item.status === 'lebih' ? 'border-rose-300 text-rose-700 dark:border-rose-700 dark:text-rose-300' : 'border-red-200 text-red-500 dark:border-red-700 dark:text-red-300'}`}>{item.status === 'lengkap' ? 'Lengkap' : item.status === 'sebagian' ? 'Sebagian' : item.status === 'lebih' ? 'Lebih' : 'Belum'}</Badge></td></tr>))}</tbody>
                        </table></div></CardContent>
                      </Card>
                    )
                  })}
                  {/* Unmatched Items */}
                  {(() => {
                    const monthData = selectedSpjMonth === -1 ? null : spjData.bulanan[selectedSpjMonth]
                    if (!monthData) return null
                    const hasUnmatched = monthData.unmatchedBKU.length > 0 || monthData.unmatchedRKAS.length > 0
                    if (!hasUnmatched) return null
                    const totalUnmatchedBKU = monthData.unmatchedBKU.reduce((s, u) => s + u.jumlah, 0)
                    const totalUnmatchedRKAS = monthData.unmatchedRKAS.reduce((s, u) => s + u.jumlah, 0)
                    return (
                      <Card className="border-dashed"><CardHeader className="pb-2"><CardTitle className="text-xs flex items-center gap-2"><AlertCircle className="h-3.5 w-3.5 text-amber-500" />Pos Tanpa Cocokan</CardTitle></CardHeader><CardContent className="space-y-3">
                        {monthData.unmatchedBKU.length > 0 && (<div><p className="text-[10px] font-medium text-amber-700 dark:text-amber-300 mb-1">Realisasi tanpa anggaran RKAS (BKU): {monthData.unmatchedBKU.length} pos · {fmtRp(totalUnmatchedBKU)}</p><div className="space-y-0.5 max-h-40 overflow-y-auto">{monthData.unmatchedBKU.map((u, i) => (<div key={i} className="flex items-center gap-2 text-[10px]"><code className="font-mono text-muted-foreground shrink-0">{u.kodeKegiatan}|{u.kodeRekening}</code><span className="truncate flex-1">{u.uraian}</span><span className="font-medium text-amber-600 shrink-0">{fmtRp(u.jumlah)}</span></div>))}</div></div>)}
                        {monthData.unmatchedRKAS.length > 0 && (<div><p className="text-[10px] font-medium text-red-700 dark:text-red-300 mb-1">Anggaran tanpa realisasi BKU (belum dibelanjakan): {monthData.unmatchedRKAS.length} pos · {fmtRp(totalUnmatchedRKAS)}</p><div className="space-y-0.5 max-h-40 overflow-y-auto">{monthData.unmatchedRKAS.map((u, i) => (<div key={i} className="flex items-center gap-2 text-[10px]"><code className="font-mono text-muted-foreground shrink-0">{u.kodeProgram}|{u.kodeRekening}</code><span className="truncate flex-1">{u.uraian}</span><span className="font-medium text-red-600 shrink-0">{fmtRp(u.jumlah)}</span></div>))}</div></div>)}
                      </CardContent></Card>
                    )
                  })()}
                  {/* SPJ Bar Chart */}
                  {(() => {
                    const src = selectedSpjMonth === -1 ? spjData.tahunan : spjData.bulanan[selectedSpjMonth]
                    if (!src || src.standarGroups.length <= 1) return null
                    return (
                      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Perbandingan Anggaran vs Realisasi per Standar SNP</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={280}><BarChart data={src.standarGroups.map(g => ({ name: g.nama.replace('Standar ', ''), Anggaran: g.anggaran, Realisasi: g.realisasi }))} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}><CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis fontSize={9} /><YAxis tickFormatter={(v: number) => `${(v/1000000).toFixed(0)}jt`} fontSize={10} /><Tooltip formatter={(v: number) => fmtRp(v)} /><Legend wrapperStyle={{ fontSize: '11px' }} /><Bar dataKey="Anggaran" fill="#10b981" radius={[4, 4, 0, 0]} /><Bar dataKey="Realisasi" fill="#f59e0b" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></CardContent></Card>
                    )
                  })()}
                </>
              )
            })()}
          </>
        )
      )}

      {/* ===== GENERATED DOCUMENT SUB-TABS ===== */}
      {!['rekapitulasi', 'master-data', 'master-toko', 'data-sekolah', 'master-bpu', 'master-bnu'].includes(spjSubTab) && (() => {
        const currentDocType = spjSubTab as SPJDocType
        const indonesianDays: Record<string, string> = { 'Sun': 'Minggu', 'Mon': 'Senin', 'Tue': 'Selasa', 'Wed': 'Rabu', 'Thu': 'Kamis', 'Fri': 'Jumat', 'Sat': 'Sabtu' }
        const indonesianMonths: Record<string, string> = { '1': 'Januari', '2': 'Februari', '3': 'Maret', '4': 'April', '5': 'Mei', '6': 'Juni', '7': 'Juli', '8': 'Agustus', '9': 'September', '10': 'Oktober', '11': 'November', '12': 'Desember' }
        const formatTanggalIndo = (dateStr: string): string => { if (!dateStr) return '....................'; try { const d = new Date(dateStr); if (isNaN(d.getTime())) return '....................'; const day = indonesianDays[d.toString().slice(0, 3)] || ''; const tgl = d.getDate(); const bulan = indonesianMonths[String(d.getMonth() + 1)] || ''; const tahun = d.getFullYear(); return `${day}, ${tgl} ${bulan} ${tahun}` } catch { return '....................' } }
        const formatTanggalShort = (dateStr: string): string => { if (!dateStr) return '....................'; try { const d = new Date(dateStr); if (isNaN(d.getTime())) return '....................'; const tgl = d.getDate(); const bulan = indonesianMonths[String(d.getMonth() + 1)] || ''; const tahun = d.getFullYear(); return `${tgl} ${bulan} ${tahun}` } catch { return '....................' } }

        const currentList = docType === 'bpu' ? bpuList : bnuList
        const selectedId = docType === 'bpu' ? docSelectedBpuId : docSelectedBnuId
        const selectedRecord = currentList.find((r: any) => r.id === selectedId)
        const eligibleBpu = bpuList.filter((b: any) => b.noPesanan && b.noPesanan.trim() !== '')
        const eligibleBnu = bnuList.filter((b: any) => b.noPesanan && b.noPesanan.trim() !== '')
        const toko = selectedRecord?.toko
        const items = selectedRecord?.items || []
        const tglPesan = selectedRecord?.tglPesan || ''
        const tahunAnggaran = tglPesan ? new Date(tglPesan).getFullYear().toString() : new Date().getFullYear().toString()
        const totalJumlah = items.reduce((s: number, i: any) => s + (i.jumlah || 0), 0)

        const kopSurat = renderKopSurat(true)

        const docTypeConfig: Record<SPJDocType, { label: string; icon: any; bgClass: string; borderClass: string; textClass: string; iconTextClass: string }> = {
          'surat-pesanan': { label: 'Surat Pesanan', icon: Package, bgClass: 'bg-teal-50 dark:bg-teal-950/30', borderClass: 'border-teal-200 dark:border-teal-800', textClass: 'text-teal-700 dark:text-teal-300', iconTextClass: 'text-teal-600 dark:text-teal-400' },
          'surat-balasan': { label: 'Dokumen Hasil Perbanding', icon: Store, bgClass: 'bg-orange-50 dark:bg-orange-950/30', borderClass: 'border-orange-200 dark:border-orange-800', textClass: 'text-orange-700 dark:text-orange-300', iconTextClass: 'text-orange-600 dark:text-orange-400' },
          'bast': { label: 'BAST', icon: FileCheck, bgClass: 'bg-emerald-50 dark:bg-emerald-950/30', borderClass: 'border-emerald-200 dark:border-emerald-800', textClass: 'text-emerald-700 dark:text-emerald-300', iconTextClass: 'text-emerald-600 dark:text-emerald-400' },
          'dokumen-perencanaan': { label: 'Dokumen Perencanaan', icon: ClipboardPaste, bgClass: 'bg-violet-50 dark:bg-violet-950/30', borderClass: 'border-violet-200 dark:border-violet-800', textClass: 'text-violet-700 dark:text-violet-300', iconTextClass: 'text-violet-600 dark:text-violet-400' },
          'surat-hasil-pemeriksaan': { label: 'Surat Hasil Pemeriksaan', icon: ShieldCheck, bgClass: 'bg-rose-50 dark:bg-rose-950/30', borderClass: 'border-rose-200 dark:border-rose-800', textClass: 'text-rose-700 dark:text-rose-300', iconTextClass: 'text-rose-600 dark:text-rose-400' },
          'kuitansi-pembayaran': { label: 'Kuitansi Pembayaran', icon: Receipt, bgClass: 'bg-amber-50 dark:bg-amber-950/30', borderClass: 'border-amber-200 dark:border-amber-800', textClass: 'text-amber-700 dark:text-amber-300', iconTextClass: 'text-amber-600 dark:text-amber-400' },
        }
        const config = docTypeConfig[currentDocType]
        const IconComp = config.icon

        return (
          <>
            <Card><CardContent className="py-3 px-4"><div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1"><Button variant={docType === 'bpu' ? 'default' : 'outline'} size="sm" className="h-7 text-[11px] gap-1" onClick={() => { setDocType('bpu'); setDocSelectedBnuId('') }}><ClipboardList className="h-3 w-3" /> BPU</Button><Button variant={docType === 'bnu' ? 'default' : 'outline'} size="sm" className="h-7 text-[11px] gap-1" onClick={() => { setDocType('bnu'); setDocSelectedBpuId('') }}><Users className="h-3 w-3" /> BNU</Button></div>
              <Separator orientation="vertical" className="h-5" />
              <div className="flex items-center gap-2 flex-1 min-w-[200px]"><span className="text-[10px] text-muted-foreground font-medium shrink-0">Pilih {docType === 'bpu' ? 'BPU' : 'BNU'}:</span><select className="h-7 text-[11px] border rounded-md px-2 flex-1 bg-background" value={selectedId} onChange={e => { if (docType === 'bpu') setDocSelectedBpuId(e.target.value); else setDocSelectedBnuId(e.target.value) }}><option value="">-- Pilih --</option>{(docType === 'bpu' ? eligibleBpu : eligibleBnu).map((r: any) => (<option key={r.id} value={r.id}>{r.noBukti} - No Pesanan: {r.noPesanan} {r.toko ? `(${r.toko.namaToko})` : '(belum ada toko)'}</option>))}</select></div>
            </div>
            {selectedId && !toko && <div className="mt-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md flex items-center gap-2 text-[10px] text-amber-700 dark:text-amber-300"><AlertCircle className="h-3.5 w-3.5 shrink-0" />{docType === 'bpu' ? 'BPU' : 'BNU'} ini belum memiliki toko yang ditugaskan. Silakan atur toko di Master {docType === 'bpu' ? 'BPU' : 'BNU'} terlebih dahulu.</div>}
            {selectedId && !sekolahData.namaSekolah && <div className="mt-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md flex items-center gap-2 text-[10px] text-amber-700 dark:text-amber-300"><AlertCircle className="h-3.5 w-3.5 shrink-0" />Data Sekolah belum diisi. Silakan lengkapi di tab Data Sekolah terlebih dahulu.</div>}
            </CardContent></Card>
            <Card className={`${config.borderClass} ${config.bgClass}`}><CardContent className="py-3 px-4"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><div className={`h-10 w-10 rounded-xl flex items-center justify-center ${config.bgClass}`}><IconComp className={`h-5 w-5 ${config.iconTextClass}`} /></div><div><h3 className={`text-sm font-semibold ${config.textClass}`}>{config.label}</h3><p className="text-[10px] text-muted-foreground">Data digenerate dari Master {docType === 'bpu' ? 'BPU' : 'BNU'}, Master Toko & Data Sekolah · Cetak sebagai bukti pertanggungjawaban</p></div></div><Button size="sm" className={`gap-1.5 ${config.bgClass} ${config.textClass} hover:opacity-90`} onClick={() => handlePrintDoc(currentDocType)} disabled={!selectedRecord}><Printer className="h-3.5 w-3.5" />Cetak Dokumen</Button></div></CardContent></Card>
            {!selectedRecord ? (
              <Card className="border-dashed"><CardContent className="py-12 text-center space-y-2"><div className={`h-12 w-12 rounded-xl ${config.bgClass} flex items-center justify-center mx-auto`}><IconComp className={`h-6 w-6 ${config.iconTextClass}`} /></div><div><h4 className="text-xs font-medium">Pilih {docType === 'bpu' ? 'BPU' : 'BNU'} terlebih dahulu</h4><p className="text-[10px] text-muted-foreground mt-0.5">{(docType === 'bpu' ? eligibleBpu : eligibleBnu).length === 0 ? `Belum ada ${docType === 'bpu' ? 'BPU' : 'BNU'} dengan No Pesanan. Isi No Pesanan di Master ${docType === 'bpu' ? 'BPU' : 'BNU'} terlebih dahulu.` : `Pilih ${docType === 'bpu' ? 'BPU' : 'BNU'} dari dropdown di atas untuk menggenerate dokumen.`}</p></div></CardContent></Card>
            ) : (
              <Card className="overflow-hidden">
                <div className="bg-gray-100 dark:bg-gray-800 py-1.5 px-4 flex items-center justify-between"><span className="text-[10px] font-medium text-muted-foreground">Preview Dokumen</span><Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={() => handlePrintDoc(currentDocType)}><Printer className="h-3 w-3" /> Cetak</Button></div>
                <CardContent className="p-0"><div className="flex justify-center bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 overflow-auto">
                  <div id={`doc-content-${currentDocType}`} className="bg-white text-black shadow-lg w-[210mm] min-h-[297mm] p-[20mm]" style={{ fontFamily: 'Times New Roman, serif', fontSize: '12pt' }}>
                    {/* SURAT PESANAN */}
                    {currentDocType === 'surat-pesanan' && (
                      <div>{kopSurat}
                        <div className="text-center mt-2 mb-1"><p className="font-bold text-[13pt]">SURAT PESANAN</p><p className="text-[11pt]">Nomor: {selectedRecord?.nomorSuratPesanan || '............'}</p></div>
                        <table className="w-full border-collapse border border-black text-[10pt] mb-0"><tbody><tr><td className="border border-black px-2 py-0.5" style={{ width: '50%' }}><table className="w-full text-[10pt]"><tbody><tr><td className="py-0.5">Paket Pesanan :</td></tr><tr><td className="py-0.5">Kegiatan jual beli dengan mitra {toko?.namaToko || '........................'}</td></tr><tr><td className="py-0.5">Waktu Pengerjaan Pesanan : {tglPesan ? formatTanggalShort(tglPesan) : '............'}</td></tr><tr><td className="py-0.5">Waktu Pemrosesan Pesanan : {tglPesan ? formatTanggalShort(tglPesan) : '............'}</td></tr><tr><td className="py-0.5">Waktu Penyelesaian Pesanan : {tglPesan ? formatTanggalShort(tglPesan) : '............'}</td></tr></tbody></table></td><td className="border border-black px-2 py-0.5" style={{ width: '50%' }}><table className="w-full text-[10pt]"><tbody><tr><td className="py-0.5">Nomor Surat Pesanan : {selectedRecord?.nomorSuratPesanan || '............'}</td></tr><tr><td className="py-0.5">Tanggal Pesanan : {tglPesan ? formatTanggalShort(tglPesan) : '............'}</td></tr><tr><td className="py-0.5">Tanggal Negosiasi : </td></tr><tr><td className="py-0.5">No. BPU : {selectedRecord?.noBukti || '............'}</td></tr><tr><td className="py-0.5">Catatan Pengiriman Untuk Penyedia : </td></tr></tbody></table></td></tr></tbody></table>
                        <table className="w-full border-collapse border border-black text-[10pt]"><thead><tr><th colSpan={6} className="border border-black px-2 py-1 text-center font-bold text-[11pt]">RINCIAN PEKERJAAN</th></tr><tr><th className="border border-black px-1 py-1 text-center w-6">No</th><th className="border border-black px-2 py-1 text-left">Uraian Barang / Jasa</th><th className="border border-black px-2 py-1 text-center w-14">Jumlah</th><th className="border border-black px-2 py-1 text-center w-20">Satuan Ukuran</th><th className="border border-black px-2 py-1 text-right w-28">Harga Satuan</th><th className="border border-black px-2 py-1 text-right w-28">Total Harga</th></tr></thead><tbody>
                          {items.map((item: any, idx: number) => (<tr key={idx}><td className="border border-black px-1 py-0.5 text-center">{idx + 1}</td><td className="border border-black px-2 py-0.5">{item.uraian || '-'}</td><td className="border border-black px-2 py-0.5 text-center">{item.volume || '1'}</td><td className="border border-black px-2 py-0.5 text-center">{item.satuan || 'Paket'}</td><td className="border border-black px-2 py-0.5 text-right">{item.tarifHarga ? fmtRp(item.tarifHarga) : fmtRp(item.jumlah || 0)}</td><td className="border border-black px-2 py-0.5 text-right">{fmtRp(item.jumlah || 0)}</td></tr>))}
                          {items.length === 0 && <tr><td colSpan={6} className="border border-black px-2 py-4 text-center text-gray-400 italic">Belum ada item</td></tr>}
                          <tr><td colSpan={5} className="border border-black px-2 py-0.5 text-right font-bold">Harga sebelum PPN</td><td className="border border-black px-2 py-0.5 text-right">{fmtRp(totalJumlah)}</td></tr>
                          <tr><td colSpan={5} className="border border-black px-2 py-0.5 text-right">DPP PPN</td><td className="border border-black px-2 py-0.5 text-right">{fmtRp(Math.round(totalJumlah / 1.11))}</td></tr>
                          <tr><td colSpan={5} className="border border-black px-2 py-0.5 text-right">PPN 11%</td><td className="border border-black px-2 py-0.5 text-right">{fmtRp(totalJumlah - Math.round(totalJumlah / 1.11))}</td></tr>
                          <tr className="font-bold"><td colSpan={5} className="border border-black px-2 py-0.5 text-right">Total Pembayaran</td><td className="border border-black px-2 py-0.5 text-right">{fmtRp(totalJumlah)}</td></tr>
                          <tr><td colSpan={5} className="border border-black px-2 py-0.5 text-right">PPh 23 2%</td><td className="border border-black px-2 py-0.5 text-right">-</td></tr>
                          <tr><td colSpan={6} className="border border-black px-2 py-0.5 text-center italic">Terbilang : {totalJumlah > 0 ? terbilang(totalJumlah) + ' Rupiah' : '........................................................'}</td></tr>
                        </tbody></table>
                        <div className="mt-3 text-[10pt]"><p className="font-bold mb-1">Instruksi ke Penyedia dan Satuan Pendidikan :</p><ol className="list-decimal pl-5 space-y-0.5 text-justify" style={{ lineHeight: '1.4' }}><li>Penyedia berkewajiban untuk menyediakan barang/jasa sesuai dengan surat pesanan dan dalam jangka waktu transaksi yang berlaku.</li><li>Penyedia berhak meminta pembayaran sesuai total pembayaran setelah penyelesaian pekerjaan yang dimintakan pada Surat Pesanan ini dan dibuktikan dengan Berita Acara Serah Terima.</li><li>Pelaksana dalam kapasitas mewakili Satuan Pendidikan berhak untuk mendapatkan barang atau jasa sesuai Surat Pesanan ini.</li><li>Pelaksana berhak menolak barang/jasa yang tidak sesuai dengan surat pesanan.</li><li>Pelaksana dalam kapasitas mewakili Satuan Pendidikan berkewajiban untuk menyelesaikan pembayaran sesuai dengan mekanisme pembayaran yang berlaku pada sistem.</li><li>Segala perselisihan yang timbul dari Surat Pesanan ini diselesaikan antara para pihak sesuai ketentuan yang berlaku.</li></ol></div>
                        <div className="flex justify-between mt-4 text-[10pt]"><div className="text-center w-40"><p>&nbsp;</p><p className="mt-1 font-bold">{toko?.namaToko || '........................'}</p><div className="h-16" /><p className="font-bold underline">{toko?.direktur || '........................'}</p><p>Direktur</p></div><div className="text-left"><p>Telukdalam, {tglPesan ? formatTanggalShort(tglPesan) : '............'}</p><p className="mt-1">Pelaksana,</p><div className="h-16" /><p className="font-bold underline">{sekolahData.kepalaSekolah || '........................'}</p><p>Pembina Tk I</p>{sekolahData.nipKepala && <p>NIP. {sekolahData.nipKepala}</p>}</div></div>
                        <div className="mt-6 border-t border-black pt-3" style={{ breakBefore: 'page' }}>
                          <table className="w-full text-[10pt] mb-2"><tbody><tr className="py-0.5"><td style={{ whiteSpace: 'nowrap' }}>Sumber Anggaran</td><td>&nbsp;:&nbsp;</td><td>Dana BOSP {tahunAnggaran}</td><td style={{ width: '8%' }} /><td style={{ whiteSpace: 'nowrap' }}>Program</td><td>&nbsp;:&nbsp;</td><td>06.05</td></tr><tr className="py-0.5"><td style={{ whiteSpace: 'nowrap' }}>Kas/Pos Tanggal</td><td>&nbsp;:&nbsp;</td><td>{tglPesan ? formatTanggalShort(tglPesan) : '............'}</td><td /><td style={{ whiteSpace: 'nowrap' }}>Kegiatan</td><td>&nbsp;:&nbsp;</td><td>06.05.08.</td></tr><tr className="py-0.5"><td style={{ whiteSpace: 'nowrap' }}>Nomor</td><td>&nbsp;:&nbsp;</td><td>{selectedRecord?.noBukti || '............'}</td><td /><td style={{ whiteSpace: 'nowrap' }}>Kode Rek</td><td>&nbsp;:&nbsp;</td><td>5.1.02.01.01.0024</td></tr></tbody></table>
                          <p className="font-bold text-center text-[11pt] mb-2">TANDA PEMBAYARAN</p>
                          <table className="w-full text-[10pt]" style={{ lineHeight: '1.5' }}><tbody><tr><td style={{ whiteSpace: 'nowrap', verticalAlign: 'top' }}>Sudah terima dari</td><td style={{ verticalAlign: 'top' }}>&nbsp;:&nbsp;</td><td>Bendahara {sekolahData.namaSekolah || '........................'}</td></tr><tr><td style={{ whiteSpace: 'nowrap', verticalAlign: 'top' }}>Uang sebesar</td><td style={{ verticalAlign: 'top' }}>&nbsp;:&nbsp;</td><td>Rp {totalJumlah > 0 ? fmt(totalJumlah) : '............'}</td></tr><tr><td style={{ whiteSpace: 'nowrap', verticalAlign: 'top' }}>Terbilang</td><td style={{ verticalAlign: 'top' }}>&nbsp;:&nbsp;</td><td className="italic">{totalJumlah > 0 ? terbilang(totalJumlah) + ' Rupiah' : '........................................................'}</td></tr><tr><td style={{ whiteSpace: 'nowrap', verticalAlign: 'top' }}>Nomor Surat persetujuan penyediaan barang dan jasa</td><td style={{ verticalAlign: 'top' }}>&nbsp;:&nbsp;</td><td>{selectedRecord?.nomorSuratPesanan || '............'}</td></tr><tr><td style={{ whiteSpace: 'nowrap', verticalAlign: 'top' }}>Untuk pembayaran</td><td style={{ verticalAlign: 'top' }}>&nbsp;:&nbsp;</td><td>Pengadaan Alat Tulis Kantor (ATK)</td></tr></tbody></table>
                          <div className="grid grid-cols-3 gap-2 mt-4 text-[10pt]"><div className="text-center"><p className="font-bold">Mengetahui :</p><p>Pengurus Barang</p><div className="h-16" /><p className="font-bold underline">{sekolahData.pengurusBarang || '........................'}</p><p>Penata Muda</p>{sekolahData.nipPengurus && <p>NIP. {sekolahData.nipPengurus}</p>}</div><div className="text-center"><p className="font-bold">Lunas Bayar Oleh :</p><p>Bendahara {sekolahData.namaSekolah || '........................'}</p><div className="h-16" /><p className="font-bold underline">{sekolahData.bendahara || '........................'}</p><p>Penata TK. I</p>{sekolahData.nipBendahara && <p>NIP. {sekolahData.nipBendahara}</p>}</div><div className="text-center"><p className="font-bold">Diterima oleh :</p><p>{toko?.namaToko || '........................'}</p><div className="h-16" /><p>-</p><p>Direktur</p></div></div>
                          <div className="text-center mt-6 text-[10pt]"><p className="font-bold">Menyetujui :</p><p>Kepala Sekolah {sekolahData.namaSekolah || '........................'}</p><div className="h-16" /><p className="font-bold underline">{sekolahData.kepalaSekolah || '........................'}</p><p>Pembina Tk I</p>{sekolahData.nipKepala && <p>NIP. {sekolahData.nipKepala}</p>}</div>
                        </div>
                      </div>
                    )}
                    {/* DOKUMEN HASIL PEMBANDING */}
                    {currentDocType === 'surat-balasan' && (
                      <div>{kopSurat}
                        <h2 className="text-center font-bold text-[13pt] mb-1">DOKUMEN HASIL PEMBANDING HARGA</h2>
                        <p className="text-center mb-4">Nomor: {selectedRecord?.nomorSuratPesanan || '............'}</p>
                        <table className="w-full border-collapse border border-black mb-4"><thead><tr className="bg-gray-100"><th className="border border-black px-2 py-1 text-center w-10">No</th><th className="border border-black px-2 py-1 text-left">Uraian</th><th className="border border-black px-2 py-1 text-center w-24">Produk I ({toko?.namaToko || 'Toko 1'})</th><th className="border border-black px-2 py-1 text-right w-24">Harga I</th><th className="border border-black px-2 py-1 text-center w-24">Produk II</th><th className="border border-black px-2 py-1 text-right w-24">Harga II</th></tr></thead><tbody>
                          {items.map((item: any, idx: number) => (<tr key={idx}><td className="border border-black px-2 py-1 text-center">{idx + 1}</td><td className="border border-black px-2 py-1">{item.uraian || '-'}</td><td className="border border-black px-2 py-1 text-center">{toko?.namaToko || '-'}</td><td className="border border-black px-2 py-1 text-right">{fmtRp(item.jumlah || 0)}</td><td className="border border-black px-2 py-1 text-center">Toko Lain</td><td className="border border-black px-2 py-1 text-right">{item.hargaToko2 > 0 ? fmtRp(item.hargaToko2) : '-'}</td></tr>))}
                          {items.length === 0 && <tr><td colSpan={6} className="border border-black px-2 py-4 text-center text-gray-400 italic">Belum ada item</td></tr>}
                        </tbody></table>
                        <p className="mb-4 text-justify">Keterangan: Toko terpilih adalah <span className="font-bold">{toko?.namaToko || '............'}</span> dengan harga paling kompetitif.</p>
                        <div className="text-right mb-2"><p>{formatTanggalShort(tglPesan)}</p></div>
                        <div className="flex justify-around mt-4"><div className="text-center w-36"><p className="text-[10px]">Penyedia,</p><div className="h-16" /><p className="text-[11px] font-bold underline">{toko?.direktur || '........................'}</p></div><div className="text-center w-36"><p className="text-[10px]">Pengurus Barang,</p><div className="h-16" /><p className="text-[11px] font-bold underline">{sekolahData.pengurusBarang || '........................'}</p>{sekolahData.nipPengurus && <p className="text-[9px]">NIP. {sekolahData.nipPengurus}</p>}</div><div className="text-center w-36"><p className="text-[10px]">Kepala Sekolah,</p><div className="h-16" /><p className="text-[11px] font-bold underline">{sekolahData.kepalaSekolah || '........................'}</p>{sekolahData.nipKepala && <p className="text-[9px]">NIP. {sekolahData.nipKepala}</p>}</div></div>
                      </div>
                    )}
                    {/* DOKUMEN PERENCANAAN */}
                    {currentDocType === 'dokumen-perencanaan' && (
                      <div>{kopSurat}
                        <h2 className="text-center font-bold text-[13pt] mb-1">DOKUMEN PERENCANAAN PENGADAAN BARANG/JASA</h2>
                        <p className="text-center mb-4">Tahun Anggaran {tahunAnggaran}</p>
                        <table className="mb-4"><tbody><tr><td className="w-36 py-0.5">Nama Sekolah</td><td className="py-0.5">: {sekolahData.namaSekolah || '........................'}</td></tr><tr><td className="py-0.5">NPSN</td><td className="py-0.5">: {sekolahData.npsn || '............'}</td></tr><tr><td className="py-0.5">Alamat</td><td className="py-0.5">: {sekolahData.alamat || '............'}</td></tr><tr><td className="py-0.5">Kategori</td><td className="py-0.5">: {toko?.kategori || 'Barang'}</td></tr></tbody></table>
                        <p className="font-bold mb-2">Daftar Spesifikasi:</p>
                        <table className="w-full border-collapse border border-black mb-4"><thead><tr className="bg-gray-100"><th className="border border-black px-2 py-1 text-center w-10">No</th><th className="border border-black px-2 py-1 text-left">Uraian Barang/Jasa</th><th className="border border-black px-2 py-1 text-center w-14">Jumlah</th><th className="border border-black px-2 py-1 text-center w-16">Satuan</th><th className="border border-black px-2 py-1 text-center w-12">✓</th></tr></thead><tbody>
                          {items.map((item: any, idx: number) => (<tr key={idx}><td className="border border-black px-2 py-1 text-center">{idx + 1}</td><td className="border border-black px-2 py-1">{item.uraian || '-'}</td><td className="border border-black px-2 py-1 text-center">{item.volume || '1'}</td><td className="border border-black px-2 py-1 text-center">{item.satuan || 'Paket'}</td><td className="border border-black px-2 py-1 text-center">✓</td></tr>))}
                          {items.length === 0 && <tr><td colSpan={5} className="border border-black px-2 py-4 text-center text-gray-400 italic">Belum ada item</td></tr>}
                        </tbody></table>
                        <div className="text-right mb-2"><p>{formatTanggalShort(tglPesan)}</p></div>
                        <div className="flex justify-around mt-4"><div className="text-center w-36"><p className="text-[10px]">Pengurus Barang,</p><div className="h-16" /><p className="text-[11px] font-bold underline">{sekolahData.pengurusBarang || '........................'}</p>{sekolahData.nipPengurus && <p className="text-[9px]">NIP. {sekolahData.nipPengurus}</p>}</div><div className="text-center w-36"><p className="text-[10px]">Kepala Sekolah,</p><div className="h-16" /><p className="text-[11px] font-bold underline">{sekolahData.kepalaSekolah || '........................'}</p>{sekolahData.nipKepala && <p className="text-[9px]">NIP. {sekolahData.nipKepala}</p>}</div></div>
                      </div>
                    )}
                    {/* SURAT HASIL PEMERIKSAAN */}
                    {currentDocType === 'surat-hasil-pemeriksaan' && (
                      <div>{kopSurat}
                        <h2 className="text-center font-bold text-[13pt] mb-1">SURAT HASIL PEMERIKSAAN BARANG/JASA</h2>
                        <p className="text-center mb-4">Nomor: {selectedRecord?.nomorSuratSHP || '............'}</p>
                        <p className="mb-2">Pada hari {formatTanggalIndo(tglPesan)}, kami yang bertanda tangan di bawah ini:</p>
                        <div className="mb-4 ml-6"><table><tbody><tr><td className="w-24 py-0.5">Nama</td><td className="py-0.5">: {sekolahData.penerimaBarang || '........................'}</td></tr><tr><td className="py-0.5">Jabatan</td><td className="py-0.5">: Penerima Barang</td></tr></tbody></table><div className="h-2" /><table><tbody><tr><td className="w-24 py-0.5">Nama</td><td className="py-0.5">: {sekolahData.pengurusBarang || '........................'}</td></tr><tr><td className="py-0.5">Jabatan</td><td className="py-0.5">: Pengurus Barang</td></tr></tbody></table></div>
                        <p className="text-justify mb-2">Telah melakukan pemeriksaan terhadap barang/jasa yang diserahkan oleh:</p>
                        <div className="ml-6 mb-4"><p className="font-bold">{toko?.namaToko || '[Nama Toko]'}</p><p>{toko?.alamat || '[Alamat Toko]'}</p></div>
                        <table className="w-full border-collapse border border-black mb-4"><thead><tr className="bg-gray-100"><th className="border border-black px-2 py-1 text-center w-10">No</th><th className="border border-black px-2 py-1 text-left">Nama Barang</th><th className="border border-black px-2 py-1 text-center w-14">Jumlah</th><th className="border border-black px-2 py-1 text-center w-20">Kondisi</th></tr></thead><tbody>
                          {items.map((item: any, idx: number) => (<tr key={idx}><td className="border border-black px-2 py-1 text-center">{idx + 1}</td><td className="border border-black px-2 py-1">{item.uraian || '-'}</td><td className="border border-black px-2 py-1 text-center">{item.volume || '1'}</td><td className="border border-black px-2 py-1 text-center">Baik</td></tr>))}
                          {items.length === 0 && <tr><td colSpan={4} className="border border-black px-2 py-4 text-center text-gray-400 italic">Belum ada item</td></tr>}
                        </tbody></table>
                        <p className="text-justify mb-8">Kesimpulan: Barang/jasa tersebut di atas dalam kondisi <span className="font-bold">BAIK</span> dan sesuai dengan pesanan.</p>
                        <div className="text-right mb-2"><p>{formatTanggalShort(tglPesan)}</p></div>
                        <div className="flex justify-around mt-4"><div className="text-center w-36"><p className="text-[10px]">Penerima Barang,</p><div className="h-16" /><p className="text-[11px] font-bold underline">{sekolahData.penerimaBarang || '........................'}</p>{sekolahData.nipPenerima && <p className="text-[9px]">NIP. {sekolahData.nipPenerima}</p>}</div><div className="text-center w-36"><p className="text-[10px]">Pengurus Barang,</p><div className="h-16" /><p className="text-[11px] font-bold underline">{sekolahData.pengurusBarang || '........................'}</p>{sekolahData.nipPengurus && <p className="text-[9px]">NIP. {sekolahData.nipPengurus}</p>}</div></div>
                      </div>
                    )}
                    {/* BAST */}
                    {currentDocType === 'bast' && (
                      <div>{kopSurat}
                        <h2 className="text-center font-bold text-[13pt] mb-1">BERITA ACARA SERAH TERIMA BARANG/JASA</h2>
                        <p className="text-center mb-4">Nomor: {selectedRecord?.nomorSuratBAST || '............'}</p>
                        <p className="mb-2">Pada hari {formatTanggalIndo(tglPesan)}, yang bertanda tangan di bawah ini:</p>
                        <div className="mb-4 ml-6"><p className="font-bold">PIHAK PERTAMA:</p><table><tbody><tr><td className="w-24 py-0.5">Nama</td><td className="py-0.5">: {toko?.direktur || '........................'}</td></tr><tr><td className="py-0.5">Jabatan</td><td className="py-0.5">: Penyedia {toko?.kategori || 'Barang/Jasa'}</td></tr><tr><td className="py-0.5">Alamat</td><td className="py-0.5">: {toko?.alamat || '............'}</td></tr><tr><td className="py-0.5">No. HP</td><td className="py-0.5">: {toko?.noHp || '-'}</td></tr></tbody></table><div className="h-2" /><p className="font-bold">PIHAK KEDUA:</p><table><tbody><tr><td className="w-24 py-0.5">Nama</td><td className="py-0.5">: {sekolahData.penerimaBarang || '........................'}</td></tr><tr><td className="py-0.5">Jabatan</td><td className="py-0.5">: Penerima Barang</td></tr><tr><td className="py-0.5">Alamat</td><td className="py-0.5">: {sekolahData.namaSekolah || '............'}</td></tr><tr><td className="py-0.5">No. HP</td><td className="py-0.5">: -</td></tr></tbody></table></div>
                        <p className="text-justify mb-4">Telah melakukan serah terima barang/jasa:</p>
                        <table className="w-full border-collapse border border-black mb-4"><thead><tr className="bg-gray-100"><th className="border border-black px-2 py-1 text-center w-10">No</th><th className="border border-black px-2 py-1 text-left">Nama Barang</th><th className="border border-black px-2 py-1 text-center w-20">Diserahkan</th><th className="border border-black px-2 py-1 text-center w-20">Diterima</th><th className="border border-black px-2 py-1 text-center w-20">Kondisi</th></tr></thead><tbody>
                          {items.map((item: any, idx: number) => (<tr key={idx}><td className="border border-black px-2 py-1 text-center">{idx + 1}</td><td className="border border-black px-2 py-1">{item.uraian || '-'}</td><td className="border border-black px-2 py-1 text-center">✓</td><td className="border border-black px-2 py-1 text-center">✓</td><td className="border border-black px-2 py-1 text-center">Baik</td></tr>))}
                          {items.length === 0 && <tr><td colSpan={5} className="border border-black px-2 py-4 text-center text-gray-400 italic">Belum ada item</td></tr>}
                        </tbody></table>
                        <p className="text-justify mb-8">Demikian berita acara ini dibuat dengan sebenarnya untuk dapat dipergunakan sebagaimana mestinya.</p>
                        <div className="flex justify-around mt-4"><div className="text-center w-36"><p className="text-[10px]">PIHAK PERTAMA,</p><div className="h-16" /><p className="text-[11px] font-bold underline">{toko?.direktur || '........................'}</p></div><div className="text-center w-36"><p className="text-[10px]">PIHAK KEDUA,</p><div className="h-16" /><p className="text-[11px] font-bold underline">{sekolahData.penerimaBarang || '........................'}</p>{sekolahData.nipPenerima && <p className="text-[9px]">NIP. {sekolahData.nipPenerima}</p>}</div></div>
                        <div className="mt-6 text-center"><p className="text-[10px]">Mengetahui,</p><p className="text-[10px]">Kepala Sekolah</p><div className="h-12" /><p className="font-bold underline text-[11px]">{sekolahData.kepalaSekolah || '........................'}</p>{sekolahData.nipKepala && <p className="text-[9px]">NIP. {sekolahData.nipKepala}</p>}</div>
                      </div>
                    )}
                    {/* KUITANSI PEMBAYARAN */}
                    {currentDocType === 'kuitansi-pembayaran' && (
                      <div>
                        <table className="w-full text-[10pt] mb-2" style={{ lineHeight: '1.4' }}><tbody><tr className="py-0.5"><td style={{ whiteSpace: 'nowrap' }}>Sumber Anggaran</td><td>&nbsp;:&nbsp;</td><td>Dana BOSP {tahunAnggaran}</td><td style={{ width: '8%' }} /><td style={{ whiteSpace: 'nowrap' }}>Program</td><td>&nbsp;:&nbsp;</td><td>06.05</td></tr><tr className="py-0.5"><td style={{ whiteSpace: 'nowrap' }}>Kas/Pos Tanggal</td><td>&nbsp;:&nbsp;</td><td>{tglPesan ? formatTanggalShort(tglPesan) : '............'}</td><td /><td style={{ whiteSpace: 'nowrap' }}>Kegiatan</td><td>&nbsp;:&nbsp;</td><td>06.05.08.</td></tr><tr className="py-0.5"><td style={{ whiteSpace: 'nowrap' }}>Nomor</td><td>&nbsp;:&nbsp;</td><td>{selectedRecord?.noBukti || '............'}</td><td /><td style={{ whiteSpace: 'nowrap' }}>Kode Rek</td><td>&nbsp;:&nbsp;</td><td>5.1.02.01.01.0024</td></tr></tbody></table>
                        <p className="font-bold text-center text-[12pt] mb-2">TANDA PEMBAYARAN</p>
                        <table className="w-full text-[10pt]" style={{ lineHeight: '1.6' }}><tbody><tr><td style={{ whiteSpace: 'nowrap', verticalAlign: 'top' }}>Sudah terima dari</td><td style={{ verticalAlign: 'top' }}>&nbsp;:&nbsp;</td><td>Bendahara {sekolahData.namaSekolah || '........................'}</td></tr><tr><td style={{ whiteSpace: 'nowrap', verticalAlign: 'top' }}>Uang sebesar</td><td style={{ verticalAlign: 'top' }}>&nbsp;:&nbsp;</td><td>Rp {totalJumlah > 0 ? fmt(totalJumlah) : '............'}</td></tr><tr><td style={{ whiteSpace: 'nowrap', verticalAlign: 'top' }}>Terbilang</td><td style={{ verticalAlign: 'top' }}>&nbsp;:&nbsp;</td><td className="italic">{totalJumlah > 0 ? terbilang(totalJumlah) + ' Rupiah' : '........................................................'}</td></tr><tr><td style={{ whiteSpace: 'nowrap', verticalAlign: 'top' }}>Nomor Surat persetujuan penyediaan barang dan jasa</td><td style={{ verticalAlign: 'top' }}>&nbsp;:&nbsp;</td><td>{selectedRecord?.nomorSuratPesanan || '............'}</td></tr><tr><td style={{ whiteSpace: 'nowrap', verticalAlign: 'top' }}>Untuk pembayaran</td><td style={{ verticalAlign: 'top' }}>&nbsp;:&nbsp;</td><td>Pengadaan Alat Tulis Kantor (ATK)</td></tr></tbody></table>
                        <div className="mt-6 text-[10pt]"><div className="grid grid-cols-3 gap-2"><div className="text-center"><p className="font-bold">Mengetahui :</p><p>Pengurus Barang</p><div className="h-16" /><p className="font-bold underline">{sekolahData.pengurusBarang || '........................'}</p><p>Penata Muda</p>{sekolahData.nipPengurus && <p>NIP. {sekolahData.nipPengurus}</p>}</div><div className="text-center"><p className="font-bold">Lunas Bayar Oleh :</p><p>Bendahara {sekolahData.namaSekolah || '........................'}</p><div className="h-16" /><p className="font-bold underline">{sekolahData.bendahara || '........................'}</p><p>Penata TK. I</p>{sekolahData.nipBendahara && <p>NIP. {sekolahData.nipBendahara}</p>}</div><div className="text-center"><p className="font-bold">Diterima oleh :</p><p>{toko?.namaToko || '........................'}</p><div className="h-16" /><p>-</p><p>Direktur</p></div></div><div className="text-center mt-6"><p className="font-bold">Menyetujui :</p><p>Kepala Sekolah {sekolahData.namaSekolah || '........................'}</p><div className="h-16" /><p className="font-bold underline">{sekolahData.kepalaSekolah || '........................'}</p><p>Pembina Tk I</p>{sekolahData.nipKepala && <p>NIP. {sekolahData.nipKepala}</p>}</div></div>
                      </div>
                    )}
                  </div>
                </div></CardContent>
              </Card>
            )}
          </>
        )
      })()}

      {/* Print Area */}
      <div id="print-area" className="print-area-screen" />
    </div>
  )
}
