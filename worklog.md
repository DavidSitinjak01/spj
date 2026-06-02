---
Task ID: 1
Agent: Main
Task: Fix PDF extraction error on Vercel serverless ("Cannot find module pdf.worker.mjs")

Work Log:
- Analyzed all PDF-related source files (pdf-processor.ts, dom-polyfill.ts, serverless.ts, all API routes)
- Identified root cause: pdfjs-dist requires Web Worker which cannot be found on Vercel serverless
- Previous fix (pdf2json as primary + pdfjs-dist fallback) was in code but didn't solve the problem because:
  a) pdf2json failure was silently caught, falling through to pdfjs-dist which crashed
  b) Error messages only showed pdfjs-dist errors, hiding the real issue
- Tested pdf2json locally — works perfectly for all PDF types (RKAS, BKU, BKU Pajak)
- Rewrote pdf-processor.ts: removed ALL pdfjs-dist code (325 lines removed, 35 added)
- pdf2json is now the SOLE extraction method — no fallbacks
- Removed DOM polyfill dependencies (only needed by pdfjs-dist)
- Updated next.config.ts: removed pdfjs-dist from serverExternalPackages
- Updated diagnostic API route: removed pdfjs-dist test
- Added detailed logging for Vercel debugging
- Added 30s timeout protection for pdf2json parsing
- Verified locally: RKAS API (14 files, items parsed), BKU API (3 files, transactions parsed)
- Pushed to GitHub: commit accd279

Stage Summary:
- Core fix: pdf2json as sole extraction method (no pdfjs-dist on serverless)
- 325 lines of pdfjs-dist code removed
- Code pushed to GitHub, Vercel rebuild triggered
- BKU/BKU Pajak parsing still needs improvement (separate task)

---
Task ID: 2
Agent: Main
Task: Fix "upload berhasil tapi tidak ada data tercatat" - add database persistence + improve pdf2json extraction

Work Log:
- Analyzed full codebase: pdf-processor.ts, pdf-text-parser.ts, all API routes (bku, bku-pajak, rkas)
- Identified ROOT CAUSE #1: No database persistence for parsed PDF data
  - Prisma schema had ZERO models for BKU, BKU Pajak, RKAS data
  - On Vercel serverless: no file cache, data lost between requests
  - Every GET request re-downloads and re-parses ALL PDFs from blob storage
- Identified ROOT CAUSE #2: pdf2json tab insertion was too simplistic
  - Simple MIN_X_GAP_FOR_TAB=1.0 threshold didn't properly detect column boundaries
  - Parser detection (isPdf2Json) was too strict (required dd-mm-yyyy exact format)
- Identified ROOT CAUSE #3: isRKASFile was too broad (treated any non-BKU PDF as RKAS)
- Added 3 Prisma models: BKUMonthDB, BKUPajakMonthDB, RKASMonthDB with Json fields for transactions
- Ran db:push against Neon PostgreSQL - tables created successfully
- Updated BKU route: save to DB after parse, read from DB first in GET, delete DB records on file delete
- Updated BKU Pajak route: same DB persistence pattern
- Updated RKAS route: same DB persistence pattern + fixed isRKASFile to exclude pajak files
- Improved pdf2json extractPageTextFromPdf2Json with column detection algorithm:
  - Step 1: Group text items by Y position (LINE_TOLERANCE=0.8)
  - Step 2: Detect column positions by clustering x-positions across all lines
  - Step 3: Assign each item to nearest column, insert tabs between different columns
- Made format detection more robust: accept d/mm/yyyy, dd/m/yy etc.
- Added useTabParsing fallback for tab-separated text
- Replaced all empty catch blocks with proper console.error logging
- Added transaction count logging to all parsers
- Pushed to GitHub: commit f70eeab

Stage Summary:
- Database persistence added: parsed PDF data now survives Vercel cold starts
- Improved pdf2json extraction with column detection algorithm
- More robust format detection for tab-separated parsing
- All empty catch blocks replaced with proper error logging
- Code pushed to GitHub, Vercel rebuild triggered
