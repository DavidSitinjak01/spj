# Task 4: Redesign SPJ 5 Sub-Tabs from Upload to Generated/Printable Documents

## Summary
Completely redesigned the 5 SPJ document sub-tabs from upload slots to generated/printable documents that serve as proof of accountability from RKAS+BKU data.

## Changes Made

### State Variables
- **Removed**: spjDocs, spjDocsCompleteness, spjDocsStats, spjDocsLoading, spjDocUploading, spjUploadTarget, spjDocFileRef
- **Added**: spjDocFields (13 editable fields for document generation)

### Functions
- **Removed**: loadSPJDocs, handleSPJDocUpload, deleteSPJDoc, formatFileSize
- **Added**: handlePrintDoc (prints document content), useEffect for initializing fields from RKAS/BKU

### Imports
- Replaced `Circle` with `Printer` from lucide-react
- Removed `FolderOpen` (no longer used)

### UI Changes
1. Simplified sub-tab navigation (removed completeness badges)
2. Removed Kelengkapan SPJ card from Rekapitulasi
3. Removed Kelengkapan SPJ column from detail table
4. Added editable "Isi Data" section per document type
5. Added A4 paper-like document preview with proper formatting
6. Added "Cetak Dokumen" print button

### Document Types Implemented
1. **Surat Pesanan** - Order letter with procurement table
2. **Surat Balasan Toko** - Store reply letter
3. **BAST** - Handover document with conditions
4. **Dokumen Perencanaan** - Planning document with 4 sections
5. **Surat Hasil Pemeriksaan** - Inspection result with findings

### CSS Changes
- Added print CSS to globals.css (@media print rules)

## Files Modified
- `/home/z/my-project/src/app/page.tsx` - Main component
- `/home/z/my-project/src/app/globals.css` - Print styles
