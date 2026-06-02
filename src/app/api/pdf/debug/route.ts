import { NextResponse } from 'next/server';
import { isServerless } from '@/lib/serverless';
import { processPDFBuffer, uploadToBlob, getBlobInfo, getPDFFiles, downloadFromBlobByPathname, ensureDOMPolyfills } from '@/lib/pdf-processor';

/**
 * Debug endpoint for testing PDF upload and text extraction step by step.
 * POST /api/pdf/debug with FormData containing a 'file' field.
 * Returns detailed diagnostic information about each step.
 */
export async function POST(request: Request) {
  // Apply DOM polyfills before any pdfjs-dist imports (required for Vercel serverless)
  ensureDOMPolyfills();

  const diagnostics: Record<string, any> = {
    timestamp: new Date().toISOString(),
    isServerless: isServerless(),
    environment: {
      VERCEL: process.env.VERCEL || 'not set',
      NODE_ENV: process.env.NODE_ENV || 'not set',
      hasBlobToken: !!process.env.BLOB_READ_WRITE_TOKEN,
    },
    steps: {},
  };

  try {
    // Step 1: Read the uploaded file
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded', diagnostics });
    }

    diagnostics.steps.upload = {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      status: 'ok',
    };

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Step 2: Test pdfjs-dist import
    diagnostics.steps.pdfjsImport = { status: 'pending' };
    try {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      diagnostics.steps.pdfjsImport = {
        status: 'ok',
        hasGetDocument: typeof pdfjs.getDocument === 'function',
        version: pdfjs.version || 'unknown',
      };
    } catch (err: any) {
      diagnostics.steps.pdfjsImport = {
        status: 'failed',
        error: err?.message || String(err),
      };

      // Try alternative import path
      try {
        const pdfjs = await import('pdfjs-dist/build/pdf.mjs');
        diagnostics.steps.pdfjsImportAlt = {
          status: 'ok',
          hasGetDocument: typeof pdfjs.getDocument === 'function',
        };
      } catch (altErr: any) {
        diagnostics.steps.pdfjsImportAlt = {
          status: 'failed',
          error: altErr?.message || String(altErr),
        };
      }
    }

    // Step 3: Test pdf-parse import
    diagnostics.steps.pdfParseImport = { status: 'pending' };
    try {
      const pdfParseModule = await import('pdf-parse');
      diagnostics.steps.pdfParseImport = {
        status: 'ok',
        hasPDFParse: typeof pdfParseModule.PDFParse === 'function',
        exports: Object.keys(pdfParseModule).slice(0, 10),
      };
    } catch (err: any) {
      diagnostics.steps.pdfParseImport = {
        status: 'failed',
        error: err?.message || String(err),
      };
    }

    // Step 4: Test text extraction with pdfjs-dist directly
    diagnostics.steps.extraction = { status: 'pending' };
    try {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      // Set up worker for Node.js environments
      if (!pdfjs.GlobalWorkerOptions.workerSrc) {
        try {
          const { createRequire } = await import('module');
          const require = createRequire(import.meta.url);
          const workerPath = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
          pdfjs.GlobalWorkerOptions.workerSrc = workerPath;
        } catch {
          try {
            const pathMod = await import('path');
            const fsMod = await import('fs');
            const p = pathMod.join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs');
            if (fsMod.existsSync(p)) {
              pdfjs.GlobalWorkerOptions.workerSrc = p;
            }
          } catch {}
        }
      }
      const uint8 = new Uint8Array(buffer);
      const loadingTask = pdfjs.getDocument({
        data: uint8,
        verbosity: 0,
        useWorkerFetch: false,
        isEvalSupported: false,
        useSystemFonts: true,
      });

      const doc = await loadingTask.promise;
      const pageCount = doc.numPages;
      const perPageInfo: { page: number; textLength: number; textPreview: string }[] = [];

      for (let pageNum = 1; pageNum <= Math.min(pageCount, 3); pageNum++) {
        const page = await doc.getPage(pageNum);
        const textContent = await page.getTextContent();
        const items = textContent.items.filter((item: any) => item.str !== undefined && item.str !== '');
        const simpleText = items.map((item: any) => item.str).join(' ');

        // Position-aware extraction
        const LINE_TOLERANCE = 2;
        const lines: { y: number; items: any[] }[] = [];
        for (const item of items) {
          let foundLine = false;
          for (const line of lines) {
            if (Math.abs(line.y - item.transform[5]) <= LINE_TOLERANCE) {
              line.items.push(item);
              foundLine = true;
              break;
            }
          }
          if (!foundLine) {
            lines.push({ y: (item as any).transform[5], items: [item] });
          }
        }
        lines.sort((a, b) => b.y - a.y);
        const posText = lines.map(line => {
          line.items.sort((a: any, b: any) => a.transform[4] - b.transform[4]);
          return line.items.map((item: any) => item.str).join('\t');
        }).join('\n');

        perPageInfo.push({
          page: pageNum,
          textLength: simpleText.length,
          textPreview: posText.substring(0, 300),
        });

        page.cleanup();
      }

      try { doc.destroy(); } catch {}

      diagnostics.steps.extraction = {
        status: 'ok',
        pageCount,
        pages: perPageInfo,
      };
    } catch (err: any) {
      diagnostics.steps.extraction = {
        status: 'failed',
        error: err?.message || String(err),
        stack: err?.stack?.substring(0, 500),
      };
    }

    // Step 5: Test processPDFBuffer (the function used by RKAS route)
    diagnostics.steps.processPDFBuffer = { status: 'pending' };
    try {
      const info = await processPDFBuffer(file.name, buffer);
      const fullText = info.extractedText.map(p => p.text).join('\n');
      diagnostics.steps.processPDFBuffer = {
        status: 'ok',
        pageCount: info.pageCount,
        textLength: fullText.length,
        textPreview: fullText.substring(0, 500),
        hasTabs: fullText.includes('\t'),
        perPageTextLengths: info.extractedText.map(p => ({ page: p.page, length: p.text.length })),
      };
    } catch (err: any) {
      diagnostics.steps.processPDFBuffer = {
        status: 'failed',
        error: err?.message || String(err),
        stack: err?.stack?.substring(0, 500),
      };
    }

    // Step 6: Test blob upload (if serverless)
    if (isServerless()) {
      diagnostics.steps.blobUpload = { status: 'pending' };
      try {
        const { url } = await uploadToBlob(file.name, buffer);
        diagnostics.steps.blobUpload = { status: 'ok', url: url.substring(0, 100) + '...' };
      } catch (err: any) {
        diagnostics.steps.blobUpload = {
          status: 'failed',
          error: err?.message || String(err),
        };
      }
    }

    return NextResponse.json({ diagnostics });
  } catch (err: any) {
    diagnostics.fatalError = {
      message: err?.message || String(err),
      stack: err?.stack?.substring(0, 500),
    };
    return NextResponse.json({ diagnostics }, { status: 500 });
  }
}

