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
  Receipt, FilePlus2, ArrowRight, Minus, Plus, Trash2, ClipboardList,
  Scale, Package, Store, FileCheck, ClipboardPaste, ShieldCheck, Printer,
  Database, ChevronUp, ImagePlus, Image as ImageIcon,
  ArrowUp, ArrowDown, Bold, Italic, Type, GripVertical, AlignCenter,
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
  fileName: string; judul: string; bulan: string; tahun: string; tipe: 'bulanan' | 'tahunan'; sumberDana: string;
  namaSekolah: string; npsn: string; alamat: string; kabupaten: string; provinsi: string;
  totalPenerimaan: number; totalBelanja: number;
  penerimaan: RKASPenerimaanItem[]; standarList: RKASStandar[]; allItems: RKASItem[];
}

interface SPJItem {
  kodeRekening: string; kodeProgram: string; standarKode: string; standarNama: string;
  uraian: string; uraianBKU: string; anggaran: number; realisasi: number; selisih: number;
  persenRealisasi: number; status: 'lengkap' | 'sebagian' | 'belum' | 'lebih';
  jumlahItem: number;
}
interface SPJStandarGroup {
  kode: string; nama: string; anggaran: number; realisasi: number; selisih: number;
  persenRealisasi: number; items: SPJItem[];
}
interface SPJMonth {
  bulan: string; tahun: string; rkasFileName: string; bkuFileName: string;
  totalAnggaran: number; totalRealisasi: number; totalSelisih: number; persenRealisasi: number;
  standarGroups: SPJStandarGroup[];
  unmatchedBKU: { kodeRekening: string; kodeKegiatan: string; uraian: string; jumlah: number }[];
  unmatchedRKAS: { kodeRekening: string; kodeProgram: string; uraian: string; jumlah: number }[];
}
interface SPJSummary {
  bulanan: SPJMonth[];
  tahunan: { tahun: string; totalAnggaran: number; totalRealisasi: number; totalSelisih: number; persenRealisasi: number; standarGroups: SPJStandarGroup[] } | null;
}

type SPJDocType = 'surat-pesanan' | 'surat-balasan' | 'bast' | 'dokumen-perencanaan' | 'surat-hasil-pemeriksaan' | 'kuitansi-pembayaran'

interface KopRowData {
  id: string
  urutan: number
  teks: string
  fontFamily: string
  fontSize: number
  lineHeight: number
  bold: boolean
  italic: boolean
  uppercase: boolean
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

// --- Terbilang helper (convert number to Indonesian words) ---
const terbilang = (n: number): string => {
  if (n === 0) return 'Nol'
  const satuan = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas']
  if (n < 12) return satuan[n]
  if (n < 20) return terbilang(n - 10) + ' Belas'
  if (n < 100) return terbilang(Math.floor(n / 10)) + ' Puluh' + (n % 10 ? ' ' + terbilang(n % 10) : '')
  if (n < 200) return 'Seratus' + (n % 100 ? ' ' + terbilang(n % 100) : '')
  if (n < 1000) return terbilang(Math.floor(n / 100)) + ' Ratus' + (n % 100 ? ' ' + terbilang(n % 100) : '')
  if (n < 2000) return 'Seribu' + (n % 1000 ? ' ' + terbilang(n % 1000) : '')
  if (n < 1000000) return terbilang(Math.floor(n / 1000)) + ' Ribu' + (n % 1000 ? ' ' + terbilang(n % 1000) : '')
  if (n < 1000000000) return terbilang(Math.floor(n / 1000000)) + ' Juta' + (n % 1000000 ? ' ' + terbilang(n % 1000000) : '')
  if (n < 1000000000000) return terbilang(Math.floor(n / 1000000000)) + ' Miliar' + (n % 1000000000 ? ' ' + terbilang(n % 1000000000) : '')
  return terbilang(Math.floor(n / 1000000000000)) + ' Triliun' + (n % 1000000000000 ? ' ' + terbilang(n % 1000000000000) : '')
}

const normalizeKode = (kode: string): string => kode.replace(/[\s\n\r]/g, '').replace(/\.+$/, '').trim()
const compositeKey = (kodeProgram: string, kodeRekening: string): string =>
  `${normalizeKode(kodeProgram)}|${normalizeKode(kodeRekening)}`

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
  const [spjData, setSpjData] = useState<SPJSummary | null>(null)
  const [spjLoading, setSpjLoading] = useState(false)
  const [selectedSpjMonth, setSelectedSpjMonth] = useState<number>(-1) // -1 = tahunan view
  const [spjSearchTerm, setSpjSearchTerm] = useState('')
  const [spjSubTab, setSpjSubTab] = useState('master-toko')
  const [docSelectedBpuId, setDocSelectedBpuId] = useState<string>('')
  const [docSelectedBnuId, setDocSelectedBnuId] = useState<string>('')
  const [docType, setDocType] = useState<'bpu'|'bnu'>('bpu')
  const [masterDataCollapsed, setMasterDataCollapsed] = useState<Record<string, boolean>>({})
  const [toastMessages, setToastMessages] = useState<{ id: number; message: string; type: 'info' | 'warning' | 'success' }[]>([])

  // --- Master Toko states ---
  const [tokoList, setTokoList] = useState<any[]>([])
  const [tokoLoading, setTokoLoading] = useState(false)
  const [tokoDialog, setTokoDialog] = useState<{open: boolean, mode: 'add'|'edit', data: any}>({open: false, mode: 'add', data: {namaToko: '', direktur: '', noHp: '', alamat: '', kategori: ''}})
  const [tokoSearch, setTokoSearch] = useState('')

  // --- Data Sekolah states ---
  const [sekolahData, setSekolahData] = useState<any>({namaSekolah:'', npsn:'', alamat:'', kabupaten:'', provinsi:'', kepalaSekolah:'', nipKepala:'', bendahara:'', nipBendahara:'', pengurusBarang:'', nipPengurus:'', penerimaBarang:'', nipPenerima:'', logoKiriUrl:'', logoKananUrl:'', logoKiriLebar:2.5, logoKiriTinggi:3, logoKananLebar:2.5, logoKananTinggi:3, garisBawahStyle:'single-thick', garisBawahJarak:4})
  const [sekolahLoading, setSekolahLoading] = useState(false)
  const [sekolahSaving, setSekolahSaving] = useState(false)
  const [logoUploading, setLogoUploading] = useState<'kiri'|'kanan'|null>(null)
  const logoKiriInputRef = useRef<HTMLInputElement>(null)
  const logoKananInputRef = useRef<HTMLInputElement>(null)

  // --- KOP Row states ---
  const [kopRows, setKopRows] = useState<KopRowData[]>([])
  const [kopRowLoading, setKopRowLoading] = useState(false)
  const [kopRowSaving, setKopRowSaving] = useState<string|null>(null) // id of row being saved

  // --- Master BPU states ---
  const [bpuList, setBpuList] = useState<any[]>([])
  const [bpuLoading, setBpuLoading] = useState(false)
  const [bpuSyncing, setBpuSyncing] = useState(false)
  const [selectedBpu, setSelectedBpu] = useState<string|null>(null)
  const [bpuEditFields, setBpuEditFields] = useState<Record<string, {noPesanan: string, tglPesan: string, tokoId: string}>>({})

  // --- Master BNU states ---
  const [bnuList, setBnuList] = useState<any[]>([])
  const [bnuLoading, setBnuLoading] = useState(false)
  const [bnuSyncing, setBnuSyncing] = useState(false)
  const [selectedBnu, setSelectedBnu] = useState<string|null>(null)
  const [bnuEditFields, setBnuEditFields] = useState<Record<string, {noPesanan: string, tglPesan: string, tokoId: string}>>({})

