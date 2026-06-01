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
  Receipt, FilePlus2, ArrowRight, Minus, Plus, FolderOpen, Trash2, ClipboardList,
  Scale,
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

interface RKASItem {
  noUrut: string; kodeRekening: string; kodeProgram: string; uraian: string;
  volume: string; satuan: string; tarifHarga: number; jumlah: number;
}
interface RKASStandar {
  kode: string; nama: string; items: RKASItem[]; total: number;
}
interface RKASPenerimaanItem { kode: string; nama: string; jumlah: number }
interface RKASMonth {
  fileName: string; bulan: string; tahun: string; sumberDana: string;
  namaSekolah: string; npsn: string; alamat: string; kabupaten: string; provinsi: string;
  totalPenerimaan: number; totalBelanja: number;
  penerimaan: RKASPenerimaanItem[]; standarList: RKASStandar[]; allItems: RKASItem[];
}

interface BKUPajakTransaction {
  tanggal: string; noKode: string; uraian: string;
  ppn: number; pph21: number; pph23: number; pph4: number; sspd: number;
  pengeluaran: number; saldo: number; jenisTransaksi: 'Terima' | 'Setor' | 'Lainnya';
}
interface BKUPajakJenisPajak {
  kode: string; nama: string; totalPenerimaan: number; totalPengeluaran: number; jumlahTransaksi: number;
}
interface BKUPajakMonth {
  fileName: string; bulan: string; tahun: string; sumberDana: string;
  namaSekolah: string; npsn: string; alamat: string; kabupaten: string; provinsi: string;
  transactions: BKUPajakTransaction[];
  totalPPN: number; totalPPh21: number; totalPPh23: number; totalPPh4: number; totalSSPD: number;
  totalPenerimaan: number; totalPengeluaran: number; saldoAkhir: number;
  jenisPajak: BKUPajakJenisPajak[]; tanggalTutup: string;
  kepalaSekolah: string; bendahara: string;
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

const MONTH_NAMES: Record<string, string> = {
  'JANUARI': 'Jan', 'FEBRUARI': 'Feb', 'MARET': 'Mar', 'APRIL': 'Apr',
  'MEI': 'Mei', 'JUNI': 'Jun', 'JULI': 'Jul', 'AGUSTUS': 'Agu',
  'SEPTEMBER': 'Sep', 'OKTOBER': 'Okt', 'NOVEMBER': 'Nov', 'DESEMBER': 'Des',
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
  const [rkasMonths, setRkasMonths] = useState<RKASMonth[]>([])
  const [rkasLoading, setRkasLoading] = useState(false)
  const [rkasUploading, setRkasUploading] = useState(false)
  const [selectedRkasMonth, setSelectedRkasMonth] = useState<number>(0)
  const [rkasSearchTerm, setRkasSearchTerm] = useState('')
  const [selectedRkasStandar, setSelectedRkasStandar] = useState<string>('all')
  const [bkuPajakMonths, setBkuPajakMonths] = useState<BKUPajakMonth[]>([])
  const [bkuPajakLoading, setBkuPajakLoading] = useState(false)
  const [bkuPajakUploading, setBkuPajakUploading] = useState(false)
  const [selectedBkuPajakMonth, setSelectedBkuPajakMonth] = useState<number>(0)
  const [bkuPajakSearchTerm, setBkuPajakSearchTerm] = useState('')
  const bkuFileInputRef = useRef<HTMLInputElement>(null)
  const rkasFileInputRef = useRef<HTMLInputElement>(null)
  const bkuPajakFileInputRef = useRef<HTMLInputElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadPDF('rapbs-all-output.pdf'); loadBKU(); loadRKAS(); loadBKUPajak() }, [])
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

  const loadRKAS = async () => {
    setRkasLoading(true)
    try {
      const res = await fetch('/api/pdf/rkas')
      if (res.ok) { const data = await res.json(); setRkasMonths(data.months || []) }
    } catch {} finally { setRkasLoading(false) }
  }

  const handleRKASUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files; if (!files || files.length === 0) return
    setRkasUploading(true)
    try {
      for (let i = 0; i < files.length; i++) {
        const formData = new FormData(); formData.append('file', files[i])
        const res = await fetch('/api/pdf/rkas', { method: 'POST', body: formData })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          setError(err.error || 'Gagal mengimpor file RKAS')
        }
      }
      await loadRKAS()
    } catch {} finally { setRkasUploading(false); if (rkasFileInputRef.current) rkasFileInputRef.current.value = '' }
  }

  const deleteRKASFile = async (fileName: string) => {
    try {
      await fetch('/api/pdf/rkas', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName }) })
      await loadRKAS()
    } catch {}
  }

  const deleteBKUFile = async (fileName: string) => {
    try {
      await fetch('/api/pdf/bku', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName }) })
      await loadBKU()
    } catch {}
  }

  const loadBKUPajak = async () => {
    setBkuPajakLoading(true)
    try {
      const res = await fetch('/api/pdf/bku-pajak')
      if (res.ok) { const data = await res.json(); setBkuPajakMonths(data.months || []) }
    } catch {} finally { setBkuPajakLoading(false) }
  }

  const handleBKUPajakUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files; if (!files || files.length === 0) return
    setBkuPajakUploading(true)
    try {
      for (let i = 0; i < files.length; i++) {
        const formData = new FormData(); formData.append('file', files[i])
        const res = await fetch('/api/pdf/bku-pajak', { method: 'POST', body: formData })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          setError(err.error || 'Gagal mengimpor file BKU Pajak')
        }
      }
      await loadBKUPajak()
    } catch {} finally { setBkuPajakUploading(false); if (bkuPajakFileInputRef.current) bkuPajakFileInputRef.current.value = '' }
  }

  const deleteBKUPajakFile = async (fileName: string) => {
    try {
      await fetch('/api/pdf/bku-pajak', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName }) })
      await loadBKUPajak()
    } catch {}
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

  // --- RKAS aggregated data for charts ---
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
    ? rkasMonths.map(m => ({ name: (MONTH_NAMES[m.bulan] || m.bulan.slice(0, 3)) + ' ' + m.tahun, Penerimaan: m.totalPenerimaan, Belanja: m.totalBelanja }))
    : []

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
                <TabsTrigger value="rkas" className="text-xs gap-1 px-2.5"><ClipboardList className="h-3 w-3" />RKAS</TabsTrigger>
                <TabsTrigger value="bku" className="text-xs gap-1 px-2.5"><Receipt className="h-3 w-3" />BKU</TabsTrigger>
                <TabsTrigger value="bku-pajak" className="text-xs gap-1 px-2.5"><Scale className="h-3 w-3" />BKU Pajak</TabsTrigger>
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

            {/* === RKAS TAB === */}
            <TabsContent value="rkas" className="flex-1 m-0 min-h-0 overflow-auto">
              <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4">
                {/* Upload area */}
                <div className="flex items-center gap-3 flex-wrap">
                  <input type="file" ref={rkasFileInputRef} onChange={handleRKASUpload} accept=".pdf" multiple className="hidden" />
                  <Button variant="outline" size="sm" onClick={() => rkasFileInputRef.current?.click()} disabled={rkasUploading} className="gap-2">
                    {rkasUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FilePlus2 className="h-3.5 w-3.5" />}
                    {rkasUploading ? 'Mengimpor...' : 'Import RKAS'}
                  </Button>
                  <span className="text-xs text-muted-foreground">{rkasMonths.length} bulan RKAS terimpor</span>
                  {rkasLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </div>

                {rkasMonths.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="py-12 text-center space-y-3">
                      <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mx-auto">
                        <ClipboardList className="h-7 w-7 text-muted-foreground" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold">Belum ada data RKAS</h3>
                        <p className="text-xs text-muted-foreground mt-1">Import file PDF RKAS per bulan untuk melihat rincian anggaran bulanan</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => rkasFileInputRef.current?.click()} className="gap-2">
                        <Upload className="h-3.5 w-3.5" /> Import File RKAS
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                          <p className="text-[10px] text-muted-foreground">Bulan Tercatat</p>
                          <p className="text-base font-bold">{rkasMonths.length} bulan</p>
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
                    {rkasMonths.length > 1 && (
                      <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-sm">Perbandingan Penerimaan vs Belanja per Bulan</CardTitle></CardHeader>
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
                        <CardHeader className="pb-2"><CardTitle className="text-sm">Distribusi Anggaran per Standar SNP (Semua Bulan)</CardTitle></CardHeader>
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

                    {/* Monthly Detail Sections */}
                    <div className="space-y-4">
                      {rkasMonths.map((month, mIdx) => {
                        const isOpen = selectedRkasMonth === mIdx
                        const filteredItems = selectedRkasStandar === 'all'
                          ? month.allItems
                          : month.standarList.find(s => s.kode === selectedRkasStandar)?.items || []
                        const searchFiltered = filteredItems.filter(item =>
                          !rkasSearchTerm || item.uraian.toLowerCase().includes(rkasSearchTerm.toLowerCase()) || item.kodeRekening.includes(rkasSearchTerm)
                        )
                        return (
                          <Card key={mIdx} className="overflow-hidden">
                            {/* Month Header - clickable */}
                            <div
                              role="button"
                              tabIndex={0}
                              className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/30 transition-colors cursor-pointer"
                              onClick={() => { setSelectedRkasMonth(isOpen ? -1 : mIdx); setSelectedRkasStandar('all'); setRkasSearchTerm('') }}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedRkasMonth(isOpen ? -1 : mIdx); setSelectedRkasStandar('all'); setRkasSearchTerm('') } }}
                            >
                              <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shrink-0">
                                <ClipboardList className="h-4 w-4 text-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold">{month.bulan ? (month.bulan.charAt(0) + month.bulan.slice(1).toLowerCase()) : 'Tahunan'} {month.tahun}</span>
                                  <Badge variant="outline" className="text-[10px]">{month.sumberDana}</Badge>
                                </div>
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

                            {/* Expanded Detail */}
                            {isOpen && (
                              <div className="border-t">
                                {/* Sub-header */}
                                <div className="px-4 py-2 bg-muted/30 flex items-center gap-4 text-[11px] text-muted-foreground flex-wrap">
                                  <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{month.namaSekolah}</span>
                                  <span>NPSN: {month.npsn}</span>
                                  {month.kabupaten && <span>{month.kabupaten}</span>}
                                </div>

                                {/* Standar Summary */}
                                <div className="px-4 py-3">
                                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                                    {month.standarList.map((s, si) => {
                                      const IconComp = STANDAR_ICONS[s.kode] || FileText
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

                                {/* Search & Filter */}
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

                                {/* Items Table */}
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
                                          <td className="py-1.5 px-1.5 max-w-[300px]">
                                            <span className="text-xs">{item.uraian}</span>
                                          </td>
                                          <td className="py-1.5 px-1.5 text-right">{item.volume || '-'}</td>
                                          <td className="py-1.5 px-1.5">{item.satuan || '-'}</td>
                                          <td className="py-1.5 px-1.5 text-right whitespace-nowrap">{item.tarifHarga > 0 ? fmtRp(item.tarifHarga) : '-'}</td>
                                          <td className="py-1.5 px-1.5 text-right whitespace-nowrap font-medium">{fmtRp(item.jumlah)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    <tfoot>
                                      <tr className="border-t-2 font-semibold">
                                        <td colSpan={6} className="py-2 px-1.5">
                                          {selectedRkasStandar === 'all' ? 'Total Belanja' : `Total Std ${selectedRkasStandar}`}
                                        </td>
                                        <td className="py-2 px-1.5 text-right whitespace-nowrap text-amber-600 dark:text-amber-400">
                                          {fmtRp(selectedRkasStandar === 'all'
                                            ? month.totalBelanja
                                            : month.standarList.find(s => s.kode === selectedRkasStandar)?.total || 0
                                          )}
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
                  </>
                )}
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

            {/* === BKU PAJAK TAB === */}
            <TabsContent value="bku-pajak" className="flex-1 m-0 min-h-0 overflow-auto">
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

                    {/* Tax Type Breakdown - Aggregated across all months */}
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
                        // Split into Terima and Setor for display
                        const terimaTx = filteredTransactions.filter(t => t.jenisTransaksi === 'Terima')
                        const setorTx = filteredTransactions.filter(t => t.jenisTransaksi === 'Setor')
                        const lainTx = filteredTransactions.filter(t => t.jenisTransaksi === 'Lainnya')

                        return (
                          <Card key={mIdx} className="overflow-hidden">
                            {/* Month Header */}
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

                            {/* Expanded Detail */}
                            {isOpen && (
                              <div className="border-t">
                                {/* Sub-header */}
                                <div className="px-4 py-2 bg-muted/30 flex items-center gap-4 text-[11px] text-muted-foreground flex-wrap">
                                  <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{month.namaSekolah}</span>
                                  <span>NPSN: {month.npsn}</span>
                                  {month.kabupaten && <span>{month.kabupaten}</span>}
                                </div>

                                {/* Tax Type Summary Cards */}
                                <div className="px-4 py-3">
                                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                                    <Card className="border-emerald-200 dark:border-emerald-800">
                                      <CardContent className="p-2">
                                        <p className="text-[10px] text-muted-foreground">PPN</p>
                                        <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">{fmtRp(month.totalPPN)}</p>
                                      </CardContent>
                                    </Card>
                                    <Card className="border-blue-200 dark:border-blue-800">
                                      <CardContent className="p-2">
                                        <p className="text-[10px] text-muted-foreground">PPh 21</p>
                                        <p className="text-xs font-bold text-blue-700 dark:text-blue-300">{fmtRp(month.totalPPh21)}</p>
                                      </CardContent>
                                    </Card>
                                    <Card className="border-amber-200 dark:border-amber-800">
                                      <CardContent className="p-2">
                                        <p className="text-[10px] text-muted-foreground">PPh 23</p>
                                        <p className="text-xs font-bold text-amber-700 dark:text-amber-300">{fmtRp(month.totalPPh23)}</p>
                                      </CardContent>
                                    </Card>
                                    <Card className="border-purple-200 dark:border-purple-800">
                                      <CardContent className="p-2">
                                        <p className="text-[10px] text-muted-foreground">PPh 4</p>
                                        <p className="text-xs font-bold text-purple-700 dark:text-purple-300">{fmtRp(month.totalPPh4)}</p>
                                      </CardContent>
                                    </Card>
                                    <Card className="border-rose-200 dark:border-rose-800">
                                      <CardContent className="p-2">
                                        <p className="text-[10px] text-muted-foreground">SSPD</p>
                                        <p className="text-xs font-bold text-rose-700 dark:text-rose-300">{fmtRp(month.totalSSPD)}</p>
                                      </CardContent>
                                    </Card>
                                  </div>
                                </div>

                                {/* Jenis Pajak mini cards */}
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

                                {/* Search */}
                                <div className="px-4 pb-3">
                                  <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                    <Input placeholder="Cari uraian, kode, atau tanggal..." value={bkuPajakSearchTerm} onChange={e => setBkuPajakSearchTerm(e.target.value)} className="pl-9 h-8 text-xs" />
                                  </div>
                                </div>

                                {/* Transactions Table */}
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
                                    {/* Totals row */}
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

                                {/* Summary row */}
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
