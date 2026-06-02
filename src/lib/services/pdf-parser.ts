/**
 * Shared PDF text parsing functions.
 * Consolidates the duplicated parser logic from bku/route.ts, bku-pajak/route.ts, rkas/route.ts
 * and pdf-text-parser.ts into a single source of truth.
 */

import type {
  BKUTransaction, BKUMonth,
  BKUPajakTransaction, BKUPajakJenisPajak, BKUPajakMonth,
  RKASItem, RKASStandar, RKASPenerimaanItem, RKASMonth,
} from '@/lib/types';

// --- Shared Helpers ---

function parseAmount(s: string | null | undefined): number {
  if (!s) return 0;
  const cleaned = s.replace(/\./g, '').replace(/,/g, '').replace(/\s/g, '').trim();
  if (!cleaned || cleaned === '-') return 0;
  return parseInt(cleaned) || 0;
}

function reMatch(pattern: RegExp, text: string): RegExpMatchArray | null {
  return text.match(pattern);
}

function reSearch(pattern: RegExp, text: string): boolean {
  return pattern.test(text);
}

// ============================================================================
// BKU Parser
// ============================================================================

export function parseBKUFromText(text: string, fileName: string): BKUMonth {
  const headerInfo: Record<string, string> = {};
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // --- Header extraction ---
  const bulanMatch = text.match(/BULAN\s*:\s*(\w+)/i);
  if (bulanMatch) headerInfo.bulan = bulanMatch[1];
  const tahunMatch = text.match(/TAHUN\s*:\s*(\d{4})/i);
  if (tahunMatch) headerInfo.tahun = tahunMatch[1];
  const bulanTahun = text.match(/BULAN\s*:\s*(\w+)\s+(\d{4})/i);
  if (bulanTahun) { headerInfo.bulan = bulanTahun[1]; headerInfo.tahun = bulanTahun[2]; }

  if (text.includes('Sumber Dana')) {
    const sdMatch = text.match(/Sumber Dana\s*:?\s*([^\t\n]+)/i);
    if (sdMatch) {
      const val = sdMatch[1].trim();
      if (val && val !== ':' && !val.includes('No.') && !val.includes('Kode')) headerInfo.sumberDana = val;
    }
  }

  const sekolahMatch = text.match(/Nama Sekolah\s*:\s*([^\t\n]+)/i);
  if (sekolahMatch) {
    let val = sekolahMatch[1].trim();
    val = val.replace(/\s*Halaman\s+\d+\s+dari\s+\d+.*$/i, '').trim();
    headerInfo.namaSekolah = val;
  }
  const npsnMatch = text.match(/NPSN\s*:?\s*(\d+)/i);
  if (npsnMatch && !headerInfo.npsn) headerInfo.npsn = npsnMatch[1];

  if (!headerInfo.tahun) {
    const tahunM = text.match(/:\s*(\d{4})/);
    if (tahunM) headerInfo.tahun = tahunM[1];
  }

  // Closing balance
  const saldoMatch = text.match(/Saldo Buku Kas Umum\s*:?\s*Rp\.?\s*([\d.]+)/i);
  if (saldoMatch) headerInfo.saldoAkhir = saldoMatch[1].replace(/\./g, '');
  const bankMatch = text.match(/Saldo Bank\s*:?\s*Rp\.?\s*([\d.]+)/i);
  if (bankMatch) headerInfo.saldoAkhirBank = bankMatch[1].replace(/\./g, '');
  const tunaiMatch = text.match(/Saldo Kas Tunai\s*:?\s*Rp\.?\s*([\d.]+)/i);
  if (tunaiMatch) headerInfo.saldoAkhirTunai = tunaiMatch[1].replace(/\./g, '');
  const tanggalMatch = text.match(/(\d{1,2}\s+\w+\s+\d{4})/);
  if (tanggalMatch) headerInfo.tanggalTutup = tanggalMatch[1];

  // --- Transaction rows ---
  const transactions: BKUTransaction[] = [];
  let totalPenerimaan = 0;
  let totalPengeluaran = 0;
  let lastSaldo = 0;

  // Detect format: pdf2json produces tab-separated columns with date at start
  const isPdf2Json = lines.some(l => {
    const tabs = l.split('\t').filter(Boolean);
    if (tabs.length < 3) return false;
    const first = tabs[0]?.trim();
    return /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(first);
  }) || lines.some(l => {
    const tabs = l.split('\t').filter(Boolean);
    return tabs.length >= 5 && tabs.some(t => /^(BPU|BNU|BBU)\d+$/i.test(t.trim()));
  });

  const hasTabs = text.includes('\t');
  const useTabParsing = isPdf2Json || (hasTabs && !lines.some(l => /^\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?\s+/.test(l) && !l.includes('\t')));

  console.log(`[BKU Parser] isPdf2Json=${isPdf2Json}, hasTabs=${hasTabs}, useTabParsing=${useTabParsing}, lines=${lines.length}`);

  if (isPdf2Json || useTabParsing) {
    // pdf2json format: tab-separated columns
    const dateRe = /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/;
    const kodeKegiatanRe = /^\d{2}\.\d{2}\.\d{2}\.?$/;
    const kodeRekeningRe = /^5\.\d+\.[\d.]+$/;
    const noBuktiRe = /^(BPU|BNU|BBU)\d+$/i;

    for (const line of lines) {
      const upperLine = line.toUpperCase();
      if (upperLine.startsWith('TANGGAL') || upperLine.startsWith('HALAMAN') || upperLine.startsWith('BULAN') || upperLine.startsWith('TAHUN')) continue;
      if (upperLine.includes('KODE KEGIATAN') || upperLine.includes('KODE REKENING') || upperLine.includes('NO BUKTI') || upperLine.includes('NO. BUKTI')) continue;
      if (upperLine.includes('Saldo Buku') || upperLine.includes('Saldo Bank') || upperLine.includes('Saldo Kas')) continue;
      if (upperLine.includes('KEPALA SEKOLAH') || upperLine.includes('BENDAHARA') || upperLine.includes('NIP')) continue;
      if (upperLine.includes('HALAMAN') && upperLine.includes('DARI')) continue;
      if (upperLine.includes('BUKU KAS') || upperLine.includes('MENYETUJUI')) continue;
      if (/^\d\s*$/.test(line) || /^[1-8]$/.test(line.trim())) continue;

      const parts = line.split('\t').map(p => p.replace(/\n/g, '').trim()).filter(Boolean);
      if (parts.length < 3) continue;

      const firstPart = parts[0];
      if (firstPart.toUpperCase() === 'JUMLAH') continue;
      if (!dateRe.test(firstPart)) continue;

      const tanggal = firstPart;
      let kodeKegiatan = '';
      let kodeRekening = '';
      let noBukti = '';
      let uraian = '';
      let penerimaan = 0;
      let pengeluaran = 0;
      let saldo = 0;

      let idx = 1;

      // Check kode kegiatan
      if (idx < parts.length && kodeKegiatanRe.test(parts[idx])) {
        kodeKegiatan = parts[idx];
        idx++;
      }

      // Check kode rekening
      if (idx < parts.length && kodeRekeningRe.test(parts[idx])) {
        kodeRekening = parts[idx];
        idx++;
        if (idx < parts.length && /^\d{2,4}$/.test(parts[idx]) && kodeRekening.endsWith('0')) {
          kodeRekening = kodeRekening + parts[idx];
          idx++;
        }
      }

      // Check no bukti
      if (idx < parts.length) {
        const noBuktiMergedMatch = parts[idx].match(/^(BPU|BNU|BBU)(\d+)\s+(.+)$/i);
        if (noBuktiRe.test(parts[idx])) {
          noBukti = parts[idx];
          idx++;
        } else if (noBuktiMergedMatch) {
          noBukti = noBuktiMergedMatch[1] + noBuktiMergedMatch[2];
          parts[idx] = noBuktiMergedMatch[3];
        }
      }

      // Uraian
      if (idx < parts.length && !/^[\d.\s]+$/.test(parts[idx])) {
        uraian = parts[idx];
        idx++;
      }

      // Amounts
      const rawAmountStrings = parts.slice(idx).filter(p => p.trim());
      const allAmounts: number[] = [];
      for (const rawPart of rawAmountStrings) {
        const subParts = rawPart.trim().split(/\s+/);
        for (const sp of subParts) {
          const val = parseAmount(sp);
          if (val > 0 || sp.trim() === '0') {
            allAmounts.push(val);
          }
        }
      }

      if (allAmounts.length >= 3) {
        penerimaan = allAmounts[0];
        pengeluaran = allAmounts[1];
        saldo = allAmounts[2];
      } else if (allAmounts.length === 2) {
        pengeluaran = allAmounts[0];
        saldo = allAmounts[1];
      } else if (allAmounts.length === 1) {
        saldo = allAmounts[0];
      }

      if (penerimaan > 0 || pengeluaran > 0 || saldo > 0 || uraian) {
        transactions.push({ tanggal, kodeKegiatan, kodeRekening, noBukti, uraian, penerimaan, pengeluaran, saldo });
        totalPenerimaan += penerimaan;
        totalPengeluaran += pengeluaran;
        lastSaldo = saldo;
      }
    }
  } else {
    // pdfplumber format
    const datePattern = /^(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?|\d{1,2})\s+/;

    for (const line of lines) {
      const upperLine = line.toUpperCase();
      if (upperLine.startsWith('TANGGAL') || upperLine.startsWith('HALAMAN') || upperLine.startsWith('BULAN') || upperLine.startsWith('TAHUN')) continue;
      if (upperLine.includes('KODE KEGIATAN') || upperLine.includes('KODE REKENING') || upperLine.includes('NO BUKTI')) continue;
      if (upperLine.includes('Saldo Buku') || upperLine.includes('Saldo Bank') || upperLine.includes('Saldo Kas')) continue;
      if (!datePattern.test(line)) continue;

      const parts = line.split(/\s{2,}|\t/).filter(Boolean);
      if (parts.length < 5) continue;
      if (parts[0].trim().toUpperCase() === 'JUMLAH') continue;

      const tanggal = parts[0]?.trim() || '';
      const kodeKegiatan = parts[1]?.trim() || '';
      const kodeRekening = parts[2]?.trim() || '';
      const noBukti = parts[3]?.trim() || '';
      const uraian = parts[4]?.trim() || '';
      const penerimaan = parseAmount(parts[parts.length - 3]);
      const pengeluaran = parseAmount(parts[parts.length - 2]);
      const saldo = parseAmount(parts[parts.length - 1]);

      if (penerimaan > 0 || pengeluaran > 0 || saldo > 0 || uraian) {
        transactions.push({ tanggal, kodeKegiatan, kodeRekening, noBukti, uraian, penerimaan, pengeluaran, saldo });
        totalPenerimaan += penerimaan;
        totalPengeluaran += pengeluaran;
        lastSaldo = saldo;
      }
    }
  }

  const result: BKUMonth = {
    fileName,
    bulan: headerInfo.bulan || '',
    tahun: headerInfo.tahun || '',
    sumberDana: headerInfo.sumberDana || '',
    namaSekolah: headerInfo.namaSekolah || '',
    npsn: headerInfo.npsn || '',
    transactions,
    totalPenerimaan,
    totalPengeluaran,
    saldoAkhir: parseInt(headerInfo.saldoAkhir) || lastSaldo,
    saldoAkhirBank: parseInt(headerInfo.saldoAkhirBank) || 0,
    saldoAkhirTunai: parseInt(headerInfo.saldoAkhirTunai) || 0,
    tanggalTutup: headerInfo.tanggalTutup || '',
  };

  console.log(`[BKU Parser] Parsed ${fileName}: ${transactions.length} transactions, bulan=${headerInfo.bulan}, tahun=${headerInfo.tahun}, namaSekolah=${headerInfo.namaSekolah}`);
  return result;
}

