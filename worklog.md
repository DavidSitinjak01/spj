---
Task ID: 1
Agent: Main Agent
Task: Fix "Failed to parse RKAS" error on Vercel serverless

Work Log:
- Investigated root cause: pdf-parse v2.4.5 extracts text in a completely different format from pdfplumber
- pdf-parse produces tab-separated columns in visual order (left-to-right), not logical table order
- Header fields (Nama Sekolah, Alamat, etc.) are split across multiple lines in pdf-parse output
- Belanja rows have tabs separating columns but in different order than pdfplumber
- "Total Penerimaan" appears AFTER "B. BELANJA" in pdf-parse output
- Penerimaan kode regex didn't match deep nesting like "4.3.1.01."

Fixes applied:
1. Rewrote parseRKASFromText in both route.ts and pdf-text-parser.ts to handle pdf-parse format
2. Added tab-aware parsing with hasTabs detection
3. Added multi-line header extraction with field-order mapping (handles both bulanan and tahunan formats)
4. Added "B. BELANJA" detection for belanja section start
5. Added isTahunanTable detection from subsequent header lines (BOSP REGULER, SILPA, etc.)
6. Fixed penerimaan regex: changed (?:\.\d+)? to (?:\.\d+)* to match "4.3.1.01"
7. Added "Total Penerimaan" search after "B. BELANJA" (pdf-parse order issue)
8. Added bulanan tab-separated format parsing with kode prog suffix/prefix handling
9. Added tahunan tab-separated format parsing with budget number extraction
10. Added better error logging in parseRKASFile

Test results (local with pdf-parse):
- Bulanan RKAS: 74 items parsed, all headers correct, total belanja = 185,010,000
- Tahunan RKAS: 219 items parsed, all headers correct, total belanja = 1,345,510,009

Stage Summary:
- Root cause: pdf-parse text format is completely different from pdfplumber (tab-separated, different column order, multi-line headers)
- Fixed by making parseRKASFromText format-aware (pdf-parse vs pdfplumber detection via tab presence)
- Both Bulanan and Tahunan RKAS formats now parse correctly with pdf-parse extracted text
- Lint passes, dev server running correctly

---
Task ID: 1
Agent: Main Agent
Task: Fix "Failed to parse RKAS" error on Vercel deployment

Work Log:
- Investigated the root cause: pdf-parse v2.4.5 uses pdfjs-dist internally but fails on Vercel serverless
- Rewrote PDF text extraction in pdf-processor.ts to use pdfjs-dist directly (primary) with pdf-parse as fallback
- Added position-aware text extraction that groups text items by Y position and inserts tabs for significant X gaps
- Updated parseRKASFromText in both pdf-text-parser.ts and rkas/route.ts to handle pdfjs-dist output format
- Fixed tahunan parser: added pdfjsMatch regex to detect "noUrut kodeRekening kodeProgram" format
- Fixed bulanan parser: added isPdfjsDistFormat detection and new parsing branch
- Fixed firstPartExtra regex bug that incorrectly matched when pdfjsMatch already captured kodeRekening
- Fixed simpleUJ/uraianJumlahMatch priority - now tries simpleUJ first to extract correct jumlah
- Updated diagnostic /api endpoint to test both pdfjs-dist and pdf-parse extraction
- Improved error messages in RKAS POST route
- Fixed lint errors (require imports → dynamic imports)
- Tested locally: Tahunan extracts 220 items with correct jumlah, Bulanan extracts 86 items
- Pushed to GitHub for Vercel deployment

Stage Summary:
- PDF text extraction now uses pdfjs-dist directly, which is more reliable on Vercel serverless
- Parser handles both pdf-parse and pdfjs-dist output formats
- Code pushed to GitHub, user should test at https://spj-five.vercel.app/
- User can debug extraction issues via the /api diagnostic endpoint