/**
 * GET: Quick diagnostic of the environment and blob storage.
 */
export async function GET() {
  // Apply DOM polyfills before any pdfjs-dist imports
  ensureDOMPolyfills();

  const diagnostics: Record<string, any> = {
    timestamp: new Date().toISOString(),
    isServerless: isServerless(),
    environment: {
      VERCEL: process.env.VERCEL || 'not set',
      NODE_ENV: process.env.NODE_ENV || 'not set',
      hasBlobToken: !!process.env.BLOB_READ_WRITE_TOKEN,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
    },
  };

  // Test pdfjs-dist import
  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    diagnostics.pdfjsDist = {
      loaded: true,
      hasGetDocument: typeof pdfjs.getDocument === 'function',
      version: pdfjs.version || 'unknown',
    };
  } catch (err: any) {
    diagnostics.pdfjsDist = { loaded: false, error: err?.message };
  }

  // Test pdf-parse import
  try {
    const pdfParseModule = await import('pdf-parse');
    diagnostics.pdfParse = {
      loaded: true,
      hasPDFParse: typeof pdfParseModule.PDFParse === 'function',
      exports: Object.keys(pdfParseModule).slice(0, 10),
    };
  } catch (err: any) {
    diagnostics.pdfParse = { loaded: false, error: err?.message };
  }

  // Test blob connection
  try {
    const files = await getPDFFiles();
    diagnostics.blobFiles = files.length;
    diagnostics.blobFileNames = files.slice(0, 5);
  } catch (err: any) {
    diagnostics.blobError = err?.message;
  }

  return NextResponse.json(diagnostics);
}
