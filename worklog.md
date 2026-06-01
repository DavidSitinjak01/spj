---
Task ID: 1
Agent: Main
Task: Analyze and improve RKAS import with Bulanan/Tahunan distinction from PDF title

Work Log:
- Analyzed current RKAS API route.ts (621 lines) and Python parser
- Examined actual PDF text from both sample files
- Updated Python parser to extract judul (title) from first page
- Added tipe detection from judul keywords
- Added judul field to RKASMonth interface
- Improved table type detection for better column parsing
- Strengthened dedup keys with prefixes
- Updated frontend to display judul in both Bulanan and Tahunan cards

Stage Summary:
- RKAS API now properly detects Bulanan vs Tahunan from PDF title
- judul field added and displayed in UI
- Duplicate prevention strengthened

---
Task ID: 2
Agent: Main
Task: Add 5 SPJ Document Sub-Features (Surat Pesanan, Surat Balasan Toko, BAST, Dokumen Perencanaan, Surat Hasil Pemeriksaan)

Work Log:
- Created SPJ Documents API route at `/api/pdf/spj-docs/route.ts` with GET/POST/DELETE
- Added SPJDocType and SPJDocument interfaces to page.tsx
- Added state variables: spjDocs, spjDocsSummary, spjDocsLoading, spjDocUploading, spjSubTab, spjDocBulan, spjDocTahun, spjDocDeskripsi, spjDocFileRefs
- Added handler functions: loadSPJDocs, handleSPJDocUpload, deleteSPJDoc, formatFileSize
- Added loadSPJDocs to initial useEffect
- Added icon imports: Package, Store, FileCheck, ClipboardPaste, ShieldCheck
- Rebuilt SPJ tab with sub-tab navigation (Rekapitulasi + 5 doc types)
- Each doc type has color-coded summary card, upload section with month/year/description, document list with delete
- Duplicate prevention per type+bulan+tahun in upload API
- Verified lint passes and API endpoint returns correct data

Stage Summary:
- SPJ tab now has 6 sub-tabs: Rekapitulasi, Surat Pesanan, Surat Balasan Toko, BAST, Dok. Perencanaan, Surat Hasil Periksa
- Each document type supports upload (PDF/JPG/DOC), metadata (bulan, tahun, deskripsi), listing, and deletion
- API at /api/pdf/spj-docs working correctly with GET/POST/DELETE
- Color scheme: teal (Surat Pesanan), orange (Surat Balasan), emerald (BAST), violet (Dokumen Perencanaan), rose (Surat Hasil Pemeriksaan)
- page.tsx grew from ~2355 to ~2632 lines
