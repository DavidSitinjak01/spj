# Task 2: RKAS Import API with Monthly Grouping

## Summary
Created `/home/z/my-project/src/app/api/pdf/rkas/route.ts` - a complete API route for importing and parsing RKAS (Rencana Kegiatan dan Anggaran Sekolah) PDF files with monthly grouping.

## What was done
1. **GET `/api/pdf/rkas`**: Lists all RKAS files (excluding BKU files), parses each with Python/pdfplumber, returns monthly grouped data sorted by Indonesian month order
2. **POST `/api/pdf/rkas`**: Accepts PDF upload via FormData, saves to upload directory, parses and returns structured data
3. **DELETE `/api/pdf/rkas`**: Deletes a file and its cache by fileName

## Key implementation details
- Python pdfplumber script handles both monthly format (8-10 cols with Volume/Satuan/Tarif Harga) and annual format (15 cols with Sumber Dana allocation)
- Intermediate "rekening header" rows are filtered out to prevent double-counting (e.g., "Belanja Makanan dan Minuman Rapat" subtotal rows)
- Footer lines ("Halaman X dari Y", "Kertas Kerja") are skipped to prevent polluting header fields
- File-based caching in `.pdf-cache/` with modification time checking (~9.2s first parse → ~18ms cached)
- Standar categories: 02=Standar Isi, 03=Standar Proses, 04=Standar Tenaga, 05=Standar Sarana, 06=Standar Pengelolaan, 07=Standar Pembiayaan, 08=Standar Penilaian

## Test results
- Monthly RKAS: JANUARI 2026, BOSP Reguler, 115 items, 7 standar categories, total belanja 181,663,000
- Annual RKAS: 220 items, 7 standar categories, total belanja 1,461,460,000 (matches penerimaan)
- Lint: All checks pass
- DELETE: handles nonexistent files gracefully
