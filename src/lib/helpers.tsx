import {
  GraduationCap, BookOpen, Users, Wrench, Landmark, Wallet,
  FileSpreadsheet, FileText,
} from 'lucide-react'

// --- Number formatting ---
export const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(n)
export const fmtRp = (n: number) => `Rp ${fmt(n)}`

// --- Terbilang helper (convert number to Indonesian words) ---
export const terbilang = (n: number): string => {
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

// --- Kode normalization ---
export const normalizeKode = (kode: string): string => kode.replace(/[\s\n\r]/g, '').replace(/\.+$/, '').trim()
export const compositeKey = (kodeProgram: string, kodeRekening: string): string =>
  `${normalizeKode(kodeProgram)}|${normalizeKode(kodeRekening)}`

// --- Normalize month name for matching ---
export const normalizeMonth = (m: string): string => m.toUpperCase().trim()

// --- Chart colors ---
export const CHART_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

// --- Standar icons mapping ---
export const STANDAR_ICONS: Record<string, any> = {
  '02': GraduationCap,
  '03': BookOpen,
  '04': Users,
  '05': Wrench,
  '06': Landmark,
  '07': Wallet,
  '08': FileSpreadsheet,
}

// --- Helper: render garis bawah KOP based on style ---
export const renderGarisBawah = (style: string) => {
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
