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
