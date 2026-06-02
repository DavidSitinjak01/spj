'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw, FileUp, Upload, Loader2,
} from 'lucide-react'
import { type PDFData } from '@/lib/types'

interface ViewerTabProps {
  pdfData: PDFData | null
  loading: boolean
  currentPage: number
  setCurrentPage: (page: number) => void
  zoom: number
  setZoom: (z: number) => void
  imageLoaded: boolean
  setImageLoaded: (v: boolean) => void
  pageInputValue: string
  setPageInputValue: (v: string) => void
  goToPage: (page: number) => void
  handlePageInput: (value: string) => void
  fileInputRef: React.RefObject<HTMLInputElement>
  handleUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  uploading: boolean
}

export default function ViewerTab({
  pdfData, loading, currentPage, setCurrentPage, zoom, setZoom,
  imageLoaded, setImageLoaded, pageInputValue, setPageInputValue,
  goToPage, handlePageInput, fileInputRef, handleUpload, uploading,
}: ViewerTabProps) {
  return (
    <>
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
    </>
  )
}
