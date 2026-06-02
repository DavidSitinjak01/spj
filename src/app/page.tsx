'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  FileText, MessageSquare, Send, Loader2,
  Upload, Bot, User,
  CheckCircle2, AlertCircle, X, PanelRightOpen, PanelRightClose,
  PieChart, Landmark, Calendar, Building2,
  Receipt, FileSpreadsheet, Sparkles,
  ClipboardList, Scale, Users,
} from 'lucide-react'
import {
  type PDFData, type Summary, type ChatMessage, type BKUMonth, type RKASMonth,
  type BKUPajakMonth, type BudgetData, type SPJSummary, type KopRowData, type SPJDocType,
  MONTH_NAMES,
} from '@/lib/types'
import { fmt, fmtRp, normalizeMonth } from '@/lib/helpers'

import DashboardTab from '@/components/tabs/DashboardTab'
import RKASTab from '@/components/tabs/RKASTab'
import BKUTab from '@/components/tabs/BKUTab'
import BKUPajakTab from '@/components/tabs/BKUPajakTab'
import SPJTab from '@/components/tabs/SPJTab'
import ViewerTab from '@/components/tabs/ViewerTab'
import SummaryTab from '@/components/tabs/SummaryTab'

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
  const [selectedSpjMonth, setSelectedSpjMonth] = useState<number>(-1)
  const [spjSearchTerm, setSpjSearchTerm] = useState('')
  const [spjSubTab, setSpjSubTab] = useState('master-toko')
  const [docSelectedBpuId, setDocSelectedBpuId] = useState<string>('')
  const [docSelectedBnuId, setDocSelectedBnuId] = useState<string>('')
  const [docType, setDocType] = useState<'bpu'|'bnu'>('bpu')
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
  const [kopRowSaving, setKopRowSaving] = useState<string|null>(null)

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
    setError(null)
    setLoading(true)
    try {
      const listRes = await fetch('/api/pdf/info')
      if (listRes.ok) {
        const listData = await listRes.json()
        const files: string[] = listData.files || []
        const generalPdfs = files.filter(f => {
          const lower = f.toLowerCase()
          return !lower.includes('bku') && !lower.includes('rkas') && !lower.includes('rapbs')
        })
        if (generalPdfs.length > 0) {
          await loadPDF(generalPdfs[0], true)
        }
      }
    } catch {} finally { setLoading(false) }
  }

  const loadPDF = async (fileName: string, skipError = false) => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/pdf/info?file=${encodeURIComponent(fileName)}`)
      if (res.status === 404) { if (!skipError) setError('File PDF tidak ditemukan'); return }
      if (!res.ok) { if (skipError) return; throw new Error('Gagal memuat PDF') }
      const data = await res.json()
      setPdfData(data); setCurrentPage(1); setZoom(100)
      generateSummary(fileName)
      extractBudget(fileName)
    } catch (err: any) { if (!skipError) setError(err.message) } finally { setLoading(false) }
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
          let errorMsg = err.error || 'Gagal mengimpor file RKAS'
          if (err.detail) { errorMsg += ` — ${err.detail}` }
          if (err.diagnostic) {
            const d = err.diagnostic
            if (d.step) errorMsg += ` (Step: ${d.step})`
            if (d.textLength === 0) errorMsg += ' — Teks PDF kosong'
          }
          setError(errorMsg)
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
          let errorMsg = err.error || 'Gagal mengimpor file BKU Pajak'
          if (err.detail) errorMsg += ` — ${err.detail}`
          setError(errorMsg)
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
      if (res.ok) { const data = await res.json(); setKopRows(data.data || []) }
    } catch {} finally { setKopRowLoading(false) }
  }

  const addKopRow = async () => {
    try {
      const res = await fetch('/api/master/sekolah/kop-row', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teks: '', fontFamily: 'Times New Roman', fontSize: 12, lineHeight: 1.3, bold: false, italic: false, uppercase: false }),
      })
      if (res.ok) { const data = await res.json(); setKopRows(prev => [...prev, data.data]); addToast('Baris KOP ditambahkan', 'success') }
    } catch { addToast('Gagal menambah baris KOP', 'warning') }
  }

  const kopRowDebounceRef = useRef<Record<string, NodeJS.Timeout>>({})
  const kopRowPendingRef = useRef<Record<string, Partial<KopRowData>>>({})

  const updateKopRow = (id: string, updates: Partial<KopRowData>) => {
    setKopRows(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r))
    kopRowPendingRef.current[id] = { ...kopRowPendingRef.current[id], ...updates }
    if (kopRowDebounceRef.current[id]) { clearTimeout(kopRowDebounceRef.current[id]) }
    kopRowDebounceRef.current[id] = setTimeout(async () => {
      const pendingUpdates = { ...kopRowPendingRef.current[id] }
      delete kopRowPendingRef.current[id]
      setKopRowSaving(id)
      try {
        const res = await fetch('/api/master/sekolah/kop-row', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...pendingUpdates }) })
        if (res.ok) { const data = await res.json(); setKopRows(prev => prev.map(r => r.id === id ? data.data : r)) }
        else { await loadKopRows(); addToast('Gagal menyimpan perubahan', 'warning') }
      } catch { await loadKopRows(); addToast('Gagal menyimpan perubahan', 'warning') } finally { setKopRowSaving(null) }
    }, 600)
  }

  const deleteKopRow = async (id: string) => {
    try {
      const res = await fetch(`/api/master/sekolah/kop-row?id=${id}`, { method: 'DELETE' })
      if (res.ok) { setKopRows(prev => prev.filter(r => r.id !== id)); addToast('Baris KOP dihapus', 'success') }
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
    setKopRows([...sorted])
    try {
      await fetch('/api/master/sekolah/kop-row', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orders: sorted.map(r => ({ id: r.id, urutan: r.urutan })) }) })
    } catch { addToast('Gagal mengubah urutan', 'warning') }
  }

  const handleLogoUpload = async (posisi: 'kiri' | 'kanan', file: File) => {
    if (file.size > 4 * 1024 * 1024) { addToast('Ukuran file maksimal 4 MB', 'warning'); return }
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']
    if (!allowedTypes.includes(file.type)) { addToast('Format file tidak didukung. Gunakan PNG, JPG, WebP, atau SVG.', 'warning'); return }
    setLogoUploading(posisi)
    try {
      const formData = new FormData(); formData.append('file', file); formData.append('posisi', posisi)
      const res = await fetch('/api/master/sekolah/logo', { method: 'POST', body: formData })
      if (res.ok) {
        const data = await res.json()
        setSekolahData((prev: any) => ({ ...prev, [posisi === 'kiri' ? 'logoKiriUrl' : 'logoKananUrl']: data.dataUrl }))
        addToast(`Logo ${posisi} berhasil diupload`, 'success')
      } else { const err = await res.json(); addToast(err.error || 'Gagal mengupload logo', 'warning') }
    } catch { addToast('Gagal mengupload logo', 'warning') } finally { setLogoUploading(null) }
  }

  const handleLogoDelete = async (posisi: 'kiri' | 'kanan') => {
    try {
      const res = await fetch(`/api/master/sekolah/logo?posisi=${posisi}`, { method: 'DELETE' })
      if (res.ok) {
        setSekolahData((prev: any) => ({ ...prev, [posisi === 'kiri' ? 'logoKiriUrl' : 'logoKananUrl']: '' }))
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
    } catch { addToast('Gagal sinkronkan BPU', 'warning') } finally { setBpuSyncing(false) }
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
    } catch { addToast('Gagal sinkronkan BNU', 'warning') } finally { setBnuSyncing(false) }
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
      const clone = docContent.cloneNode(true) as HTMLElement
      clone.removeAttribute('id')
      clone.classList.remove('shadow-lg')
      clone.style.boxShadow = 'none'
      printArea.innerHTML = ''
      printArea.appendChild(clone)
      const originalTitle = document.title
      document.title = ' '
      window.print()
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
              {toast.type === 'info' && <Landmark className="h-4 w-4 shrink-0 mt-0.5" />}
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
              <DashboardTab bkuMonths={bkuMonths} rkasMonths={rkasMonths} bkuPajakMonths={bkuPajakMonths} budgetData={budgetData} />
            </TabsContent>

            {/* === RKAS TAB === */}
            <TabsContent value="rkas" className="flex-1 m-0 min-h-0 overflow-auto">
              <RKASTab
                rkasMonths={rkasMonths} rkasLoading={rkasLoading} rkasUploading={rkasUploading}
                selectedRkasMonth={selectedRkasMonth} setSelectedRkasMonth={setSelectedRkasMonth}
                rkasSearchTerm={rkasSearchTerm} setRkasSearchTerm={setRkasSearchTerm}
                selectedRkasStandar={selectedRkasStandar} setSelectedRkasStandar={setSelectedRkasStandar}
                handleRKASUpload={handleRKASUpload} deleteRKASFile={deleteRKASFile}
              />
            </TabsContent>

            {/* === SPJ TAB === */}
            <TabsContent value="spj" className="flex-1 m-0 min-h-0 overflow-auto">
              <SPJTab
                spjSubTab={spjSubTab} setSpjSubTab={setSpjSubTab}
                spjData={spjData} spjLoading={spjLoading}
                selectedSpjMonth={selectedSpjMonth} setSelectedSpjMonth={setSelectedSpjMonth}
                spjSearchTerm={spjSearchTerm} setSpjSearchTerm={setSpjSearchTerm}
                docType={docType} setDocType={setDocType}
                docSelectedBpuId={docSelectedBpuId} setDocSelectedBpuId={setDocSelectedBpuId}
                docSelectedBnuId={docSelectedBnuId} setDocSelectedBnuId={setDocSelectedBnuId}
                tokoList={tokoList} tokoLoading={tokoLoading} tokoDialog={tokoDialog} setTokoDialog={setTokoDialog}
                tokoSearch={tokoSearch} setTokoSearch={setTokoSearch} saveToko={saveToko} deleteToko={deleteToko}
                sekolahData={sekolahData} setSekolahData={setSekolahData} sekolahLoading={sekolahLoading} sekolahSaving={sekolahSaving} saveSekolah={saveSekolah}
                logoUploading={logoUploading} handleLogoUpload={handleLogoUpload} handleLogoDelete={handleLogoDelete}
                kopRows={kopRows} kopRowLoading={kopRowLoading} kopRowSaving={kopRowSaving}
                addKopRow={addKopRow} updateKopRow={updateKopRow} deleteKopRow={deleteKopRow} moveKopRow={moveKopRow}
                bpuList={bpuList} bpuLoading={bpuLoading} bpuSyncing={bpuSyncing} selectedBpu={selectedBpu} setSelectedBpu={setSelectedBpu}
                bpuEditFields={bpuEditFields} setBpuEditFields={setBpuEditFields}
                syncBPU={syncBPU} updateBPU={updateBPU} deleteBPU={deleteBPU} updateBPItemHargaToko2={updateBPItemHargaToko2} setBpuList={setBpuList}
                bnuList={bnuList} bnuLoading={bnuLoading} bnuSyncing={bnuSyncing} selectedBnu={selectedBnu} setSelectedBnu={setSelectedBnu}
                bnuEditFields={bnuEditFields} setBnuEditFields={setBnuEditFields}
                syncBNU={syncBNU} updateBNU={updateBNU} deleteBNU={deleteBNU} updateBNUItemHargaToko2={updateBNUItemHargaToko2} setBnuList={setBnuList}
                handlePrintDoc={handlePrintDoc}
              />
            </TabsContent>

            {/* === BKU TAB === */}
            <TabsContent value="bku" className="flex-1 m-0 min-h-0 overflow-auto">
              <BKUTab
                bkuMonths={bkuMonths} bkuLoading={bkuLoading} bkuUploading={bkuUploading}
                selectedBkuMonth={selectedBkuMonth} setSelectedBkuMonth={setSelectedBkuMonth}
                bkuSearchTerm={bkuSearchTerm} setBkuSearchTerm={setBkuSearchTerm}
                handleBKUUpload={handleBKUUpload} deleteBKUFile={deleteBKUFile}
              />
            </TabsContent>

            {/* === BKU PAJAK TAB === */}
            <TabsContent value="bku-pajak" className="flex-1 m-0 min-h-0 overflow-auto">
              <BKUPajakTab
                bkuPajakMonths={bkuPajakMonths} bkuPajakLoading={bkuPajakLoading} bkuPajakUploading={bkuPajakUploading}
                selectedBkuPajakMonth={selectedBkuPajakMonth} setSelectedBkuPajakMonth={setSelectedBkuPajakMonth}
                bkuPajakSearchTerm={bkuPajakSearchTerm} setBkuPajakSearchTerm={setBkuPajakSearchTerm}
                handleBKUPajakUpload={handleBKUPajakUpload} deleteBKUPajakFile={deleteBKUPajakFile}
              />
            </TabsContent>

            {/* === VIEWER TAB === */}
            <TabsContent value="viewer" className="flex-1 flex flex-col m-0 min-h-0">
              <ViewerTab
                pdfData={pdfData} loading={loading}
                currentPage={currentPage} setCurrentPage={setCurrentPage}
                zoom={zoom} setZoom={setZoom}
                imageLoaded={imageLoaded} setImageLoaded={setImageLoaded}
                pageInputValue={pageInputValue} setPageInputValue={setPageInputValue}
                goToPage={goToPage} handlePageInput={handlePageInput}
                fileInputRef={fileInputRef} handleUpload={handleUpload} uploading={uploading}
              />
            </TabsContent>

            {/* === SUMMARY TAB === */}
            <TabsContent value="summary" className="flex-1 m-0 min-h-0 overflow-auto">
              <SummaryTab summary={summary} summaryLoading={summaryLoading} />
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
