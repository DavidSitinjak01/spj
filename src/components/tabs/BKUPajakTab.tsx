'use client'

import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  FilePlus2, Loader2, Upload, Scale, Building2,
  Search, Trash2, ChevronDown, Calendar,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { type BKUPajakMonth, MONTH_NAMES } from '@/lib/types'
import { fmt, fmtRp, CHART_COLORS, normalizeMonth } from '@/lib/helpers'

interface BKUPajakTabProps {
  bkuPajakMonths: BKUPajakMonth[]
  bkuPajakLoading: boolean
  bkuPajakUploading: boolean
  selectedBkuPajakMonth: number
  setSelectedBkuPajakMonth: (idx: number) => void
  bkuPajakSearchTerm: string
  setBkuPajakSearchTerm: (v: string) => void
  handleBKUPajakUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  deleteBKUPajakFile: (fileName: string) => void
}

export default function BKUPajakTab({
  bkuPajakMonths, bkuPajakLoading, bkuPajakUploading,
  selectedBkuPajakMonth, setSelectedBkuPajakMonth,
  bkuPajakSearchTerm, setBkuPajakSearchTerm,
  handleBKUPajakUpload, deleteBKUPajakFile,
}: BKUPajakTabProps) {
  const bkuPajakFileInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4">
      {/* Upload area */}
      <div className="flex items-center gap-3 flex-wrap">
        <input type="file" ref={bkuPajakFileInputRef} onChange={handleBKUPajakUpload} accept=".pdf" multiple className="hidden" />
        <Button variant="outline" size="sm" onClick={() => bkuPajakFileInputRef.current?.click()} disabled={bkuPajakUploading} className="gap-2">
          {bkuPajakUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FilePlus2 className="h-3.5 w-3.5" />}
          {bkuPajakUploading ? 'Mengimpor...' : 'Import BKU Pajak'}
        </Button>
        <span className="text-xs text-muted-foreground">{bkuPajakMonths.length} bulan BKU Pajak terimpor</span>
        {bkuPajakLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {bkuPajakMonths.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center space-y-3">
            <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mx-auto">
              <Scale className="h-7 w-7 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Belum ada data BKU Pajak</h3>
              <p className="text-xs text-muted-foreground mt-1">Import file PDF BKU Pajak per bulan untuk melihat rincian pajak bulanan</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => bkuPajakFileInputRef.current?.click()} className="gap-2">
              <Upload className="h-3.5 w-3.5" /> Import File BKU Pajak
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30">
              <CardContent className="pt-3 pb-2">
                <p className="text-[10px] text-muted-foreground">Total Penerimaan Pajak</p>
                <p className="text-base font-bold text-emerald-700 dark:text-emerald-300">{fmtRp(bkuPajakMonths.reduce((s, m) => s + m.totalPenerimaan, 0))}</p>
              </CardContent>
            </Card>
            <Card className="border-red-200 dark:border-red-800 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30">
              <CardContent className="pt-3 pb-2">
                <p className="text-[10px] text-muted-foreground">Total Setor Pajak</p>
                <p className="text-base font-bold text-red-700 dark:text-red-300">{fmtRp(bkuPajakMonths.reduce((s, m) => s + m.totalPengeluaran, 0))}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-3 pb-2">
                <p className="text-[10px] text-muted-foreground">Total PPN</p>
                <p className="text-base font-bold">{fmtRp(bkuPajakMonths.reduce((s, m) => s + m.totalPPN, 0))}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-3 pb-2">
                <p className="text-[10px] text-muted-foreground">Bulan Tercatat</p>
                <p className="text-base font-bold">{bkuPajakMonths.length} bulan</p>
              </CardContent>
            </Card>
          </div>

          {/* Tax Type Breakdown */}
          {(() => {
            const aggregatedPajak: Record<string, { nama: string; totalPenerimaan: number; totalPengeluaran: number; count: number }> = {}
            for (const m of bkuPajakMonths) {
              for (const jp of m.jenisPajak) {
                if (!aggregatedPajak[jp.kode]) {
                  aggregatedPajak[jp.kode] = { nama: jp.nama, totalPenerimaan: 0, totalPengeluaran: 0, count: 0 }
                }
                aggregatedPajak[jp.kode].totalPenerimaan += jp.totalPenerimaan
                aggregatedPajak[jp.kode].totalPengeluaran += jp.totalPengeluaran
                aggregatedPajak[jp.kode].count += jp.jumlahTransaksi
              }
            }
            const sortedPajak = Object.entries(aggregatedPajak).sort((a, b) => b[1].totalPenerimaan - a[1].totalPenerimaan)
            const totalAll = sortedPajak.reduce((s, [, v]) => s + v.totalPenerimaan, 0)
            return sortedPajak.length > 0 ? (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Rincian per Jenis Pajak (Semua Bulan)</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {sortedPajak.map(([kode, info], i) => (
                    <div key={kode} className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: `${CHART_COLORS[i % CHART_COLORS.length]}20` }}>
                        <Scale className="h-4 w-4" style={{ color: CHART_COLORS[i % CHART_COLORS.length] }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium truncate max-w-[60%]">{info.nama}</span>
                          <span className="text-xs font-semibold ml-2 shrink-0">{fmtRp(info.totalPenerimaan)}</span>
                        </div>
                        <Progress value={totalAll > 0 ? Math.round(info.totalPenerimaan / totalAll * 100) : 0} className="h-1.5" />
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-[10px] text-muted-foreground">{totalAll > 0 ? Math.round(info.totalPenerimaan / totalAll * 100) : 0}% dari total</span>
                          <span className="text-[10px] text-muted-foreground">{info.count} transaksi</span>
                          <span className="text-[10px] text-red-500">Disetor: {fmtRp(info.totalPengeluaran)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null
          })()}

          {/* Monthly Comparison Chart */}
          {bkuPajakMonths.length > 1 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Perbandingan Penerimaan vs Setor Pajak per Bulan</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={bkuPajakMonths.map(m => ({ name: (MONTH_NAMES[m.bulan] || m.bulan.slice(0, 3)) + ' ' + m.tahun, Penerimaan: m.totalPenerimaan, 'Setor Pajak': m.totalPengeluaran }))}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis fontSize={10} />
                    <YAxis tickFormatter={(v: number) => `${(v/1000000).toFixed(0)}jt`} fontSize={10} />
                    <Tooltip formatter={(v: number) => fmtRp(v)} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="Penerimaan" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Setor Pajak" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Monthly Detail Sections */}
          <div className="space-y-4">
            {bkuPajakMonths.map((month, mIdx) => {
              const isOpen = selectedBkuPajakMonth === mIdx
              const filteredTransactions = month.transactions.filter(t =>
                !bkuPajakSearchTerm || t.uraian.toLowerCase().includes(bkuPajakSearchTerm.toLowerCase()) || t.noKode.includes(bkuPajakSearchTerm) || t.tanggal.includes(bkuPajakSearchTerm)
              )
              const terimaTx = filteredTransactions.filter(t => t.jenisTransaksi === 'Terima')
              const setorTx = filteredTransactions.filter(t => t.jenisTransaksi === 'Setor')
              const lainTx = filteredTransactions.filter(t => t.jenisTransaksi === 'Lainnya')

              return (
                <Card key={mIdx} className="overflow-hidden">
                  <div
                    role="button"
                    tabIndex={0}
                    className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => { setSelectedBkuPajakMonth(isOpen ? -1 : mIdx); setBkuPajakSearchTerm('') }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedBkuPajakMonth(isOpen ? -1 : mIdx); setBkuPajakSearchTerm('') } }}
                  >
                    <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0">
                      <Scale className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{month.bulan ? (month.bulan.charAt(0) + month.bulan.slice(1).toLowerCase()) : 'Tahunan'} {month.tahun}</span>
                        <Badge variant="outline" className="text-[10px]">{month.sumberDana}</Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
                        <span className="text-emerald-600 dark:text-emerald-400">+{fmtRp(month.totalPenerimaan)}</span>
                        <span className="text-red-600 dark:text-red-400">-{fmtRp(month.totalPengeluaran)}</span>
                        <span>{month.transactions.length} transaksi</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={(e) => { e.stopPropagation(); deleteBKUPajakFile(month.fileName) }} title="Hapus file">
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
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                          <Card className="border-emerald-200 dark:border-emerald-800"><CardContent className="p-2"><p className="text-[10px] text-muted-foreground">PPN</p><p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">{fmtRp(month.totalPPN)}</p></CardContent></Card>
                          <Card className="border-blue-200 dark:border-blue-800"><CardContent className="p-2"><p className="text-[10px] text-muted-foreground">PPh 21</p><p className="text-xs font-bold text-blue-700 dark:text-blue-300">{fmtRp(month.totalPPh21)}</p></CardContent></Card>
                          <Card className="border-amber-200 dark:border-amber-800"><CardContent className="p-2"><p className="text-[10px] text-muted-foreground">PPh 23</p><p className="text-xs font-bold text-amber-700 dark:text-amber-300">{fmtRp(month.totalPPh23)}</p></CardContent></Card>
                          <Card className="border-purple-200 dark:border-purple-800"><CardContent className="p-2"><p className="text-[10px] text-muted-foreground">PPh 4</p><p className="text-xs font-bold text-purple-700 dark:text-purple-300">{fmtRp(month.totalPPh4)}</p></CardContent></Card>
                          <Card className="border-rose-200 dark:border-rose-800"><CardContent className="p-2"><p className="text-[10px] text-muted-foreground">SSPD</p><p className="text-xs font-bold text-rose-700 dark:text-rose-300">{fmtRp(month.totalSSPD)}</p></CardContent></Card>
                        </div>
                      </div>
                      {month.jenisPajak.length > 0 && (
                        <div className="px-4 pb-3">
                          <p className="text-[10px] text-muted-foreground mb-1.5">Rincian Jenis Pajak:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {month.jenisPajak.map((jp, jpi) => (
                              <Badge key={jpi} variant="outline" className="text-[10px] gap-1 py-0.5">
                                <span className="font-mono">{jp.kode}</span>
                                <span className="max-w-[120px] truncate">{jp.nama}</span>
                                <span className="font-semibold">{fmtRp(jp.totalPenerimaan)}</span>
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="px-4 pb-3">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <Input placeholder="Cari uraian, kode, atau tanggal..." value={bkuPajakSearchTerm} onChange={e => setBkuPajakSearchTerm(e.target.value)} className="pl-9 h-8 text-xs" />
                        </div>
                      </div>
                      <div className="px-4 pb-3 overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b bg-muted/30">
                              <th className="text-left py-2 px-1.5 font-medium text-muted-foreground whitespace-nowrap">Tanggal</th>
                              <th className="text-left py-2 px-1.5 font-medium text-muted-foreground whitespace-nowrap">Kode</th>
                              <th className="text-left py-2 px-1.5 font-medium text-muted-foreground">Uraian</th>
                              <th className="text-right py-2 px-1.5 font-medium text-muted-foreground whitespace-nowrap">PPN</th>
                              <th className="text-right py-2 px-1.5 font-medium text-muted-foreground whitespace-nowrap">PPh 21</th>
                              <th className="text-right py-2 px-1.5 font-medium text-muted-foreground whitespace-nowrap">PPh 23</th>
                              <th className="text-right py-2 px-1.5 font-medium text-muted-foreground whitespace-nowrap">PPh 4</th>
                              <th className="text-right py-2 px-1.5 font-medium text-muted-foreground whitespace-nowrap">SSPD</th>
                              <th className="text-right py-2 px-1.5 font-medium text-muted-foreground whitespace-nowrap">Setor</th>
                              <th className="text-right py-2 px-1.5 font-medium text-muted-foreground whitespace-nowrap">Saldo</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredTransactions.map((t, tIdx) => (
                              <tr key={tIdx} className={`border-b hover:bg-muted/20 transition-colors ${t.jenisTransaksi === 'Terima' ? 'bg-emerald-50/50 dark:bg-emerald-950/10' : t.jenisTransaksi === 'Setor' ? 'bg-red-50/50 dark:bg-red-950/10' : ''}`}>
                                <td className="py-1.5 px-1.5 whitespace-nowrap font-mono">{t.tanggal}</td>
                                <td className="py-1.5 px-1.5 font-mono text-muted-foreground">{t.noKode}</td>
                                <td className="py-1.5 px-1.5 max-w-[300px]">
                                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium mr-1 ${t.jenisTransaksi === 'Terima' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' : t.jenisTransaksi === 'Setor' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' : 'bg-muted text-muted-foreground'}`}>
                                    {t.jenisTransaksi}
                                  </span>
                                  <span className="text-[11px]">{t.uraian}</span>
                                </td>
                                <td className="py-1.5 px-1.5 text-right font-mono">{t.ppn > 0 ? fmt(t.ppn) : '-'}</td>
                                <td className="py-1.5 px-1.5 text-right font-mono">{t.pph21 > 0 ? fmt(t.pph21) : '-'}</td>
                                <td className="py-1.5 px-1.5 text-right font-mono">{t.pph23 > 0 ? fmt(t.pph23) : '-'}</td>
                                <td className="py-1.5 px-1.5 text-right font-mono">{t.pph4 > 0 ? fmt(t.pph4) : '-'}</td>
                                <td className="py-1.5 px-1.5 text-right font-mono">{t.sspd > 0 ? fmt(t.sspd) : '-'}</td>
                                <td className="py-1.5 px-1.5 text-right font-mono text-red-600 dark:text-red-400">{t.pengeluaran > 0 ? fmt(t.pengeluaran) : '-'}</td>
                                <td className="py-1.5 px-1.5 text-right font-mono font-semibold">{t.saldo > 0 ? fmt(t.saldo) : '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t-2 font-semibold bg-muted/20">
                              <td colSpan={3} className="py-2 px-1.5">Jumlah</td>
                              <td className="py-2 px-1.5 text-right font-mono">{fmt(month.totalPPN)}</td>
                              <td className="py-2 px-1.5 text-right font-mono">{fmt(month.totalPPh21)}</td>
                              <td className="py-2 px-1.5 text-right font-mono">{fmt(month.totalPPh23)}</td>
                              <td className="py-2 px-1.5 text-right font-mono">{fmt(month.totalPPh4)}</td>
                              <td className="py-2 px-1.5 text-right font-mono">{fmt(month.totalSSPD)}</td>
                              <td className="py-2 px-1.5 text-right font-mono text-red-600 dark:text-red-400">{fmt(month.totalPengeluaran)}</td>
                              <td className="py-2 px-1.5 text-right font-mono">{fmt(month.saldoAkhir)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                      <div className="px-4 py-2 border-t bg-muted/20 flex items-center gap-4 text-[11px] text-muted-foreground flex-wrap">
                        {month.tanggalTutup && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Tutup: {month.tanggalTutup}</span>}
                        <span>{terimaTx.length} penerimaan, {setorTx.length} setor</span>
                        {lainTx.length > 0 && <span>{lainTx.length} lainnya</span>}
                      </div>
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
