---
Task ID: 1
Agent: main
Task: Fix "Cannot find module pdf.worker.mjs" error on Vercel serverless

Work Log:
- Analyzed the error: pdfjs-dist's "fake worker" tries to dynamically import pdf.worker.mjs using a path computed from import.meta.url, but on Vercel's bundled serverless environment, the chunk doesn't exist at that path
- Previous DOMMatrix polyfill fix was working (error changed from "DOMMatrix is not defined" to "Cannot find module pdf.worker.mjs")
- Installed pdf2json (^4.0.3) as a worker-free, pure JavaScript PDF parser
- Rewrote pdf-processor.ts extraction logic:
  - Method 1: pdf2json (PRIMARY — worker-free, no DOMMatrix needed, pure JS)
  - Method 2: pdfjs-dist with position-aware extraction (fallback)
  - Method 3: pdfjs-dist simple extraction (last resort)
- Added serverExternalPackages: ['pdfjs-dist', 'pdf2json', 'canvas'] to next.config.ts
- Removed experimental.instrumentationHook (no longer needed in Next.js 16)
- Updated diagnostic and debug routes to test pdf2json and use centralized extraction
- Committed and pushed to GitHub (commit d1a29a9)

Stage Summary:
- pdf2json is now the primary PDF extraction method — completely worker-free
- serverExternalPackages prevents Next.js from bundling pdfjs-dist, which should fix the fake worker issue on Vercel production builds
- Both pdf2json and pdfjs-dist load successfully in local testing
- Vercel auto-deploy triggered from the GitHub push

---
Task ID: 2
Agent: main
Task: Fix BKU and BKU Pajak import - no data parsed after upload

Work Log:
- Analyzed pdf2json output format: all text on 1-2 very long lines with many tab-separated values
- Old parsers split by \n then by tabs, but pdf2json puts everything on 1 line → no rows detected
- Rewrote parseBKUFromText to detect pdf2json format (>20 tabs per line) and scan flat token array
- BKU Tunai: detects kodeKegiatan(5.x.x.x.x)+date or standalone date as row boundaries
- BKU Pajak: detects date+noKode as row start, scans for 7 consecutive amount tokens
- Kept pdfplumber format parsing as fallback for local mode
- Local testing confirmed: 205 BKU Tunai rows and 14 BKU Pajak rows correctly detected
- Pushed to GitHub (commit ac0fbee)

Stage Summary:
- Both BKU and BKU Pajak parsers now handle pdf2json format correctly
- Vercel auto-deploy triggered

---
Task ID: 3
Agent: main
Task: Fix pdf2json extraction quality and update BKU/BKU Pajak parsers for proper tab-separated format

Work Log:
- Diagnosed root cause: pdf2json's `w` (width) values are inflated (represent cell width, not text width), causing gap-based tab insertion to produce negative gaps and concatenate columns
- Key fix: Use x-position gap only (ignore `w` value) with strict Y grouping (LINE_TOLERANCE=0.5, down from 1.5)
- Updated extractPageTextFromPdf2Json in pdf-processor.ts:
  - Removed `w` from item tracking (was `{ str, x, y, w }`, now `{ str, x, y }`)
  - Changed gap calculation from `item.x - (lastX + lastWidth)` to `item.x - lastX` (x-gap only)
  - Reduced LINE_TOLERANCE from 1.5 to 0.5 (prevents merging adjacent table rows)
  - Reduced MIN_X_GAP_FOR_TAB from 3 to 1.0 (MIN_X_GAP_FOR_TAB → MIN_X_GAP_FOR_TAB)
  - Added handling for overlapping items (xGap <= 0: just concatenate, no separator)
- Fixed pdf2json import to handle both CJS and ESM exports: `(pdf2jsonModule as any).default || pdf2jsonModule`
- Updated parseBKUFromText in bku/route.ts:
  - Changed isPdf2Json detection from `>20 tabs per line` to `>=5 tabs with date pattern at start`
  - Replaced flat token array scanning with per-line tab-separated column parsing
  - Added proper kode kegiatan, kode rekening, split kode rekening, no bukti detection
  - Handles both patterns: with kode kegiatan and without (Saldo Bank, Tarik Tunai rows)
- Updated parseBKUPajakFromText in bku-pajak/route.ts:
  - Same detection change from `>20 tabs` to date-pattern-based
  - Per-line parsing instead of flat token scanning
  - Handles variable number of amount columns (7 or more with possible extra column)
  - Proper Jumlah/total row parsing with numeric-only filtering
- Lint check passes with no errors
- Dev server running successfully

Stage Summary:
- pdf2json now produces proper tab-separated text with each table row on its own line
- BKU and BKU Pajak parsers correctly parse the new format
- The x-gap-only approach avoids the inflated `w` value issue that was concatenating columns
- Ready for Vercel deployment
