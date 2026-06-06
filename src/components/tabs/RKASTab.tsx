'use client'

import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  FilePlus2, Loader2, Upload, Calendar, Landmark, Building2,
  Search, Trash2, ChevronDown, ClipboardList,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart as RechartsPie, Pie, Cell,
} from 'recharts'
import { type RKASMonth } from '@/lib/types'
import { MONTH_NAMES } from '@/lib/types'
import { fmtRp, CHART_COLORS, STANDAR_ICONS } from '@/lib/helpers'

interface RKASTabProps {
  rkasMonths: RKASMonth[]
  rkasLoading: boolean
  rkasUploading: boolean
  selectedRkasMonth: number
  setSelectedRkasMonth: (idx: number) => void
  rkasSearchTerm: string
  setRkasSearchTerm: (v: string) => void
  selectedRkasStandar: string
  setSelectedRkasStandar: (v: string) => void
  handleRKASUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  deleteRKASFile: (fileName: string) => void
}

export default function RKASTab({
  rkasMonths, rkasLoading, rkasUploading,
  selectedRkasMonth, setSelectedRkasMonth,
  rkasSearchTerm, setRkasSearchTerm,
  selectedRkasStandar, setSelectedRkasStandar,
  handleRKASUpload, deleteRKASFile,
}: RKASTabProps) {
  const rkasFileInputRef = useRef<HTMLInputElement>(null)

  const rkasBulanan = rkasMonths.filter(m => m.tipe === 'bulanan')
  const rkasTahunan = rkasMonths.filter(m => m.tipe === 'tahunan')

  const rkasPieData = rkasMonths.length > 0
    ? (() => {
        const standarTotals: Record<string, number> = {}
        const standarNames: Record<string, string> = {}
        for (const m of rkasMonths) {
          for (const s of m.standarList) {
            standarTotals[s.kode] = (standarTotals[s.kode] || 0) + s.total
            standarNames[s.kode] = s.nama
          }
        }
        const total = Object.values(standarTotals).reduce((a, b) => a + b, 0)
        return Object.entries(standarTotals).map(([kode, jumlah]) => ({
          name: standarNames[kode], value: jumlah, persen: total > 0 ? Math.round(jumlah / total * 100) : 0
        }))
      })()
    : []

  const rkasBarData = rkasMonths.length > 0
    ? rkasMonths.map(m => ({ name: (MONTH_NAMES[m.bulan] || (m.tipe === 'tahunan' ? 'Tahunan' : m.bulan.slice(0, 3))) + ' ' + m.tahun, Penerimaan: m.totalPenerimaan, Belanja: m.totalBelanja }))
    : []

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4">
      {/* Upload area */}
      <div className="flex items-center gap-3 flex-wrap">
        <input type="file" ref={rkasFileInputRef} onChange={handleRKASUpload} accept=".pdf" multiple className="hidden" />
        <Button variant="outline" size="sm" onClick={() => rkasFileInputRef.current?.click()} disabled={rkasUploading} className="gap-2">
          {rkasUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FilePlus2 className="h-3.5 w-3.5" />}
          {rkasUploading ? 'Mengimpor...' : 'Import RKAS'}
        </Button>
        <span className="text-xs text-muted-foreground">
          {rkasBulanan.length} bulanan, {rkasTahunan.length} tahunan
        </span>
        {rkasLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        <span className="text-[10px] text-muted-foreground">
          Otomatis terdeteksi: judul &quot;Perbulan&quot; → Bulanan, judul &quot;RKAS&quot; → Tahunan
        </span>
      </div>

      {rkasMonths.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center space-y-3">
            <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mx-auto">
              <ClipboardList className="h-7 w-7 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Belum ada data RKAS</h3>
              <p className="text-xs text-muted-foreground mt-1">Import file PDF RKAS Bulanan (Rincian Kertas Kerja Perbulan) atau RKAS Tahunan (Kertas Kerja RKAS)</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => rkasFileInputRef.current?.click()} className="gap-2">
              <Upload className="h-3.5 w-3.5" /> Import File RKAS
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Card className="border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30">
              <CardContent className="pt-3 pb-2">
                <p className="text-[10px] text-muted-foreground">Total Penerimaan</p>
                <p className="text-base font-bold text-emerald-700 dark:text-emerald-300">{fmtRp(rkasMonths.reduce((s, m) => s + m.totalPenerimaan, 0))}</p>
              </CardContent>
            </Card>
            <Card className="border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30">
              <CardContent className="pt-3 pb-2">
                <p className="text-[10px] text-muted-foreground">Total Belanja</p>
                <p className="text-base font-bold text-amber-700 dark:text-amber-300">{fmtRp(rkasMonths.reduce((s, m) => s + m.totalBelanja, 0))}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-3 pb-2">
                <p className="text-[10px] text-muted-foreground">RKAS Bulanan</p>
                <p className="text-base font-bold">{rkasBulanan.length} bulan</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-3 pb-2">
                <p className="text-[10px] text-muted-foreground">RKAS Tahunan</p>
                <p className="text-base font-bold">{rkasTahunan.length} dokumen</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-3 pb-2">
                <p className="text-[10px] text-muted-foreground">Standar SNP</p>
                <p className="text-base font-bold">{new Set(rkasMonths.flatMap(m => m.standarList.map(s => s.kode))).size} kategori</p>
              </CardContent>
            </Card>
          </div>

          {/* Monthly Comparison Bar Chart */}
          {rkasBarData.length > 1 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Perbandingan Penerimaan vs Belanja</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={rkasBarData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis fontSize={10} />
                    <YAxis tickFormatter={(v: number) => `${(v/1000000).toFixed(0)}jt`} fontSize={10} />
                    <Tooltip formatter={(v: number) => fmtRp(v)} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="Penerimaan" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Belanja" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Aggregated Standar Pie Chart */}
          {rkasPieData.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Distribusi Anggaran per Standar SNP (Semua Periode)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <RechartsPie>
                    <Pie data={rkasPieData} cx="50%" cy="50%" outerRadius={90} innerRadius={50} dataKey="value" nameKey="name" label={({ persen }) => `${persen}%`}>
                      {rkasPieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmtRp(v)} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                  </RechartsPie>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* ===== RKAS BULANAN Section ===== */}
          {rkasBulanan.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 pt-2">
                <div className="h-6 w-6 rounded bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                  <Calendar className="h-3 w-3 text-white" />
                </div>
                <h3 className="text-sm font-semibold">RKAS Bulanan</h3>
                <Badge variant="secondary" className="text-[10px]">{rkasBulanan.length} bulan</Badge>
                <span className="text-[10px] text-muted-foreground italic">Rincian Kertas Kerja Perbulan</span>
              </div>
              <div className="space-y-3">
                {rkasBulanan.map((month) => {
                  const globalIdx = rkasMonths.indexOf(month)
                  const isOpen = selectedRkasMonth === globalIdx
                  const filteredItems = selectedRkasStandar === 'all'
                    ? month.allItems
                    : month.standarList.find(s => s.kode === selectedRkasStandar)?.items || []
                  const searchFiltered = filteredItems.filter(item =>
                    !rkasSearchTerm || item.uraian.toLowerCase().includes(rkasSearchTerm.toLowerCase()) || item.kodeRekening.includes(rkasSearchTerm)
                  )
                  return (
                    <Card key={globalIdx} className="overflow-hidden">
                      <div
                        role="button"
                        tabIndex={0}
                        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => { setSelectedRkasMonth(isOpen ? -1 : globalIdx); setSelectedRkasStandar('all'); setRkasSearchTerm('') }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedRkasMonth(isOpen ? -1 : globalIdx); setSelectedRkasStandar('all'); setRkasSearchTerm('') } }}
                      >
                        <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shrink-0">
                          <Calendar className="h-4 w-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">{month.bulan.charAt(0) + month.bulan.slice(1).toLowerCase()} {month.tahun}</span>
                            <Badge className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-0">Bulanan</Badge>
                            {month.sumberDana && <Badge variant="outline" className="text-[10px]">{month.sumberDana}</Badge>}
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{month.judul}</p>
                          <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
                            <span className="text-emerald-600 dark:text-emerald-400">+{fmtRp(month.totalPenerimaan)}</span>
                            <span className="text-amber-600 dark:text-amber-400">-{fmtRp(month.totalBelanja)}</span>
                            <span>{month.standarList.length} standar</span>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={(e) => { e.stopPropagation(); deleteRKASFile(month.fileName) }} title="Hapus file">
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                        </Button>
                        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </div>

                      {isOpen && (
                        <div className="border-t">
                          <div className="px-4 py-2 bg-muted/30 flex items-center gap-4 text-[11px] text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{month.namaSekolah}</span>
                            <span>NPSN: {month.npsn}</span>
                            {month.kabupaten && <span>{month.kabupaten}</span>}
                          </div>
                          <div className="px-4 py-3">
                            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                              {month.standarList.map((s, si) => {
                                const IconComp = STANDAR_ICONS[s.kode] || ClipboardList
                                const isActive = selectedRkasStandar === s.kode
                                return (
                                  <button key={si} onClick={() => setSelectedRkasStandar(isActive ? 'all' : s.kode)}
                                    className={`p-2 rounded-lg border text-left transition-colors ${isActive ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50'}`}>
                                    <div className="flex items-center gap-1.5 mb-1">
                                      <IconComp className="h-3 w-3 shrink-0" style={{ color: CHART_COLORS[si % CHART_COLORS.length] }} />
                                      <span className="text-[10px] font-medium truncate">Std {s.kode}</span>
                                    </div>
                                    <p className="text-xs font-bold">{fmtRp(s.total)}</p>
                                    <p className="text-[10px] text-muted-foreground">{s.items.length} item</p>
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                          <div className="px-4 pb-3 flex items-center gap-2">
                            <div className="relative flex-1">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                              <Input placeholder="Cari uraian atau kode rekening..." value={rkasSearchTerm} onChange={e => setRkasSearchTerm(e.target.value)} className="pl-9 h-8 text-xs" />
                            </div>
                            {selectedRkasStandar !== 'all' && (
                              <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => setSelectedRkasStandar('all')}>
                                <X className="h-3 w-3" />Reset Filter
                              </Button>
                            )}
                          </div>
                          <div className="px-4 pb-3 overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b">
                                  <th className="text-left py-2 px-1.5 font-medium text-muted-foreground w-8">No</th>
                                  <th className="text-left py-2 px-1.5 font-medium text-muted-foreground">Kode Rekening</th>
                                  <th className="text-left py-2 px-1.5 font-medium text-muted-foreground">Uraian</th>
                                  <th className="text-right py-2 px-1.5 font-medium text-muted-foreground">Vol</th>
                                  <th className="text-left py-2 px-1.5 font-medium text-muted-foreground">Satuan</th>
                                  <th className="text-right py-2 px-1.5 font-medium text-muted-foreground whitespace-nowrap">Tarif</th>
                                  <th className="text-right py-2 px-1.5 font-medium text-muted-foreground whitespace-nowrap">Jumlah</th>
                                </tr>
                              </thead>
                              <tbody>
                                {searchFiltered.slice(0, 100).map((item, tIdx) => (
                                  <tr key={tIdx} className="border-b hover:bg-muted/20 transition-colors">
                                    <td className="py-1.5 px-1.5 font-mono text-muted-foreground">{item.noUrut}</td>
                                    <td className="py-1.5 px-1.5 font-mono text-muted-foreground whitespace-nowrap">{item.kodeRekening}</td>
                                    <td className="py-1.5 px-1.5 max-w-[300px]"><span className="text-xs">{item.uraian}</span></td>
                                    <td className="py-1.5 px-1.5 text-right">{item.volume || '-'}</td>
                                    <td className="py-1.5 px-1.5">{item.satuan || '-'}</td>
                                    <td className="py-1.5 px-1.5 text-right whitespace-nowrap">{item.tarifHarga > 0 ? fmtRp(item.tarifHarga) : '-'}</td>
                                    <td className="py-1.5 px-1.5 text-right whitespace-nowrap font-medium">{fmtRp(item.jumlah)}</td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="border-t-2 font-semibold">
                                  <td colSpan={6} className="py-2 px-1.5">{selectedRkasStandar === 'all' ? 'Total Belanja' : `Total Std ${selectedRkasStandar}`}</td>
                                  <td className="py-2 px-1.5 text-right whitespace-nowrap text-amber-600 dark:text-amber-400">
                                    {fmtRp(selectedRkasStandar === 'all' ? month.totalBelanja : month.standarList.find(s => s.kode === selectedRkasStandar)?.total || 0)}
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                            {searchFiltered.length > 100 && (
                              <p className="text-[10px] text-muted-foreground mt-2 text-center">Menampilkan 100 dari {searchFiltered.length} item. Gunakan pencarian untuk memfilter.</p>
                            )}
                          </div>
                        </div>
                      )}
                    </Card>
                  )
                })}
              </div>
            </div>
          )}

          {/* ===== RKAS TAHUNAN Section ===== */}
          {rkasTahunan.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 pt-2">
                <div className="h-6 w-6 rounded bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                  <Landmark className="h-3 w-3 text-white" />
                </div>
                <h3 className="text-sm font-semibold">RKAS Tahunan</h3>
                <Badge variant="secondary" className="text-[10px]">{rkasTahunan.length} dokumen</Badge>
                <span className="text-[10px] text-muted-foreground italic">Kertas Kerja Rencana Kegiatan dan Anggaran Sekolah</span>
              </div>
              <div className="space-y-3">
                {rkasTahunan.map((month) => {
                  const globalIdx = rkasMonths.indexOf(month)
                  const isOpen = selectedRkasMonth === globalIdx
                  const filteredItems = selectedRkasStandar === 'all'
                    ? month.allItems
                    : month.standarList.find(s => s.kode === selectedRkasStandar)?.items || []
                  const searchFiltered = filteredItems.filter(item =>
                    !rkasSearchTerm || item.uraian.toLowerCase().includes(rkasSearchTerm.toLowerCase()) || item.kodeRekening.includes(rkasSearchTerm)
                  )
                  return (
                    <Card key={globalIdx} className="overflow-hidden border-violet-200 dark:border-violet-800">
                      <div
                        role="button"
                        tabIndex={0}
                        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => { setSelectedRkasMonth(isOpen ? -1 : globalIdx); setSelectedRkasStandar('all'); setRkasSearchTerm('') }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedRkasMonth(isOpen ? -1 : globalIdx); setSelectedRkasStandar('all'); setRkasSearchTerm('') } }}
                      >
                        <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0">
                          <Landmark className="h-4 w-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">Tahunan {month.tahun}</span>
                            <Badge className="text-[10px] bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 border-0">Tahunan</Badge>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{month.judul}</p>
                          <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
                            <span className="text-emerald-600 dark:text-emerald-400">+{fmtRp(month.totalPenerimaan)}</span>
                            <span className="text-amber-600 dark:text-amber-400">-{fmtRp(month.totalBelanja)}</span>
                            <span>{month.standarList.length} standar</span>
                            <span>{month.allItems.length} item</span>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={(e) => { e.stopPropagation(); deleteRKASFile(month.fileName) }} title="Hapus file">
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                        </Button>
                        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </div>

                      {isOpen && (
                        <div className="border-t">
                          <div className="px-4 py-2 bg-muted/30 flex items-center gap-4 text-[11px] text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{month.namaSekolah}</span>
                            <span>NPSN: {month.npsn}</span>
                            {month.kabupaten && <span>{month.kabupaten}</span>}
                            {month.provinsi && <span>{month.provinsi}</span>}
                          </div>
                          <div className="px-4 py-3">
                            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                              {month.standarList.map((s, si) => {
                                const IconComp = STANDAR_ICONS[s.kode] || ClipboardList
                                const isActive = selectedRkasStandar === s.kode
                                return (
                                  <button key={si} onClick={() => setSelectedRkasStandar(isActive ? 'all' : s.kode)}
                                    className={`p-2 rounded-lg border text-left transition-colors ${isActive ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50'}`}>
                                    <div className="flex items-center gap-1.5 mb-1">
                                      <IconComp className="h-3 w-3 shrink-0" style={{ color: CHART_COLORS[si % CHART_COLORS.length] }} />
                                      <span className="text-[10px] font-medium truncate">Std {s.kode}</span>
                                    </div>
                                    <p className="text-xs font-bold">{fmtRp(s.total)}</p>
                                    <p className="text-[10px] text-muted-foreground">{s.items.length} item</p>
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                          <div className="px-4 pb-3 flex items-center gap-2">
                            <div className="relative flex-1">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                              <Input placeholder="Cari uraian atau kode rekening..." value={rkasSearchTerm} onChange={e => setRkasSearchTerm(e.target.value)} className="pl-9 h-8 text-xs" />
                            </div>
                            {selectedRkasStandar !== 'all' && (
                              <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => setSelectedRkasStandar('all')}>
                                <X className="h-3 w-3" />Reset Filter
                              </Button>
                            )}
                          </div>
                          <div className="px-4 pb-3 overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b">
                                  <th className="text-left py-2 px-1.5 font-medium text-muted-foreground w-8">No</th>
                                  <th className="text-left py-2 px-1.5 font-medium text-muted-foreground">Kode Rekening</th>
                                  <th className="text-left py-2 px-1.5 font-medium text-muted-foreground">Uraian</th>
                                  <th className="text-right py-2 px-1.5 font-medium text-muted-foreground">Vol</th>
                                  <th className="text-left py-2 px-1.5 font-medium text-muted-foreground">Satuan</th>
                                  <th className="text-right py-2 px-1.5 font-medium text-muted-foreground whitespace-nowrap">Tarif</th>
                                  <th className="text-right py-2 px-1.5 font-medium text-muted-foreground whitespace-nowrap">Jumlah</th>
                                </tr>
                              </thead>
                              <tbody>
                                {searchFiltered.slice(0, 100).map((item, tIdx) => (
                                  <tr key={tIdx} className="border-b hover:bg-muted/20 transition-colors">
                                    <td className="py-1.5 px-1.5 font-mono text-muted-foreground">{item.noUrut}</td>
                                    <td className="py-1.5 px-1.5 font-mono text-muted-foreground whitespace-nowrap">{item.kodeRekening}</td>
                                    <td className="py-1.5 px-1.5 max-w-[300px]"><span className="text-xs">{item.uraian}</span></td>
                                    <td className="py-1.5 px-1.5 text-right">{item.volume || '-'}</td>
                                    <td className="py-1.5 px-1.5">{item.satuan || '-'}</td>
                                    <td className="py-1.5 px-1.5 text-right whitespace-nowrap">{item.tarifHarga > 0 ? fmtRp(item.tarifHarga) : '-'}</td>
                                    <td className="py-1.5 px-1.5 text-right whitespace-nowrap font-medium">{fmtRp(item.jumlah)}</td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="border-t-2 font-semibold">
                                  <td colSpan={6} className="py-2 px-1.5">{selectedRkasStandar === 'all' ? 'Total Belanja' : `Total Std ${selectedRkasStandar}`}</td>
                                  <td className="py-2 px-1.5 text-right whitespace-nowrap text-amber-600 dark:text-amber-400">
                                    {fmtRp(selectedRkasStandar === 'all' ? month.totalBelanja : month.standarList.find(s => s.kode === selectedRkasStandar)?.total || 0)}
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                            {searchFiltered.length > 100 && (
                              <p className="text-[10px] text-muted-foreground mt-2 text-center">Menampilkan 100 dari {searchFiltered.length} item. Gunakan pencarian untuk memfilter.</p>
                            )}
                          </div>
                        </div>
                      )}
                    </Card>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// Need X import for the reset filter button
import { X } from 'lucide-react'
