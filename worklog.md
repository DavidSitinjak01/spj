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
