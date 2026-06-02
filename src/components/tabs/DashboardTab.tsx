'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  PieChart, Wallet, ArrowDownRight, ArrowUpRight, AlertCircle,
  TrendingUp, Receipt, Landmark, Building2, Calendar,
} from 'lucide-react'
import {
  PieChart as RechartsPie, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { MONTH_NAMES, type BKUMonth, type RKASMonth, type BKUPajakMonth, type BudgetData } from '@/lib/types'
import { fmtRp, CHART_COLORS, STANDAR_ICONS, normalizeMonth } from '@/lib/helpers'

interface DashboardTabProps {
  bkuMonths: BKUMonth[]
  rkasMonths: RKASMonth[]
  bkuPajakMonths: BKUPajakMonth[]
  budgetData: BudgetData | null
}

export default function DashboardTab({ bkuMonths, rkasMonths, bkuPajakMonths, budgetData }: DashboardTabProps) {
  // --- RKAS separated by tipe ---
  const rkasBulanan = rkasMonths.filter(m => m.tipe === 'bulanan')
  const rkasTahunan = rkasMonths.filter(m => m.tipe === 'tahunan')

  // --- Combined Dashboard Analytics ---
  const tahunanData = rkasTahunan.length > 0 ? rkasTahunan[0] : null
  const danaBOS = tahunanData?.totalPenerimaan || 0
  const anggaranBelanja = tahunanData?.totalBelanja || 0

  const totalRealisasi = bkuMonths.reduce((s, m) => s + m.totalPengeluaran, 0)
  const sisaDana = danaBOS - totalRealisasi
  const persenSerapan = danaBOS > 0 ? Math.round((totalRealisasi / danaBOS) * 100) : 0

  const totalPajak = bkuPajakMonths.reduce((s, m) => s + m.totalPengeluaran, 0)
  const pajakDetail = {
    ppn: bkuPajakMonths.reduce((s, m) => s + m.totalPPN, 0),
    pph21: bkuPajakMonths.reduce((s, m) => s + m.totalPPh21, 0),
    pph23: bkuPajakMonths.reduce((s, m) => s + m.totalPPh23, 0),
    pph4: bkuPajakMonths.reduce((s, m) => s + m.totalPPh4, 0),
    sspd: bkuPajakMonths.reduce((s, m) => s + m.totalSSPD, 0),
  }

  const lastBkuSaldo = bkuMonths.length > 0 ? bkuMonths[bkuMonths.length - 1].saldoAkhir : 0

  // Monthly comparison
  const monthlyComparison = (() => {
    const months = ['JANUARI','FEBRUARI','MARET','APRIL','MEI','JUNI','JULI','AGUSTUS','SEPTEMBER','OKTOBER','NOVEMBER','DESEMBER']
    return months.map((bulan) => {
      const rkas = rkasBulanan.find(r => normalizeMonth(r.bulan) === bulan)
      const bku = bkuMonths.find(b => normalizeMonth(b.bulan) === bulan)
      const pajak = bkuPajakMonths.find(p => normalizeMonth(p.bulan) === bulan)
      return {
        name: MONTH_NAMES[bulan] || bulan.slice(0, 3),
        Anggaran: rkas?.totalBelanja || 0,
        Realisasi: bku?.totalPengeluaran || 0,
        Pajak: pajak?.totalPengeluaran || 0,
        Penerimaan: bku?.totalPenerimaan || 0,
        hasData: !!rkas || !!bku,
      }
    }).filter(m => m.hasData)
  })()

  const cashFlowData = bkuMonths.map(m => ({
    name: MONTH_NAMES[normalizeMonth(m.bulan)] || m.bulan.slice(0, 3),
    Penerimaan: m.totalPenerimaan,
    Pengeluaran: m.totalPengeluaran,
    Saldo: m.saldoAkhir,
  }))

  const tahunanStandarData = tahunanData?.standarList.map(s => ({
    kode: s.kode,
    name: s.nama,
    value: s.total,
    persen: anggaranBelanja > 0 ? Math.round((s.total / anggaranBelanja) * 100) : 0,
  })) || []

  const hasAnyData = rkasMonths.length > 0 || bkuMonths.length > 0 || bkuPajakMonths.length > 0 || !!budgetData

  const pieDataStandar = budgetData?.alokasiStandar.map(s => ({ name: s.nama, value: s.jumlah, persen: s.persen })) || []

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4">
      {!hasAnyData ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center space-y-3">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
              <PieChart className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Belum ada data</h3>
              <p className="text-xs text-muted-foreground mt-1">Import file RKAS, BKU, atau BKU Pajak untuk melihat analisis dashboard</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ===== Section 1: KPI Cards ===== */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card className="border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30">
              <CardContent className="pt-3 pb-2 px-3">
                <div className="flex items-center gap-2 mb-1">
                  <Wallet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <p className="text-[10px] text-muted-foreground">Dana BOS</p>
                </div>
                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{danaBOS > 0 ? fmtRp(danaBOS) : '-'}</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">{tahunanData ? `RKAS Tahunan ${tahunanData.tahun}` : 'Impor RKAS Tahunan'}</p>
              </CardContent>
            </Card>
            <Card className="border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30">
              <CardContent className="pt-3 pb-2 px-3">
                <div className="flex items-center gap-2 mb-1">
                  <ArrowDownRight className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  <p className="text-[10px] text-muted-foreground">Realisasi</p>
                </div>
                <p className="text-sm font-bold text-amber-700 dark:text-amber-300">{totalRealisasi > 0 ? fmtRp(totalRealisasi) : '-'}</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">{bkuMonths.length > 0 ? `${bkuMonths.length} bulan BKU` : 'Impor BKU'}</p>
              </CardContent>
            </Card>
            <Card className={sisaDana >= 0 ? 'border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-sky-50 dark:from-blue-950/30 dark:to-sky-950/30' : 'border-red-200 dark:border-red-800 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30'}>
              <CardContent className="pt-3 pb-2 px-3">
                <div className="flex items-center gap-2 mb-1">
                  {sisaDana >= 0 ? <ArrowUpRight className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" /> : <AlertCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />}
                  <p className="text-[10px] text-muted-foreground">Sisa Dana</p>
                </div>
                <p className={`text-sm font-bold ${sisaDana >= 0 ? 'text-blue-700 dark:text-blue-300' : 'text-red-700 dark:text-red-300'}`}>{danaBOS > 0 ? fmtRp(sisaDana) : '-'}</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">{danaBOS > 0 ? `${persenSerapan}% terserap` : '-'}</p>
              </CardContent>
            </Card>
            <Card className="border-violet-200 dark:border-violet-800 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30">
              <CardContent className="pt-3 pb-2 px-3">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                  <p className="text-[10px] text-muted-foreground">Serapan</p>
                </div>
                <p className="text-sm font-bold text-violet-700 dark:text-violet-300">{danaBOS > 0 ? `${persenSerapan}%` : '-'}</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">{bkuMonths.length > 0 ? `dari ${bkuMonths.length} bulan` : '-'}</p>
              </CardContent>
            </Card>
            <Card className="border-rose-200 dark:border-rose-800 bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-950/30 dark:to-pink-950/30">
              <CardContent className="pt-3 pb-2 px-3">
                <div className="flex items-center gap-2 mb-1">
                  <Receipt className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                  <p className="text-[10px] text-muted-foreground">Total Pajak</p>
                </div>
                <p className="text-sm font-bold text-rose-700 dark:text-rose-300">{totalPajak > 0 ? fmtRp(totalPajak) : '-'}</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">{bkuPajakMonths.length > 0 ? `${bkuPajakMonths.length} bulan` : 'Impor BKU Pajak'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-3 pb-2 px-3">
                <div className="flex items-center gap-2 mb-1">
                  <Landmark className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-[10px] text-muted-foreground">Saldo Kas</p>
                </div>
                <p className="text-sm font-bold">{lastBkuSaldo > 0 ? fmtRp(lastBkuSaldo) : '-'}</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">{bkuMonths.length > 0 ? `s/d ${MONTH_NAMES[normalizeMonth(bkuMonths[bkuMonths.length-1]?.bulan)] || ''}` : '-'}</p>
              </CardContent>
            </Card>
          </div>

          {/* ===== Section 2: Serapan Dana BOS - Progress ===== */}
          {danaBOS > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Serapan Dana BOS</CardTitle>
                  <Badge variant={persenSerapan >= 80 ? 'default' : persenSerapan >= 50 ? 'secondary' : 'outline'} className="text-[10px]">
                    {persenSerapan >= 80 ? 'Baik' : persenSerapan >= 50 ? 'Sedang' : 'Rendah'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground">Realisasi vs Dana BOS</span>
                    <span className="font-semibold">{fmtRp(totalRealisasi)} / {fmtRp(danaBOS)}</span>
                  </div>
                  <div className="relative h-6 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${
                        persenSerapan >= 80 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' :
                        persenSerapan >= 50 ? 'bg-gradient-to-r from-amber-400 to-amber-500' :
                        'bg-gradient-to-r from-red-400 to-red-500'
                      }`}
                      style={{ width: `${Math.min(persenSerapan, 100)}%` }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[11px] font-bold text-white drop-shadow-sm">{persenSerapan}%</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
                    <p className="text-[10px] text-muted-foreground">Anggaran Belanja</p>
                    <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">{fmtRp(anggaranBelanja)}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30">
                    <p className="text-[10px] text-muted-foreground">Sudah Dibelanjakan</p>
                    <p className="text-xs font-bold text-amber-700 dark:text-amber-300">{fmtRp(totalRealisasi)}</p>
                  </div>
                  <div className={`p-2 rounded-lg ${sisaDana >= 0 ? 'bg-blue-50 dark:bg-blue-950/30' : 'bg-red-50 dark:bg-red-950/30'}`}>
                    <p className="text-[10px] text-muted-foreground">{sisaDana >= 0 ? 'Sisa Anggaran' : 'Defisit'}</p>
                    <p className={`text-xs font-bold ${sisaDana >= 0 ? 'text-blue-700 dark:text-blue-300' : 'text-red-700 dark:text-red-300'}`}>{fmtRp(Math.abs(sisaDana))}</p>
                  </div>
                </div>
                {rkasBulanan.length > 0 && (
                  <div className="pt-2 border-t">
                    <p className="text-[10px] text-muted-foreground mb-2">Serapan per Bulan (RKAS Bulanan vs BKU)</p>
                    <div className="space-y-1.5">
                      {rkasBulanan.map((rkas, idx) => {
                        const bku = bkuMonths.find(b => normalizeMonth(b.bulan) === normalizeMonth(rkas.bulan))
                        const realisasiBulan = bku?.totalPengeluaran || 0
                        const anggaranBulan = rkas.totalBelanja
                        const persenBulan = anggaranBulan > 0 ? Math.round((realisasiBulan / anggaranBulan) * 100) : 0
                        return (
                          <div key={idx} className="flex items-center gap-2">
                            <span className="text-[10px] w-8 shrink-0 font-medium">{MONTH_NAMES[normalizeMonth(rkas.bulan)] || rkas.bulan.slice(0,3)}</span>
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${persenBulan >= 80 ? 'bg-emerald-500' : persenBulan >= 50 ? 'bg-amber-500' : 'bg-red-400'}`}
                                style={{ width: `${Math.min(persenBulan, 100)}%` }}
                              />
                            </div>
                            <span className="text-[10px] w-10 text-right shrink-0 font-medium">{persenBulan}%</span>
                            <span className="text-[9px] text-muted-foreground w-28 text-right shrink-0 truncate">{fmtRp(realisasiBulan)}/{fmtRp(anggaranBulan)}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ===== Section 3: Anggaran vs Realisasi Chart ===== */}
          {monthlyComparison.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Anggaran (RKAS) vs Realisasi (BKU) per Bulan</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={monthlyComparison} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis fontSize={10} />
                    <YAxis tickFormatter={(v: number) => `${(v/1000000).toFixed(0)}jt`} fontSize={10} />
                    <Tooltip formatter={(v: number) => fmtRp(v)} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="Anggaran" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Realisasi" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* ===== Section 4: Charts Row ===== */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {cashFlowData.length > 0 && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Arus Kas Bulanan (BKU)</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={cashFlowData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis fontSize={10} />
                      <YAxis tickFormatter={(v: number) => `${(v/1000000).toFixed(0)}jt`} fontSize={10} />
                      <Tooltip formatter={(v: number) => fmtRp(v)} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Bar dataKey="Penerimaan" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Pengeluaran" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {(tahunanStandarData.length > 0 ? tahunanStandarData : pieDataStandar).length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Alokasi per Standar SNP {tahunanStandarData.length > 0 ? '(RKAS Tahunan)' : ''}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <RechartsPie>
                      <Pie data={tahunanStandarData.length > 0 ? tahunanStandarData : pieDataStandar} cx="50%" cy="50%" outerRadius={85} innerRadius={45} dataKey="value" nameKey="name" label={({ persen }: { persen: number }) => `${persen}%`}>
                        {(tahunanStandarData.length > 0 ? tahunanStandarData : pieDataStandar).map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => fmtRp(v)} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                    </RechartsPie>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>

          {/* ===== Section 5: Distribusi Standar + Pajak ===== */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {(tahunanStandarData.length > 0 ? tahunanStandarData : (budgetData?.alokasiStandar || [])).length > 0 && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Distribusi Anggaran per Standar</CardTitle></CardHeader>
                <CardContent className="space-y-2.5">
                  {(tahunanStandarData.length > 0 ? tahunanStandarData : (budgetData?.alokasiStandar.map(s => ({ kode: s.kode, name: s.nama, value: s.jumlah, persen: s.persen })) || [])).map((s, i) => {
                    const IconComp = STANDAR_ICONS[s.kode] || PieChart
                    return (
                      <div key={i} className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: `${CHART_COLORS[i % CHART_COLORS.length]}20` }}>
                          <IconComp className="h-3.5 w-3.5" style={{ color: CHART_COLORS[i % CHART_COLORS.length] }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[11px] font-medium truncate">{s.name}</span>
                            <span className="text-[11px] font-semibold ml-2 shrink-0">{fmtRp(s.value)}</span>
                          </div>
                          <Progress value={s.persen} className="h-1.5" />
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0 w-8 text-right">{s.persen}%</span>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            )}

            {totalPajak > 0 && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Ringkasan Pajak (BKU Pajak)</CardTitle></CardHeader>
                <CardContent className="space-y-2.5">
                  {[
                    { label: 'PPN', value: pajakDetail.ppn, color: '#ef4444' },
                    { label: 'PPh 21', value: pajakDetail.pph21, color: '#f59e0b' },
                    { label: 'PPh 23', value: pajakDetail.pph23, color: '#10b981' },
                    { label: 'PPh 4(2)', value: pajakDetail.pph4, color: '#8b5cf6' },
                    { label: 'SSPD', value: pajakDetail.sspd, color: '#3b82f6' },
                  ].map((tax, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: `${tax.color}20` }}>
                        <Receipt className="h-3.5 w-3.5" style={{ color: tax.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[11px] font-medium">{tax.label}</span>
                          <span className="text-[11px] font-semibold">{fmtRp(tax.value)}</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${totalPajak > 0 ? (tax.value / totalPajak * 100) : 0}%`, backgroundColor: tax.color }} />
                        </div>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0 w-10 text-right">{totalPajak > 0 ? Math.round(tax.value / totalPajak * 100) : 0}%</span>
                    </div>
                  ))}
                  <div className="pt-2 border-t flex items-center justify-between">
                    <span className="text-xs font-semibold">Total Pajak</span>
                    <span className="text-xs font-bold text-rose-600 dark:text-rose-400">{fmtRp(totalPajak)}</span>
                  </div>
                  {totalRealisasi > 0 && (
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>Rasio Pajak terhadap Belanja</span>
                      <span className="font-medium">{(totalPajak / totalRealisasi * 100).toFixed(1)}%</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* ===== Section 6: School Info ===== */}
          {(tahunanData || (bkuMonths.length > 0 ? bkuMonths[0] : null)) && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Profil Sekolah</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  {(() => {
                    const src = tahunanData || bkuMonths[0]
                    if (!src) return null
                    return (
                      <>
                        <div><p className="text-[10px] text-muted-foreground">Nama Sekolah</p><p className="font-medium truncate">{src.namaSekolah || '-'}</p></div>
                        <div><p className="text-[10px] text-muted-foreground">NPSN</p><p className="font-medium">{src.npsn || '-'}</p></div>
                        <div><p className="text-[10px] text-muted-foreground">Sumber Dana</p><p className="font-medium">{src.sumberDana || '-'}</p></div>
                        <div><p className="text-[10px] text-muted-foreground">Tahun Anggaran</p><p className="font-medium">{tahunanData?.tahun || bkuMonths[0]?.tahun || '-'}</p></div>
                      </>
                    )
                  })()}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