// ============================================================================
// BKU Pajak Parser
// ============================================================================

export function parseBKUPajakFromText(text: string, fileName: string): BKUPajakMonth {
  const headerInfo: Record<string, string> = {};
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const bulanMatch = text.match(/BULAN\s*:\s*(\w+)/i);
  if (bulanMatch) headerInfo.bulan = bulanMatch[1];
  const tahunMatch = text.match(/TAHUN\s*:\s*(\d{4})/i);
  if (tahunMatch) headerInfo.tahun = tahunMatch[1];
  const bulanTahun = text.match(/BULAN\s*:\s*(\w+)\s+(\d{4})/i);
  if (bulanTahun) { headerInfo.bulan = bulanTahun[1]; headerInfo.tahun = bulanTahun[2]; }

  const npsnMatch = text.match(/NPSN\s*:?\s*(\d+)/i);
  if (npsnMatch && !headerInfo.npsn) headerInfo.npsn = npsnMatch[1];
  const sekolahMatch = text.match(/Nama Sekolah\s*:\s*([^\t\n]+)/i);
  if (sekolahMatch) {
    let val = sekolahMatch[1].trim();
    val = val.replace(/\s*Halaman\s+\d+\s+dari\s+\d+.*$/i, '').trim();
    headerInfo.namaSekolah = val;
  }
  const alamatMatch = text.match(/Desa\/Kecamatan\s*:\s*([^\t\n]+)/i);
  if (alamatMatch) headerInfo.alamat = alamatMatch[1].trim();
  const kabMatch = text.match(/Kabupaten\s*\/?\s*Kota\s*:\s*([^\t\n]+)/i);
  if (kabMatch) headerInfo.kabupaten = kabMatch[1].trim();
  const provMatch = text.match(/Provinsi\s*:\s*([^\t\n]+)/i);
  if (provMatch) headerInfo.provinsi = provMatch[1].trim();

  if (text.includes('Sumber Dana')) {
    const sdMatch = text.match(/Sumber Dana\s*:?\s*([^\t\n]+)/i);
    if (sdMatch) {
      const val = sdMatch[1].trim();
      if (val && val !== ':' && !val.includes('No.') && !val.includes('Kode')) headerInfo.sumberDana = val;
    }
  }

  const nameMatches = text.match(/[A-Z][a-z]+[A-Z]?[a-z]*.*?(?:S\.Pd|S\.Kom|M\.M|M\.Si|S\.E|S\.S)/g);
  if (nameMatches) {
    if (!headerInfo.kepalaSekolahName && nameMatches[0]) headerInfo.kepalaSekolahName = nameMatches[0].trim();
    if (!headerInfo.bendaharaName && nameMatches[1]) headerInfo.bendaharaName = nameMatches[1].trim();
  }

  if (!headerInfo.tahun) {
    const tahunM = text.match(/:\s*(\d{4})/);
    if (tahunM) headerInfo.tahun = tahunM[1];
  }

  const tanggalMatch = text.match(/(\d{1,2}\s+\w+\s+\d{4})/);
  if (tanggalMatch) headerInfo.tanggalTutup = tanggalMatch[1];

  // --- Transaction rows ---
  const transactions: BKUPajakTransaction[] = [];
  let totalPPN = 0, totalPPh21 = 0, totalPPh23 = 0, totalPPh4 = 0, totalSSPD = 0;
  let totalPenerimaan = 0, totalPengeluaran = 0, saldoAkhir = 0;
  const jenisPajakMap = new Map<string, { nama: string; totalPenerimaan: number; totalPengeluaran: number; jumlahTransaksi: number }>();

  const isPdf2Json = lines.some(l => {
    const tabs = l.split('\t').filter(Boolean);
    if (tabs.length < 3) return false;
    const first = tabs[0]?.trim();
    return /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(first);
  });

  const hasTabs = text.includes('\t');
  const useTabParsing = isPdf2Json || (hasTabs && !lines.some(l => /^\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?\s+/.test(l) && !l.includes('\t')));

  console.log(`[BKU Pajak Parser] isPdf2Json=${isPdf2Json}, hasTabs=${hasTabs}, useTabParsing=${useTabParsing}, lines=${lines.length}`);

  if (isPdf2Json || useTabParsing) {
    const dateRe = /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/;
    const noKodeRe = /^\d{2}\.\d{2}\.\d{2}\.?$/;

    for (const line of lines) {
      const upperLine = line.toUpperCase();
      if (upperLine.startsWith('TANGGAL') || upperLine.startsWith('HALAMAN') || upperLine.startsWith('BULAN') || upperLine.startsWith('TAHUN')) continue;
      if (upperLine.includes('NO. KODE') || upperLine.includes('URAIAN') || upperLine.includes('PENERIMAAN')) continue;
      if (upperLine.includes('KEPALA SEKOLAH') || upperLine.includes('BENDAHARA') || upperLine.includes('NIP')) continue;
      if (upperLine.includes('MENYETUJUI') || upperLine.includes('BUKU PEMBANTU')) continue;
      if (upperLine.includes('DESA') || upperLine.includes('KABUPATEN') || upperLine.includes('PROVINSI')) continue;
      if (upperLine.includes('HALAMAN') && upperLine.includes('DARI')) continue;
      if (upperLine.includes('NPSN') || upperLine.includes('NAMA SEKOLAH') || upperLine.includes('SUMBER DANA')) continue;

      const parts = line.split('\t').map(p => p.replace(/\n/g, '').trim()).filter(Boolean);

      if (parts[0]?.toUpperCase() === 'JUMLAH') {
        const amounts = parts.slice(1).filter(p => /^[\d.\s]+$/.test(p.trim()) || p.trim() === '0');
        if (amounts.length >= 7) {
          totalPPN = parseAmount(amounts[0]);
          totalPPh21 = parseAmount(amounts[1]);
          totalPPh23 = parseAmount(amounts[2]);
          totalPPh4 = parseAmount(amounts[3]);
          totalSSPD = parseAmount(amounts[4]);
          totalPengeluaran = parseAmount(amounts[5]);
          saldoAkhir = parseAmount(amounts[6]);
          totalPenerimaan = totalPPN + totalPPh21 + totalPPh23 + totalPPh4 + totalSSPD;
        }
        continue;
      }

      if (!dateRe.test(parts[0])) continue;

      const tanggal = parts[0];
      let noKode = '';
      let uraian = '';
      let ppn = 0, pph21 = 0, pph23 = 0, pph4 = 0, sspd = 0, pengeluaran = 0, saldo = 0;

      let idx = 1;
      if (idx < parts.length && noKodeRe.test(parts[idx])) {
        noKode = parts[idx];
        idx++;
      }
      if (idx < parts.length && !/^[\d.\s]+$/.test(parts[idx])) {
        uraian = parts[idx];
        idx++;
      }

      const amountParts = parts.slice(idx).map(p => p.trim()).filter(p => p);
      const numericParts = amountParts.filter(p => /^[\d.]+$/.test(p) || p === '0');

      if (numericParts.length >= 7) {
        ppn = parseAmount(numericParts[0]);
        pph21 = parseAmount(numericParts[1]);
        pph23 = parseAmount(numericParts[2]);
        pph4 = parseAmount(numericParts[3]);
        sspd = parseAmount(numericParts[4]);
        pengeluaran = parseAmount(numericParts[5]);
        saldo = parseAmount(numericParts[6]);
      } else if (numericParts.length >= 5) {
        ppn = parseAmount(numericParts[0]);
        if (numericParts.length > 1) pph21 = parseAmount(numericParts[1]);
        if (numericParts.length > 2) pph23 = parseAmount(numericParts[2]);
        if (numericParts.length > 3) pph4 = parseAmount(numericParts[3]);
        if (numericParts.length > 4) sspd = parseAmount(numericParts[4]);
        if (numericParts.length > 5) pengeluaran = parseAmount(numericParts[5]);
        if (numericParts.length > 6) saldo = parseAmount(numericParts[6]);
      }

      let jenisTransaksi: 'Terima' | 'Setor' | 'Lainnya' = 'Lainnya';
      if (uraian.toLowerCase().startsWith('terima')) jenisTransaksi = 'Terima';
      else if (uraian.toLowerCase().startsWith('setor')) jenisTransaksi = 'Setor';

      transactions.push({ tanggal, noKode, uraian, ppn, pph21, pph23, pph4, sspd, pengeluaran, saldo, jenisTransaksi });

      if (noKode) {
        const existing = jenisPajakMap.get(noKode);
        if (existing) {
          existing.totalPenerimaan += ppn + pph21 + pph23 + pph4 + sspd;
          existing.totalPengeluaran += pengeluaran;
          existing.jumlahTransaksi += 1;
        } else {
          let cleanNama = uraian
            .replace(/^Terima\s+(PPN\s+|PPh\s+)?/i, '')
            .replace(/^Setor\s+(PPN\s+|PPh\s+)?/i, '')
            .replace(/\s*\(.*?\)\s*/g, '')
            .trim();
          if (!cleanNama) cleanNama = uraian.trim();
          jenisPajakMap.set(noKode, {
            nama: cleanNama,
            totalPenerimaan: ppn + pph21 + pph23 + pph4 + sspd,
            totalPengeluaran: pengeluaran,
            jumlahTransaksi: 1,
          });
        }
      }
    }
  } else {
    // pdfplumber format
    for (const line of lines) {
      const upperLine = line.toUpperCase();
      if (upperLine.startsWith('TANGGAL') || (upperLine.includes('KODE') && upperLine.includes('URAIAN'))) continue;
      if (upperLine.includes('PPN') && upperLine.includes('PPH') && !line.match(/^\d/)) continue;
      if (upperLine.startsWith('HALAMAN')) continue;

      const parts = line.split(/\s{2,}|\t/).filter(Boolean);
      if (parts.length < 5) continue;

      if (parts[0].trim().toUpperCase() === 'JUMLAH') {
        totalPPN = parseAmount(parts[3]);
        totalPPh21 = parseAmount(parts[4]);
        totalPPh23 = parseAmount(parts[5]);
        totalPPh4 = parseAmount(parts[6]);
        totalSSPD = parseAmount(parts[7]);
        totalPengeluaran = parseAmount(parts[parts.length - 2]);
        saldoAkhir = parseAmount(parts[parts.length - 1]);
        totalPenerimaan = totalPPN + totalPPh21 + totalPPh23 + totalPPh4 + totalSSPD;
        continue;
      }

      const firstPart = parts[0].trim();
      if (!firstPart || !firstPart.match(/^\d/)) continue;

      const tanggal = firstPart;
      const noKode = parts[1]?.trim() || '';
      const uraian = parts[2]?.trim() || '';
      const ppn = parseAmount(parts[3]);
      const pph21 = parseAmount(parts[4]);
      const pph23 = parseAmount(parts[5]);
      const pph4 = parseAmount(parts[6]);
      const sspd = parseAmount(parts[7]);
      const pengeluaran = parseAmount(parts[parts.length - 2]);
      const saldo = parseAmount(parts[parts.length - 1]);

      let jenisTransaksi: 'Terima' | 'Setor' | 'Lainnya' = 'Lainnya';
      if (uraian.toLowerCase().startsWith('terima')) jenisTransaksi = 'Terima';
      else if (uraian.toLowerCase().startsWith('setor')) jenisTransaksi = 'Setor';

      transactions.push({ tanggal, noKode, uraian, ppn, pph21, pph23, pph4, sspd, pengeluaran, saldo, jenisTransaksi });

      if (noKode) {
        const existing = jenisPajakMap.get(noKode);
        if (existing) {
          existing.totalPenerimaan += ppn + pph21 + pph23 + pph4 + sspd;
          existing.totalPengeluaran += pengeluaran;
          existing.jumlahTransaksi += 1;
        } else {
          let cleanNama = uraian
            .replace(/^Terima\s+(PPN\s+|PPh\s+)?/i, '')
            .replace(/^Setor\s+(PPN\s+|PPh\s+)?/i, '')
            .replace(/\s*\(.*?\)\s*/g, '')
            .trim();
          if (!cleanNama) cleanNama = uraian.trim();
          jenisPajakMap.set(noKode, {
            nama: cleanNama,
            totalPenerimaan: ppn + pph21 + pph23 + pph4 + sspd,
            totalPengeluaran: pengeluaran,
            jumlahTransaksi: 1,
          });
        }
      }
    }
  }

  // Fallback totals from transactions
  if (totalPenerimaan === 0 && totalPengeluaran === 0) {
    totalPPN = transactions.reduce((s, t) => s + t.ppn, 0);
    totalPPh21 = transactions.reduce((s, t) => s + t.pph21, 0);
    totalPPh23 = transactions.reduce((s, t) => s + t.pph23, 0);
    totalPPh4 = transactions.reduce((s, t) => s + t.pph4, 0);
    totalSSPD = transactions.reduce((s, t) => s + t.sspd, 0);
    totalPenerimaan = totalPPN + totalPPh21 + totalPPh23 + totalPPh4 + totalSSPD;
    totalPengeluaran = transactions.reduce((s, t) => s + t.pengeluaran, 0);
    saldoAkhir = transactions.length > 0 ? transactions[transactions.length - 1].saldo : 0;
  }

  // Build jenisPajak list
  const namaMap = new Map<string, BKUPajakJenisPajak>();
  for (const [kode, info] of jenisPajakMap) {
    const key = info.nama;
    const existing = namaMap.get(key);
    if (existing) {
      existing.totalPenerimaan += info.totalPenerimaan;
      existing.totalPengeluaran += info.totalPengeluaran;
      existing.jumlahTransaksi += info.jumlahTransaksi;
    } else {
      namaMap.set(key, { kode, ...info });
    }
  }
  const jenisPajak = Array.from(namaMap.values()).sort((a, b) => b.totalPenerimaan - a.totalPenerimaan);

  const result: BKUPajakMonth = {
    fileName,
    bulan: (headerInfo.bulan || '').toUpperCase(),
    tahun: headerInfo.tahun || '',
    sumberDana: headerInfo.sumberDana || '',
    namaSekolah: headerInfo.namaSekolah || '',
    npsn: headerInfo.npsn || '',
    alamat: headerInfo.alamat || '',
    kabupaten: headerInfo.kabupaten || '',
    provinsi: headerInfo.provinsi || '',
    transactions,
    totalPPN, totalPPh21, totalPPh23, totalPPh4, totalSSPD,
    totalPenerimaan, totalPengeluaran, saldoAkhir,
    jenisPajak,
    tanggalTutup: headerInfo.tanggalTutup || '',
    kepalaSekolah: headerInfo.kepalaSekolahName || headerInfo.kepalaSekolah || '',
    bendahara: headerInfo.bendaharaName || headerInfo.bendahara || '',
  };

  console.log(`[BKU Pajak Parser] Parsed ${fileName}: ${transactions.length} transactions, bulan=${headerInfo.bulan}, tahun=${headerInfo.tahun}`);
  return result;
}

