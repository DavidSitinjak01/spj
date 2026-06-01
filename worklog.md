# Worklog: Document Section Redesign

## Task: Redesign document generation section in `/home/z/my-project/src/app/page.tsx`

### Date: 2025-03-04

### Summary
Completely redesigned the document generation section in the SPJ tab. The old implementation used manual `spjDocFields` input and `spjPesananMap` to generate documents. The new design pulls all data from the database (Master BPU/BNU, Master Toko, and Data Sekolah) and auto-generates 5 document types.

### Changes Made

#### 1. State Variable Changes
- **Removed**: `spjDocFields`, `spjPesananMap`, `spjSelectedPesanan` (old manual input states)
- **Added**: `docSelectedBpuId`, `docSelectedBnuId`, `docType` (new BPU/BNU selector states)
- **Removed**: The `useEffect` that initialized `spjDocFields` from `bkuPajakMonths` (no longer needed)

#### 2. BPU/BNU Selector
- Added a BPU/BNU toggle at the top of the document section
- Added a dropdown that only shows BPU/BNU records with `noPesanan` filled in
- Added warning messages when:
  - Selected BPU/BNU has no toko assigned
  - Data Sekolah is not filled

#### 3. Five Document Previews (Matching Excel Format)
Replaced the old document templates with 5 new ones:

- **A. SURAT PESANAN (01PESAN)**: Uses BPU/BNU items with `nomorSuratPesanan`, toko info, and signed by Penyedia, Pengurus Barang, and Kepala Sekolah
- **B. DOKUMEN HASIL PEMBANDING (02BANDING)**: Comparison document between two shops (Toko 1 = main toko, Toko 2 = hargaToko2), with `nomorSuratPesanan`
- **C. DOKUMEN PERENCANAAN (03RENCANA)**: Planning document with school info, kategori from toko, and specification checklist
- **D. SURAT HASIL PEMERIKSAAN (04SHP)**: Inspection document with `nomorSuratSHP`, signed by Penerima Barang and Pengurus Barang
- **E. BAST (05BAST)**: Handover document with `nomorSuratBAST`, Pihak Pertama/Pihak Kedua, and Mengetahui section

#### 4. Indonesian Date Helpers
- Added `indonesianDays` and `indonesianMonths` lookup maps
- Added `formatTanggalIndo()` for full date with day name (e.g., "Senin, 5 Januari 2025")
- Added `formatTanggalShort()` for short date (e.g., "5 Januari 2025")

#### 5. Sub-tab Label Update
- Changed "Surat Balasan Toko" to "Dok. Perbanding" to match the new document type

#### 6. Data Flow
All document data now comes from:
- **BPU/BNU record**: items, tokoId, tglPesan, noPesanan, nomorSurat* (computed by API)
- **Toko relation**: namaToko, direktur, noHp, alamat, kategori
- **SekolahData**: namaSekolah, npsn, alamat, kepalaSekolah, nipKepala, pengurusBarang, nipPengurus, penerimaBarang, nipPenerima

### Verification
- `bun run lint` passed with no errors
- Dev server running without compilation errors
- All API endpoints (BPU, BNU, Toko, Sekolah) loading successfully