  const bkuFileInputRef = useRef<HTMLInputElement>(null)
  const rkasFileInputRef = useRef<HTMLInputElement>(null)
  const bkuPajakFileInputRef = useRef<HTMLInputElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadAvailablePDF(); loadBKU(); loadRKAS(); loadBKUPajak(); loadSPJ(); loadToko(); loadSekolah(); loadKopRows(); loadBPU(); loadBNU() }, [])
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatMessages])
  useEffect(() => { setPageInputValue(String(currentPage)) }, [currentPage])
  useEffect(() => { setImageLoaded(false) }, [currentPage])

  const loadAvailablePDF = async () => {
    setError(null) // Always clear stale errors on mount
    setLoading(true)
    try {
      // First check what PDFs are available
      const listRes = await fetch('/api/pdf/info')
      if (listRes.ok) {
        const listData = await listRes.json()
        const files: string[] = listData.files || []
        // Filter out BKU/RKAS/BKU Pajak files - those are handled by their own tabs
        const generalPdfs = files.filter(f => {
          const lower = f.toLowerCase()
          return !lower.includes('bku') && !lower.includes('rkas') && !lower.includes('rapbs')
        })
        if (generalPdfs.length > 0) {
          await loadPDF(generalPdfs[0], true)
        }
      }
    } catch {
      // Silently ignore - no PDF available is a valid state
    } finally {
      setLoading(false)
    }
  }

  const loadPDF = async (fileName: string, skipError = false) => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/pdf/info?file=${encodeURIComponent(fileName)}`)
      if (res.status === 404) {
        if (!skipError) setError('File PDF tidak ditemukan')
        return
      }
      if (!res.ok) {
        if (skipError) return // Don't throw on auto-load failures
        throw new Error('Gagal memuat PDF')
      }
      const data = await res.json()
      setPdfData(data); setCurrentPage(1); setZoom(100)
      generateSummary(fileName)
      extractBudget(fileName)
    } catch (err: any) {
      if (!skipError) setError(err.message)
    } finally { setLoading(false) }
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
        const res = await fetch('/api/pdf/bku', { method: 'POST', body: formData })
        if (res.ok) {
          const result = await res.json()
          if (result.replaced) {
            addToast(`BKU ${result.data?.bulan || ''} ${result.data?.tahun || ''} sudah ada. File lama diganti dengan yang baru.`, 'warning')
          } else {
            addToast(`BKU berhasil diimpor.`, 'success')
          }
        }
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

  const addToast = useCallback((message: string, type: 'info' | 'warning' | 'success' = 'info') => {
    const id = Date.now() + Math.random()
    setToastMessages(prev => [...prev, { id, message, type }])
    setTimeout(() => setToastMessages(prev => prev.filter(t => t.id !== id)), 5000)
  }, [])



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
        } else {
          const result = await res.json()
          if (result.replaced) {
            const tipeLabel = result.tipe === 'tahunan' ? 'Tahunan' : 'Bulanan'
            addToast(`RKAS ${tipeLabel} ${result.tipe === 'tahunan' ? result.data?.tahun || '' : (result.data?.bulan || '') + ' ' + (result.data?.tahun || '')} sudah ada. File lama diganti dengan yang baru.`, 'warning')
          } else {
            const tipeLabel = result.tipe === 'tahunan' ? 'Tahunan' : 'Bulanan'
            addToast(`RKAS ${tipeLabel} berhasil diimpor.`, 'success')
          }
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
        } else {
          const result = await res.json()
          if (result.replaced) {
            addToast(`BKU Pajak ${result.data?.bulan || ''} ${result.data?.tahun || ''} sudah ada. File lama diganti dengan yang baru.`, 'warning')
          } else {
            addToast(`BKU Pajak berhasil diimpor.`, 'success')
          }
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

  const loadSPJ = async () => {
    setSpjLoading(true)
    try {
      const res = await fetch('/api/pdf/spj')
      if (res.ok) { const data = await res.json(); setSpjData(data) }
    } catch {} finally { setSpjLoading(false) }
  }

  const loadToko = async () => {
    setTokoLoading(true)
    try {
      const res = await fetch('/api/master/toko')
      if (res.ok) { const data = await res.json(); setTokoList(data.data || []) }
    } catch {} finally { setTokoLoading(false) }
  }

  const saveToko = async (toko: any) => {
    try {
      const res = toko.id
        ? await fetch('/api/master/toko', { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(toko) })
        : await fetch('/api/master/toko', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(toko) })
      if (res.ok) { await loadToko(); setTokoDialog({open: false, mode: 'add', data: {namaToko:'', direktur:'', noHp:'', alamat:'', kategori:''}}); addToast(toko.id ? 'Toko berhasil diperbarui' : 'Toko berhasil ditambahkan', 'success') }
      else { const err = await res.json(); addToast(err.error || 'Gagal menyimpan toko', 'warning') }
    } catch { addToast('Gagal menyimpan toko', 'warning') }
  }

  const deleteToko = async (id: string) => {
    try {
      const res = await fetch('/api/master/toko', { method: 'DELETE', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id}) })
      if (res.ok) { await loadToko(); addToast('Toko berhasil dihapus', 'success') }
      else { const err = await res.json(); addToast(err.error || 'Gagal menghapus toko', 'warning') }
    } catch { addToast('Gagal menghapus toko', 'warning') }
  }

  const loadSekolah = async () => {
    setSekolahLoading(true)
    try {
      const res = await fetch('/api/master/sekolah')
      if (res.ok) { const data = await res.json(); if (data.data) setSekolahData(data.data) }
    } catch {} finally { setSekolahLoading(false) }
  }

  const saveSekolah = async () => {
    setSekolahSaving(true)
    try {
      const res = await fetch('/api/master/sekolah', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(sekolahData) })
      if (res.ok) { addToast('Data sekolah berhasil disimpan', 'success') }
      else { addToast('Gagal menyimpan data sekolah', 'warning') }
    } catch { addToast('Gagal menyimpan data sekolah', 'warning') }
    finally { setSekolahSaving(false) }
  }

  // --- KOP Row functions ---
  const loadKopRows = async () => {
    setKopRowLoading(true)
    try {
      const res = await fetch('/api/master/sekolah/kop-row')
      if (res.ok) {
        const data = await res.json()
        setKopRows(data.data || [])
      }
    } catch {} finally { setKopRowLoading(false) }
  }

  const addKopRow = async () => {
    try {
      const res = await fetch('/api/master/sekolah/kop-row', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teks: '',
          fontFamily: 'Times New Roman',
          fontSize: 12,
          lineHeight: 1.3,
          bold: false,
          italic: false,
          uppercase: false,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setKopRows(prev => [...prev, data.data])
        addToast('Baris KOP ditambahkan', 'success')
      }
    } catch { addToast('Gagal menambah baris KOP', 'warning') }
  }

  // Debounce timers for KOP row updates
  const kopRowDebounceRef = useRef<Record<string, NodeJS.Timeout>>({})
  const kopRowPendingRef = useRef<Record<string, Partial<KopRowData>>>({})

  const updateKopRow = (id: string, updates: Partial<KopRowData>) => {
    // Optimistic update
    setKopRows(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r))

    // Accumulate pending updates
    kopRowPendingRef.current[id] = { ...kopRowPendingRef.current[id], ...updates }

    // Debounced save
    if (kopRowDebounceRef.current[id]) {
      clearTimeout(kopRowDebounceRef.current[id])
    }
    kopRowDebounceRef.current[id] = setTimeout(async () => {
      const pendingUpdates = { ...kopRowPendingRef.current[id] }
      delete kopRowPendingRef.current[id]
      setKopRowSaving(id)
      try {
        const res = await fetch('/api/master/sekolah/kop-row', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, ...pendingUpdates }),
        })
        if (res.ok) {
          const data = await res.json()
          setKopRows(prev => prev.map(r => r.id === id ? data.data : r))
        } else {
          await loadKopRows()
          addToast('Gagal menyimpan perubahan', 'warning')
        }
      } catch {
        await loadKopRows()
        addToast('Gagal menyimpan perubahan', 'warning')
      } finally { setKopRowSaving(null) }
    }, 600)
  }

  const deleteKopRow = async (id: string) => {
    try {
      const res = await fetch(`/api/master/sekolah/kop-row?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        setKopRows(prev => prev.filter(r => r.id !== id))
        addToast('Baris KOP dihapus', 'success')
      }
    } catch { addToast('Gagal menghapus baris KOP', 'warning') }
  }

  const moveKopRow = async (id: string, direction: 'up' | 'down') => {
    const sorted = [...kopRows].sort((a, b) => a.urutan - b.urutan)
    const idx = sorted.findIndex(r => r.id === id)
    if (direction === 'up' && idx <= 0) return
    if (direction === 'down' && idx >= sorted.length - 1) return

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    const temp = sorted[idx].urutan
    sorted[idx].urutan = sorted[swapIdx].urutan
    sorted[swapIdx].urutan = temp

    // Optimistic
    setKopRows([...sorted])

    // Save reordering
    try {
      await fetch('/api/master/sekolah/kop-row', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders: sorted.map(r => ({ id: r.id, urutan: r.urutan })) }),
      })
    } catch { addToast('Gagal mengubah urutan', 'warning') }
  }

  // Logo upload handler
  const handleLogoUpload = async (posisi: 'kiri' | 'kanan', file: File) => {
    if (file.size > 4 * 1024 * 1024) {
      addToast('Ukuran file maksimal 4 MB', 'warning')
      return
    }
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']
    if (!allowedTypes.includes(file.type)) {
      addToast('Format file tidak didukung. Gunakan PNG, JPG, WebP, atau SVG.', 'warning')
      return
    }
    setLogoUploading(posisi)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('posisi', posisi)
      const res = await fetch('/api/master/sekolah/logo', { method: 'POST', body: formData })
      if (res.ok) {
        const data = await res.json()
        setSekolahData((prev: any) => ({
          ...prev,
          [posisi === 'kiri' ? 'logoKiriUrl' : 'logoKananUrl']: data.dataUrl,
        }))
        addToast(`Logo ${posisi} berhasil diupload`, 'success')
      } else {
        const err = await res.json()
        addToast(err.error || 'Gagal mengupload logo', 'warning')
      }
    } catch { addToast('Gagal mengupload logo', 'warning') }
    finally { setLogoUploading(null) }
  }

  // Logo delete handler
  const handleLogoDelete = async (posisi: 'kiri' | 'kanan') => {
    try {
      const res = await fetch(`/api/master/sekolah/logo?posisi=${posisi}`, { method: 'DELETE' })
      if (res.ok) {
        setSekolahData((prev: any) => ({
          ...prev,
          [posisi === 'kiri' ? 'logoKiriUrl' : 'logoKananUrl']: '',
        }))
        addToast(`Logo ${posisi} berhasil dihapus`, 'success')
      }
    } catch { addToast('Gagal menghapus logo', 'warning') }
  }

  const loadBPU = async () => {
    setBpuLoading(true)
    try {
      const res = await fetch('/api/master/bpu')
      if (res.ok) { const data = await res.json(); setBpuList(data.data || []) }
    } catch {} finally { setBpuLoading(false) }
  }

  const syncBPU = async () => {
    setBpuSyncing(true)
    try {
      const res = await fetch('/api/master/bpu', { method: 'PATCH' })
      if (res.ok) {
        const data = await res.json()
        addToast(`BPU disinkronkan: ${data.summary?.created || 0} baru, ${data.summary?.updated || 0} diperbarui`, 'success')
        await loadBPU()
      }
    } catch { addToast('Gagal sinkronkan BPU', 'warning') }
    finally { setBpuSyncing(false) }
  }

  const updateBPU = async (id: string, fields: {noPesanan?: string, tglPesan?: string, tokoId?: string}) => {
    try {
      const res = await fetch('/api/master/bpu', { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id, ...fields}) })
      if (res.ok) { await loadBPU() }
    } catch {}
  }

  const deleteBPU = async (id: string) => {
    try {
      const res = await fetch('/api/master/bpu', { method: 'DELETE', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id}) })
      if (res.ok) { addToast('BPU berhasil dihapus', 'success'); setSelectedBpu(null); await loadBPU() }
    } catch {}
  }

  const updateBPItemHargaToko2 = async (bpuId: string, items: any[]) => {
    try {
      const res = await fetch('/api/master/bpu', { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id: bpuId, items}) })
      if (res.ok) { await loadBPU() }
    } catch {}
  }

  const loadBNU = async () => {
    setBnuLoading(true)
    try {
      const res = await fetch('/api/master/bnu')
      if (res.ok) { const data = await res.json(); setBnuList(data.data || []) }
    } catch {} finally { setBnuLoading(false) }
  }

  const syncBNU = async () => {
    setBnuSyncing(true)
    try {
      const res = await fetch('/api/master/bnu', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action: 'sync'}) })
      if (res.ok) {
        const data = await res.json()
        addToast(`BNU disinkronkan: ${data.synced || 0} data`, 'success')
        await loadBNU()
      }
    } catch { addToast('Gagal sinkronkan BNU', 'warning') }
    finally { setBnuSyncing(false) }
  }

  const updateBNU = async (id: string, fields: {noPesanan?: string, tglPesan?: string, tokoId?: string}) => {
    try {
      const res = await fetch('/api/master/bnu', { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id, ...fields}) })
      if (res.ok) { await loadBNU() }
    } catch {}
  }

  const deleteBNU = async (id: string) => {
    try {
      const res = await fetch('/api/master/bnu', { method: 'DELETE', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id}) })
      if (res.ok) { addToast('BNU berhasil dihapus', 'success'); setSelectedBnu(null); await loadBNU() }
    } catch {}
  }

  const updateBNUItemHargaToko2 = async (bnuId: string, items: any[]) => {
    try {
      const res = await fetch('/api/master/bnu', { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id: bnuId, items}) })
      if (res.ok) { await loadBNU() }
    } catch {}
  }

  // Reload SPJ when RKAS or BKU data changes
  useEffect(() => {
    if (rkasMonths.length > 0 || bkuMonths.length > 0) { loadSPJ() }
  }, [rkasMonths, bkuMonths])


  const handlePrintDoc = (docType: string) => {
    const printArea = document.getElementById('print-area')
    const docContent = document.getElementById(`doc-content-${docType}`)
    if (printArea && docContent) {
      // Clone only the document content, strip wrapper divs
      const clone = docContent.cloneNode(true) as HTMLElement
      clone.removeAttribute('id')
      clone.classList.remove('shadow-lg')
      clone.style.boxShadow = 'none'
      printArea.innerHTML = ''
      printArea.appendChild(clone)
      // Remove page title so browser doesn't print header/footer text
      const originalTitle = document.title
      document.title = ' '
      window.print()
      // Restore title
      document.title = originalTitle
      printArea.innerHTML = ''
    }
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

  // --- Budget chart data (fallback from AI extraction) ---
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

  // --- RKAS separated by tipe ---
  const rkasBulanan = rkasMonths.filter(m => m.tipe === 'bulanan')
  const rkasTahunan = rkasMonths.filter(m => m.tipe === 'tahunan')

  // --- Helper: normalize month name for matching ---
  const normalizeMonth = (m: string): string => m.toUpperCase().trim()

  // --- Combined Dashboard Analytics ---
  // Primary: RKAS Tahunan (annual budget plan)
  const tahunanData = rkasTahunan.length > 0 ? rkasTahunan[0] : null
  const danaBOS = tahunanData?.totalPenerimaan || 0
  const anggaranBelanja = tahunanData?.totalBelanja || 0

  // BKU: actual cash flow
  const totalRealisasi = bkuMonths.reduce((s, m) => s + m.totalPengeluaran, 0)
  const totalPenerimaanAktual = bkuMonths.reduce((s, m) => s + m.totalPenerimaan, 0)
  const sisaDana = danaBOS - totalRealisasi
  const persenSerapan = danaBOS > 0 ? Math.round((totalRealisasi / danaBOS) * 100) : 0

  // BKU Pajak: tax totals
  const totalPajak = bkuPajakMonths.reduce((s, m) => s + m.totalPengeluaran, 0)
  const pajakDetail = {
    ppn: bkuPajakMonths.reduce((s, m) => s + m.totalPPN, 0),
    pph21: bkuPajakMonths.reduce((s, m) => s + m.totalPPh21, 0),
    pph23: bkuPajakMonths.reduce((s, m) => s + m.totalPPh23, 0),
    pph4: bkuPajakMonths.reduce((s, m) => s + m.totalPPh4, 0),
    sspd: bkuPajakMonths.reduce((s, m) => s + m.totalSSPD, 0),
  }

  // Last BKU saldo
  const lastBkuSaldo = bkuMonths.length > 0 ? bkuMonths[bkuMonths.length - 1].saldoAkhir : 0

  // Monthly comparison: RKAS Bulanan (plan) vs BKU (actual)
  const monthlyComparison = (() => {
    const months = ['JANUARI','FEBRUARI','MARET','APRIL','MEI','JUNI','JULI','AGUSTUS','SEPTEMBER','OKTOBER','NOVEMBER','DESEMBER']
    return months.map((bulan, idx) => {
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

  // Cash flow trend data
  const cashFlowData = bkuMonths.map(m => ({
    name: MONTH_NAMES[normalizeMonth(m.bulan)] || m.bulan.slice(0, 3),
    Penerimaan: m.totalPenerimaan,
    Pengeluaran: m.totalPengeluaran,
    Saldo: m.saldoAkhir,
  }))

  // RKAS Tahunan standar breakdown for dashboard
  const tahunanStandarData = tahunanData?.standarList.map(s => ({
    kode: s.kode,
    name: s.nama,
    value: s.total,
    persen: anggaranBelanja > 0 ? Math.round((s.total / anggaranBelanja) * 100) : 0,
  })) || []

  // Data availability check
  const hasAnyData = rkasMonths.length > 0 || bkuMonths.length > 0 || bkuPajakMonths.length > 0 || !!budgetData

  // --- RKAS aggregated data for charts (used in RKAS tab) ---
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

  // --- Helper: render garis bawah KOP based on style ---
  const renderGarisBawah = (style: string) => {
    switch (style) {
      case 'single-thin':
        return <div style={{ borderBottom: '1px solid #000' }} />
      case 'single-thick':
        return <div style={{ borderBottom: '2px solid #000' }} />
      case 'double':
        return (
          <div>
            <div style={{ borderBottom: '1px solid #000' }} />
            <div style={{ margin: '2px 0' }} />
            <div style={{ borderBottom: '1px solid #000' }} />
          </div>
        )
      case 'double-thick-thin':
        return (
          <div>
            <div style={{ borderBottom: '2px solid #000' }} />
            <div style={{ margin: '2px 0' }} />
            <div style={{ borderBottom: '1px solid #000' }} />
          </div>
        )
      case 'double-thin-thick':
        return (
          <div>
            <div style={{ borderBottom: '1px solid #000' }} />
            <div style={{ margin: '2px 0' }} />
            <div style={{ borderBottom: '2px solid #000' }} />
          </div>
        )
      case 'none':
      default:
        return null
    }
  }

  // --- Helper: determine which logos are present ---
  const hasLogoKiri = !!sekolahData.logoKiriUrl
  const hasLogoKanan = !!sekolahData.logoKananUrl
  const logoCount = (hasLogoKiri ? 1 : 0) + (hasLogoKanan ? 1 : 0)

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Toast Notifications */}
      {toastMessages.length > 0 && (
        <div className="fixed top-16 right-4 z-[60] flex flex-col gap-2 max-w-sm">
          {toastMessages.map(toast => (
            <div key={toast.id} className={`px-4 py-3 rounded-lg shadow-lg border text-sm flex items-start gap-2 animate-in slide-in-from-right ${
              toast.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/80 dark:border-amber-800 dark:text-amber-200' :
              toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/80 dark:border-emerald-800 dark:text-emerald-200' :
              'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/80 dark:border-blue-800 dark:text-blue-200'
            }`}>
              {toast.type === 'warning' && <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />}
              {toast.type === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />}
              {toast.type === 'info' && <Info className="h-4 w-4 shrink-0 mt-0.5" />}
              <span>{toast.message}</span>
            </div>
          ))}
        </div>
      )}
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
                <TabsTrigger value="spj" className="text-xs gap-1 px-2.5"><FileSpreadsheet className="h-3 w-3" />SPJ</TabsTrigger>
                <TabsTrigger value="bku" className="text-xs gap-1 px-2.5"><Receipt className="h-3 w-3" />BKU</TabsTrigger>
                <TabsTrigger value="bku-pajak" className="text-xs gap-1 px-2.5"><Scale className="h-3 w-3" />BKU Pajak</TabsTrigger>
                <TabsTrigger value="viewer" className="text-xs gap-1 px-2.5"><FileText className="h-3 w-3" />Dokumen</TabsTrigger>
                <TabsTrigger value="summary" className="text-xs gap-1 px-2.5"><Sparkles className="h-3 w-3" />Ringkasan</TabsTrigger>
              </TabsList>
            </div>

            {/* === DASHBOARD TAB === */}
            <TabsContent value="dashboard" className="flex-1 m-0 min-h-0 overflow-auto">
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
                      {/* Cash Flow Trend */}
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

                      {/* Standar SNP Distribution - from RKAS Tahunan or fallback */}
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
                      {/* Standar SNP Distribution List */}
                      {(tahunanStandarData.length > 0 ? tahunanStandarData : (budgetData?.alokasiStandar || [])).length > 0 && (
                        <Card>
                          <CardHeader className="pb-2"><CardTitle className="text-sm">Distribusi Anggaran per Standar</CardTitle></CardHeader>
                          <CardContent className="space-y-2.5">
                            {(tahunanStandarData.length > 0 ? tahunanStandarData : (budgetData?.alokasiStandar.map(s => ({ kode: s.kode, name: s.nama, value: s.jumlah, persen: s.persen })) || [])).map((s, i) => {
                              const IconComp = STANDAR_ICONS[s.kode] || FileText
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

                      {/* Tax Summary */}
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

                    {/* ===== Section 6: School Info (from any available source) ===== */}
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
                  <span className="text-xs text-muted-foreground">
                    {rkasBulanan.length} bulanan, {rkasTahunan.length} tahunan
                  </span>
                  {rkasLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  <span className="text-[10px] text-muted-foreground">
                    Otomatis terdeteksi: judul "Perbulan" → Bulanan, judul "RKAS" → Tahunan
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
                                {/* Month Header - clickable */}
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

                                {/* Expanded Detail */}
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
            </TabsContent>

            {/* === SPJ TAB === */}
            <TabsContent value="spj" className="flex-1 m-0 min-h-0 overflow-auto">
              <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4">
                {/* ===== Sub-Tab Navigation ===== */}
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
                    <Button
                      key={tab.key}
                      variant={spjSubTab === tab.key ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 text-[11px] gap-1 shrink-0"
                      onClick={() => setSpjSubTab(tab.key)}
                    >
                      <tab.icon className="h-3 w-3" />
                      {tab.label}
                    </Button>
                  ))}
                </div>

                {/* ===== MASTER TOKO SUB-TAB ===== */}
                {spjSubTab === 'master-toko' && (
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold">Master Toko</h3>
                        <p className="text-[11px] text-muted-foreground">Kelola database toko/penyedia</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <Input className="h-7 text-[11px] pl-7 w-48" placeholder="Cari toko..." value={tokoSearch} onChange={e => setTokoSearch(e.target.value)} />
                        </div>
                        <Button size="sm" className="h-7 text-[11px] gap-1" onClick={() => setTokoDialog({open: true, mode: 'add', data: {namaToko: '', direktur: '', noHp: '', alamat: '', kategori: ''}})}>
                          <Plus className="h-3 w-3" /> Tambah Toko
                        </Button>
                      </div>
                    </div>

                    {tokoLoading ? (
                      <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
                    ) : tokoList.length === 0 ? (
                      <Card className="border-dashed">
                        <CardContent className="py-12 text-center">
                          <Store className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                          <h3 className="text-sm font-semibold">Belum ada data toko</h3>
                          <p className="text-xs text-muted-foreground mt-1">Tambahkan toko/penyedia untuk keperluan SPJ</p>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="grid gap-3">
                        {tokoList
                          .filter(t => !tokoSearch || t.namaToko.toLowerCase().includes(tokoSearch.toLowerCase()) || t.direktur.toLowerCase().includes(tokoSearch.toLowerCase()))
                          .map(toko => (
                          <Card key={toko.id} className="overflow-hidden">
                            <CardContent className="py-3 px-4">
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold truncate">{toko.namaToko}</span>
                                    {toko.kategori && <Badge variant="outline" className="text-[9px] h-4">{toko.kategori}</Badge>}
                                  </div>
                                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground">
                                    {toko.direktur && <span>Direktur: {toko.direktur}</span>}
                                    {toko.noHp && <span>HP: {toko.noHp}</span>}
                                  </div>
                                  {toko.alamat && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{toko.alamat}</p>}
                                </div>
                                <div className="flex items-center gap-1 ml-2">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setTokoDialog({open: true, mode: 'edit', data: toko})}>
                                    <FilePlus2 className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteToko(toko.id)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}

                    {/* Toko Dialog */}
                    {tokoDialog.open && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                        <Card className="w-full max-w-md mx-4">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-sm">{tokoDialog.mode === 'add' ? 'Tambah Toko' : 'Edit Toko'}</CardTitle>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setTokoDialog(prev => ({...prev, open: false}))}><X className="h-3.5 w-3.5" /></Button>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div>
                              <label className="text-[11px] font-medium text-muted-foreground">Nama Toko *</label>
                              <Input className="h-8 text-xs mt-1" value={tokoDialog.data.namaToko} onChange={e => setTokoDialog(prev => ({...prev, data: {...prev.data, namaToko: e.target.value}}))} placeholder="Nama toko/penyedia" />
                            </div>
                            <div>
                              <label className="text-[11px] font-medium text-muted-foreground">Direktur/Pengusaha</label>
                              <Input className="h-8 text-xs mt-1" value={tokoDialog.data.direktur} onChange={e => setTokoDialog(prev => ({...prev, data: {...prev.data, direktur: e.target.value}}))} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-[11px] font-medium text-muted-foreground">No. HP</label>
                                <Input className="h-8 text-xs mt-1" value={tokoDialog.data.noHp} onChange={e => setTokoDialog(prev => ({...prev, data: {...prev.data, noHp: e.target.value}}))} />
                              </div>
                              <div>
                                <label className="text-[11px] font-medium text-muted-foreground">Kategori</label>
                                <Input className="h-8 text-xs mt-1" value={tokoDialog.data.kategori} onChange={e => setTokoDialog(prev => ({...prev, data: {...prev.data, kategori: e.target.value}}))} placeholder="Barang/Jasa" />
                              </div>
                            </div>
                            <div>
                              <label className="text-[11px] font-medium text-muted-foreground">Alamat</label>
                              <textarea className="w-full mt-1 rounded-md border border-input bg-transparent px-3 py-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[60px]" value={tokoDialog.data.alamat} onChange={e => setTokoDialog(prev => ({...prev, data: {...prev.data, alamat: e.target.value}}))} />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setTokoDialog(prev => ({...prev, open: false}))}>Batal</Button>
                              <Button size="sm" className="h-7 text-xs" onClick={() => saveToko(tokoDialog.data)} disabled={!tokoDialog.data.namaToko.trim()}>
                                {tokoDialog.mode === 'add' ? 'Tambah' : 'Simpan'}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </div>
                )}

                {/* ===== DATA SEKOLAH SUB-TAB ===== */}
                {spjSubTab === 'data-sekolah' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold">Data Sekolah</h3>
                        <p className="text-[11px] text-muted-foreground">Informasi sekolah untuk keperluan dokumen SPJ</p>
                      </div>
                      <Button size="sm" className="h-7 text-[11px] gap-1" onClick={saveSekolah} disabled={sekolahSaving}>
                        {sekolahSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                        Simpan Semua
                      </Button>
                    </div>

                    {sekolahLoading ? (
                      <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
                    ) : (
                      <div className="grid gap-4">
                        {/* ===== KOP SEKOLAH EDITOR ===== */}
                        <Card>
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                              <div>
                                <CardTitle className="text-xs flex items-center gap-1.5">
                                  <AlignCenter className="h-3.5 w-3.5" />
                                  KOP Sekolah
                                </CardTitle>
                                <p className="text-[10px] text-muted-foreground mt-0.5">Atur logo, ukuran, dan baris teks untuk kop surat dokumen SPJ</p>
                              </div>
                              <Button size="sm" className="h-7 text-[11px] gap-1" onClick={saveSekolah} disabled={sekolahSaving}>
                                {sekolahSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                                Simpan Ukuran
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {/* --- Logo Section --- */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {/* Logo Kiri */}
                              <div className="space-y-2">
                                <label className="text-[11px] font-medium text-muted-foreground">Logo Kiri (Lambang Negara)</label>
                                <div className="relative group border-2 border-dashed rounded-lg overflow-hidden transition-colors hover:border-primary/50 bg-muted/30"
                                  style={{ minHeight: '100px' }}>
                                  {sekolahData.logoKiriUrl ? (
                                    <div className="flex flex-col items-center justify-center p-3 h-full">
                                      <img
                                        src={sekolahData.logoKiriUrl}
                                        alt="Logo Kiri"
                                        style={{ height: `${(sekolahData.logoKiriTinggi || 3) * 20}px`, width: `${(sekolahData.logoKiriLebar || 2.5) * 20}px`, objectFit: 'contain' }}
                                      />
                                      <div className="mt-2 flex gap-1.5">
                                        <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1" onClick={() => logoKiriInputRef.current?.click()} disabled={logoUploading === 'kiri'}>
                                          {logoUploading === 'kiri' ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImagePlus className="h-3 w-3" />}
                                          Ganti
                                        </Button>
                                        <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1 text-destructive hover:text-destructive" onClick={() => handleLogoDelete('kiri')}>
                                          <Trash2 className="h-3 w-3" /> Hapus
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col items-center justify-center p-4 cursor-pointer h-full" style={{ minHeight: '100px' }} onClick={() => logoKiriInputRef.current?.click()}>
                                      {logoUploading === 'kiri' ? (
                                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                      ) : (
                                        <>
                                          <ImagePlus className="h-8 w-8 text-muted-foreground/50 mb-2" />
                                          <p className="text-[10px] text-muted-foreground text-center">Klik untuk upload logo kiri</p>
                                          <p className="text-[9px] text-muted-foreground/60 mt-0.5">Maks. 4 MB</p>
                                        </>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <input ref={logoKiriInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleLogoUpload('kiri', file); e.target.value = '' }} />
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="text-[10px] text-muted-foreground">Lebar (cm)</label>
                                    <Input type="number" step="0.1" min="0.5" max="10" className="h-7 text-[11px] mt-0.5" value={sekolahData.logoKiriLebar ?? 2.5} onChange={e => setSekolahData(prev => ({...prev, logoKiriLebar: parseFloat(e.target.value) || 2.5}))} />
                                  </div>
                                  <div>
                                    <label className="text-[10px] text-muted-foreground">Tinggi (cm)</label>
                                    <Input type="number" step="0.1" min="0.5" max="10" className="h-7 text-[11px] mt-0.5" value={sekolahData.logoKiriTinggi ?? 3} onChange={e => setSekolahData(prev => ({...prev, logoKiriTinggi: parseFloat(e.target.value) || 3}))} />
                                  </div>
                                </div>
                              </div>

                              {/* Logo Kanan */}
                              <div className="space-y-2">
                                <label className="text-[11px] font-medium text-muted-foreground">Logo Kanan (Logo Sekolah)</label>
                                <div className="relative group border-2 border-dashed rounded-lg overflow-hidden transition-colors hover:border-primary/50 bg-muted/30"
                                  style={{ minHeight: '100px' }}>
                                  {sekolahData.logoKananUrl ? (
                                    <div className="flex flex-col items-center justify-center p-3 h-full">
                                      <img
                                        src={sekolahData.logoKananUrl}
                                        alt="Logo Kanan"
                                        style={{ height: `${(sekolahData.logoKananTinggi || 3) * 20}px`, width: `${(sekolahData.logoKananLebar || 2.5) * 20}px`, objectFit: 'contain' }}
                                      />
                                      <div className="mt-2 flex gap-1.5">
                                        <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1" onClick={() => logoKananInputRef.current?.click()} disabled={logoUploading === 'kanan'}>
                                          {logoUploading === 'kanan' ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImagePlus className="h-3 w-3" />}
                                          Ganti
                                        </Button>
                                        <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1 text-destructive hover:text-destructive" onClick={() => handleLogoDelete('kanan')}>
                                          <Trash2 className="h-3 w-3" /> Hapus
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col items-center justify-center p-4 cursor-pointer h-full" style={{ minHeight: '100px' }} onClick={() => logoKananInputRef.current?.click()}>
                                      {logoUploading === 'kanan' ? (
                                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                      ) : (
                                        <>
                                          <ImagePlus className="h-8 w-8 text-muted-foreground/50 mb-2" />
                                          <p className="text-[10px] text-muted-foreground text-center">Klik untuk upload logo kanan</p>
                                          <p className="text-[9px] text-muted-foreground/60 mt-0.5">Maks. 4 MB</p>
                                        </>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <input ref={logoKananInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleLogoUpload('kanan', file); e.target.value = '' }} />
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="text-[10px] text-muted-foreground">Lebar (cm)</label>
                                    <Input type="number" step="0.1" min="0.5" max="10" className="h-7 text-[11px] mt-0.5" value={sekolahData.logoKananLebar ?? 2.5} onChange={e => setSekolahData(prev => ({...prev, logoKananLebar: parseFloat(e.target.value) || 2.5}))} />
                                  </div>
                                  <div>
                                    <label className="text-[10px] text-muted-foreground">Tinggi (cm)</label>
                                    <Input type="number" step="0.1" min="0.5" max="10" className="h-7 text-[11px] mt-0.5" value={sekolahData.logoKananTinggi ?? 3} onChange={e => setSekolahData(prev => ({...prev, logoKananTinggi: parseFloat(e.target.value) || 3}))} />
                                  </div>
                                </div>
                              </div>
                            </div>

                            <Separator />

                            {/* --- KOP Text Rows --- */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h4 className="text-[11px] font-semibold">Baris Teks KOP</h4>
                                  <p className="text-[10px] text-muted-foreground">Atur teks yang tampil di kop surat (baris per baris)</p>
                                </div>
                                <Button size="sm" className="h-7 text-[11px] gap-1" onClick={addKopRow} disabled={kopRowLoading}>
                                  <Plus className="h-3 w-3" /> Tambah Baris
                                </Button>
                              </div>

                              {kopRows.length === 0 ? (
                                <div className="border-2 border-dashed rounded-lg py-8 text-center bg-muted/20">
                                  <Type className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                                  <p className="text-[11px] text-muted-foreground">Belum ada baris teks KOP</p>
                                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">Klik &quot;Tambah Baris&quot; untuk menambahkan teks kop surat</p>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {[...kopRows].sort((a, b) => a.urutan - b.urutan).map((row, idx, arr) => (
                                    <div key={row.id} className="border rounded-lg p-3 bg-card space-y-2">
                                      <div className="flex items-center gap-2">
                                        <GripVertical className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
                                        <span className="text-[10px] font-medium text-muted-foreground w-6">#{idx + 1}</span>
                                        <div className="flex-1">
                                          <Input
                                            className="h-8 text-xs"
                                            placeholder="Teks baris KOP (misal: PEMERINTAH KABUPATEN TANGERANG)"
                                            value={row.teks}
                                            onChange={e => updateKopRow(row.id, { teks: e.target.value })}
                                            style={{ fontFamily: row.fontFamily, fontSize: `${row.fontSize}pt`, fontWeight: row.bold ? 'bold' : 'normal', fontStyle: row.italic ? 'italic' : 'normal', textTransform: row.uppercase ? 'uppercase' : 'none' }}
                                          />
                                        </div>
                                        <div className="flex items-center gap-0.5 flex-shrink-0">
                                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => moveKopRow(row.id, 'up')} disabled={idx === 0}>
                                            <ArrowUp className="h-3.5 w-3.5" />
                                          </Button>
                                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => moveKopRow(row.id, 'down')} disabled={idx === arr.length - 1}>
                                            <ArrowDown className="h-3.5 w-3.5" />
                                          </Button>
                                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => deleteKopRow(row.id)}>
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </Button>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 flex-wrap pl-8">
                                        {/* Font Family */}
                                        <div className="flex items-center gap-1">
                                          <label className="text-[9px] text-muted-foreground">Font:</label>
                                          <select
                                            className="h-6 text-[10px] border rounded px-1 bg-background"
                                            value={row.fontFamily}
                                            onChange={e => updateKopRow(row.id, { fontFamily: e.target.value })}
                                          >
                                            <option value="Times New Roman">Times New Roman</option>
                                            <option value="Arial">Arial</option>
                                            <option value="Courier New">Courier New</option>
                                            <option value="Georgia">Georgia</option>
                                            <option value="Verdana">Verdana</option>
                                            <option value="Trebuchet MS">Trebuchet MS</option>
                                            <option value="Calibri">Calibri</option>
                                            <option value="Cambria">Cambria</option>
                                            <option value="Garamond">Garamond</option>
                                            <option value="Comic Sans MS">Comic Sans MS</option>
                                            <option value="Impact">Impact</option>
                                            <option value="Palatino Linotype">Palatino</option>
                                            <option value="Tahoma">Tahoma</option>
                                          </select>
                                        </div>
                                        {/* Font Size */}
                                        <div className="flex items-center gap-1">
                                          <label className="text-[9px] text-muted-foreground">Ukuran:</label>
                                          <Input
                                            type="number"
                                            min="6"
                                            max="72"
                                            step="0.5"
                                            className="h-6 w-14 text-[10px] px-1"
                                            value={row.fontSize}
                                            onChange={e => updateKopRow(row.id, { fontSize: parseFloat(e.target.value) || 12 })}
                                          />
                                          <span className="text-[9px] text-muted-foreground">pt</span>
                                        </div>
                                        {/* Line Height (Jarak Antar Baris) */}
                                        <div className="flex items-center gap-0.5">
                                          <label className="text-[9px] text-muted-foreground mr-0.5">Jarak:</label>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-6 w-6 p-0 text-[11px]"
                                            onClick={() => updateKopRow(row.id, { lineHeight: Math.max(0.5, Math.round((row.lineHeight - 0.1) * 10) / 10) })}
                                            disabled={row.lineHeight <= 0.5}
                                          >
                                            ↓
                                          </Button>
                                          <span className="text-[10px] w-6 text-center font-mono">{row.lineHeight?.toFixed(1) || '1.3'}</span>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-6 w-6 p-0 text-[11px]"
                                            onClick={() => updateKopRow(row.id, { lineHeight: Math.min(3.0, Math.round((row.lineHeight + 0.1) * 10) / 10) })}
                                            disabled={row.lineHeight >= 3.0}
                                          >
                                            ↑
                                          </Button>
                                        </div>
                                        {/* Bold */}
                                        <Button
                                          variant={row.bold ? 'default' : 'outline'}
                                          size="sm"
                                          className={`h-6 w-7 p-0 ${row.bold ? '' : 'text-muted-foreground'}`}
                                          onClick={() => updateKopRow(row.id, { bold: !row.bold })}
                                        >
                                          <Bold className="h-3 w-3" />
                                        </Button>
                                        {/* Italic */}
                                        <Button
                                          variant={row.italic ? 'default' : 'outline'}
                                          size="sm"
                                          className={`h-6 w-7 p-0 ${row.italic ? '' : 'text-muted-foreground'}`}
                                          onClick={() => updateKopRow(row.id, { italic: !row.italic })}
                                        >
                                          <Italic className="h-3 w-3" />
                                        </Button>
                                        {/* Uppercase */}
                                        <Button
                                          variant={row.uppercase ? 'default' : 'outline'}
                                          size="sm"
                                          className={`h-6 px-1.5 p-0 text-[9px] ${row.uppercase ? '' : 'text-muted-foreground'}`}
                                          onClick={() => updateKopRow(row.id, { uppercase: !row.uppercase })}
                                        >
                                          AA
                                        </Button>
                                        {kopRowSaving === row.id && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            <Separator />

                            {/* --- Garis Bawah KOP --- */}
                            <div className="space-y-2">
                              <h4 className="text-[11px] font-semibold">Garis Bawah KOP</h4>
                              <div className="flex items-center gap-3 flex-wrap">
                                {/* Garis Style */}
                                <div className="flex items-center gap-1.5">
                                  <label className="text-[9px] text-muted-foreground">Gaya Garis:</label>
                                  <select
                                    className="h-6 text-[10px] border rounded px-1 bg-background"
                                    value={sekolahData.garisBawahStyle || 'single-thick'}
                                    onChange={e => setSekolahData(prev => ({...prev, garisBawahStyle: e.target.value}))}
                                  >
                                    <option value="single-thin">Garis 1 (tipis)</option>
                                    <option value="single-thick">Garis 1 (tebal)</option>
                                    <option value="double">Garis 2 (tipis-tipis)</option>
                                    <option value="double-thick-thin">Garis 2 (tebal-tipis)</option>
                                    <option value="double-thin-thick">Garis 2 (tipis-tebal)</option>
                                    <option value="none">Tanpa Garis</option>
                                  </select>
                                </div>
                                {/* Garis Jarak (spacing from last row to line) */}
                                <div className="flex items-center gap-0.5">
                                  <label className="text-[9px] text-muted-foreground mr-0.5">Jarak:</label>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 w-6 p-0 text-[11px]"
                                    onClick={() => setSekolahData(prev => ({...prev, garisBawahJarak: Math.max(0, (prev.garisBawahJarak || 4) - 1)}))}
                                    disabled={(sekolahData.garisBawahJarak || 4) <= 0}
                                  >
                                    ↓
                                  </Button>
                                  <span className="text-[10px] w-6 text-center font-mono">{sekolahData.garisBawahJarak ?? 4}</span>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 w-6 p-0 text-[11px]"
                                    onClick={() => setSekolahData(prev => ({...prev, garisBawahJarak: Math.min(20, (prev.garisBawahJarak || 4) + 1)}))}
                                    disabled={(sekolahData.garisBawahJarak || 4) >= 20}
                                  >
                                    ↑
                                  </Button>
                                  <span className="text-[9px] text-muted-foreground">pt</span>
                                </div>
                              </div>
                              {/* Garis preview mini */}
                              <div className="border rounded p-2 bg-white">
                                {renderGarisBawah(sekolahData.garisBawahStyle || 'single-thick')}
                              </div>
                            </div>

                            <Separator />

                            {/* --- KOP Preview --- */}
                            <div className="space-y-1">
                              <h4 className="text-[11px] font-semibold">Pratinjau KOP</h4>
                              <div className="border rounded-lg p-4 bg-white">
                                <div style={{ paddingBottom: `${sekolahData.garisBawahJarak || 4}pt` }}>
                                  {/* 0 logos: just centered text */}
                                  {logoCount === 0 && (
                                    <div className="text-center">
                                      {[...kopRows].sort((a, b) => a.urutan - b.urutan).map((row) => (
                                        <p
                                          key={row.id}
                                          style={{
                                            fontFamily: row.fontFamily,
                                            fontSize: `${row.fontSize}pt`,
                                            fontWeight: row.bold ? 'bold' : 'normal',
                                            fontStyle: row.italic ? 'italic' : 'normal',
                                            textTransform: row.uppercase ? 'uppercase' : 'none',
                                            lineHeight: row.lineHeight || 1.3,
                                            color: '#000',
                                          }}
                                        >
                                          {row.teks || '........................'}
                                        </p>
                                      ))}
                                      {kopRows.length === 0 && (
                                        <p className="text-gray-400 text-[10px]">Belum ada baris teks</p>
                                      )}
                                    </div>
                                  )}
                                  {/* 1 logo kiri only: logo left, text right */}
                                  {logoCount === 1 && hasLogoKiri && !hasLogoKanan && (
                                    <div className="flex items-center">
                                      <div style={{ width: `${(sekolahData.logoKiriLebar || 2.5) * 10}mm`, flexShrink: 0 }}>
                                        <img src={sekolahData.logoKiriUrl} alt="Logo Kiri" style={{ height: `${(sekolahData.logoKiriTinggi || 3) * 10}mm`, width: `${(sekolahData.logoKiriLebar || 2.5) * 10}mm`, objectFit: 'contain' }} />
                                      </div>
                                      <div className="text-center flex-1 min-w-0 px-2">
                                        {[...kopRows].sort((a, b) => a.urutan - b.urutan).map((row) => (
                                          <p
                                            key={row.id}
                                            style={{
                                              fontFamily: row.fontFamily,
                                              fontSize: `${row.fontSize}pt`,
                                              fontWeight: row.bold ? 'bold' : 'normal',
                                              fontStyle: row.italic ? 'italic' : 'normal',
                                              textTransform: row.uppercase ? 'uppercase' : 'none',
                                              lineHeight: row.lineHeight || 1.3,
                                              color: '#000',
                                            }}
                                          >
                                            {row.teks || '........................'}
                                          </p>
                                        ))}
                                        {kopRows.length === 0 && (
                                          <p className="text-gray-400 text-[10px]">Belum ada baris teks</p>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                  {/* 1 logo kanan only: text left, logo right */}
                                  {logoCount === 1 && !hasLogoKiri && hasLogoKanan && (
                                    <div className="flex items-center">
                                      <div className="text-center flex-1 min-w-0 px-2">
                                        {[...kopRows].sort((a, b) => a.urutan - b.urutan).map((row) => (
                                          <p
                                            key={row.id}
                                            style={{
                                              fontFamily: row.fontFamily,
                                              fontSize: `${row.fontSize}pt`,
                                              fontWeight: row.bold ? 'bold' : 'normal',
                                              fontStyle: row.italic ? 'italic' : 'normal',
                                              textTransform: row.uppercase ? 'uppercase' : 'none',
                                              lineHeight: row.lineHeight || 1.3,
                                              color: '#000',
                                            }}
                                          >
                                            {row.teks || '........................'}
                                          </p>
                                        ))}
                                        {kopRows.length === 0 && (
                                          <p className="text-gray-400 text-[10px]">Belum ada baris teks</p>
                                        )}
                                      </div>
                                      <div style={{ width: `${(sekolahData.logoKananLebar || 2.5) * 10}mm`, flexShrink: 0 }}>
                                        <img src={sekolahData.logoKananUrl} alt="Logo Kanan" style={{ height: `${(sekolahData.logoKananTinggi || 3) * 10}mm`, width: `${(sekolahData.logoKananLebar || 2.5) * 10}mm`, objectFit: 'contain' }} />
                                      </div>
                                    </div>
                                  )}
                                  {/* 2 logos: classic 3-column layout */}
                                  {logoCount === 2 && (
                                    <div className="flex items-center justify-between">
                                      <div style={{ width: `${(sekolahData.logoKiriLebar || 2.5) * 10}mm`, flexShrink: 0 }}>
                                        <img src={sekolahData.logoKiriUrl} alt="Logo Kiri" style={{ height: `${(sekolahData.logoKiriTinggi || 3) * 10}mm`, width: `${(sekolahData.logoKiriLebar || 2.5) * 10}mm`, objectFit: 'contain' }} />
                                      </div>
                                      <div className="text-center flex-1 min-w-0 px-2">
                                        {[...kopRows].sort((a, b) => a.urutan - b.urutan).map((row) => (
                                          <p
                                            key={row.id}
                                            style={{
                                              fontFamily: row.fontFamily,
                                              fontSize: `${row.fontSize}pt`,
                                              fontWeight: row.bold ? 'bold' : 'normal',
                                              fontStyle: row.italic ? 'italic' : 'normal',
                                              textTransform: row.uppercase ? 'uppercase' : 'none',
                                              lineHeight: row.lineHeight || 1.3,
                                              color: '#000',
                                            }}
                                          >
                                            {row.teks || '........................'}
                                          </p>
                                        ))}
                                        {kopRows.length === 0 && (
                                          <p className="text-gray-400 text-[10px]">Belum ada baris teks</p>
                                        )}
                                      </div>
                                      <div style={{ width: `${(sekolahData.logoKananLebar || 2.5) * 10}mm`, flexShrink: 0 }}>
                                        <img src={sekolahData.logoKananUrl} alt="Logo Kanan" style={{ height: `${(sekolahData.logoKananTinggi || 3) * 10}mm`, width: `${(sekolahData.logoKananLebar || 2.5) * 10}mm`, objectFit: 'contain' }} />
                                      </div>
                                    </div>
                                  )}
                                </div>
                                {/* Garis bawah */}
                                {renderGarisBawah(sekolahData.garisBawahStyle || 'single-thick')}
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="pb-2"><CardTitle className="text-xs">Identitas Sekolah</CardTitle></CardHeader>
                          <CardContent className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="text-[11px] font-medium text-muted-foreground">Nama Sekolah</label>
                                <Input className="h-8 text-xs mt-1" value={sekolahData.namaSekolah || ''} onChange={e => setSekolahData(prev => ({...prev, namaSekolah: e.target.value}))} />
                              </div>
                              <div>
                                <label className="text-[11px] font-medium text-muted-foreground">NPSN</label>
                                <Input className="h-8 text-xs mt-1" value={sekolahData.npsn || ''} onChange={e => setSekolahData(prev => ({...prev, npsn: e.target.value}))} />
                              </div>
                            </div>
                            <div>
                              <label className="text-[11px] font-medium text-muted-foreground">Alamat</label>
                              <Input className="h-8 text-xs mt-1" value={sekolahData.alamat || ''} onChange={e => setSekolahData(prev => ({...prev, alamat: e.target.value}))} />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="text-[11px] font-medium text-muted-foreground">Kabupaten</label>
                                <Input className="h-8 text-xs mt-1" value={sekolahData.kabupaten || ''} onChange={e => setSekolahData(prev => ({...prev, kabupaten: e.target.value}))} />
                              </div>
                              <div>
                                <label className="text-[11px] font-medium text-muted-foreground">Provinsi</label>
                                <Input className="h-8 text-xs mt-1" value={sekolahData.provinsi || ''} onChange={e => setSekolahData(prev => ({...prev, provinsi: e.target.value}))} />
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="pb-2"><CardTitle className="text-xs">Pejabat Sekolah</CardTitle></CardHeader>
                          <CardContent className="space-y-3">
                            {[
                              {label: 'Kepala Sekolah', nameKey: 'kepalaSekolah', nipKey: 'nipKepala'},
                              {label: 'Bendahara', nameKey: 'bendahara', nipKey: 'nipBendahara'},
                              {label: 'Pengurus Barang', nameKey: 'pengurusBarang', nipKey: 'nipPengurus'},
                              {label: 'Penerima Barang', nameKey: 'penerimaBarang', nipKey: 'nipPenerima'},
                            ].map(field => (
                              <div key={field.nameKey} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <label className="text-[11px] font-medium text-muted-foreground">{field.label}</label>
                                  <Input className="h-8 text-xs mt-1" value={sekolahData[field.nameKey] || ''} onChange={e => setSekolahData(prev => ({...prev, [field.nameKey]: e.target.value}))} />
                                </div>
                                <div>
                                  <label className="text-[11px] font-medium text-muted-foreground">NIP</label>
                                  <Input className="h-8 text-xs mt-1" value={sekolahData[field.nipKey] || ''} onChange={e => setSekolahData(prev => ({...prev, [field.nipKey]: e.target.value}))} />
                                </div>
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </div>
                )}

                {/* ===== MASTER BPU SUB-TAB ===== */}
                {spjSubTab === 'master-bpu' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold">Master BPU</h3>
                        <p className="text-[11px] text-muted-foreground">Bukti Pengeluaran Uang — barang/jasa</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{bpuList.length} BPU</Badge>
                        <Button size="sm" className="h-7 text-[11px] gap-1" onClick={syncBPU} disabled={bpuSyncing}>
                          {bpuSyncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Database className="h-3 w-3" />}
                          Sinkron dari BKU
                        </Button>
                      </div>
                    </div>

                    {bpuLoading ? (
                      <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}</div>
                    ) : bpuList.length === 0 ? (
                      <Card className="border-dashed">
                        <CardContent className="py-12 text-center">
                          <ClipboardList className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                          <h3 className="text-sm font-semibold">Belum ada data BPU</h3>
                          <p className="text-xs text-muted-foreground mt-1">Klik &quot;Sinkron dari BKU&quot; untuk mengambil data BPU dari file BKU yang sudah diimpor</p>
                        </CardContent>
                      </Card>
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
                                  <div className="flex items-center gap-3">
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-semibold">{bpu.noBukti}</span>
                                        {bpu.noPesanan && <Badge className="text-[9px] h-4 px-1.5 bg-teal-600">No. {bpu.noPesanan.padStart(3, '0')}</Badge>}
                                        {!bpu.noPesanan && <Badge variant="outline" className="text-[9px] h-4 px-1.5 text-amber-600 border-amber-300">Belum ada pesanan</Badge>}
                                      </div>
                                      <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
                                        {bpu.tglPesan && <span>{new Date(bpu.tglPesan).toLocaleDateString('id-ID')}</span>}
                                        <span>{bpu.items?.length || 0} item</span>
                                        {bpu.toko && <span>Toko: {bpu.toko.namaToko}</span>}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-sm font-bold">{fmtRp(totalJumlah)}</span>
                                    {isSelected ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                                  </div>
                                </div>
                              </div>

                              {isSelected && (
                                <CardContent className="px-4 pb-3 pt-0 space-y-3 border-t">
                                  {/* Edit fields */}
                                  <div className="pt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                      <label className="text-[10px] font-medium text-muted-foreground">No Pesanan (3 digit)</label>
                                      <Input className="h-7 text-[11px] mt-1" value={editFields.noPesanan} onChange={e => setBpuEditFields(prev => ({...prev, [bpu.id]: {...(prev[bpu.id] || {noPesanan: bpu.noPesanan, tglPesan: bpu.tglPesan, tokoId: bpu.tokoId || ''}), noPesanan: e.target.value}}))} placeholder="001" />
                                    </div>
                                    <div>
                                      <label className="text-[10px] font-medium text-muted-foreground">Tanggal Pesan</label>
                                      <Input type="date" className="h-7 text-[11px] mt-1" value={editFields.tglPesan ? editFields.tglPesan.split('T')[0] : ''} onChange={e => setBpuEditFields(prev => ({...prev, [bpu.id]: {...(prev[bpu.id] || {noPesanan: bpu.noPesanan, tglPesan: bpu.tglPesan, tokoId: bpu.tokoId || ''}), tglPesan: e.target.value}}))} />
                                    </div>
                                    <div>
                                      <label className="text-[10px] font-medium text-muted-foreground">Toko</label>
                                      <select className="w-full h-7 text-[11px] mt-1 rounded-md border border-input bg-transparent px-2" value={editFields.tokoId} onChange={e => setBpuEditFields(prev => ({...prev, [bpu.id]: {...(prev[bpu.id] || {noPesanan: bpu.noPesanan, tglPesan: bpu.tglPesan, tokoId: bpu.tokoId || ''}), tokoId: e.target.value}}))}>
                                        <option value="">-- Pilih Toko --</option>
                                        {tokoList.map((t: any) => <option key={t.id} value={t.id}>{t.namaToko}</option>)}
                                      </select>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button size="sm" className="h-6 text-[10px] gap-1" onClick={() => { updateBPU(bpu.id, editFields); setBpuEditFields(prev => { const next = {...prev}; delete next[bpu.id]; return next }) }}>
                                      <CheckCircle2 className="h-3 w-3" /> Simpan
                                    </Button>
                                    <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1" onClick={() => setBpuEditFields(prev => { const next = {...prev}; delete next[bpu.id]; return next })}>
                                      Batal
                                    </Button>
                                    <div className="ml-auto">
                                      <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-destructive" onClick={() => deleteBPU(bpu.id)}>
                                        <Trash2 className="h-3 w-3" /> Hapus
                                      </Button>
                                    </div>
                                  </div>

                                  {/* Auto-generated nomor surat */}
                                  {(bpu.nomorSuratPesanan || bpu.nomorSuratBAST || bpu.nomorSuratSHP) && (
                                    <div className="bg-teal-50 dark:bg-teal-950/30 rounded-md p-2.5 space-y-1">
                                      <p className="text-[10px] font-semibold text-teal-700 dark:text-teal-300">Nomor Surat (Auto-generated)</p>
                                      {bpu.nomorSuratPesanan && <p className="text-[10px] text-teal-600 dark:text-teal-400">Pesanan: {bpu.nomorSuratPesanan}</p>}
                                      {bpu.nomorSuratBAST && <p className="text-[10px] text-teal-600 dark:text-teal-400">BAST: {bpu.nomorSuratBAST}</p>}
                                      {bpu.nomorSuratSHP && <p className="text-[10px] text-teal-600 dark:text-teal-400">SHP: {bpu.nomorSuratSHP}</p>}
                                    </div>
                                  )}

                                  {/* Items table */}
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-[11px]">
                                      <thead>
                                        <tr className="border-b bg-muted/50">
                                          <th className="px-2 py-1.5 text-center w-10">No</th>
                                          <th className="px-2 py-1.5 text-left">Uraian</th>
                                          <th className="px-2 py-1.5 text-left w-28">Kode Rekening</th>
                                          <th className="px-2 py-1.5 text-right w-24">Jumlah</th>
                                          <th className="px-2 py-1.5 text-right w-28">Harga Toko 2</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {bpu.items?.map((item: any, idx: number) => (
                                          <tr key={item.id || idx} className="border-b last:border-0 hover:bg-muted/30">
                                            <td className="px-2 py-1.5 text-center text-muted-foreground">{idx + 1}</td>
                                            <td className="px-2 py-1.5">{item.uraian || '-'}</td>
                                            <td className="px-2 py-1.5 font-mono text-[10px]">{item.kodeRekening || '-'}</td>
                                            <td className="px-2 py-1.5 text-right font-medium">{fmtRp(item.jumlah)}</td>
                                            <td className="px-2 py-1.5 text-right">
                                              <Input className="h-6 text-[10px] text-right w-24 ml-auto" value={item.hargaToko2 || ''} onBlur={e => {
                                                const newItems = bpu.items.map((i: any, fi: number) => fi === idx ? {...i, hargaToko2: parseFloat(e.target.value) || 0} : i)
                                                updateBPItemHargaToko2(bpu.id, newItems)
                                              }} onChange={e => {
                                                const newItems = bpu.items.map((i: any, fi: number) => fi === idx ? {...i, hargaToko2: parseFloat(e.target.value) || 0} : i)
                                                setBpuList(prev => prev.map((b: any) => b.id === bpu.id ? {...b, items: newItems} : b))
                                              }} placeholder="0" />
                                            </td>
                                          </tr>
                                        ))}
                                        <tr className="bg-muted/50 font-semibold">
                                          <td colSpan={3} className="px-2 py-1.5 text-right">Total</td>
                                          <td className="px-2 py-1.5 text-right">{fmtRp(totalJumlah)}</td>
                                          <td></td>
                                        </tr>
                                      </tbody>
                                    </table>
                                  </div>
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
                      <div>
                        <h3 className="text-sm font-semibold">Master BNU</h3>
                        <p className="text-[11px] text-muted-foreground">Belanja Honor/Gaji</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{bnuList.length} BNU</Badge>
                        <Button size="sm" className="h-7 text-[11px] gap-1" onClick={syncBNU} disabled={bnuSyncing}>
                          {bnuSyncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Database className="h-3 w-3" />}
                          Sinkron dari BKU
                        </Button>
                      </div>
                    </div>

                    {bnuLoading ? (
                      <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}</div>
                    ) : bnuList.length === 0 ? (
                      <Card className="border-dashed">
                        <CardContent className="py-12 text-center">
                          <Users className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                          <h3 className="text-sm font-semibold">Belum ada data BNU</h3>
                          <p className="text-xs text-muted-foreground mt-1">Klik &quot;Sinkron dari BKU&quot; untuk mengambil data BNU dari file BKU yang sudah diimpor</p>
                        </CardContent>
                      </Card>
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
                                  <div className="flex items-center gap-3">
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-semibold">{bnu.noBukti}</span>
                                        {bnu.noPesanan && <Badge className="text-[9px] h-4 px-1.5 bg-teal-600">No. {bnu.noPesanan.padStart(3, '0')}</Badge>}
                                        {!bnu.noPesanan && <Badge variant="outline" className="text-[9px] h-4 px-1.5 text-amber-600 border-amber-300">Belum ada pesanan</Badge>}
                                      </div>
                                      <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
                                        {bnu.tglPesan && <span>{new Date(bnu.tglPesan).toLocaleDateString('id-ID')}</span>}
                                        <span>{bnu.items?.length || 0} item</span>
                                        {bnu.toko && <span>Toko: {bnu.toko.namaToko}</span>}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-sm font-bold">{fmtRp(totalJumlah)}</span>
                                    {isSelected ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                                  </div>
                                </div>
                              </div>

                              {isSelected && (
                                <CardContent className="px-4 pb-3 pt-0 space-y-3 border-t">
                                  <div className="pt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                      <label className="text-[10px] font-medium text-muted-foreground">No Pesanan (3 digit)</label>
                                      <Input className="h-7 text-[11px] mt-1" value={editFields.noPesanan} onChange={e => setBnuEditFields(prev => ({...prev, [bnu.id]: {...(prev[bnu.id] || {noPesanan: bnu.noPesanan, tglPesan: bnu.tglPesan, tokoId: bnu.tokoId || ''}), noPesanan: e.target.value}}))} placeholder="001" />
                                    </div>
                                    <div>
                                      <label className="text-[10px] font-medium text-muted-foreground">Tanggal Pesan</label>
                                      <Input type="date" className="h-7 text-[11px] mt-1" value={editFields.tglPesan ? editFields.tglPesan.split('T')[0] : ''} onChange={e => setBnuEditFields(prev => ({...prev, [bnu.id]: {...(prev[bnu.id] || {noPesanan: bnu.noPesanan, tglPesan: bnu.tglPesan, tokoId: bnu.tokoId || ''}), tglPesan: e.target.value}}))} />
                                    </div>
                                    <div>
                                      <label className="text-[10px] font-medium text-muted-foreground">Toko</label>
                                      <select className="w-full h-7 text-[11px] mt-1 rounded-md border border-input bg-transparent px-2" value={editFields.tokoId} onChange={e => setBnuEditFields(prev => ({...prev, [bnu.id]: {...(prev[bnu.id] || {noPesanan: bnu.noPesanan, tglPesan: bnu.tglPesan, tokoId: bnu.tokoId || ''}), tokoId: e.target.value}}))}>
                                        <option value="">-- Pilih Toko --</option>
                                        {tokoList.map((t: any) => <option key={t.id} value={t.id}>{t.namaToko}</option>)}
                                      </select>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button size="sm" className="h-6 text-[10px] gap-1" onClick={() => { updateBNU(bnu.id, editFields); setBnuEditFields(prev => { const next = {...prev}; delete next[bnu.id]; return next }) }}>
                                      <CheckCircle2 className="h-3 w-3" /> Simpan
                                    </Button>
                                    <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1" onClick={() => setBnuEditFields(prev => { const next = {...prev}; delete next[bnu.id]; return next })}>
                                      Batal
                                    </Button>
                                    <div className="ml-auto">
                                      <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-destructive" onClick={() => deleteBNU(bnu.id)}>
                                        <Trash2 className="h-3 w-3" /> Hapus
                                      </Button>
                                    </div>
                                  </div>

                                  {(bnu.nomorSuratPesanan || bnu.nomorSuratBAST || bnu.nomorSuratSHP) && (
                                    <div className="bg-teal-50 dark:bg-teal-950/30 rounded-md p-2.5 space-y-1">
                                      <p className="text-[10px] font-semibold text-teal-700 dark:text-teal-300">Nomor Surat (Auto-generated)</p>
                                      {bnu.nomorSuratPesanan && <p className="text-[10px] text-teal-600 dark:text-teal-400">Pesanan: {bnu.nomorSuratPesanan}</p>}
                                      {bnu.nomorSuratBAST && <p className="text-[10px] text-teal-600 dark:text-teal-400">BAST: {bnu.nomorSuratBAST}</p>}
                                      {bnu.nomorSuratSHP && <p className="text-[10px] text-teal-600 dark:text-teal-400">SHP: {bnu.nomorSuratSHP}</p>}
                                    </div>
                                  )}

                                  <div className="overflow-x-auto">
                                    <table className="w-full text-[11px]">
                                      <thead>
                                        <tr className="border-b bg-muted/50">
                                          <th className="px-2 py-1.5 text-center w-10">No</th>
                                          <th className="px-2 py-1.5 text-left">Uraian</th>
                                          <th className="px-2 py-1.5 text-left w-28">Kode Rekening</th>
                                          <th className="px-2 py-1.5 text-right w-24">Jumlah</th>
                                          <th className="px-2 py-1.5 text-right w-28">Harga Toko 2</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {bnu.items?.map((item: any, idx: number) => (
                                          <tr key={item.id || idx} className="border-b last:border-0 hover:bg-muted/30">
                                            <td className="px-2 py-1.5 text-center text-muted-foreground">{idx + 1}</td>
                                            <td className="px-2 py-1.5">{item.uraian || '-'}</td>
                                            <td className="px-2 py-1.5 font-mono text-[10px]">{item.kodeRekening || '-'}</td>
                                            <td className="px-2 py-1.5 text-right font-medium">{fmtRp(item.jumlah)}</td>
                                            <td className="px-2 py-1.5 text-right">
                                              <Input className="h-6 text-[10px] text-right w-24 ml-auto" value={item.hargaToko2 || ''} onBlur={e => {
                                                const newItems = bnu.items.map((i: any, fi: number) => fi === idx ? {...i, hargaToko2: parseFloat(e.target.value) || 0} : i)
                                                updateBNUItemHargaToko2(bnu.id, newItems)
                                              }} onChange={e => {
                                                const newItems = bnu.items.map((i: any, fi: number) => fi === idx ? {...i, hargaToko2: parseFloat(e.target.value) || 0} : i)
                                                setBnuList(prev => prev.map((b: any) => b.id === bnu.id ? {...b, items: newItems} : b))
                                              }} placeholder="0" />
                                            </td>
                                          </tr>
                                        ))}
                                        <tr className="bg-muted/50 font-semibold">
                                          <td colSpan={3} className="px-2 py-1.5 text-right">Total</td>
                                          <td className="px-2 py-1.5 text-right">{fmtRp(totalJumlah)}</td>
                                          <td></td>
                                        </tr>
                                      </tbody>
                                    </table>
                                  </div>
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
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}
                      </div>
                      <Skeleton className="h-64 rounded-lg" />
                    </div>
                  ) : !spjData || (spjData.bulanan.length === 0 && !spjData.tahunan) ? (
                    <Card className="border-dashed">
                      <CardContent className="py-16 text-center space-y-3">
                        <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
                          <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold">Belum ada data SPJ</h3>
                          <p className="text-xs text-muted-foreground mt-1">
                            Import file RKAS dan BKU untuk melihat pencocokan Surat Pertanggungjawaban
                          </p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 justify-center mt-4">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <ClipboardList className="h-3.5 w-3.5" />
                            <span>1. Import RKAS (Bulanan & Tahunan)</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Receipt className="h-3.5 w-3.5" />
                            <span>2. Import BKU per bulan</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <>
                      {/* ===== Period Selector ===== */}
                      <Card>
                        <CardContent className="py-2.5 px-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] text-muted-foreground font-medium shrink-0">Periode:</span>
                            {spjData.tahunan && (
                              <Button
                                variant={selectedSpjMonth === -1 ? 'default' : 'outline'}
                                size="sm" className="h-7 text-[11px] gap-1"
                                onClick={() => setSelectedSpjMonth(-1)}
                              >
                                <Calendar className="h-3 w-3" /> Tahunan {spjData.tahunan.tahun}
                              </Button>
                            )}
                            {spjData.bulanan.map((m, idx) => (
                              <Button
                                key={idx}
                                variant={selectedSpjMonth === idx ? 'default' : 'outline'}
                                size="sm" className="h-7 text-[11px] gap-1"
                                onClick={() => setSelectedSpjMonth(idx)}
                              >
                                <Calendar className="h-3 w-3" /> {MONTH_NAMES[m.bulan] || m.bulan.slice(0,3)} {m.tahun}
                                {m.persenRealisasi > 0 && (
                                  <span className={`ml-0.5 text-[9px] ${
                                    m.persenRealisasi >= 95 ? 'text-emerald-600' :
                                    m.persenRealisasi >= 50 ? 'text-amber-600' : 'text-red-500'
                                  }`}>({m.persenRealisasi}%)</span>
                                )}
                              </Button>
                            ))}
                            {spjLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                          </div>
                        </CardContent>
                      </Card>

                      {/* ===== SPJ Summary KPI ===== */}
                      {(() => {
                        const src = selectedSpjMonth === -1 ? spjData.tahunan : spjData.bulanan[selectedSpjMonth]
                        if (!src) return null

                        // Count status distribution
                        const allItems = src.standarGroups.flatMap(g => g.items)
                        const statusCounts = {
                          lengkap: allItems.filter(i => i.status === 'lengkap').length,
                          sebagian: allItems.filter(i => i.status === 'sebagian').length,
                          belum: allItems.filter(i => i.status === 'belum').length,
                          lebih: allItems.filter(i => i.status === 'lebih').length,
                        }

                        return (
                          <>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <Card className="border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30">
                                <CardContent className="pt-3 pb-2 px-3">
                                  <div className="flex items-center gap-2 mb-1">
                                    <ClipboardList className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                    <p className="text-[10px] text-muted-foreground">Anggaran (RKAS)</p>
                                  </div>
                                  <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{fmtRp(src.totalAnggaran)}</p>
                                </CardContent>
                              </Card>
                              <Card className="border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30">
                                <CardContent className="pt-3 pb-2 px-3">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Receipt className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                                    <p className="text-[10px] text-muted-foreground">Realisasi (BKU)</p>
                                  </div>
                                  <p className="text-sm font-bold text-amber-700 dark:text-amber-300">{fmtRp(src.totalRealisasi)}</p>
                                </CardContent>
                              </Card>
                              <Card className={src.totalSelisih >= 0 ? 'border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-sky-50 dark:from-blue-950/30 dark:to-sky-950/30' : 'border-red-200 dark:border-red-800 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30'}>
                                <CardContent className="pt-3 pb-2 px-3">
                                  <div className="flex items-center gap-2 mb-1">
                                    {src.totalSelisih >= 0 ? <Minus className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" /> : <AlertCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />}
                                    <p className="text-[10px] text-muted-foreground">{src.totalSelisih >= 0 ? 'Sisa Anggaran' : 'Defisit'}</p>
                                  </div>
                                  <p className={`text-sm font-bold ${src.totalSelisih >= 0 ? 'text-blue-700 dark:text-blue-300' : 'text-red-700 dark:text-red-300'}`}>{fmtRp(Math.abs(src.totalSelisih))}</p>
                                </CardContent>
                              </Card>
                              <Card className="border-violet-200 dark:border-violet-800 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30">
                                <CardContent className="pt-3 pb-2 px-3">
                                  <div className="flex items-center gap-2 mb-1">
                                    <TrendingUp className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                                    <p className="text-[10px] text-muted-foreground">% Pertanggungjawaban</p>
                                  </div>
                                  <p className="text-sm font-bold text-violet-700 dark:text-violet-300">{src.persenRealisasi}%</p>
                                </CardContent>
                              </Card>
                            </div>

                            {/* Overall Progress Bar */}
                            <Card>
                              <CardContent className="py-3 px-4 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-medium">Tingkat Pertanggungjawaban</span>
                                  <span className="text-xs font-bold">{fmtRp(src.totalRealisasi)} / {fmtRp(src.totalAnggaran)}</span>
                                </div>
                                <div className="h-4 bg-muted rounded-full overflow-hidden relative">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${
                                      src.persenRealisasi >= 95 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' :
                                      src.persenRealisasi >= 50 ? 'bg-gradient-to-r from-amber-400 to-amber-500' :
                                      'bg-gradient-to-r from-red-400 to-red-500'
                                    }`}
                                    style={{ width: `${Math.min(src.persenRealisasi, 100)}%` }}
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-[11px] font-bold text-white drop-shadow-sm">{src.persenRealisasi}%</span>
                                  </div>
                                </div>
                                {/* Status counts */}
                                <div className="flex items-center gap-3 text-[10px] flex-wrap">
                                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Lengkap: {statusCounts.lengkap}</span>
                                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> Sebagian: {statusCounts.sebagian}</span>
                                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-400" /> Belum: {statusCounts.belum}</span>
                                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-600" /> Lebih: {statusCounts.lebih}</span>
                                  <span className="text-muted-foreground ml-auto">{allItems.length} pos total</span>
                                </div>
                              </CardContent>
                            </Card>

                          </>
                        )
                      })()}

                      {/* ===== SPJ Detail Table ===== */}
                      {(() => {
                        const src = selectedSpjMonth === -1 ? spjData.tahunan : spjData.bulanan[selectedSpjMonth]
                        if (!src) return <div className="text-center py-8 text-muted-foreground text-sm">Pilih periode untuk melihat SPJ</div>

                        const filteredGroups = src.standarGroups.map(g => ({
                          ...g,
                          items: g.items.filter(item =>
                            !spjSearchTerm ||
                            item.uraian.toLowerCase().includes(spjSearchTerm.toLowerCase()) ||
                            item.kodeRekening.includes(spjSearchTerm) ||
                            item.kodeProgram.includes(spjSearchTerm) ||
                            item.standarNama.toLowerCase().includes(spjSearchTerm.toLowerCase()) ||
                            item.uraianBKU.toLowerCase().includes(spjSearchTerm.toLowerCase())
                          )
                        })).filter(g => g.items.length > 0)

                        return (
                          <>
                            {/* Search */}
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                              <Input
                                placeholder="Cari uraian, kode rekening, kode program, atau standar..."
                                value={spjSearchTerm}
                                onChange={e => setSpjSearchTerm(e.target.value)}
                                className="pl-9 h-8 text-xs"
                              />
                            </div>

                            {/* Per Standar Groups */}
                            {filteredGroups.map(group => {
                              const IconComp = STANDAR_ICONS[group.kode] || FileText
                              const colorIdx = (['02','03','04','05','06','07','08'].indexOf(group.kode))
                              const color = CHART_COLORS[colorIdx >= 0 ? colorIdx : 7]
                              const matchedCount = group.items.filter(i => i.realisasi > 0).length
                              return (
                                <Card key={group.kode}>
                                  <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
                                          <IconComp className="h-4 w-4" style={{ color }} />
                                        </div>
                                        <div>
                                          <CardTitle className="text-xs">{group.nama}</CardTitle>
                                          <p className="text-[10px] text-muted-foreground">{group.items.length} pos · {matchedCount} terealisasi</p>
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <div className="flex items-center gap-2 text-[11px]">
                                          <span className="text-muted-foreground">Anggaran:</span>
                                          <span className="font-semibold text-emerald-600">{fmtRp(group.anggaran)}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[11px]">
                                          <span className="text-muted-foreground">Realisasi:</span>
                                          <span className="font-semibold text-amber-600">{fmtRp(group.realisasi)}</span>
                                        </div>
                                      </div>
                                    </div>
                                    {/* Progress bar */}
                                    <div className="mt-2">
                                      <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                                        <div
                                          className={`h-full rounded-full transition-all ${
                                            group.persenRealisasi >= 95 ? 'bg-emerald-500' :
                                            group.persenRealisasi >= 50 ? 'bg-amber-500' :
                                            group.persenRealisasi > 0 ? 'bg-red-400' : 'bg-gray-300'
                                          }`}
                                          style={{ width: `${Math.min(group.persenRealisasi, 100)}%` }}
                                        />
                                      </div>
                                      <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-0.5">
                                        <span>{group.persenRealisasi}% terealisasi</span>
                                        <span>Selisih: {fmtRp(Math.abs(group.selisih))} {group.selisih >= 0 ? '(sisa)' : '(defisit)'}</span>
                                      </div>
                                    </div>
                                  </CardHeader>
                                  <CardContent className="pt-0">
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-[11px]">
                                        <thead>
                                          <tr className="border-b">
                                            <th className="text-left py-1.5 px-1 font-medium text-muted-foreground w-6">#</th>
                                            <th className="text-left py-1.5 px-1 font-medium text-muted-foreground">Kode Program</th>
                                            <th className="text-left py-1.5 px-1 font-medium text-muted-foreground">Kode Rekening</th>
                                            <th className="text-left py-1.5 px-1 font-medium text-muted-foreground">Uraian</th>
                                            <th className="text-right py-1.5 px-1 font-medium text-muted-foreground">Anggaran</th>
                                            <th className="text-right py-1.5 px-1 font-medium text-muted-foreground">Realisasi</th>
                                            <th className="text-right py-1.5 px-1 font-medium text-muted-foreground">Selisih</th>
                                            <th className="text-center py-1.5 px-1 font-medium text-muted-foreground w-14">%</th>
                                            <th className="text-center py-1.5 px-1 font-medium text-muted-foreground w-20">Status</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {group.items.map((item, idx) => {
                                            return (
                                              <tr key={idx} className={`border-b last:border-0 ${item.status === 'lebih' ? 'bg-rose-50/50 dark:bg-rose-950/20' : item.status === 'lengkap' ? 'bg-emerald-50/30 dark:bg-emerald-950/10' : 'hover:bg-muted/50'}`}>
                                                <td className="py-1.5 px-1 text-muted-foreground">{idx + 1}</td>
                                                <td className="py-1.5 px-1 font-mono text-[10px] text-muted-foreground" title={item.kodeProgram}>{item.kodeProgram.length > 10 ? item.kodeProgram.slice(0, 10) + '…' : item.kodeProgram}</td>
                                                <td className="py-1.5 px-1 font-mono text-[10px]">{item.kodeRekening}</td>
                                                <td className="py-1.5 px-1 max-w-[180px]">
                                                  <div className="truncate" title={item.uraian}>{item.uraian}</div>
                                                  {item.jumlahItem > 1 && (
                                                    <span className="text-[9px] text-muted-foreground">({item.jumlahItem} sub-item)</span>
                                                  )}
                                                  {item.uraianBKU && item.realisasi > 0 && (
                                                    <div className="text-[9px] text-amber-600 dark:text-amber-400 truncate" title={`BKU: ${item.uraianBKU}`}>
                                                      BKU: {item.uraianBKU}
                                                    </div>
                                                  )}
                                                </td>
                                                <td className="py-1.5 px-1 text-right font-medium text-emerald-700 dark:text-emerald-300">{fmtRp(item.anggaran)}</td>
                                                <td className="py-1.5 px-1 text-right font-medium text-amber-700 dark:text-amber-300">{item.realisasi > 0 ? fmtRp(item.realisasi) : '-'}</td>
                                                <td className={`py-1.5 px-1 text-right font-medium ${item.selisih >= 0 ? 'text-blue-700 dark:text-blue-300' : 'text-red-700 dark:text-red-300'}`}>{item.realisasi > 0 ? fmtRp(item.selisih) : '-'}</td>
                                                <td className="py-1.5 px-1 text-center font-medium">{item.persenRealisasi > 0 ? `${item.persenRealisasi}%` : '-'}</td>
                                                <td className="py-1.5 px-1 text-center">
                                                  <Badge variant="outline" className={`text-[9px] h-4 px-1 ${
                                                    item.status === 'lengkap' ? 'border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300' :
                                                    item.status === 'sebagian' ? 'border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300' :
                                                    item.status === 'lebih' ? 'border-rose-300 text-rose-700 dark:border-rose-700 dark:text-rose-300' :
                                                    'border-red-200 text-red-500 dark:border-red-700 dark:text-red-300'
                                                  }`}>
                                                    {item.status === 'lengkap' ? 'Lengkap' :
                                                     item.status === 'sebagian' ? 'Sebagian' :
                                                     item.status === 'lebih' ? 'Lebih' : 'Belum'}
                                                  </Badge>
                                                </td>
                                              </tr>
                                            )
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  </CardContent>
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
                                <Card className="border-dashed">
                                  <CardHeader className="pb-2">
                                    <CardTitle className="text-xs flex items-center gap-2">
                                      <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                                      Pos Tanpa Cocokan
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent className="space-y-3">
                                    {monthData.unmatchedBKU.length > 0 && (
                                      <div>
                                        <p className="text-[10px] font-medium text-amber-700 dark:text-amber-300 mb-1">
                                          Realisasi tanpa anggaran RKAS (BKU): {monthData.unmatchedBKU.length} pos · {fmtRp(totalUnmatchedBKU)}
                                        </p>
                                        <div className="space-y-0.5 max-h-40 overflow-y-auto">
                                          {monthData.unmatchedBKU.map((u, i) => (
                                            <div key={i} className="flex items-center gap-2 text-[10px]">
                                              <code className="font-mono text-muted-foreground shrink-0">{u.kodeKegiatan}|{u.kodeRekening}</code>
                                              <span className="truncate flex-1">{u.uraian}</span>
                                              <span className="font-medium text-amber-600 shrink-0">{fmtRp(u.jumlah)}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {monthData.unmatchedRKAS.length > 0 && (
                                      <div>
                                        <p className="text-[10px] font-medium text-red-700 dark:text-red-300 mb-1">
                                          Anggaran tanpa realisasi BKU (belum dibelanjakan): {monthData.unmatchedRKAS.length} pos · {fmtRp(totalUnmatchedRKAS)}
                                        </p>
                                        <div className="space-y-0.5 max-h-40 overflow-y-auto">
                                          {monthData.unmatchedRKAS.map((u, i) => (
                                            <div key={i} className="flex items-center gap-2 text-[10px]">
                                              <code className="font-mono text-muted-foreground shrink-0">{u.kodeProgram}|{u.kodeRekening}</code>
                                              <span className="truncate flex-1">{u.uraian}</span>
                                              <span className="font-medium text-red-600 shrink-0">{fmtRp(u.jumlah)}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </CardContent>
                                </Card>
                              )
                            })()}

                            {/* SPJ Bar Chart - Per Standar Comparison */}
                            {src.standarGroups.length > 1 && (
                              <Card>
                                <CardHeader className="pb-2"><CardTitle className="text-sm">Perbandingan Anggaran vs Realisasi per Standar SNP</CardTitle></CardHeader>
                                <CardContent>
                                  <ResponsiveContainer width="100%" height={280}>
                                    <BarChart data={src.standarGroups.map(g => ({
                                      name: g.nama.replace('Standar ', ''),
                                      Anggaran: g.anggaran,
                                      Realisasi: g.realisasi,
                                    }))} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                                      <XAxis fontSize={9} />
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
                          </>
                        )
                      })()}
                    </>
                  )
                )}

                {/* ===== GENERATED DOCUMENT SUB-TABS ===== */}
                {!['rekapitulasi', 'master-data', 'master-toko', 'data-sekolah', 'master-bpu', 'master-bnu'].includes(spjSubTab) && (() => {
                  const currentDocType = spjSubTab as SPJDocType

                  // Indonesian date helpers
                  const indonesianDays: Record<string, string> = { 'Sun': 'Minggu', 'Mon': 'Senin', 'Tue': 'Selasa', 'Wed': 'Rabu', 'Thu': 'Kamis', 'Fri': 'Jumat', 'Sat': 'Sabtu' }
                  const indonesianMonths: Record<string, string> = { '1': 'Januari', '2': 'Februari', '3': 'Maret', '4': 'April', '5': 'Mei', '6': 'Juni', '7': 'Juli', '8': 'Agustus', '9': 'September', '10': 'Oktober', '11': 'November', '12': 'Desember' }

                  const formatTanggalIndo = (dateStr: string): string => {
                    if (!dateStr) return '....................'
                    try {
                      const d = new Date(dateStr)
                      if (isNaN(d.getTime())) return '....................'
                      const day = indonesianDays[d.toString().slice(0, 3)] || ''
                      const tgl = d.getDate()
                      const bulan = indonesianMonths[String(d.getMonth() + 1)] || ''
                      const tahun = d.getFullYear()
                      return `${day}, ${tgl} ${bulan} ${tahun}`
                    } catch { return '....................' }
                  }

                  const formatTanggalShort = (dateStr: string): string => {
                    if (!dateStr) return '....................'
                    try {
                      const d = new Date(dateStr)
                      if (isNaN(d.getTime())) return '....................'
                      const tgl = d.getDate()
                      const bulan = indonesianMonths[String(d.getMonth() + 1)] || ''
                      const tahun = d.getFullYear()
                      return `${tgl} ${bulan} ${tahun}`
                    } catch { return '....................' }
                  }

                  // Get the selected record
                  const currentList = docType === 'bpu' ? bpuList : bnuList
                  const selectedId = docType === 'bpu' ? docSelectedBpuId : docSelectedBnuId
                  const selectedRecord = currentList.find((r: any) => r.id === selectedId)

                  // Filter BPU/BNU that have noPesanan filled
                  const eligibleBpu = bpuList.filter((b: any) => b.noPesanan && b.noPesanan.trim() !== '')
                  const eligibleBnu = bnuList.filter((b: any) => b.noPesanan && b.noPesanan.trim() !== '')

                  const toko = selectedRecord?.toko
                  const items = selectedRecord?.items || []
                  const tglPesan = selectedRecord?.tglPesan || ''
                  const tahunAnggaran = tglPesan ? new Date(tglPesan).getFullYear().toString() : new Date().getFullYear().toString()

                  // Compute totals
                  const totalJumlah = items.reduce((s: number, i: any) => s + (i.jumlah || 0), 0)

                  // Letterhead from sekolahData
                  const kopSurat = (
                    <div style={{ paddingBottom: `${sekolahData.garisBawahJarak || 4}pt`, marginBottom: '16px' }}>
                      {/* 0 logos: just centered text */}
                      {((!sekolahData.logoKiriUrl && !sekolahData.logoKananUrl)) && (
                        <div className="text-center">
                          {kopRows.length > 0 ? (
                            [...kopRows].sort((a, b) => a.urutan - b.urutan).map((row) => (
                              <p
                                key={row.id}
                                style={{
                                  fontFamily: row.fontFamily,
                                  fontSize: `${row.fontSize}pt`,
                                  fontWeight: row.bold ? 'bold' : 'normal',
                                  fontStyle: row.italic ? 'italic' : 'normal',
                                  textTransform: row.uppercase ? 'uppercase' : 'none',
                                  lineHeight: row.lineHeight || 1.3,
                                }}
                              >
                                {row.teks || '........................'}
                              </p>
                            ))
                          ) : (
                            <>
                              <p className="text-[13px] font-bold uppercase">{sekolahData.namaSekolah || '........................'}</p>
                              <p className="text-[10px]">NPSN: {sekolahData.npsn || '............'}</p>
                              <p className="text-[10px]">{sekolahData.alamat || '............'}</p>
                            </>
                          )}
                        </div>
                      )}
                      {/* 1 logo kiri only */}
                      {sekolahData.logoKiriUrl && !sekolahData.logoKananUrl && (
                        <div className="flex items-center">
                          <div style={{ width: `${(sekolahData.logoKiriLebar || 2.5) * 10}mm`, flexShrink: 0 }}>
                            <img src={sekolahData.logoKiriUrl} alt="Logo Kiri" style={{ height: `${(sekolahData.logoKiriTinggi || 3) * 10}mm`, width: `${(sekolahData.logoKiriLebar || 2.5) * 10}mm`, objectFit: 'contain' }} />
                          </div>
                          <div className="text-center flex-1 min-w-0 px-2">
                            {kopRows.length > 0 ? (
                              [...kopRows].sort((a, b) => a.urutan - b.urutan).map((row) => (
                                <p
                                  key={row.id}
                                  style={{
                                    fontFamily: row.fontFamily,
                                    fontSize: `${row.fontSize}pt`,
                                    fontWeight: row.bold ? 'bold' : 'normal',
                                    fontStyle: row.italic ? 'italic' : 'normal',
                                    textTransform: row.uppercase ? 'uppercase' : 'none',
                                    lineHeight: row.lineHeight || 1.3,
                                  }}
                                >
                                  {row.teks || '........................'}
                                </p>
                              ))
                            ) : (
                              <>
                                <p className="text-[13px] font-bold uppercase">{sekolahData.namaSekolah || '........................'}</p>
                                <p className="text-[10px]">NPSN: {sekolahData.npsn || '............'}</p>
                                <p className="text-[10px]">{sekolahData.alamat || '............'}</p>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                      {/* 1 logo kanan only */}
                      {!sekolahData.logoKiriUrl && sekolahData.logoKananUrl && (
                        <div className="flex items-center">
                          <div className="text-center flex-1 min-w-0 px-2">
                            {kopRows.length > 0 ? (
                              [...kopRows].sort((a, b) => a.urutan - b.urutan).map((row) => (
                                <p
                                  key={row.id}
                                  style={{
                                    fontFamily: row.fontFamily,
                                    fontSize: `${row.fontSize}pt`,
                                    fontWeight: row.bold ? 'bold' : 'normal',
                                    fontStyle: row.italic ? 'italic' : 'normal',
                                    textTransform: row.uppercase ? 'uppercase' : 'none',
                                    lineHeight: row.lineHeight || 1.3,
                                  }}
                                >
                                  {row.teks || '........................'}
                                </p>
                              ))
                            ) : (
                              <>
                                <p className="text-[13px] font-bold uppercase">{sekolahData.namaSekolah || '........................'}</p>
                                <p className="text-[10px]">NPSN: {sekolahData.npsn || '............'}</p>
                                <p className="text-[10px]">{sekolahData.alamat || '............'}</p>
                              </>
                            )}
                          </div>
                          <div style={{ width: `${(sekolahData.logoKananLebar || 2.5) * 10}mm`, flexShrink: 0 }}>
                            <img src={sekolahData.logoKananUrl} alt="Logo Kanan" style={{ height: `${(sekolahData.logoKananTinggi || 3) * 10}mm`, width: `${(sekolahData.logoKananLebar || 2.5) * 10}mm`, objectFit: 'contain' }} />
                          </div>
                        </div>
                      )}
                      {/* 2 logos: classic 3-column layout */}
                      {sekolahData.logoKiriUrl && sekolahData.logoKananUrl && (
                        <div className="flex items-center justify-between">
                          <div style={{ width: `${(sekolahData.logoKiriLebar || 2.5) * 10}mm`, flexShrink: 0 }}>
                            <img src={sekolahData.logoKiriUrl} alt="Logo Kiri" style={{ height: `${(sekolahData.logoKiriTinggi || 3) * 10}mm`, width: `${(sekolahData.logoKiriLebar || 2.5) * 10}mm`, objectFit: 'contain' }} />
                          </div>
                          <div className="text-center flex-1 min-w-0 px-2">
                            {kopRows.length > 0 ? (
                              [...kopRows].sort((a, b) => a.urutan - b.urutan).map((row) => (
                                <p
                                  key={row.id}
                                  style={{
                                    fontFamily: row.fontFamily,
                                    fontSize: `${row.fontSize}pt`,
                                    fontWeight: row.bold ? 'bold' : 'normal',
                                    fontStyle: row.italic ? 'italic' : 'normal',
                                    textTransform: row.uppercase ? 'uppercase' : 'none',
                                    lineHeight: row.lineHeight || 1.3,
                                  }}
                                >
                                  {row.teks || '........................'}
                                </p>
                              ))
                            ) : (
                              <>
                                <p className="text-[13px] font-bold uppercase">{sekolahData.namaSekolah || '........................'}</p>
                                <p className="text-[10px]">NPSN: {sekolahData.npsn || '............'}</p>
                                <p className="text-[10px]">{sekolahData.alamat || '............'}</p>
                              </>
                            )}
                          </div>
                          <div style={{ width: `${(sekolahData.logoKananLebar || 2.5) * 10}mm`, flexShrink: 0 }}>
                            <img src={sekolahData.logoKananUrl} alt="Logo Kanan" style={{ height: `${(sekolahData.logoKananTinggi || 3) * 10}mm`, width: `${(sekolahData.logoKananLebar || 2.5) * 10}mm`, objectFit: 'contain' }} />
                          </div>
                        </div>
                      )}
                      {/* Garis bawah */}
                      {renderGarisBawah(sekolahData.garisBawahStyle || 'single-thick')}
                    </div>
                  )

                  // Signature helper
                  const signatureBlock = (signatories: { label: string; name: string; nip?: string }[]) => (
                    <div className="flex justify-around mt-8">
                      {signatories.map((s, i) => (
                        <div key={i} className="text-center w-40">
                          <p className="text-[10px]">{s.label}</p>
                          <div className="h-16" />
                          <p className="text-[11px] font-bold underline">{s.name || '........................'}</p>
                          {s.nip && <p className="text-[9px]">NIP. {s.nip || '....................'}</p>}
                        </div>
                      ))}
                    </div>
                  )

                  // Doc type config
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
                      {/* ===== BPU/BNU SELECTOR ===== */}
                      <Card>
                        <CardContent className="py-3 px-4">
                          <div className="flex items-center gap-4 flex-wrap">
                            {/* BPU / BNU Toggle */}
                            <div className="flex items-center gap-1">
                              <Button
                                variant={docType === 'bpu' ? 'default' : 'outline'}
                                size="sm" className="h-7 text-[11px] gap-1"
                                onClick={() => { setDocType('bpu'); setDocSelectedBnuId('') }}
                              >
                                <ClipboardList className="h-3 w-3" /> BPU
                              </Button>
                              <Button
                                variant={docType === 'bnu' ? 'default' : 'outline'}
                                size="sm" className="h-7 text-[11px] gap-1"
                                onClick={() => { setDocType('bnu'); setDocSelectedBpuId('') }}
                              >
                                <Users className="h-3 w-3" /> BNU
                              </Button>
                            </div>

                            <Separator orientation="vertical" className="h-5" />

                            {/* BPU/BNU Dropdown */}
                            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                              <span className="text-[10px] text-muted-foreground font-medium shrink-0">Pilih {docType === 'bpu' ? 'BPU' : 'BNU'}:</span>
                              <select
                                className="h-7 text-[11px] border rounded-md px-2 flex-1 bg-background"
                                value={selectedId}
                                onChange={e => {
                                  if (docType === 'bpu') setDocSelectedBpuId(e.target.value)
                                  else setDocSelectedBnuId(e.target.value)
                                }}
                              >
                                <option value="">-- Pilih --</option>
                                {(docType === 'bpu' ? eligibleBpu : eligibleBnu).map((r: any) => (
                                  <option key={r.id} value={r.id}>
                                    {r.noBukti} - No Pesanan: {r.noPesanan} {r.toko ? `(${r.toko.namaToko})` : '(belum ada toko)'}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* Warnings */}
                          {selectedId && !toko && (
                            <div className="mt-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md flex items-center gap-2 text-[10px] text-amber-700 dark:text-amber-300">
                              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                              {docType === 'bpu' ? 'BPU' : 'BNU'} ini belum memiliki toko yang ditugaskan. Silakan atur toko di Master {docType === 'bpu' ? 'BPU' : 'BNU'} terlebih dahulu.
                            </div>
                          )}
                          {selectedId && !sekolahData.namaSekolah && (
                            <div className="mt-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md flex items-center gap-2 text-[10px] text-amber-700 dark:text-amber-300">
                              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                              Data Sekolah belum diisi. Silakan lengkapi di tab Data Sekolah terlebih dahulu.
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Header Card */}
                      <Card className={`${config.borderClass} ${config.bgClass}`}>
                        <CardContent className="py-3 px-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${config.bgClass}`}>
                                <IconComp className={`h-5 w-5 ${config.iconTextClass}`} />
                              </div>
                              <div>
                                <h3 className={`text-sm font-semibold ${config.textClass}`}>{config.label}</h3>
                                <p className="text-[10px] text-muted-foreground">
                                  Data digenerate dari Master {docType === 'bpu' ? 'BPU' : 'BNU'}, Master Toko & Data Sekolah · Cetak sebagai bukti pertanggungjawaban
                                </p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              className={`gap-1.5 ${config.bgClass} ${config.textClass} hover:opacity-90`}
                              onClick={() => handlePrintDoc(currentDocType)}
                              disabled={!selectedRecord}
                            >
                              <Printer className="h-3.5 w-3.5" />
                              Cetak Dokumen
                            </Button>
                          </div>
                        </CardContent>
                      </Card>

                      {/* No record selected */}
                      {!selectedRecord ? (
                        <Card className="border-dashed">
                          <CardContent className="py-12 text-center space-y-2">
                            <div className={`h-12 w-12 rounded-xl ${config.bgClass} flex items-center justify-center mx-auto`}>
                              <IconComp className={`h-6 w-6 ${config.iconTextClass}`} />
                            </div>
                            <div>
                              <h4 className="text-xs font-medium">Pilih {docType === 'bpu' ? 'BPU' : 'BNU'} terlebih dahulu</h4>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {(docType === 'bpu' ? eligibleBpu : eligibleBnu).length === 0
                                  ? `Belum ada ${docType === 'bpu' ? 'BPU' : 'BNU'} dengan No Pesanan. Isi No Pesanan di Master ${docType === 'bpu' ? 'BPU' : 'BNU'} terlebih dahulu.`
                                  : `Pilih ${docType === 'bpu' ? 'BPU' : 'BNU'} dari dropdown di atas untuk menggenerate dokumen.`}
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      ) : (
                        <>
                          {/* ===== DOCUMENT PREVIEW ===== */}
                          <Card className="overflow-hidden">
                            <div className="bg-gray-100 dark:bg-gray-800 py-1.5 px-4 flex items-center justify-between">
                              <span className="text-[10px] font-medium text-muted-foreground">Preview Dokumen</span>
                              <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={() => handlePrintDoc(currentDocType)}>
                                <Printer className="h-3 w-3" /> Cetak
                              </Button>
                            </div>
                            <CardContent className="p-0">
                              <div className="flex justify-center bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 overflow-auto">
                                <div id={`doc-content-${currentDocType}`} className="bg-white text-black shadow-lg w-[210mm] min-h-[297mm] p-[20mm]" style={{ fontFamily: 'Times New Roman, serif', fontSize: '12pt' }}>

                                  {/* ===== A. SURAT PESANAN (01PESAN) ===== */}
                                  {currentDocType === 'surat-pesanan' && (
                                    <div>
                                      {kopSurat}

                                      {/* Judul SURAT PESANAN */}
                                      <div className="text-center mt-2 mb-1">
                                        <p className="font-bold text-[13pt]">SURAT PESANAN</p>
                                        <p className="text-[11pt]">Nomor: {selectedRecord?.nomorSuratPesanan || '............'}</p>
                                      </div>

                                      {/* Tabel Info 2 Kolom */}
                                      <table className="w-full border-collapse border border-black text-[10pt] mb-0">
                                        <tbody>
                                          <tr>
                                            <td className="border border-black px-2 py-0.5" style={{ width: '50%' }}>
                                              <table className="w-full text-[10pt]">
                                                <tbody>
                                                  <tr><td className="py-0.5">Paket Pesanan :</td></tr>
                                                  <tr><td className="py-0.5">Kegiatan jual beli dengan mitra {toko?.namaToko || '........................'}</td></tr>
                                                  <tr><td className="py-0.5">Waktu Pengerjaan Pesanan : {tglPesan ? formatTanggalShort(tglPesan) : '............'}</td></tr>
                                                  <tr><td className="py-0.5">Waktu Pemrosesan Pesanan : {tglPesan ? formatTanggalShort(tglPesan) : '............'}</td></tr>
                                                  <tr><td className="py-0.5">Waktu Penyelesaian Pesanan : {tglPesan ? formatTanggalShort(tglPesan) : '............'}</td></tr>
                                                </tbody>
                                              </table>
                                            </td>
                                            <td className="border border-black px-2 py-0.5" style={{ width: '50%' }}>
                                              <table className="w-full text-[10pt]">
                                                <tbody>
                                                  <tr><td className="py-0.5">Nomor Surat Pesanan : {selectedRecord?.nomorSuratPesanan || '............'}</td></tr>
                                                  <tr><td className="py-0.5">Tanggal Pesanan : {tglPesan ? formatTanggalShort(tglPesan) : '............'}</td></tr>
                                                  <tr><td className="py-0.5">Tanggal Negosiasi : </td></tr>
                                                  <tr><td className="py-0.5">No. BPU : {selectedRecord?.noBukti || '............'}</td></tr>
                                                  <tr><td className="py-0.5">Catatan Pengiriman Untuk Penyedia : </td></tr>
                                                </tbody>
                                              </table>
                                            </td>
                                          </tr>
                                        </tbody>
                                      </table>

                                      {/* RINCIAN PEKERJAAN */}
                                      <table className="w-full border-collapse border border-black text-[10pt]">
                                        <thead>
                                          <tr>
                                            <th colSpan={6} className="border border-black px-2 py-1 text-center font-bold text-[11pt]">RINCIAN PEKERJAAN</th>
                                          </tr>
                                          <tr>
                                            <th className="border border-black px-1 py-1 text-center w-6">No</th>
                                            <th className="border border-black px-2 py-1 text-left">Uraian Barang / Jasa</th>
                                            <th className="border border-black px-2 py-1 text-center w-14">Jumlah</th>
                                            <th className="border border-black px-2 py-1 text-center w-20">Satuan Ukuran</th>
                                            <th className="border border-black px-2 py-1 text-right w-28">Harga Satuan</th>
                                            <th className="border border-black px-2 py-1 text-right w-28">Total Harga</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {items.map((item: any, idx: number) => (
                                            <tr key={idx}>
                                              <td className="border border-black px-1 py-0.5 text-center">{idx + 1}</td>
                                              <td className="border border-black px-2 py-0.5">{item.uraian || '-'}</td>
                                              <td className="border border-black px-2 py-0.5 text-center">{item.volume || '1'}</td>
                                              <td className="border border-black px-2 py-0.5 text-center">{item.satuan || 'Paket'}</td>
                                              <td className="border border-black px-2 py-0.5 text-right">{item.tarifHarga ? fmtRp(item.tarifHarga) : fmtRp(item.jumlah || 0)}</td>
                                              <td className="border border-black px-2 py-0.5 text-right">{fmtRp(item.jumlah || 0)}</td>
                                            </tr>
                                          ))}
                                          {items.length === 0 && (
                                            <tr>
                                              <td colSpan={6} className="border border-black px-2 py-4 text-center text-gray-400 italic">Belum ada item</td>
                                            </tr>
                                          )}
                                          {/* Harga sebelum PPN */}
                                          <tr>
                                            <td colSpan={5} className="border border-black px-2 py-0.5 text-right font-bold">Harga sebelum PPN</td>
                                            <td className="border border-black px-2 py-0.5 text-right">{fmtRp(totalJumlah)}</td>
                                          </tr>
                                          {/* DPP PPN */}
                                          <tr>
                                            <td colSpan={5} className="border border-black px-2 py-0.5 text-right">DPP PPN</td>
                                            <td className="border border-black px-2 py-0.5 text-right">{fmtRp(Math.round(totalJumlah / 1.11))}</td>
                                          </tr>
                                          {/* PPN 11% */}
                                          <tr>
                                            <td colSpan={5} className="border border-black px-2 py-0.5 text-right">PPN 11%</td>
                                            <td className="border border-black px-2 py-0.5 text-right">{fmtRp(totalJumlah - Math.round(totalJumlah / 1.11))}</td>
                                          </tr>
                                          {/* Total Pembayaran */}
                                          <tr className="font-bold">
                                            <td colSpan={5} className="border border-black px-2 py-0.5 text-right">Total Pembayaran</td>
                                            <td className="border border-black px-2 py-0.5 text-right">{fmtRp(totalJumlah)}</td>
                                          </tr>
                                          {/* PPh 23 2% */}
                                          <tr>
                                            <td colSpan={5} className="border border-black px-2 py-0.5 text-right">PPh 23 2%</td>
                                            <td className="border border-black px-2 py-0.5 text-right">-</td>
                                          </tr>
                                          {/* Terbilang */}
                                          <tr>
                                            <td colSpan={6} className="border border-black px-2 py-0.5 text-center italic">
                                              Terbilang : {totalJumlah > 0 ? terbilang(totalJumlah) + ' Rupiah' : '........................................................'}
                                            </td>
                                          </tr>
                                        </tbody>
                                      </table>

                                      {/* SYARAT-SYARAT */}
                                      <div className="mt-3 text-[10pt]">
                                        <p className="font-bold mb-1">Instruksi ke Penyedia dan Satuan Pendidikan :</p>
                                        <ol className="list-decimal pl-5 space-y-0.5 text-justify" style={{ lineHeight: '1.4' }}>
                                          <li>Penyedia berkewajiban untuk menyediakan barang/jasa sesuai dengan surat pesanan dan dalam jangka waktu transaksi yang berlaku.</li>
                                          <li>Penyedia berhak meminta pembayaran sesuai total pembayaran setelah penyelesaian pekerjaan yang dimintakan pada Surat Pesanan ini dan dibuktikan dengan Berita Acara Serah Terima.</li>
                                          <li>Pelaksana dalam kapasitas mewakili Satuan Pendidikan berhak untuk mendapatkan barang atau jasa sesuai Surat Pesanan ini.</li>
                                          <li>Pelaksana berhak menolak barang/jasa yang tidak sesuai dengan surat pesanan.</li>
                                          <li>Pelaksana dalam kapasitas mewakili Satuan Pendidikan berkewajiban untuk menyelesaikan pembayaran sesuai dengan mekanisme pembayaran yang berlaku pada sistem.</li>
                                          <li>Segala perselisihan yang timbul dari Surat Pesanan ini diselesaikan antara para pihak sesuai ketentuan yang berlaku.</li>
                                        </ol>
                                      </div>

                                      {/* Tanggal & Tanda Tangan */}
                                      <div className="flex justify-between mt-4 text-[10pt]">
                                        <div className="text-center w-40">
                                          <p>&nbsp;</p>
                                          <p className="mt-1 font-bold">{toko?.namaToko || '........................'}</p>
                                          <div className="h-16" />
                                          <p className="font-bold underline">{toko?.direktur || '........................'}</p>
                                          <p>Direktur</p>
                                        </div>
                                        <div className="text-left">
                                          <p>Telukdalam, {tglPesan ? formatTanggalShort(tglPesan) : '............'}</p>
                                          <p className="mt-1">Pelaksana,</p>
                                          <div className="h-16" />
                                          <p className="font-bold underline">{sekolahData.kepalaSekolah || '........................'}</p>
                                          <p>Pembina Tk I</p>
                                          {sekolahData.nipKepala && <p>NIP. {sekolahData.nipKepala}</p>}
                                        </div>
                                      </div>

                                      {/* TANDA PEMBAYARAN (Kuitansi) - Halaman baru saat cetak */}
                                      <div className="mt-6 border-t border-black pt-3" style={{ breakBefore: 'page' }}>
                                        <table className="w-full text-[10pt] mb-2">
                                          <tbody>
                                            <tr className="py-0.5">
                                              <td style={{ whiteSpace: 'nowrap' }}>Sumber Anggaran</td>
                                              <td>&nbsp;:&nbsp;</td>
                                              <td>Dana BOSP {tahunAnggaran}</td>
                                              <td style={{ width: '8%' }} />
                                              <td style={{ whiteSpace: 'nowrap' }}>Program</td>
                                              <td>&nbsp;:&nbsp;</td>
                                              <td>06.05</td>
                                            </tr>
                                            <tr className="py-0.5">
                                              <td style={{ whiteSpace: 'nowrap' }}>Kas/Pos Tanggal</td>
                                              <td>&nbsp;:&nbsp;</td>
                                              <td>{tglPesan ? formatTanggalShort(tglPesan) : '............'}</td>
                                              <td />
                                              <td style={{ whiteSpace: 'nowrap' }}>Kegiatan</td>
                                              <td>&nbsp;:&nbsp;</td>
                                              <td>06.05.08.</td>
                                            </tr>
                                            <tr className="py-0.5">
                                              <td style={{ whiteSpace: 'nowrap' }}>Nomor</td>
                                              <td>&nbsp;:&nbsp;</td>
                                              <td>{selectedRecord?.noBukti || '............'}</td>
                                              <td />
                                              <td style={{ whiteSpace: 'nowrap' }}>Kode Rek</td>
                                              <td>&nbsp;:&nbsp;</td>
                                              <td>5.1.02.01.01.0024</td>
                                            </tr>
                                          </tbody>
                                        </table>

                                        <p className="font-bold text-center text-[11pt] mb-2">TANDA PEMBAYARAN</p>

                                        <table className="w-full text-[10pt]" style={{ lineHeight: '1.5' }}>
                                          <tbody>
                                            <tr>
                                              <td style={{ whiteSpace: 'nowrap', verticalAlign: 'top' }}>Sudah terima dari</td>
                                              <td style={{ verticalAlign: 'top' }}>&nbsp;:&nbsp;</td>
                                              <td>Bendahara {sekolahData.namaSekolah || '........................'}</td>
                                            </tr>
                                            <tr>
                                              <td style={{ whiteSpace: 'nowrap', verticalAlign: 'top' }}>Uang sebesar</td>
                                              <td style={{ verticalAlign: 'top' }}>&nbsp;:&nbsp;</td>
                                              <td>Rp {totalJumlah > 0 ? fmt(totalJumlah) : '............'}</td>
                                            </tr>
                                            <tr>
                                              <td style={{ whiteSpace: 'nowrap', verticalAlign: 'top' }}>Terbilang</td>
                                              <td style={{ verticalAlign: 'top' }}>&nbsp;:&nbsp;</td>
                                              <td className="italic">{totalJumlah > 0 ? terbilang(totalJumlah) + ' Rupiah' : '........................................................'}</td>
                                            </tr>
                                            <tr>
                                              <td style={{ whiteSpace: 'nowrap', verticalAlign: 'top' }}>Nomor Surat persetujuan penyediaan barang dan jasa</td>
                                              <td style={{ verticalAlign: 'top' }}>&nbsp;:&nbsp;</td>
                                              <td>{selectedRecord?.nomorSuratPesanan || '............'}</td>
                                            </tr>
                                            <tr>
                                              <td style={{ whiteSpace: 'nowrap', verticalAlign: 'top' }}>Untuk pembayaran</td>
                                              <td style={{ verticalAlign: 'top' }}>&nbsp;:&nbsp;</td>
                                              <td>Pengadaan Alat Tulis Kantor (ATK)</td>
                                            </tr>
                                          </tbody>
                                        </table>

                                        <div className="grid grid-cols-3 gap-2 mt-4 text-[10pt]">
                                          <div className="text-center">
                                            <p className="font-bold">Mengetahui :</p>
                                            <p>Pengurus Barang</p>
                                            <div className="h-16" />
                                            <p className="font-bold underline">{sekolahData.pengurusBarang || '........................'}</p>
                                            <p>Penata Muda</p>
                                            {sekolahData.nipPengurus && <p>NIP. {sekolahData.nipPengurus}</p>}
                                          </div>
                                          <div className="text-center">
                                            <p className="font-bold">Lunas Bayar Oleh :</p>
                                            <p>Bendahara {sekolahData.namaSekolah || '........................'}</p>
                                            <div className="h-16" />
                                            <p className="font-bold underline">{sekolahData.bendahara || '........................'}</p>
                                            <p>Penata TK. I</p>
                                            {sekolahData.nipBendahara && <p>NIP. {sekolahData.nipBendahara}</p>}
                                          </div>
                                          <div className="text-center">
                                            <p className="font-bold">Diterima oleh :</p>
                                            <p>{toko?.namaToko || '........................'}</p>
                                            <div className="h-16" />
                                            <p>-</p>
                                            <p>Direktur</p>
                                          </div>
                                        </div>

                                        <div className="text-center mt-6 text-[10pt]">
                                          <p className="font-bold">Menyetujui :</p>
                                          <p>Kepala Sekolah {sekolahData.namaSekolah || '........................'}</p>
                                          <div className="h-16" />
                                          <p className="font-bold underline">{sekolahData.kepalaSekolah || '........................'}</p>
                                          <p>Pembina Tk I</p>
                                          {sekolahData.nipKepala && <p>NIP. {sekolahData.nipKepala}</p>}
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* ===== B. DOKUMEN HASIL PEMBANDING (02BANDING) ===== */}
                                  {currentDocType === 'surat-balasan' && (
                                    <div>
                                      {kopSurat}
                                      <h2 className="text-center font-bold text-[13pt] mb-1">DOKUMEN HASIL PEMBANDING HARGA</h2>
                                      <p className="text-center mb-4">Nomor: {selectedRecord?.nomorSuratPesanan || '............'}</p>
                                      <table className="w-full border-collapse border border-black mb-4">
                                        <thead>
                                          <tr className="bg-gray-100">
                                            <th className="border border-black px-2 py-1 text-center w-10">No</th>
                                            <th className="border border-black px-2 py-1 text-left">Uraian</th>
                                            <th className="border border-black px-2 py-1 text-center w-24">Produk I ({toko?.namaToko || 'Toko 1'})</th>
                                            <th className="border border-black px-2 py-1 text-right w-24">Harga I</th>
                                            <th className="border border-black px-2 py-1 text-center w-24">Produk II</th>
                                            <th className="border border-black px-2 py-1 text-right w-24">Harga II</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {items.map((item: any, idx: number) => (
                                            <tr key={idx}>
                                              <td className="border border-black px-2 py-1 text-center">{idx + 1}</td>
                                              <td className="border border-black px-2 py-1">{item.uraian || '-'}</td>
                                              <td className="border border-black px-2 py-1 text-center">{toko?.namaToko || '-'}</td>
                                              <td className="border border-black px-2 py-1 text-right">{fmtRp(item.jumlah || 0)}</td>
                                              <td className="border border-black px-2 py-1 text-center">Toko Lain</td>
                                              <td className="border border-black px-2 py-1 text-right">{item.hargaToko2 > 0 ? fmtRp(item.hargaToko2) : '-'}</td>
                                            </tr>
                                          ))}
                                          {items.length === 0 && (
                                            <tr>
                                              <td colSpan={6} className="border border-black px-2 py-4 text-center text-gray-400 italic">Belum ada item</td>
                                            </tr>
                                          )}
                                        </tbody>
                                      </table>
                                      <p className="mb-4 text-justify">
                                        Keterangan: Toko terpilih adalah <span className="font-bold">{toko?.namaToko || '............'}</span> dengan harga paling kompetitif.
                                      </p>
                                      <div className="text-right mb-2">
                                        <p>{formatTanggalShort(tglPesan)}</p>
                                      </div>
                                      <div className="flex justify-around mt-4">
                                        <div className="text-center w-36">
                                          <p className="text-[10px]">Penyedia,</p>
                                          <div className="h-16" />
                                          <p className="text-[11px] font-bold underline">{toko?.direktur || '........................'}</p>
                                        </div>
                                        <div className="text-center w-36">
                                          <p className="text-[10px]">Pengurus Barang,</p>
                                          <div className="h-16" />
                                          <p className="text-[11px] font-bold underline">{sekolahData.pengurusBarang || '........................'}</p>
                                          {sekolahData.nipPengurus && <p className="text-[9px]">NIP. {sekolahData.nipPengurus}</p>}
                                        </div>
                                        <div className="text-center w-36">
                                          <p className="text-[10px]">Kepala Sekolah,</p>
                                          <div className="h-16" />
                                          <p className="text-[11px] font-bold underline">{sekolahData.kepalaSekolah || '........................'}</p>
                                          {sekolahData.nipKepala && <p className="text-[9px]">NIP. {sekolahData.nipKepala}</p>}
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* ===== C. DOKUMEN PERENCANAAN (03RENCANA) ===== */}
                                  {currentDocType === 'dokumen-perencanaan' && (
                                    <div>
                                      {kopSurat}
                                      <h2 className="text-center font-bold text-[13pt] mb-1">DOKUMEN PERENCANAAN PENGADAAN BARANG/JASA</h2>
                                      <p className="text-center mb-4">Tahun Anggaran {tahunAnggaran}</p>

                                      <table className="mb-4">
                                        <tbody>
                                          <tr><td className="w-36 py-0.5">Nama Sekolah</td><td className="py-0.5">: {sekolahData.namaSekolah || '........................'}</td></tr>
                                          <tr><td className="py-0.5">NPSN</td><td className="py-0.5">: {sekolahData.npsn || '............'}</td></tr>
                                          <tr><td className="py-0.5">Alamat</td><td className="py-0.5">: {sekolahData.alamat || '............'}</td></tr>
                                          <tr><td className="py-0.5">Kategori</td><td className="py-0.5">: {toko?.kategori || 'Barang'}</td></tr>
                                        </tbody>
                                      </table>

                                      <p className="font-bold mb-2">Daftar Spesifikasi:</p>
                                      <table className="w-full border-collapse border border-black mb-4">
                                        <thead>
                                          <tr className="bg-gray-100">
                                            <th className="border border-black px-2 py-1 text-center w-10">No</th>
                                            <th className="border border-black px-2 py-1 text-left">Uraian Barang/Jasa</th>
                                            <th className="border border-black px-2 py-1 text-center w-14">Jumlah</th>
                                            <th className="border border-black px-2 py-1 text-center w-16">Satuan</th>
                                            <th className="border border-black px-2 py-1 text-center w-12">✓</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {items.map((item: any, idx: number) => (
                                            <tr key={idx}>
                                              <td className="border border-black px-2 py-1 text-center">{idx + 1}</td>
                                              <td className="border border-black px-2 py-1">{item.uraian || '-'}</td>
                                              <td className="border border-black px-2 py-1 text-center">{item.volume || '1'}</td>
                                              <td className="border border-black px-2 py-1 text-center">{item.satuan || 'Paket'}</td>
                                              <td className="border border-black px-2 py-1 text-center">✓</td>
                                            </tr>
                                          ))}
                                          {items.length === 0 && (
                                            <tr>
                                              <td colSpan={5} className="border border-black px-2 py-4 text-center text-gray-400 italic">Belum ada item</td>
                                            </tr>
                                          )}
                                        </tbody>
                                      </table>

                                      <div className="text-right mb-2">
                                        <p>{formatTanggalShort(tglPesan)}</p>
                                      </div>
                                      <div className="flex justify-around mt-4">
                                        <div className="text-center w-36">
                                          <p className="text-[10px]">Pengurus Barang,</p>
                                          <div className="h-16" />
                                          <p className="text-[11px] font-bold underline">{sekolahData.pengurusBarang || '........................'}</p>
                                          {sekolahData.nipPengurus && <p className="text-[9px]">NIP. {sekolahData.nipPengurus}</p>}
                                        </div>
                                        <div className="text-center w-36">
                                          <p className="text-[10px]">Kepala Sekolah,</p>
                                          <div className="h-16" />
                                          <p className="text-[11px] font-bold underline">{sekolahData.kepalaSekolah || '........................'}</p>
                                          {sekolahData.nipKepala && <p className="text-[9px]">NIP. {sekolahData.nipKepala}</p>}
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* ===== D. SURAT HASIL PEMERIKSAAN (04SHP) ===== */}
                                  {currentDocType === 'surat-hasil-pemeriksaan' && (
                                    <div>
                                      {kopSurat}
                                      <h2 className="text-center font-bold text-[13pt] mb-1">SURAT HASIL PEMERIKSAAN BARANG/JASA</h2>
                                      <p className="text-center mb-4">Nomor: {selectedRecord?.nomorSuratSHP || '............'}</p>

                                      <p className="mb-2">
                                        Pada hari {formatTanggalIndo(tglPesan)}, kami yang bertanda tangan di bawah ini:
                                      </p>

                                      <div className="mb-4 ml-6">
                                        <table>
                                          <tbody>
                                            <tr><td className="w-24 py-0.5">Nama</td><td className="py-0.5">: {sekolahData.penerimaBarang || '........................'}</td></tr>
                                            <tr><td className="py-0.5">Jabatan</td><td className="py-0.5">: Penerima Barang</td></tr>
                                          </tbody>
                                        </table>
                                        <div className="h-2" />
                                        <table>
                                          <tbody>
                                            <tr><td className="w-24 py-0.5">Nama</td><td className="py-0.5">: {sekolahData.pengurusBarang || '........................'}</td></tr>
                                            <tr><td className="py-0.5">Jabatan</td><td className="py-0.5">: Pengurus Barang</td></tr>
                                          </tbody>
                                        </table>
                                      </div>

                                      <p className="text-justify mb-2">
                                        Telah melakukan pemeriksaan terhadap barang/jasa yang diserahkan oleh:
                                      </p>
                                      <div className="ml-6 mb-4">
                                        <p className="font-bold">{toko?.namaToko || '[Nama Toko]'}</p>
                                        <p>{toko?.alamat || '[Alamat Toko]'}</p>
                                      </div>

                                      <table className="w-full border-collapse border border-black mb-4">
                                        <thead>
                                          <tr className="bg-gray-100">
                                            <th className="border border-black px-2 py-1 text-center w-10">No</th>
                                            <th className="border border-black px-2 py-1 text-left">Nama Barang</th>
                                            <th className="border border-black px-2 py-1 text-center w-14">Jumlah</th>
                                            <th className="border border-black px-2 py-1 text-center w-20">Kondisi</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {items.map((item: any, idx: number) => (
                                            <tr key={idx}>
                                              <td className="border border-black px-2 py-1 text-center">{idx + 1}</td>
                                              <td className="border border-black px-2 py-1">{item.uraian || '-'}</td>
                                              <td className="border border-black px-2 py-1 text-center">{item.volume || '1'}</td>
                                              <td className="border border-black px-2 py-1 text-center">Baik</td>
                                            </tr>
                                          ))}
                                          {items.length === 0 && (
                                            <tr>
                                              <td colSpan={4} className="border border-black px-2 py-4 text-center text-gray-400 italic">Belum ada item</td>
                                            </tr>
                                          )}
                                        </tbody>
                                      </table>

                                      <p className="text-justify mb-8">
                                        Kesimpulan: Barang/jasa tersebut di atas dalam kondisi <span className="font-bold">BAIK</span> dan sesuai dengan pesanan.
                                      </p>

                                      <div className="text-right mb-2">
                                        <p>{formatTanggalShort(tglPesan)}</p>
                                      </div>
                                      <div className="flex justify-around mt-4">
                                        <div className="text-center w-36">
                                          <p className="text-[10px]">Penerima Barang,</p>
                                          <div className="h-16" />
                                          <p className="text-[11px] font-bold underline">{sekolahData.penerimaBarang || '........................'}</p>
                                          {sekolahData.nipPenerima && <p className="text-[9px]">NIP. {sekolahData.nipPenerima}</p>}
                                        </div>
                                        <div className="text-center w-36">
                                          <p className="text-[10px]">Pengurus Barang,</p>
                                          <div className="h-16" />
                                          <p className="text-[11px] font-bold underline">{sekolahData.pengurusBarang || '........................'}</p>
                                          {sekolahData.nipPengurus && <p className="text-[9px]">NIP. {sekolahData.nipPengurus}</p>}
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* ===== E. BAST (05BAST) ===== */}
                                  {currentDocType === 'bast' && (
                                    <div>
                                      {kopSurat}
                                      <h2 className="text-center font-bold text-[13pt] mb-1">BERITA ACARA SERAH TERIMA BARANG/JASA</h2>
                                      <p className="text-center mb-4">Nomor: {selectedRecord?.nomorSuratBAST || '............'}</p>

                                      <p className="mb-2">
                                        Pada hari {formatTanggalIndo(tglPesan)}, yang bertanda tangan di bawah ini:
                                      </p>

                                      <div className="mb-4 ml-6">
                                        <p className="font-bold">PIHAK PERTAMA:</p>
                                        <table>
                                          <tbody>
                                            <tr><td className="w-24 py-0.5">Nama</td><td className="py-0.5">: {toko?.direktur || '........................'}</td></tr>
                                            <tr><td className="py-0.5">Jabatan</td><td className="py-0.5">: Penyedia {toko?.kategori || 'Barang/Jasa'}</td></tr>
                                            <tr><td className="py-0.5">Alamat</td><td className="py-0.5">: {toko?.alamat || '............'}</td></tr>
                                            <tr><td className="py-0.5">No. HP</td><td className="py-0.5">: {toko?.noHp || '-'}</td></tr>
                                          </tbody>
                                        </table>
                                        <div className="h-2" />
                                        <p className="font-bold">PIHAK KEDUA:</p>
                                        <table>
                                          <tbody>
                                            <tr><td className="w-24 py-0.5">Nama</td><td className="py-0.5">: {sekolahData.penerimaBarang || '........................'}</td></tr>
                                            <tr><td className="py-0.5">Jabatan</td><td className="py-0.5">: Penerima Barang</td></tr>
                                            <tr><td className="py-0.5">Alamat</td><td className="py-0.5">: {sekolahData.namaSekolah || '............'}</td></tr>
                                            <tr><td className="py-0.5">No. HP</td><td className="py-0.5">: -</td></tr>
                                          </tbody>
                                        </table>
                                      </div>

                                      <p className="text-justify mb-4">
                                        Telah melakukan serah terima barang/jasa:
                                      </p>

                                      <table className="w-full border-collapse border border-black mb-4">
                                        <thead>
                                          <tr className="bg-gray-100">
                                            <th className="border border-black px-2 py-1 text-center w-10">No</th>
                                            <th className="border border-black px-2 py-1 text-left">Nama Barang</th>
                                            <th className="border border-black px-2 py-1 text-center w-20">Diserahkan</th>
                                            <th className="border border-black px-2 py-1 text-center w-20">Diterima</th>
                                            <th className="border border-black px-2 py-1 text-center w-20">Kondisi</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {items.map((item: any, idx: number) => (
                                            <tr key={idx}>
                                              <td className="border border-black px-2 py-1 text-center">{idx + 1}</td>
                                              <td className="border border-black px-2 py-1">{item.uraian || '-'}</td>
                                              <td className="border border-black px-2 py-1 text-center">✓</td>
                                              <td className="border border-black px-2 py-1 text-center">✓</td>
                                              <td className="border border-black px-2 py-1 text-center">Baik</td>
                                            </tr>
                                          ))}
                                          {items.length === 0 && (
                                            <tr>
                                              <td colSpan={5} className="border border-black px-2 py-4 text-center text-gray-400 italic">Belum ada item</td>
                                            </tr>
                                          )}
                                        </tbody>
                                      </table>

                                      <p className="text-justify mb-8">
                                        Demikian berita acara ini dibuat dengan sebenarnya untuk dapat dipergunakan sebagaimana mestinya.
                                      </p>

                                      <div className="flex justify-around mt-4">
                                        <div className="text-center w-36">
                                          <p className="text-[10px]">PIHAK PERTAMA,</p>
                                          <div className="h-16" />
                                          <p className="text-[11px] font-bold underline">{toko?.direktur || '........................'}</p>
                                        </div>
                                        <div className="text-center w-36">
                                          <p className="text-[10px]">PIHAK KEDUA,</p>
                                          <div className="h-16" />
                                          <p className="text-[11px] font-bold underline">{sekolahData.penerimaBarang || '........................'}</p>
                                          {sekolahData.nipPenerima && <p className="text-[9px]">NIP. {sekolahData.nipPenerima}</p>}
                                        </div>
                                      </div>

                                      <div className="mt-6 text-center">
                                        <p className="text-[10px]">Mengetahui,</p>
                                        <p className="text-[10px]">Kepala Sekolah</p>
                                        <div className="h-12" />
                                        <p className="font-bold underline text-[11px]">{sekolahData.kepalaSekolah || '........................'}</p>
                                        {sekolahData.nipKepala && <p className="text-[9px]">NIP. {sekolahData.nipKepala}</p>}
                                      </div>
                                    </div>
                                  )}

                                  {/* ===== F. KUITANSI PEMBAYARAN ===== */}
                                  {currentDocType === 'kuitansi-pembayaran' && (
                                    <div>
                                      {/* Info Header 2 Kolom */}
                                      <table className="w-full text-[10pt] mb-2" style={{ lineHeight: '1.4' }}>
                                        <tbody>
                                          <tr className="py-0.5">
                                            <td style={{ whiteSpace: 'nowrap' }}>Sumber Anggaran</td>
                                            <td>&nbsp;:&nbsp;</td>
                                            <td>Dana BOSP {tahunAnggaran}</td>
                                            <td style={{ width: '8%' }} />
                                            <td style={{ whiteSpace: 'nowrap' }}>Program</td>
                                            <td>&nbsp;:&nbsp;</td>
                                            <td>06.05</td>
                                          </tr>
                                          <tr className="py-0.5">
                                            <td style={{ whiteSpace: 'nowrap' }}>Kas/Pos Tanggal</td>
                                            <td>&nbsp;:&nbsp;</td>
                                            <td>{tglPesan ? formatTanggalShort(tglPesan) : '............'}</td>
                                            <td />
                                            <td style={{ whiteSpace: 'nowrap' }}>Kegiatan</td>
                                            <td>&nbsp;:&nbsp;</td>
                                            <td>06.05.08.</td>
                                          </tr>
                                          <tr className="py-0.5">
                                            <td style={{ whiteSpace: 'nowrap' }}>Nomor</td>
                                            <td>&nbsp;:&nbsp;</td>
                                            <td>{selectedRecord?.noBukti || '............'}</td>
                                            <td />
                                            <td style={{ whiteSpace: 'nowrap' }}>Kode Rek</td>
                                            <td>&nbsp;:&nbsp;</td>
                                            <td>5.1.02.01.01.0024</td>
                                          </tr>
                                        </tbody>
                                      </table>

                                      <p className="font-bold text-center text-[12pt] mb-2">TANDA PEMBAYARAN</p>

                                      <table className="w-full text-[10pt]" style={{ lineHeight: '1.6' }}>
                                        <tbody>
                                          <tr>
                                            <td style={{ whiteSpace: 'nowrap', verticalAlign: 'top' }}>Sudah terima dari</td>
                                            <td style={{ verticalAlign: 'top' }}>&nbsp;:&nbsp;</td>
                                            <td>Bendahara {sekolahData.namaSekolah || '........................'}</td>
                                          </tr>
                                          <tr>
                                            <td style={{ whiteSpace: 'nowrap', verticalAlign: 'top' }}>Uang sebesar</td>
                                            <td style={{ verticalAlign: 'top' }}>&nbsp;:&nbsp;</td>
                                            <td>Rp {totalJumlah > 0 ? fmt(totalJumlah) : '............'}</td>
                                          </tr>
                                          <tr>
                                            <td style={{ whiteSpace: 'nowrap', verticalAlign: 'top' }}>Terbilang</td>
                                            <td style={{ verticalAlign: 'top' }}>&nbsp;:&nbsp;</td>
                                            <td className="italic">{totalJumlah > 0 ? terbilang(totalJumlah) + ' Rupiah' : '........................................................'}</td>
                                          </tr>
                                          <tr>
                                            <td style={{ whiteSpace: 'nowrap', verticalAlign: 'top' }}>Nomor Surat persetujuan penyediaan barang dan jasa</td>
                                            <td style={{ verticalAlign: 'top' }}>&nbsp;:&nbsp;</td>
                                            <td>{selectedRecord?.nomorSuratPesanan || '............'}</td>
                                          </tr>
                                          <tr>
                                            <td style={{ whiteSpace: 'nowrap', verticalAlign: 'top' }}>Untuk pembayaran</td>
                                            <td style={{ verticalAlign: 'top' }}>&nbsp;:&nbsp;</td>
                                            <td>Pengadaan Alat Tulis Kantor (ATK)</td>
                                          </tr>
                                        </tbody>
                                      </table>

                                      <div className="mt-6 text-[10pt]">
                                        <div className="grid grid-cols-3 gap-2">
                                          <div className="text-center">
                                            <p className="font-bold">Mengetahui :</p>
                                            <p>Pengurus Barang</p>
                                            <div className="h-16" />
                                            <p className="font-bold underline">{sekolahData.pengurusBarang || '........................'}</p>
                                            <p>Penata Muda</p>
                                            {sekolahData.nipPengurus && <p>NIP. {sekolahData.nipPengurus}</p>}
                                          </div>
                                          <div className="text-center">
                                            <p className="font-bold">Lunas Bayar Oleh :</p>
                                            <p>Bendahara {sekolahData.namaSekolah || '........................'}</p>
                                            <div className="h-16" />
                                            <p className="font-bold underline">{sekolahData.bendahara || '........................'}</p>
                                            <p>Penata TK. I</p>
                                            {sekolahData.nipBendahara && <p>NIP. {sekolahData.nipBendahara}</p>}
                                          </div>
                                          <div className="text-center">
                                            <p className="font-bold">Diterima oleh :</p>
                                            <p>{toko?.namaToko || '........................'}</p>
                                            <div className="h-16" />
                                            <p>-</p>
                                            <p>Direktur</p>
                                          </div>
                                        </div>

                                        <div className="text-center mt-6">
                                          <p className="font-bold">Menyetujui :</p>
                                          <p>Kepala Sekolah {sekolahData.namaSekolah || '........................'}</p>
                                          <div className="h-16" />
                                          <p className="font-bold underline">{sekolahData.kepalaSekolah || '........................'}</p>
                                          <p>Pembina Tk I</p>
                                          {sekolahData.nipKepala && <p>NIP. {sekolahData.nipKepala}</p>}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </>
                      )}
                    </>
                  )
                })()}
              </div>

              {/* Print Area - Hidden, used for printing */}
              <div id="print-area" className="print-area-screen" />
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
