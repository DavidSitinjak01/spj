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

---
Task ID: 3
Agent: Main
Task: Redesign SPJ — Documents linked to spending items from RKAS+BKU matching (pertanggungjawaban per pos belanja)

Work Log:
- Updated SPJ Docs API: added itemKey, kodeRekening, kodeProgram, uraian fields to SPJDocument
- API now returns completenessMap (itemKey → {docType: doc|null}) and stats (totalItems, completeItems, incompleteItems)
- Duplicate prevention changed: one doc per type per item (not per month)
- Updated SPJDocument interface in page.tsx with new fields
- Replaced spjDocsSummary with spjDocsCompleteness and spjDocsStats state
- Added spjUploadTarget state to track which item+type user is uploading for
- Added compositeKey and normalizeKode helpers for matching items to docs
- Updated handleSPJDocUpload to include itemKey, kodeRekening, kodeProgram, uraian
- Rebuilt Rekapitulasi sub-tab: added "Kelengkapan SPJ" summary card with progress bar + per-type counts; added "Kelengkapan SPJ" column to detail table with 5 clickable icon indicators
- Rebuilt each doc type sub-tab: shows spending items from RKAS+BKU matching, grouped by standar; each item shows upload/replace/delete actions; completeness tracking per item
- Sub-tab badges show "X/Y" (items with doc / total items)
- Fixed runtime error: replaced stale spjDocsSummary reference with spjDocsCompleteness
- Verified lint passes and page loads without errors

Stage Summary:
- SPJ now properly tracks 5 accountability documents PER SPENDING ITEM (from RKAS+BKU matching)
- Rekapitulasi view has Kelengkapan SPJ column with 5 clickable icons per row
- Each doc type sub-tab shows per-item view with upload/replace/delete per spending item
- Completeness tracked via completenessMap from API
- page.tsx: ~2868 lines
