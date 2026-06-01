'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import {
  FileUp, FileText, MessageSquare, ChevronLeft, ChevronRight, Send, Loader2,
  Upload, BookOpen, Bot, User, Sparkles, ZoomIn, ZoomOut, RotateCcw,
  CheckCircle2, AlertCircle, X, PanelRightOpen, PanelRightClose,
  PieChart, BarChart3, Users, ShoppingBag, Landmark, Calendar, Building2,
  Search, TrendingUp, Wallet, GraduationCap, Wrench, Monitor, FileSpreadsheet,
  ChevronDown, ArrowUpRight, ArrowDownRight, Info,
  Receipt, FilePlus2, ArrowRight, Minus, Plus, FolderOpen, Trash2,
} from 'lucide-react'
import {
  PieChart as RechartsPie, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

// --- Types ---
interface PDFPage { page: number; text: string }
interface PDFData { fileName: string; pageCount: number; pageImages: string[]; extractedText: PDFPage[] }
interface Summary { title: string; type: string; summary: string; keyPoints: string[]; totalAmount: string; entity: string; period: string }
interface ChatMessage { role: 'user' | 'assistant'; content: string }

interface BKUTransaction {
  tanggal: string; kodeKegiatan: string; kodeRekening: string; noBukti: string;
  uraian: string; penerimaan: number; pengeluaran: number; saldo: number;
}
interface BKUMonth {
  fileName: string; bulan: string; tahun: string; sumberDana: string;
  namaSekolah: string; npsn: string; transactions: BKUTransaction[];
  totalPenerimaan: number; totalPengeluaran: number; saldoAkhir: number;
  saldoAkhirBank: number; saldoAkhirTunai: number; tanggalTutup: string;
}

interface BudgetData {
  profil: { namaSekolah: string; npsn: string; alamat: string; kabupaten: string; provinsi: string; tahunAnggaran: string; kepalaSekolah: string; bendahara: string; komiteSekolah: string }
  penerimaan: { total: number; sumber: { nama: string; kode: string; jumlah: number }[] }
  alokasiStandar: { kode: string; nama: string; jumlah: number; persen: number }[]
  alokasiBelanja: { operasi: number; modal: number }
  belanjaTerbesar: { nama: string; jumlah: number; kategori: string }[]
  pegawai: { nama: string; jenis: string; honor: number }[]
  pengadaan: { nama: string; jumlah: number; kategori: string }[]
  sumberDanaDetail: { bospRegulerOperasi: number; bospRegulerModal: number; bospDaerahOperasi: number; bospDaerahModal: number }
}

// --- Helpers ---
const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(n)
const fmtRp = (n: number) => `Rp ${fmt(n)}`

const CHART_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

const STANDAR_ICONS: Record<string, any> = {
  '02': GraduationCap,
  '03': BookOpen,
  '04': Users,
  '05': Wrench,
  '06': Landmark,
  '07': Wallet,
  '08': FileSpreadsheet,
}

// --- Component ---
export default function Home() {
  const [pdfData, setPdfData] = useState<PDFData | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [zoom, setZoom] = useState(100)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [budgetData, setBudgetData] = useState<BudgetData | null>(null)
  const [budgetLoading, setBudgetLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [chatPanelOpen, setChatPanelOpen] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pageInputValue, setPageInputValue] = useState('1')
  const [imageLoaded, setImageLoaded] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [bkuMonths, setBkuMonths] = useState<BKUMonth[]>([])
  const [bkuLoading, setBkuLoading] = useState(false)
  const [bkuUploading, setBkuUploading] = useState(false)
  const [selectedBkuMonth, setSelectedBkuMonth] = useState<number>(0)
  const [bkuSearchTerm, setBkuSearchTerm] = useState('')
  const bkuFileInputRef = useRef<HTMLInputElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadPDF('rapbs-all-output.pdf'); loadBKU() }, [])
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatMessages])
  useEffect(() => { setPageInputValue(String(currentPage)) }, [currentPage])
  useEffect(() => { setImageLoaded(false) }, [currentPage])

  const loadPDF = async (fileName: string) => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/pdf/info?file=${encodeURIComponent(fileName)}`)
      if (!res.ok) throw new Error('Gagal memuat PDF')
      const data = await res.json()
      setPdfData(data); setCurrentPage(1); setZoom(100)
      generateSummary(fileName)
      extractBudget(fileName)
    } catch (err: any) { setError(err.message) } finally { setLoading(false) }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true); setError(null)
    try {
      const formData = new FormData(); formData.append('file', file)
      const res = await fetch('/api/pdf/upload', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Gagal mengunggah PDF')
      const data = await res.json()
      setPdfData(data); setCurrentPage(1); setZoom(100); setChatMessages([]); setSummary(null); setBudgetData(null)
      generateSummary(file.name); extractBudget(file.name)
    } catch (err: any) { setError(err.message) } finally {
      setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const generateSummary = async (fileName: string) => {
    setSummaryLoading(true)
    try {
      const res = await fetch('/api/pdf/summarize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName }) })
      if (!res.ok) throw new Error('Gagal membuat ringkasan')
      const data = await res.json(); setSummary(data.summary)
    } catch {} finally { setSummaryLoading(false) }
  }

  const extractBudget = async (fileName: string) => {
    setBudgetLoading(true)
    try {
      const res = await fetch('/api/pdf/budget', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName }) })
      if (!res.ok) throw new Error('Gagal ekstrak data anggaran')
      const data = await res.json()
      if (data.data && !data.data.error) setBudgetData(data.data)
    } catch {} finally { setBudgetLoading(false) }
  }

  const sendChat = async () => {
    if (!chatInput.trim() || !pdfData || chatLoading) return
    const userMessage = chatInput.trim(); setChatInput('')
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]); setChatLoading(true)
    try {
      const history = chatMessages.map(m => ({ role: m.role, content: m.content }))
      const res = await fetch('/api/pdf/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: pdfData.fileName, question: userMessage, history }) })
      if (!res.ok) throw new Error('Gagal mendapatkan respons')
      const data = await res.json()
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.answer }])
    } catch { setChatMessages(prev => [...prev, { role: 'assistant', content: 'Maaf, terjadi kesalahan.' }]) }
    finally { setChatLoading(false) }
  }

  const loadBKU = async () => {
    setBkuLoading(true)
    try {
      const res = await fetch('/api/pdf/bku')
      if (res.ok) { const data = await res.json(); setBkuMonths(data.months || []) }
    } catch {} finally { setBkuLoading(false) }
  }

  const handleBKUUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files; if (!files || files.length === 0) return
    setBkuUploading(true)
    try {
      for (let i = 0; i < files.length; i++) {
        const formData = new FormData(); formData.append('file', files[i])
        await fetch('/api/pdf/bku', { method: 'POST', body: formData })
      }
      await loadBKU()
    } catch {} finally { setBkuUploading(false); if (bkuFileInputRef.current) bkuFileInputRef.current.value = '' }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat() } }
  const goToPage = (page: number) => { if (pdfData && page >= 1 && page <= pdfData.pageCount) setCurrentPage(page) }
  const handlePageInput = (value: string) => { setPageInputValue(value); const page = parseInt(value); if (!isNaN(page) && page >= 1 && page <= (pdfData?.pageCount || 1)) setCurrentPage(page) }

  const suggestedQuestions = [
    'Berapa total penerimaan anggaran?',
    'Sebutkan pos belanja terbesar!',
    'Apa saja program kegiatan yang ada?',
    'Berapa total honor pegawai?',
    'Barang pengadaan apa saja yang direncanakan?',
  ]

  // --- Budget chart data ---
  const pieDataStandar = budgetData?.alokasiStandar.map(s => ({ name: s.nama, value: s.jumlah, persen: s.persen })) || []
  const barDataBelanja = budgetData?.belanjaTerbesar.slice(0, 8).map(b => ({ name: b.nama.length > 25 ? b.nama.slice(0, 25) + '...' : b.nama, jumlah: b.jumlah, kategori: b.kategori })) || []
  const belanjaTypeData = budgetData ? [
    { name: 'Belanja Operasi', value: budgetData.alokasiBelanja.operasi },
    { name: 'Belanja Modal', value: budgetData.alokasiBelanja.modal },
  ] : []

  const filteredPengadaan = budgetData?.pengadaan.filter(p =>
    !searchTerm || p.nama.toLowerCase().includes(searchTerm.toLowerCase()) || p.kategori.toLowerCase().includes(searchTerm.toLowerCase())
  ) || []

  const filteredPegawai = budgetData?.pegawai.filter(p =>
    !searchTerm || p.nama.toLowerCase().includes(searchTerm.toLowerCase())
  ) || []

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-screen-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
              <Landmark className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight tracking-tight">RKAS Reader</h1>
              <p className="text-[11px] text-muted-foreground leading-none">Analisis Anggaran Sekolah dengan AI</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="file" ref={fileInputRef} onChange={handleUpload} accept=".pdf" className="hidden" />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="gap-2">
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {uploading ? 'Mengunggah...' : 'Unggah PDF'}
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setChatPanelOpen(!chatPanelOpen)} title={chatPanelOpen ? 'Tutup panel chat' : 'Buka panel chat'}>
              {chatPanelOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Left Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {error && (
            <div className="mx-4 mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" /><span>{error}</span>
              <Button variant="ghost" size="icon" className="ml-auto h-6 w-6" onClick={() => setError(null)}><X className="h-3 w-3" /></Button>
            </div>
          )}

          {pdfData && (
            <div className="px-4 py-2 border-b bg-muted/30 flex items-center gap-3 text-xs flex-wrap">
              <div className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-muted-foreground" /><span className="font-medium truncate max-w-[220px]">{pdfData.fileName}</span></div>
              <Separator orientation="vertical" className="h-3.5" />
              <span className="text-muted-foreground">{pdfData.pageCount} halaman</span>
              {budgetData?.profil && (
                <>
                  <Separator orientation="vertical" className="h-3.5" />
                  <div className="flex items-center gap-1"><Building2 className="h-3 w-3 text-muted-foreground" /><span className="text-muted-foreground truncate max-w-[200px]">{budgetData.profil.namaSekolah}</span></div>
                  <Separator orientation="vertical" className="h-3.5" />
                  <div className="flex items-center gap-1"><Calendar className="h-3 w-3 text-muted-foreground" /><span className="text-muted-foreground">TA {budgetData.profil.tahunAnggaran}</span></div>
                </>
              )}
            </div>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <div className="px-4 pt-2 border-b overflow-x-auto">
              <TabsList className="h-8">
                <TabsTrigger value="dashboard" className="text-xs gap-1 px-2.5"><PieChart className="h-3 w-3" />Dashboard</TabsTrigger>
                <TabsTrigger value="alokasi" className="text-xs gap-1 px-2.5"><BarChart3 className="h-3 w-3" />Alokasi</TabsTrigger>
                <TabsTrigger value="pengadaan" className="text-xs gap-1 px-2.5"><ShoppingBag className="h-3 w-3" />Pengadaan</TabsTrigger>
                <TabsTrigger value="pegawai" className="text-xs gap-1 px-2.5"><Users className="h-3 w-3" />Pegawai</TabsTrigger>
                <TabsTrigger value="bku" className="text-xs gap-1 px-2.5"><Receipt className="h-3 w-3" />BKU</TabsTrigger>
                <TabsTrigger value="viewer" className="text-xs gap-1 px-2.5"><FileText className="h-3 w-3" />Dokumen</TabsTrigger>
                <TabsTrigger value="summary" className="text-xs gap-1 px-2.5"><Sparkles className="h-3 w-3" />Ringkasan</TabsTrigger>
              </TabsList>
            </div>

            {/* === DASHBOARD TAB === */}
            <TabsContent value="dashboard" className="flex-1 m-0 min-h-0 overflow-auto">
              <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4">
                {budgetLoading ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
                    </div>
                    <Skeleton className="h-64 rounded-lg" />
                  </div>
                ) : budgetData ? (
                  <>
                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Card className="border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30">
                        <CardContent className="pt-4 pb-3">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center"><Wallet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /></div>
                            <div><p className="text-[11px] text-muted-foreground">Total Penerimaan</p><p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{fmtRp(budgetData.penerimaan.total)}</p></div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4 pb-3">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center"><TrendingUp className="h-5 w-5 text-amber-600 dark:text-amber-400" /></div>
                            <div><p className="text-[11px] text-muted-foreground">Belanja Operasi</p><p className="text-xl font-bold">{fmtRp(budgetData.alokasiBelanja.operasi)}</p></div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4 pb-3">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center"><Monitor className="h-5 w-5 text-blue-600 dark:text-blue-400" /></div>
                            <div><p className="text-[11px] text-muted-foreground">Belanja Modal</p><p className="text-xl font-bold">{fmtRp(budgetData.alokasiBelanja.modal)}</p></div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Charts Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Pie Chart - Alokasi per Standar */}
                      <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-sm">Alokasi per Standar Nasional Pendidikan</CardTitle></CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={280}>
                            <RechartsPie>
                              <Pie data={pieDataStandar} cx="50%" cy="50%" outerRadius={90} innerRadius={50} dataKey="value" nameKey="name" label={({ name, persen }) => `${persen}%`}>
                                {pieDataStandar.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                              </Pie>
                              <Tooltip formatter={(v: number) => fmtRp(v)} />
                              <Legend wrapperStyle={{ fontSize: '11px' }} />
                            </RechartsPie>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>

                      {/* Bar Chart - Top Spending */}
                      <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-sm">Top 8 Belanja Terbesar</CardTitle></CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={barDataBelanja} layout="vertical" margin={{ left: 10 }}>
                              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                              <XAxis type="number" tickFormatter={(v: number) => `${(v/1000000).toFixed(0)}jt`} fontSize={10} />
                              <YAxis type="category" dataKey="name" width={130} fontSize={10} />
                              <Tooltip formatter={(v: number) => fmtRp(v)} />
                              <Bar dataKey="jumlah" fill="#10b981" radius={[0, 4, 4, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Alokasi per Standar - List View */}
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm">Distribusi Anggaran per Standar</CardTitle></CardHeader>
                      <CardContent className="space-y-3">
                        {budgetData.alokasiStandar.map((s, i) => {
                          const IconComp = STANDAR_ICONS[s.kode] || FileText
                          return (
                            <div key={i} className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: `${CHART_COLORS[i % CHART_COLORS.length]}20` }}>
                                <IconComp className="h-4 w-4" style={{ color: CHART_COLORS[i % CHART_COLORS.length] }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-medium truncate">{s.nama}</span>
                                  <span className="text-xs font-semibold ml-2 shrink-0">{fmtRp(s.jumlah)}</span>
                                </div>
                                <Progress value={s.persen} className="h-1.5" />
                                <span className="text-[10px] text-muted-foreground">{s.persen}% dari total</span>
                              </div>
                            </div>
                          )
                        })}
                      </CardContent>
                    </Card>
                  </>
                ) : (
                  <div className="text-center py-12 text-muted-foreground text-sm">Data anggaran belum tersedia</div>
                )}
              </div>
            </TabsContent>

            {/* === ALOKASI TAB === */}
            <TabsContent value="alokasi" className="flex-1 m-0 min-h-0 overflow-auto">
              <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
                {budgetLoading ? (
                  <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
                ) : budgetData ? (
                  <>
                    {/* Belanja Operasi vs Modal */}
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm">Perbandingan Belanja Operasi vs Modal</CardTitle></CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                          <RechartsPie>
                            <Pie data={belanjaTypeData} cx="50%" cy="50%" outerRadius={90} innerRadius={55} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent*100).toFixed(1)}%`}>
                              <Cell fill="#f59e0b" /><Cell fill="#3b82f6" />
                            </Pie>
                            <Tooltip formatter={(v: number) => fmtRp(v)} />
                          </RechartsPie>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    {/* Sumber Dana Detail */}
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm">Detail Sumber Dana</CardTitle></CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {budgetData.penerimaan.sumber.map((s, i) => (
                            <div key={i} className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-sm">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[10px] font-mono">{s.kode}</Badge>
                                <span>{s.nama}</span>
                              </div>
                              <span className="font-semibold">{fmtRp(s.jumlah)}</span>
                            </div>
                          ))}
                          <Separator />
                          <div className="flex items-center justify-between p-2 text-sm font-bold">
                            <span>Total Penerimaan</span>
                            <span className="text-emerald-600 dark:text-emerald-400">{fmtRp(budgetData.penerimaan.total)}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Belanja Terbesar */}
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm">Pos Belanja Terbesar</CardTitle></CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {budgetData.belanjaTerbesar.map((b, i) => (
                            <div key={i} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors">
                              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold text-primary">{i + 1}</div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{b.nama}</p>
                                <Badge variant="secondary" className="text-[10px]">{b.kategori}</Badge>
                              </div>
                              <span className="text-sm font-semibold shrink-0">{fmtRp(b.jumlah)}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </>
                ) : <div className="text-center py-12 text-muted-foreground text-sm">Data belum tersedia</div>}
              </div>
            </TabsContent>

            {/* === PENGADAAN TAB === */}
            <TabsContent value="pengadaan" className="flex-1 m-0 min-h-0 overflow-auto">
              <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
                {budgetData ? (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Cari barang pengadaan..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 h-9 text-sm" />
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">{filteredPengadaan.length} item pengadaan ditemukan</div>
                    <div className="space-y-2">
                      {filteredPengadaan.map((p, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                          <div className="h-8 w-8 rounded-md bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                            <ShoppingBag className="h-4 w-4 text-blue-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{p.nama}</p>
                            <Badge variant="outline" className="text-[10px] mt-0.5">{p.kategori}</Badge>
                          </div>
                          <span className="text-sm font-semibold shrink-0">{fmtRp(p.jumlah)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : budgetLoading ? <div className="space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}</div> : <div className="text-center py-12 text-muted-foreground text-sm">Data belum tersedia</div>}
              </div>
            </TabsContent>

            {/* === PEGAWAI TAB === */}
            <TabsContent value="pegawai" className="flex-1 m-0 min-h-0 overflow-auto">
              <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
                {budgetData ? (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Cari nama pegawai..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 h-9 text-sm" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Card className="border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30">
                        <CardContent className="pt-4 pb-3">
                          <p className="text-[11px] text-muted-foreground">Total Honor Pendidik</p>
                          <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{fmtRp(budgetData.pegawai.filter(p => p.jenis === 'pendidik').reduce((s, p) => s + p.honor, 0))}</p>
                          <p className="text-[11px] text-muted-foreground">{budgetData.pegawai.filter(p => p.jenis === 'pendidik').length} orang</p>
                        </CardContent>
                      </Card>
                      <Card className="border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-sky-50 dark:from-blue-950/30 dark:to-sky-950/30">
                        <CardContent className="pt-4 pb-3">
                          <p className="text-[11px] text-muted-foreground">Total Honor Tenaga Kependidikan</p>
                          <p className="text-lg font-bold text-blue-700 dark:text-blue-300">{fmtRp(budgetData.pegawai.filter(p => p.jenis !== 'pendidik').reduce((s, p) => s + p.honor, 0))}</p>
                          <p className="text-[11px] text-muted-foreground">{budgetData.pegawai.filter(p => p.jenis !== 'pendidik').length} orang</p>
                        </CardContent>
                      </Card>
                    </div>
                    <div className="space-y-2">
                      {filteredPegawai.map((p, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${p.jenis === 'pendidik' ? 'bg-amber-100 dark:bg-amber-900' : 'bg-blue-100 dark:bg-blue-900'}`}>
                            <Users className={`h-4 w-4 ${p.jenis === 'pendidik' ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{p.nama}</p>
                            <Badge variant="outline" className="text-[10px] mt-0.5">{p.jenis === 'pendidik' ? 'Pendidik' : 'Tenaga Kependidikan'}</Badge>
                          </div>
                          <span className="text-sm font-semibold shrink-0">{fmtRp(p.honor)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : budgetLoading ? <div className="space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}</div> : <div className="text-center py-12 text-muted-foreground text-sm">Data belum tersedia</div>}
              </div>
            </TabsContent>

            {/* === BKU TAB === */}
            <TabsContent value="bku" className="flex-1 m-0 min-h-0 overflow-auto">
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
                        <CardHeader className="pb-2"><CardTitle className="text-sm">Perbandingan Penerimaan vs Pengeluaran per Bulan</CardTitle></CardHeader>
                        <CardContent>
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
                            {/* Month Header - clickable */}
                            <button
                              className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/30 transition-colors"
                              onClick={() => setSelectedBkuMonth(isOpen ? -1 : mIdx)}
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
                              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {/* Expanded Transaction Detail */}
                            {isOpen && (
                              <div className="border-t">
                                {/* Sub-header info */}
                                <div className="px-4 py-2 bg-muted/30 flex items-center gap-4 text-[11px] text-muted-foreground flex-wrap">
                                  <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{month.namaSekolah}</span>
                                  <span>NPSN: {month.npsn}</span>
                                  {month.saldoAkhirBank > 0 && <span>Bank: {fmtRp(month.saldoAkhirBank)}</span>}
                                  {month.saldoAkhirTunai > 0 && <span>Tunai: {fmtRp(month.saldoAkhirTunai)}</span>}
                                </div>
                                {/* Search within transactions */}
                                <div className="px-4 pt-3">
                                  <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                    <Input placeholder="Cari transaksi..." value={bkuSearchTerm} onChange={e => setBkuSearchTerm(e.target.value)} className="pl-9 h-8 text-xs" />
                                  </div>
                                </div>
                                {/* Transaction Table */}
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
            </TabsContent>

            {/* === VIEWER TAB === */}
            <TabsContent value="viewer" className="flex-1 flex flex-col m-0 min-h-0">
              {loading ? (
                <div className="flex-1 flex items-center justify-center"><div className="text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-muted-foreground" /><p className="text-sm text-muted-foreground">Memuat dokumen...</p></div></div>
              ) : pdfData ? (
                <>
                  <div className="flex-1 overflow-auto bg-[#e8e8e8] dark:bg-[#1a1a1a] p-4 sm:p-6">
                    <div className="flex justify-center">
                      <div className="relative">
                        {!imageLoaded && <div className="absolute inset-0 flex items-center justify-center"><Skeleton className="w-[600px] h-[800px] rounded-md" /></div>}
                        <img src={pdfData.pageImages[currentPage - 1]} alt={`Halaman ${currentPage}`} className={`shadow-xl rounded-sm border border-black/10 transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`} style={{ maxWidth: `${zoom}%`, height: 'auto' }} onLoad={() => setImageLoaded(true)} />
                      </div>
                    </div>
                  </div>
                  <div className="border-t px-4 py-2 flex items-center justify-center gap-2 bg-card">
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1}><ChevronLeft className="h-3.5 w-3.5" /></Button>
                    <div className="flex items-center gap-1.5"><Input type="number" value={pageInputValue} onChange={(e) => handlePageInput(e.target.value)} className="w-12 h-7 text-center text-xs px-1" min={1} max={pdfData.pageCount} /><span className="text-xs text-muted-foreground">/ {pdfData.pageCount}</span></div>
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= pdfData.pageCount}><ChevronRight className="h-3.5 w-3.5" /></Button>
                    <Separator orientation="vertical" className="h-4 mx-1" />
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(Math.max(30, zoom - 15))}><ZoomOut className="h-3.5 w-3.5" /></Button>
                    <span className="text-[11px] text-muted-foreground w-10 text-center font-mono">{zoom}%</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(Math.min(250, zoom + 15))}><ZoomIn className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(100)}><RotateCcw className="h-3 w-3" /></Button>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center max-w-sm space-y-4">
                    <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto"><FileUp className="h-8 w-8 text-muted-foreground" /></div>
                    <h2 className="text-lg font-semibold">Unggah Dokumen RKAS</h2>
                    <p className="text-sm text-muted-foreground">Unggah file PDF RKAS/RAPBS untuk dianalisis</p>
                    <Button onClick={() => fileInputRef.current?.click()} className="gap-2"><Upload className="h-4 w-4" />Pilih File PDF</Button>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* === SUMMARY TAB === */}
            <TabsContent value="summary" className="flex-1 m-0 min-h-0 overflow-auto">
              <ScrollArea className="h-full">
                <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-4">
                  {summaryLoading ? (
                    <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
                  ) : summary ? (
                    <>
                      <Card className="overflow-hidden">
                        <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
                        <CardHeader className="pb-3">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge className="text-[10px] h-5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"><Landmark className="h-2.5 w-2.5 mr-1" />{summary.type}</Badge>
                            {summary.period && <Badge variant="outline" className="text-[10px] h-5"><Calendar className="h-2.5 w-2.5 mr-1" />{summary.period}</Badge>}
                          </div>
                          <CardTitle className="text-lg">{summary.title}</CardTitle>
                          {summary.entity && <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" />{summary.entity}</p>}
                        </CardHeader>
                        <CardContent><p className="text-sm leading-relaxed">{summary.summary}</p></CardContent>
                      </Card>
                      {summary.totalAmount && (
                        <Card className="border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30">
                          <CardContent className="pt-4 pb-4">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center"><FileSpreadsheet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /></div>
                              <div><p className="text-xs text-muted-foreground">Total Anggaran</p><p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">Rp {summary.totalAmount}</p></div>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                      {summary.keyPoints?.length > 0 && (
                        <Card>
                          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-amber-500" />Poin-Poin Penting</CardTitle></CardHeader>
                          <CardContent>
                            <ul className="space-y-2.5">
                              {summary.keyPoints.map((point, i) => (
                                <li key={i} className="flex gap-2.5 text-sm">
                                  <div className="mt-0.5 h-5 w-5 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center shrink-0"><CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" /></div>
                                  <span className="leading-relaxed">{point}</span>
                                </li>
                              ))}
                            </ul>
                          </CardContent>
                        </Card>
                      )}
                    </>
                  ) : <div className="text-center py-12 text-muted-foreground text-sm">Ringkasan belum tersedia</div>}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right: AI Chat Panel */}
        {chatPanelOpen && (
          <div className="w-[360px] border-l flex flex-col bg-card shrink-0">
            <div className="px-4 py-3 border-b">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm"><Bot className="h-4 w-4 text-white" /></div>
                <div><h3 className="text-sm font-semibold">AI Assistant</h3><p className="text-[11px] text-muted-foreground">Tanyakan tentang RKAS</p></div>
              </div>
            </div>
            <ScrollArea className="flex-1 px-4 py-3">
              {chatMessages.length === 0 ? (
                <div className="py-4 space-y-4">
                  <div className="text-center space-y-2">
                    <div className="h-10 w-10 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center mx-auto"><MessageSquare className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /></div>
                    <p className="text-xs text-muted-foreground">Tanyakan apa saja tentang dokumen RKAS Anda</p>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium px-1">Contoh pertanyaan</p>
                    {suggestedQuestions.map((q, i) => (
                      <button key={i} className="w-full text-left text-xs p-2.5 rounded-lg border bg-card hover:bg-muted/50 transition-colors" onClick={() => setChatInput(q)}>
                        <span className="text-muted-foreground mr-1">{i + 1}.</span> {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                      {msg.role === 'assistant' && <div className="h-6 w-6 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0 mt-0.5"><Bot className="h-3 w-3 text-white" /></div>}
                      <div className={`max-w-[85%] rounded-xl px-3 py-2 text-[13px] ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                        <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                      </div>
                      {msg.role === 'user' && <div className="h-6 w-6 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5"><User className="h-3 w-3" /></div>}
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="flex gap-2">
                      <div className="h-6 w-6 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0 mt-0.5"><Bot className="h-3 w-3 text-white" /></div>
                      <div className="bg-muted rounded-xl px-3 py-2.5">
                        <div className="flex gap-1">
                          <span className="h-1.5 w-1.5 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:0ms]" />
                          <span className="h-1.5 w-1.5 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:150ms]" />
                          <span className="h-1.5 w-1.5 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:300ms]" />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              )}
            </ScrollArea>
            <div className="p-3 border-t">
              <div className="flex gap-2">
                <Input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Tanyakan sesuatu..." disabled={chatLoading || !pdfData} className="text-sm h-9" />
                <Button size="icon" className="h-9 w-9 shrink-0 bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700" onClick={sendChat} disabled={chatLoading || !chatInput.trim() || !pdfData}>
                  {chatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t bg-card py-2 px-4 text-center text-[11px] text-muted-foreground">
        RKAS Reader AI — Analisis Anggaran Sekolah dengan AI
      </footer>
    </div>
  )
}