// ============================================================================
// RKAS Parser
// ============================================================================

export function parseRKASFromText(text: string, fileName: string): RKASMonth {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const hasTabs = text.includes('\t');
  const headerInfo: Record<string, string> = {};

  // --- Extract judul ---
  const judulParts: string[] = [];
  for (const line of lines.slice(0, 15)) {
    if (reSearch(/(NPSN|TAHUN ANGGARAN|Nama Sekolah|Alamat|Kabupaten|Provinsi|Bulan|Sumber Dana)\s*:/i, line)) break;
    if (reSearch(/Halaman.*dari/i, line)) continue;
    if (reSearch(/Kertas Kerja.*NPSN/i, line)) continue;
    if (reSearch(/^A\.\s*PENERIMAAN/i, line)) break;
    if (reSearch(/^B\.\s*BELANJA/i, line)) break;
    if (line === ':' || line.trim() === '') continue;
    judulParts.push(line);
  }
  headerInfo.judul = judulParts.join(' ');

  const judulUpper = headerInfo.judul.toUpperCase();
  if (judulUpper.includes('PERBULAN') || judulUpper.includes('BULANAN')) {
    headerInfo.tipeFromJudul = 'bulanan';
  } else if (judulUpper.includes('TAHUNAN') || (judulUpper.includes('RKAS') && !judulUpper.includes('PERBULAN'))) {
    headerInfo.tipeFromJudul = 'tahunan';
  }

  // --- Header extraction ---
  for (const line of lines) {
    if (line.includes('Halaman') && line.includes('dari')) continue;
    if (line.includes('Kertas Kerja') && line.includes('NPSN')) continue;
    if (line.includes('RKAS') && line.includes('NPSN')) continue;

    const bulanMatch = reMatch(/Bulan\s*:\s*(\w+)/i, line);
    if (bulanMatch) headerInfo.bulan = bulanMatch[1];
    const tahunMatch = reMatch(/TAHUN ANGGARAN\s*:\s*(\d{4})/i, line);
    if (tahunMatch) headerInfo.tahun = tahunMatch[1];
    const bulanTahun = reMatch(/Bulan\s*:\s*(\w+)\s+(\d{4})/i, line);
    if (bulanTahun) { headerInfo.bulan = bulanTahun[1]; headerInfo.tahun = bulanTahun[2]; }
    const npsnMatch = reMatch(/NPSN\s*:\s*(\d+)/i, line);
    if (npsnMatch && !headerInfo.npsn) headerInfo.npsn = npsnMatch[1];
    const sekolahMatch = reMatch(/Nama Sekolah\s*:\s*(.+)/i, line);
    if (sekolahMatch && sekolahMatch[1].trim()) {
      let val = sekolahMatch[1].trim();
      val = val.replace(/\s*Halaman\s+\d+\s+dari\s+\d+.*$/i, '').trim();
      headerInfo.namaSekolah = val;
    }
    const alamatMatch = reMatch(/Alamat\s*:\s*(.+)/i, line);
    if (alamatMatch && alamatMatch[1].trim()) headerInfo.alamat = alamatMatch[1].trim();
    const kabMatch = reMatch(/Kabupaten\s*:\s*(.+)/i, line);
    if (kabMatch && kabMatch[1].trim()) headerInfo.kabupaten = kabMatch[1].trim();
    const provMatch = reMatch(/Provinsi\s*:\s*(.+)/i, line);
    if (provMatch && provMatch[1].trim()) headerInfo.provinsi = provMatch[1].trim();
    if (line.includes('Sumber Dana') && !line.includes('dan Alokasi')) {
      const sdMatch = reMatch(/Sumber Dana\s*:?\s*(.+)/i, line);
      if (sdMatch) {
        const val = sdMatch[1].trim();
        if (val && val !== ':' && !val.includes('No.') && !val.includes('Kode') && !val.includes('Penerimaan')) {
          headerInfo.sumberDana = val;
        }
      }
    }
  }

  // Multi-line format fallback
  if (!headerInfo.namaSekolah || !headerInfo.alamat || !headerInfo.kabupaten || !headerInfo.provinsi) {
    const fieldOrder: { name: string; lineIdx: number }[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (reSearch(/^Nama Sekolah\s*:?\s*$/i, line)) fieldOrder.push({ name: 'namaSekolah', lineIdx: i });
      else if (reSearch(/^Alamat\s*:?\s*$/i, line)) fieldOrder.push({ name: 'alamat', lineIdx: i });
      else if (reSearch(/^Kabupaten\s*:?\s*$/i, line)) fieldOrder.push({ name: 'kabupaten', lineIdx: i });
      else if (reSearch(/^Provinsi\s*:?\s*$/i, line)) fieldOrder.push({ name: 'provinsi', lineIdx: i });
      else if (reSearch(/^Bulan\s*:?\s*$/i, line)) fieldOrder.push({ name: 'bulan', lineIdx: i });
    }

    if (fieldOrder.length >= 2) {
      const lastFieldIdx = fieldOrder[fieldOrder.length - 1].lineIdx;
      let colonEnd = -1;
      for (let i = lastFieldIdx + 1; i < Math.min(lastFieldIdx + 10, lines.length); i++) {
        if (lines[i].trim() === ':') colonEnd = i;
        else if (colonEnd !== -1 && lines[i].trim() !== ':') break;
      }
      const valueStartIdx = colonEnd !== -1 ? colonEnd + 1 : lastFieldIdx + 1;
      const values: string[] = [];
      for (let i = valueStartIdx; i < Math.min(valueStartIdx + fieldOrder.length + 5, lines.length); i++) {
        const candidate = lines[i].trim();
        if (candidate === ':' || candidate === '') continue;
        if (reSearch(/^(NPSN|A\.|B\.)/i, candidate)) break;
        values.push(candidate);
      }
      for (let fi = 0; fi < fieldOrder.length && fi < values.length; fi++) {
        const fieldName = fieldOrder[fi].name;
        const value = values[fi];
        if (fieldName === 'namaSekolah' && !headerInfo.namaSekolah) headerInfo.namaSekolah = value;
        if (fieldName === 'alamat' && !headerInfo.alamat) headerInfo.alamat = value;
        if (fieldName === 'kabupaten' && !headerInfo.kabupaten) headerInfo.kabupaten = value;
        if (fieldName === 'provinsi' && !headerInfo.provinsi) headerInfo.provinsi = value;
        if (fieldName === 'bulan' && !headerInfo.bulan) {
          const bulanMatch = reMatch(/^(\w+)\s+\d{4}$/i, value);
          if (bulanMatch) headerInfo.bulan = bulanMatch[1];
          else headerInfo.bulan = value;
        }
      }
    }
  }

  // Try "Februari 2026" pattern
  if (!headerInfo.bulan) {
    const bulanNames = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    for (const line of lines) {
      for (const b of bulanNames) {
        const m = reMatch(new RegExp(`(${b})\\s+(\\d{4})`, 'i'), line);
        if (m) { headerInfo.bulan = m[1]; if (!headerInfo.tahun) headerInfo.tahun = m[2]; break; }
      }
      if (headerInfo.bulan) break;
    }
  }

  if (!headerInfo.tahun) {
    const tahunM = reMatch(/:\s*(\d{4})/, text);
    if (tahunM) headerInfo.tahun = tahunM[1];
  }

  // Sumber Dana from tab-separated line
  if (!headerInfo.sumberDana) {
    for (const line of lines) {
      if (line.includes('\t') && line.includes('Sumber Dana')) {
        const parts = line.split('\t');
        const sumberDanaPart = parts.find(p => p.trim() && !p.includes('Sumber Dana'));
        if (sumberDanaPart) headerInfo.sumberDana = sumberDanaPart.trim();
      }
    }
  }

  // --- Penerimaan ---
  const penerimaan: RKASPenerimaanItem[] = [];
  let totalPenerimaan = 0;
  let inPenerimaan = false;

  for (const line of lines) {
    const upperLine = line.toUpperCase();
    if (reSearch(/^A\.\s*PENERIMAAN/i, line) || (upperLine.includes('PENERIMAAN') && (upperLine.includes('KODE') || upperLine.includes('NO')))) {
      inPenerimaan = true; continue;
    }
    if (inPenerimaan) {
      if (upperLine.includes('TOTAL') && upperLine.includes('PENERIMAAN')) {
        const totalMatch = reMatch(/([\d.]+)/, line.replace(/TOTAL\s*PENERIMAAN/i, ''));
        if (totalMatch) totalPenerimaan = parseAmount(totalMatch[1]);
        inPenerimaan = false; continue;
      }
      if (upperLine.startsWith('B.') && upperLine.includes('BELANJA')) { inPenerimaan = false; continue; }
      const match = reMatch(/^(\d+\.\d+(?:\.\d+)*)\.?\s+(.+?)\s+([\d.]+)$/, line);
      if (match) {
        penerimaan.push({ kode: match[1], nama: match[2].trim(), jumlah: parseAmount(match[3]) });
      }
    }
  }

  if (totalPenerimaan === 0) {
    for (const line of lines) {
      if (line.toUpperCase().includes('TOTAL') && line.toUpperCase().includes('PENERIMAAN')) {
        const totalMatch = reMatch(/([\d.]+)/, line.replace(/TOTAL\s*PENERIMAAN/i, ''));
        if (totalMatch) totalPenerimaan = parseAmount(totalMatch[1]);
      }
    }
  }
  if (totalPenerimaan === 0 && penerimaan.length > 0) {
    totalPenerimaan = penerimaan.reduce((s, p) => s + p.jumlah, 0);
  }

  // --- Belanja ---
  const belanjaRaw: {
    noUrut: string; kodeRekening: string; kodeProgram: string; uraian: string;
    volume: string; satuan: string; tarifHarga: string; jumlah: string;
  }[] = [];

  let inBelanja = false;

  if (hasTabs) {
    let isTahunanTable = false;
    let belanjaHeaderLines = 0;

    for (const line of lines) {
      const upperLine = line.toUpperCase();

      if (reSearch(/^B\.\s*BELANJA/i, line) ||
          (upperLine.includes('BELANJA') && (upperLine.includes('NO') || upperLine.includes('URUT'))) ||
          (upperLine.includes('KODE REKENING') && upperLine.includes('URAIAN'))) {
        inBelanja = true; belanjaHeaderLines = 0;
        if (upperLine.includes('SUMBER DANA') || upperLine.includes('ALOKASI') || upperLine.includes('OPERASI')) isTahunanTable = true;
        continue;
      }
      if (!inBelanja) continue;

      belanjaHeaderLines++;
      if (belanjaHeaderLines <= 20) {
        if (upperLine.includes('SUMBER DANA') || upperLine.includes('ALOKASI ANGGARAN') ||
            (upperLine.includes('BOSP') && upperLine.includes('REGULER')) ||
            upperLine.includes('SILPA')) {
          isTahunanTable = true;
        }
      }

      if (upperLine.includes('TOTAL') && upperLine.includes('PENERIMAAN')) continue;
      if (upperLine.includes('VOLUME') && upperLine.includes('SATUAN')) continue;
      if (upperLine.includes('BELANJA') && upperLine.includes('OPERASI')) continue;
      if (upperLine.includes('SUMBER DANA') && upperLine.includes('ALOKASI')) continue;
      if (upperLine.includes('NO') && upperLine.includes('URUT')) continue;
      if (upperLine.includes('KODE') && upperLine.includes('REKENING')) continue;
      if (upperLine.includes('KODE') && upperLine.includes('KEGIATAN')) continue;
      if (upperLine.includes('BOSP') && (upperLine.includes('REGULER') || upperLine.includes('DAERAH'))) continue;
      if (upperLine.includes('Halaman') && upperLine.includes('dari')) continue;
      if (upperLine.includes('Kertas Kerja') || upperLine.includes('RKAS')) continue;
      if (upperLine.includes('MODAL') && upperLine.includes('OPERASI')) continue;
      if (upperLine.includes('SiLPA')) continue;
      if (upperLine.includes('Jumlah') && line.split('\t').length <= 2) continue;

      const tabs = line.split('\t');

      if (isTahunanTable) {
        if (tabs.length < 1) continue;
        const firstPart = tabs[0].trim();
        const secondPart = tabs[1]?.trim() || '';

        let noUrut = '';
        let kodeProgram = '';
        let kodeRekening = '';

        let firstMatch = reMatch(/^(\d+)\s+([\d.]+\.?)$/, firstPart);
        if (firstMatch) {
          noUrut = firstMatch[1]; kodeProgram = firstMatch[2];
        } else {
          const pdfjsMatch = reMatch(/^(\d+)\s+(5\.\d+\.[\d.]+)\s+([\d.]+\.?)$/, firstPart);
          if (pdfjsMatch) {
            noUrut = pdfjsMatch[1]; kodeRekening = pdfjsMatch[2]; kodeProgram = pdfjsMatch[3];
          } else {
            const simpleMatch = reMatch(/^(\d+)\s+([\d.]+\.?)\s+(.+)$/, firstPart);
            if (simpleMatch) {
              noUrut = simpleMatch[1]; kodeProgram = simpleMatch[2];
            } else {
              const noKodeRekMatch = reMatch(/^(\d+)\s+([\d.]+\.\s+)/, firstPart);
              if (noKodeRekMatch) {
                noUrut = noKodeRekMatch[1]; kodeProgram = noKodeRekMatch[2].trim();
              } else continue;
            }
          }
        }

        let uraianSource = secondPart;
        if (!kodeRekening) {
          const firstPartExtra = reMatch(/^\d+\s+(?:5\.\d+\.[\d.]+\s+)?[\d.]+\.?\s+(.+)$/, firstPart);
          if (firstPartExtra) uraianSource = firstPartExtra[1] + (secondPart ? '\t' + secondPart : '');
        }

        let uraian = '';
        let jumlah = '';

        const kodeRekMatch = reMatch(/^(\d+\.[\d.]+)\s+(.+)$/, uraianSource);
        if (kodeRekMatch && reMatch(/^5\./, kodeRekMatch[1]) && !kodeRekening) {
          kodeRekening = kodeRekMatch[1];
          const rest = kodeRekMatch[2];
          const uraianJumlahMatch = reMatch(/^(.+?)\s+([\d.]+)\s+[\d.]+\s+[\d.]+\s+[\d.]+\s+[\d.]+$/, rest);
          if (uraianJumlahMatch) { uraian = uraianJumlahMatch[1].trim(); jumlah = uraianJumlahMatch[2]; }
          else {
            const simpleUJ = reMatch(/^(.+?)\s+([\d.]+)\s/, rest);
            if (simpleUJ) { uraian = simpleUJ[1].trim(); jumlah = simpleUJ[2]; }
          }
        } else {
          const simpleUJ = reMatch(/^(.+?)\s+([\d.]+)\s/, uraianSource);
          if (simpleUJ) { uraian = simpleUJ[1].trim(); jumlah = simpleUJ[2]; }
          else {
            const uraianJumlahMatch = reMatch(/^(.+?)\s+([\d.]+)\s+[\d.]+\s+[\d.]+\s+[\d.]+\s+[\d.]+$/, uraianSource);
            if (uraianJumlahMatch) { uraian = uraianJumlahMatch[1].trim(); jumlah = uraianJumlahMatch[2]; }
            else uraian = uraianSource;
          }
        }

        belanjaRaw.push({ noUrut, kodeRekening, kodeProgram, uraian, volume: '', satuan: '', tarifHarga: '', jumlah });
      } else {
        // Bulanan format
        if (!reSearch(/^\d/, line.replace(/^\s*/, ''))) continue;
        if (upperLine.startsWith('HALAMAN')) continue;

        const firstPart = tabs[0].trim();
        let kodeProgSuffix = '';
        let mainDataPart = '';
        let volumePart = '';
        let kodeRekening = '';
        let kodeProgParts: string[] = [];

        if (reMatch(/^(\d{2})\.\s*$/, firstPart)) {
          kodeProgSuffix = firstPart.trim();
          mainDataPart = tabs[1]?.trim() || '';
          const remaining = tabs.slice(2);
          let volIdx = 0;
          if (remaining.length > 0 && reSearch(/^\d[\d.]*\s+\w+/, remaining[0].trim())) {
            volumePart = remaining[0].trim(); volIdx = 1;
          }
          const kodeParts = remaining.slice(volIdx);
          for (const kp of kodeParts) {
            const trimmed = kp.trim();
            if (!trimmed) continue;
            if (reMatch(/^5\.\d+\.[\d.]+$/, trimmed)) kodeRekening = trimmed;
            else if (reMatch(/^\d{2}\.\s*$/, trimmed)) kodeProgParts.push(trimmed);
          }
        } else {
          mainDataPart = firstPart;
          const remaining = tabs.slice(1);
          let volIdx = 0;
          if (remaining.length > 0 && reSearch(/^\d[\d.]*\s+\w+/, remaining[0].trim())) {
            volumePart = remaining[0].trim(); volIdx = 1;
          }
          const kodeParts = remaining.slice(volIdx);
          for (const kp of kodeParts) {
            const trimmed = kp.trim();
            if (!trimmed) continue;
            if (reMatch(/^5\.\d+\.[\d.]+$/, trimmed)) kodeRekening = trimmed;
            else if (reMatch(/^\d{2}\.\s*$/, trimmed)) kodeProgParts.push(trimmed);
          }
        }

        const mainMatch = reMatch(/^(\d+)\.\s+(.+?)\s+([\d.]+)$/, mainDataPart);
        if (!mainMatch) continue;

        const noUrut = mainMatch[1];
        const uraian = mainMatch[2].trim();
        const jumlah = mainMatch[3];
        const kodeProgram = [...kodeProgParts, kodeProgSuffix].join('').replace(/\s/g, '');

        let volume = '';
        let satuan = '';
        let tarifHarga = '';
        if (volumePart) {
          const volMatch = reMatch(/^(\d[\d.]*)\s+(.+?)\s+([\d.]+)$/, volumePart);
          if (volMatch) { volume = volMatch[1]; satuan = volMatch[2].trim(); tarifHarga = volMatch[3]; }
          else {
            const volMatch2 = reMatch(/^(\d[\d.]*)\s+(.+)$/, volumePart);
            if (volMatch2) { volume = volMatch2[1]; satuan = volMatch2[2].trim(); }
          }
        }

        belanjaRaw.push({ noUrut, kodeRekening, kodeProgram, uraian, volume, satuan, tarifHarga, jumlah });
      }
    }
  } else {
    // pdfplumber format
    for (const line of lines) {
      const upperLine = line.toUpperCase();
      if ((upperLine.includes('BELANJA') && (upperLine.includes('NO') || upperLine.includes('URUT'))) ||
          (upperLine.includes('KODE REKENING') && upperLine.includes('URAIAN'))) {
        inBelanja = true; continue;
      }
      if (!inBelanja) continue;
      if (upperLine.includes('VOLUME') && upperLine.includes('SATUAN')) continue;
      if (upperLine.includes('BELANJA') && upperLine.includes('OPERASI')) continue;
      if (upperLine.includes('SUMBER DANA') && upperLine.includes('ALOKASI')) continue;
      if (upperLine.includes('NO') && upperLine.includes('URUT')) continue;

      const fullMatch = reMatch(/^(\d+)\s+(\d+\.[\d.]+)\s+(\d{2}\.[\d.]+)\s+(.+?)\s+(\d[\d.]*)\s+(\w+)\s+(\d[\d.]*)\s+(\d[\d.]+)$/, line);
      if (fullMatch) {
        belanjaRaw.push({ noUrut: fullMatch[1], kodeRekening: fullMatch[2], kodeProgram: fullMatch[3], uraian: fullMatch[4].trim(), volume: fullMatch[5], satuan: fullMatch[6], tarifHarga: fullMatch[7], jumlah: fullMatch[8] });
        continue;
      }
      const simpleMatch = reMatch(/^(\d+)\s+(\d+\.[\d.]+)\s+(\d{2}\.[\d.]+)\s+(.+?)\s+(\d[\d.]+)\s*$/, line);
      if (simpleMatch) {
        belanjaRaw.push({ noUrut: simpleMatch[1], kodeRekening: simpleMatch[2], kodeProgram: simpleMatch[3], uraian: simpleMatch[4].trim(), volume: '', satuan: '', tarifHarga: '', jumlah: simpleMatch[5] });
        continue;
      }
    }
  }

  // Build items
  const STANDAR_MAP: Record<string, string> = {
    '02': 'Standar Isi', '03': 'Standar Proses', '04': 'Standar Tenaga Kependidikan',
    '05': 'Standar Sarana dan Prasarana', '06': 'Standar Pengelolaan',
    '07': 'Standar Pembiayaan', '08': 'Standar Penilaian Pendidikan',
  };

  function extractStandarCode(kodeProgram: string): string {
    if (!kodeProgram) return '';
    const cleaned = kodeProgram.replace(/\s/g, '');
    const match = cleaned.match(/^(\d{2})\./);
    return match ? match[1] : '';
  }

  const rawItems: RKASItem[] = belanjaRaw
    .filter(r => r.kodeRekening && r.kodeRekening.trim() !== '')
    .map(r => ({
      noUrut: r.noUrut, kodeRekening: r.kodeRekening, kodeProgram: r.kodeProgram,
      uraian: r.uraian, volume: r.volume, satuan: r.satuan,
      tarifHarga: parseAmount(r.tarifHarga), jumlah: parseAmount(r.jumlah),
    }));

  // Filter intermediate rows
  const allItems: RKASItem[] = [];
  for (let idx = 0; idx < rawItems.length; idx++) {
    const item = rawItems[idx];
    const next = idx + 1 < rawItems.length ? rawItems[idx + 1] : null;
    const itemStartsWithNumber = /^\d{3}[.\s]/.test(item.uraian.trim());
    const isIntermediate = !itemStartsWithNumber
      && next
      && item.kodeRekening === next.kodeRekening
      && item.kodeProgram.replace(/\s/g, '') === next.kodeProgram.replace(/\s/g, '')
      && /^\d{3}[.\s]/.test(next.uraian.trim());
    if (!isIntermediate) allItems.push(item);
  }

  // Group by standar
  const standarMap = new Map<string, RKASItem[]>();
  for (const item of allItems) {
    const standarCode = extractStandarCode(item.kodeProgram);
    if (standarCode) {
      if (!standarMap.has(standarCode)) standarMap.set(standarCode, []);
      standarMap.get(standarCode)!.push(item);
    }
  }

  const standarList: RKASStandar[] = [];
  const orderedCodes = ['02', '03', '04', '05', '06', '07', '08'];
  for (const code of orderedCodes) {
    const items = standarMap.get(code);
    if (items && items.length > 0) {
      standarList.push({ kode: code, nama: STANDAR_MAP[code] || `Standar ${code}`, items, total: items.reduce((s, item) => s + item.jumlah, 0) });
    }
  }
  for (const [code, items] of standarMap) {
    if (!orderedCodes.includes(code) && items.length > 0) {
      standarList.push({ kode: code, nama: STANDAR_MAP[code] || `Standar ${code}`, items, total: items.reduce((s, item) => s + item.jumlah, 0) });
    }
  }

  const totalBelanja = allItems.reduce((s, item) => s + item.jumlah, 0);

  // Determine tipe
  const bulanValue = (headerInfo.bulan || '').toUpperCase();
  const tipeFromJudul = headerInfo.tipeFromJudul || '';
  let tipe: 'bulanan' | 'tahunan';

  if (tipeFromJudul === 'bulanan') tipe = 'bulanan';
  else if (tipeFromJudul === 'tahunan') tipe = 'tahunan';
  else tipe = bulanValue ? 'bulanan' : 'tahunan';

  const judul = headerInfo.judul || (tipe === 'bulanan' ? 'Rincian Kertas Kerja Perbulan' : 'Kertas Kerja RKAS');

  const result: RKASMonth = {
    fileName,
    judul,
    bulan: bulanValue,
    tahun: headerInfo.tahun || '',
    tipe,
    sumberDana: headerInfo.sumberDana || '',
    namaSekolah: headerInfo.namaSekolah || '',
    npsn: headerInfo.npsn || '',
    alamat: headerInfo.alamat || '',
    kabupaten: headerInfo.kabupaten || '',
    provinsi: headerInfo.provinsi || '',
    totalPenerimaan,
    totalBelanja,
    penerimaan,
    standarList,
    allItems,
  };

  console.log(`[RKAS Parser] Parsed ${fileName}: ${allItems.length} items, tipe=${tipe}, bulan=${bulanValue}, tahun=${headerInfo.tahun}`);
  return result;
}
