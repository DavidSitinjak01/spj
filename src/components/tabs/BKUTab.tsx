'use client'

import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  FilePlus2, Loader2, Upload, Receipt, Building2,
  Search, Trash2, ChevronDown,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { type BKUMonth } from '@/lib/types'
import { fmtRp } from '@/lib/helpers'

interface BKUTabProps {
  bkuMonths: BKUMonth[]
  bkuLoading: boolean
  bkuUploading: boolean
  selectedBkuMonth: number
  setSelectedBkuMonth: (idx: number) => void
  bkuSearchTerm: string
  setBkuSearchTerm: (v: string) => void
  handleBKUUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  deleteBKUFile: (fileName: string) => void
}

export default function BKUTab({
  bkuMonths, bkuLoading, bkuUploading,
  selectedBkuMonth, setSelectedBkuMonth,
  bkuSearchTerm, setBkuSearchTerm,
  handleBKUUpload, deleteBKUFile,
}: BKUTabProps) {
  const bkuFileInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4">
      {/* Upload area */}
      <div className="flex items-center gap-3 flex-wrap">
        <input type="file" ref={bkuFileInputRef} onChange={handleBKUUpload} accept=".pdf" multiple className="hidden" />
        <Button variant="outline" size="sm" onClick={() => bkuFileInputRef.current?.click()} disabled={bkuUploading} className="gap-2">
          {bkuUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FilePlus2 className="h-3.5 w-3.5" />}
          {bkuUploading ? 'Mengimpor...' : 'Import BKU'}
        </Button>
        <span className="text-xs text-muted-foreground">{bkuMonths.length} bulan BKU terimpor</span>
        {bkuLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {bkuMonths.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center space-y-3">
            <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mx-auto">
              <Receipt className="h-7 w-7 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Belum ada data BKU</h3>
              <p className="text-xs text-muted-foreground mt-1">Import file PDF BKU per bulan untuk melihat tabel belanja bulanan</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => bkuFileInputRef.current?.click()} className="gap-2">
              <Upload className="h-3.5 w-3.5" /> Import File BKU
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Monthly Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30">
              <CardContent className="pt-3 pb-2">
                <p className="text-[10px] text-muted-foreground">Total Penerimaan</p>
                <p className="text-base font-bold text-emerald-700 dark:text-emerald-300">{fmtRp(bkuMonths.reduce((s, m) => s + m.totalPenerimaan, 0))}</p>
              </CardContent>
            </Card>
            <Card className="border-red-200 dark:border-red-800 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30">
              <CardContent className="pt-3 pb-2">
                <p className="text-[10px] text-muted-foreground">Total Pengeluaran</p>
                <p className="text-base font-bold text-red-700 dark:text-red-300">{fmtRp(bkuMonths.reduce((s, m) => s + m.totalPengeluaran, 0))}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-3 pb-2">
                <p className="text-[10px] text-muted-foreground">Saldo Akhir</p>
                <p className="text-base font-bold">{fmtRp(bkuMonths.length > 0 ? bkuMonths[bkuMonths.length - 1].saldoAkhir : 0)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-3 pb-2">
                <p className="text-[10px] text-muted-foreground">Bulan Tercatat</p>
                <p className="text-base font-bold">{bkuMonths.length} bulan</p>
              </CardContent>
            </Card>
          </div>

          {/* Monthly Comparison Bar Chart */}
          {bkuMonths.length > 1 && (
            <Card>
              <CardContent className="pt-4 pb-2">
                <p className="text-sm font-semibold mb-2">Perbandingan Penerimaan vs Pengeluaran per Bulan</p>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={bkuMonths.map(m => ({ name: m.bulan.slice(0, 3), Penerimaan: m.totalPenerimaan, Pengeluaran: m.totalPengeluaran }))}>
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

          {/* Monthly Detail Sections */}
          <div className="space-y-4">
            {bkuMonths.map((month, mIdx) => {
              const isOpen = selectedBkuMonth === mIdx
              const filteredTx = month.transactions.filter(t =>
                !bkuSearchTerm || t.uraian.toLowerCase().includes(bkuSearchTerm.toLowerCase()) || t.tanggal.includes(bkuSearchTerm)
              )
              return (
                <Card key={mIdx} className="overflow-hidden">
                  <div
                    role="button"
                    tabIndex={0}
                    className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => setSelectedBkuMonth(isOpen ? -1 : mIdx)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedBkuMonth(isOpen ? -1 : mIdx) } }}
                  >
                    <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0">
                      <Receipt className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{month.bulan} {month.tahun}</span>
                        <Badge variant="outline" className="text-[10px]">{month.sumberDana}</Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
                        <span className="text-emerald-600 dark:text-emerald-400">+{fmtRp(month.totalPenerimaan)}</span>
                        <span className="text-red-600 dark:text-red-400">-{fmtRp(month.totalPengeluaran)}</span>
                        <span>Saldo: {fmtRp(month.saldoAkhir)}</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={(e) => { e.stopPropagation(); deleteBKUFile(month.fileName) }} title="Hapus file">
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                    </Button>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </div>

                  {isOpen && (
                    <div className="border-t">
                      <div className="px-4 py-2 bg-muted/30 flex items-center gap-4 text-[11px] text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{month.namaSekolah}</span>
                        <span>NPSN: {month.npsn}</span>
                        {month.saldoAkhirBank > 0 && <span>Bank: {fmtRp(month.saldoAkhirBank)}</span>}
                        {month.saldoAkhirTunai > 0 && <span>Tunai: {fmtRp(month.saldoAkhirTunai)}</span>}
                      </div>
                      <div className="px-4 pt-3">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <Input placeholder="Cari transaksi..." value={bkuSearchTerm} onChange={e => setBkuSearchTerm(e.target.value)} className="pl-9 h-8 text-xs" />
                        </div>
                      </div>
                      <div className="px-4 py-3 overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2 px-2 font-medium text-muted-foreground whitespace-nowrap">Tanggal</th>
                              <th className="text-left py-2 px-2 font-medium text-muted-foreground">No. Bukti</th>
                              <th className="text-left py-2 px-2 font-medium text-muted-foreground">Uraian</th>
                              <th className="text-right py-2 px-2 font-medium text-muted-foreground whitespace-nowrap">Penerimaan</th>
                              <th className="text-right py-2 px-2 font-medium text-muted-foreground whitespace-nowrap">Pengeluaran</th>
                              <th className="text-right py-2 px-2 font-medium text-muted-foreground whitespace-nowrap">Saldo</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredTx.map((tx, tIdx) => (
                              <tr key={tIdx} className="border-b hover:bg-muted/20 transition-colors">
                                <td className="py-2 px-2 whitespace-nowrap font-mono">{tx.tanggal}</td>
                                <td className="py-2 px-2"><span className="font-mono text-muted-foreground">{tx.noBukti || '-'}</span></td>
                                <td className="py-2 px-2 max-w-[300px]">
                                  <span className={tx.pengeluaran > 0 ? 'text-red-600 dark:text-red-400' : tx.penerimaan > 0 ? 'text-emerald-600 dark:text-emerald-400' : ''}>
                                    {tx.uraian}
                                  </span>
                                </td>
                                <td className="py-2 px-2 text-right whitespace-nowrap">
                                  {tx.penerimaan > 0 ? <span className="text-emerald-600 dark:text-emerald-400 font-medium">{fmtRp(tx.penerimaan)}</span> : <span className="text-muted-foreground">-</span>}
                                </td>
                                <td className="py-2 px-2 text-right whitespace-nowrap">
                                  {tx.pengeluaran > 0 ? <span className="text-red-600 dark:text-red-400 font-medium">{fmtRp(tx.pengeluaran)}</span> : <span className="text-muted-foreground">-</span>}
                                </td>
                                <td className="py-2 px-2 text-right whitespace-nowrap font-medium">{fmtRp(tx.saldo)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t-2 font-semibold">
                              <td colSpan={3} className="py-2 px-2">Jumlah</td>
                              <td className="py-2 px-2 text-right whitespace-nowrap text-emerald-600 dark:text-emerald-400">{fmtRp(month.totalPenerimaan)}</td>
                              <td className="py-2 px-2 text-right whitespace-nowrap text-red-600 dark:text-red-400">{fmtRp(month.totalPengeluaran)}</td>
                              <td className="py-2 px-2 text-right whitespace-nowrap">{fmtRp(month.saldoAkhir)}</td>
                            </tr>
                          </tfoot>
                        </table>
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
