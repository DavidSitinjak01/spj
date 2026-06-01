'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import {
  FileUp,
  FileText,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Send,
  Loader2,
  Upload,
  BookOpen,
  Bot,
  User,
  Sparkles,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  X,
  PanelRightOpen,
  PanelRightClose,
  Download,
  Search,
  FileSpreadsheet,
  Landmark,
  Calendar,
  Building2,
} from 'lucide-react'

interface PDFPage {
  page: number
  text: string
}

interface PDFData {
  fileName: string
  pageCount: number
  pageImages: string[]
  extractedText: PDFPage[]
}

interface Summary {
  title: string
  type: string
  summary: string
  keyPoints: string[]
  totalAmount: string
  entity: string
  period: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

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
  const [activeTab, setActiveTab] = useState('viewer')
  const [chatPanelOpen, setChatPanelOpen] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pageInputValue, setPageInputValue] = useState('1')
  const [imageLoaded, setImageLoaded] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatInputRef = useRef<HTMLTextAreaElement>(null)

  // Load the demo PDF on mount
  useEffect(() => {
    loadPDF('rapbs-all-output.pdf')
  }, [])

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // Sync page input value
  useEffect(() => {
    setPageInputValue(String(currentPage))
  }, [currentPage])

  // Reset image loaded when page changes
  useEffect(() => {
    setImageLoaded(false)
  }, [currentPage])

  const loadPDF = async (fileName: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/pdf/info?file=${encodeURIComponent(fileName)}`)
      if (!res.ok) throw new Error('Gagal memuat PDF')
      const data = await res.json()
      setPdfData(data)
      setCurrentPage(1)
      setZoom(100)
      generateSummary(fileName)
    } catch (err: any) {
      setError(err.message || 'Gagal memuat PDF')
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/pdf/upload', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) throw new Error('Gagal mengunggah PDF')
      const data = await res.json()

      setPdfData(data)
      setCurrentPage(1)
      setZoom(100)
      setChatMessages([])
      setSummary(null)
      generateSummary(file.name)
    } catch (err: any) {
      setError(err.message || 'Gagal mengunggah PDF')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const generateSummary = async (fileName: string) => {
    setSummaryLoading(true)
    try {
      const res = await fetch('/api/pdf/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName }),
      })

      if (!res.ok) throw new Error('Gagal membuat ringkasan')
      const data = await res.json()
      setSummary(data.summary)
    } catch (err) {
      console.error('Summary error:', err)
    } finally {
      setSummaryLoading(false)
    }
  }

  const sendChat = async () => {
    if (!chatInput.trim() || !pdfData || chatLoading) return

    const userMessage = chatInput.trim()
    setChatInput('')
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setChatLoading(true)

    try {
      const history = chatMessages.map(m => ({
        role: m.role,
        content: m.content,
      }))

      const res = await fetch('/api/pdf/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: pdfData.fileName,
          question: userMessage,
          history,
        }),
      })

      if (!res.ok) throw new Error('Gagal mendapatkan respons')
      const data = await res.json()
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.answer }])
    } catch (err) {
      setChatMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Maaf, terjadi kesalahan. Silakan coba lagi.' },
      ])
    } finally {
      setChatLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendChat()
    }
  }

  const goToPage = (page: number) => {
    if (pdfData && page >= 1 && page <= pdfData.pageCount) {
      setCurrentPage(page)
    }
  }

  const handlePageInput = (value: string) => {
    setPageInputValue(value)
    const page = parseInt(value)
    if (!isNaN(page) && page >= 1 && page <= (pdfData?.pageCount || 1)) {
      setCurrentPage(page)
    }
  }

  const suggestedQuestions = [
    'Berapa total penerimaan anggaran?',
    'Sebutkan pos belanja terbesar!',
    'Apa saja program kegiatan yang ada?',
    'Berapa alokasi BOSP Reguler?',
    'Ringkas dokumen ini dalam 3 poin',
  ]

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-screen-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
              <BookOpen className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight tracking-tight">PDF Reader AI</h1>
              <p className="text-[11px] text-muted-foreground leading-none">Baca & analisis dokumen dengan AI</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleUpload}
              accept=".pdf"
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="gap-2"
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              {uploading ? 'Mengunggah...' : 'Unggah PDF'}
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setChatPanelOpen(!chatPanelOpen)}
              title={chatPanelOpen ? 'Tutup panel chat' : 'Buka panel chat'}
            >
              {chatPanelOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left: PDF Viewer */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Error banner */}
          {error && (
            <div className="mx-4 mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
              <Button variant="ghost" size="icon" className="ml-auto h-6 w-6" onClick={() => setError(null)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}

          {/* PDF info bar */}
          {pdfData && (
            <div className="px-4 py-2 border-b bg-muted/30 flex items-center gap-3 text-xs flex-wrap">
              <div className="flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium truncate max-w-[220px]">{pdfData.fileName}</span>
              </div>
              <Separator orientation="vertical" className="h-3.5" />
              <span className="text-muted-foreground">{pdfData.pageCount} halaman</span>
              {summary?.entity && (
                <>
                  <Separator orientation="vertical" className="h-3.5" />
                  <div className="flex items-center gap-1">
                    <Building2 className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground truncate max-w-[200px]">{summary.entity}</span>
                  </div>
                </>
              )}
              {summary?.period && (
                <>
                  <Separator orientation="vertical" className="h-3.5" />
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">{summary.period}</span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Tabs for viewer / text / summary */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <div className="px-4 pt-2 border-b">
              <TabsList className="h-8">
                <TabsTrigger value="viewer" className="text-xs gap-1.5 px-3">
                  <FileText className="h-3 w-3" />
                  Dokumen
                </TabsTrigger>
                <TabsTrigger value="text" className="text-xs gap-1.5 px-3">
                  <Search className="h-3 w-3" />
                  Teks
                </TabsTrigger>
                <TabsTrigger value="summary" className="text-xs gap-1.5 px-3">
                  <Sparkles className="h-3 w-3" />
                  Ringkasan
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Viewer Tab */}
            <TabsContent value="viewer" className="flex-1 flex flex-col m-0 min-h-0">
              {loading ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center space-y-3">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Memuat dokumen PDF...</p>
                      <p className="text-xs text-muted-foreground">Mengekstrak teks dan merender halaman</p>
                    </div>
                  </div>
                </div>
              ) : pdfData ? (
                <>
                  <div className="flex-1 overflow-auto bg-[#e8e8e8] dark:bg-[#1a1a1a] p-4 sm:p-6">
                    <div className="flex justify-center">
                      <div className="relative">
                        {!imageLoaded && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Skeleton className="w-[600px] h-[800px] rounded-md" />
                          </div>
                        )}
                        <img
                          src={pdfData.pageImages[currentPage - 1]}
                          alt={`Halaman ${currentPage}`}
                          className={`shadow-xl rounded-sm border border-black/10 transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                          style={{
                            maxWidth: `${zoom}%`,
                            height: 'auto',
                          }}
                          onLoad={() => setImageLoaded(true)}
                        />
                      </div>
                    </div>
                  </div>
                  {/* Page navigation */}
                  <div className="border-t px-4 py-2 flex items-center justify-center gap-2 bg-card">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage <= 1}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        value={pageInputValue}
                        onChange={(e) => handlePageInput(e.target.value)}
                        className="w-12 h-7 text-center text-xs px-1"
                        min={1}
                        max={pdfData.pageCount}
                      />
                      <span className="text-xs text-muted-foreground">/ {pdfData.pageCount}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage >= pdfData.pageCount}
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                    <Separator orientation="vertical" className="h-4 mx-1" />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setZoom(Math.max(30, zoom - 15))}
                      title="Perkecil"
                    >
                      <ZoomOut className="h-3.5 w-3.5" />
                    </Button>
                    <span className="text-[11px] text-muted-foreground w-10 text-center font-mono">{zoom}%</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setZoom(Math.min(250, zoom + 15))}
                      title="Perbesar"
                    >
                      <ZoomIn className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setZoom(100)}
                      title="Reset zoom"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center max-w-sm space-y-4">
                    <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
                      <FileUp className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-lg font-semibold">Unggah Dokumen PDF</h2>
                      <p className="text-sm text-muted-foreground">
                        Unggah file PDF untuk dibaca dan dianalisis oleh AI
                      </p>
                    </div>
                    <Button onClick={() => fileInputRef.current?.click()} className="gap-2">
                      <Upload className="h-4 w-4" />
                      Pilih File PDF
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Text Tab */}
            <TabsContent value="text" className="flex-1 m-0 min-h-0">
              {pdfData ? (
                <ScrollArea className="h-full">
                  <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
                    {pdfData.extractedText.map((page) => (
                      <div key={page.page} className="group">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="secondary" className="text-[10px] h-5">
                            Hal. {page.page}
                          </Badge>
                        </div>
                        <div className="text-xs leading-relaxed whitespace-pre-wrap font-mono bg-card p-4 rounded-lg border shadow-sm">
                          {page.text || '(Tidak ada teks yang dapat diekstrak)'}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                  Unggah PDF untuk melihat teks
                </div>
              )}
            </TabsContent>

            {/* Summary Tab */}
            <TabsContent value="summary" className="flex-1 m-0 min-h-0">
              <ScrollArea className="h-full">
                <div className="p-4 sm:p-6 max-w-2xl mx-auto">
                  {summaryLoading ? (
                    <div className="space-y-4 py-4">
                      <Skeleton className="h-8 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-20 w-full" />
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-32 w-full" />
                    </div>
                  ) : summary ? (
                    <div className="space-y-4">
                      {/* Title Card */}
                      <Card className="overflow-hidden">
                        <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
                        <CardHeader className="pb-3">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge className="text-[10px] h-5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                              <Landmark className="h-2.5 w-2.5 mr-1" />
                              {summary.type}
                            </Badge>
                            {summary.period && (
                              <Badge variant="outline" className="text-[10px] h-5">
                                <Calendar className="h-2.5 w-2.5 mr-1" />
                                {summary.period}
                              </Badge>
                            )}
                          </div>
                          <CardTitle className="text-lg">{summary.title}</CardTitle>
                          {summary.entity && (
                            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                              <Building2 className="h-3.5 w-3.5" />
                              {summary.entity}
                            </p>
                          )}
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm leading-relaxed">{summary.summary}</p>
                        </CardContent>
                      </Card>

                      {/* Total Amount */}
                      {summary.totalAmount && (
                        <Card className="border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30">
                          <CardContent className="pt-4 pb-4">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
                                <FileSpreadsheet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Total Anggaran</p>
                                <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                                  Rp {summary.totalAmount}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Key Points */}
                      {summary.keyPoints && summary.keyPoints.length > 0 && (
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-semibold flex items-center gap-2">
                              <Sparkles className="h-4 w-4 text-amber-500" />
                              Poin-Poin Penting
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <ul className="space-y-2.5">
                              {summary.keyPoints.map((point, i) => (
                                <li key={i} className="flex gap-2.5 text-sm">
                                  <div className="mt-0.5 h-5 w-5 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center shrink-0">
                                    <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                                  </div>
                                  <span className="leading-relaxed">{point}</span>
                                </li>
                              ))}
                            </ul>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground text-sm">
                      Ringkasan belum tersedia
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right: AI Chat Panel */}
        {chatPanelOpen && (
          <div className="w-[360px] border-l flex flex-col bg-card shrink-0">
            {/* Chat Header */}
            <div className="px-4 py-3 border-b">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">AI Assistant</h3>
                  <p className="text-[11px] text-muted-foreground">Tanyakan tentang dokumen</p>
                </div>
              </div>
            </div>

            {/* Chat Messages */}
            <ScrollArea className="flex-1 px-4 py-3">
              {chatMessages.length === 0 ? (
                <div className="py-4 space-y-4">
                  <div className="text-center space-y-2">
                    <div className="h-10 w-10 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
                      <MessageSquare className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Tanyakan apa saja tentang dokumen PDF Anda
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium px-1">Contoh pertanyaan</p>
                    {suggestedQuestions.map((q, i) => (
                      <button
                        key={i}
                        className="w-full text-left text-xs p-2.5 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                        onClick={() => setChatInput(q)}
                      >
                        <span className="text-muted-foreground mr-1">{i + 1}.</span> {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                      {msg.role === 'assistant' && (
                        <div className="h-6 w-6 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0 mt-0.5">
                          <Bot className="h-3 w-3 text-white" />
                        </div>
                      )}
                      <div
                        className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                          msg.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <div className="whitespace-pre-wrap leading-relaxed text-[13px]">
                          {msg.content}
                        </div>
                      </div>
                      {msg.role === 'user' && (
                        <div className="h-6 w-6 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                          <User className="h-3 w-3" />
                        </div>
                      )}
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="flex gap-2">
                      <div className="h-6 w-6 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0 mt-0.5">
                        <Bot className="h-3 w-3 text-white" />
                      </div>
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

            {/* Chat Input */}
            <div className="p-3 border-t">
              <div className="flex gap-2">
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Tanyakan sesuatu..."
                  disabled={chatLoading || !pdfData}
                  className="text-sm h-9"
                />
                <Button
                  size="icon"
                  className="h-9 w-9 shrink-0 bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
                  onClick={sendChat}
                  disabled={chatLoading || !chatInput.trim() || !pdfData}
                >
                  {chatLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t bg-card py-2 px-4 text-center text-[11px] text-muted-foreground">
        PDF Reader AI — Dibuat dengan Next.js & AI
      </footer>
    </div>
  )
}
