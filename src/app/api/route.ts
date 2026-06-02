import { NextResponse } from "next/server";

export async function GET() {
  const diagnostics: Record<string, any> = {
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: {
      VERCEL: process.env.VERCEL || "not set",
      NODE_ENV: process.env.NODE_ENV || "not set",
      hasBlobToken: !!process.env.BLOB_READ_WRITE_TOKEN,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
    },
  };

  // Test pdfjs-dist import (primary extraction method)
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    diagnostics.pdfjsDist = {
      loaded: true,
      hasGetDocument: typeof pdfjs.getDocument === "function",
      version: pdfjs.version || "unknown",
    };
  } catch (e: any) {
    diagnostics.pdfjsDist = { loaded: false, error: e.message };
  }

  // Test pdf-parse import (fallback extraction method)
  try {
    const pdfParseModule = await import("pdf-parse");
    diagnostics.pdfParse = {
      loaded: true,
      hasPDFParse: typeof pdfParseModule.PDFParse === "function",
    };
  } catch (e: any) {
    diagnostics.pdfParse = { loaded: false, error: e.message };
  }

  // Test full text extraction from a blob file
  try {
    const { list, get } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: "pdfs/", limit: 1 });

    if (blobs.length > 0) {
      diagnostics.testBlob = blobs[0].pathname;

      // Try to download the blob using get() v2 API (returns stream)
      try {
        const result = await get(blobs[0].pathname, { access: "private" });
        if (!result || result.statusCode !== 200 || !result.stream) {
          diagnostics.blobDownloadError = `get() returned unexpected result: statusCode=${result?.statusCode}, hasStream=${!!result?.stream}`;
        } else {
          // Convert stream to buffer
          const chunks: Uint8Array[] = [];
          const reader = result.stream.getReader();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              chunks.push(value);
            }
          } finally {
            reader.releaseLock();
          }
          const buffer = Buffer.concat(chunks);
          diagnostics.blobDownloadSize = buffer.length;

          // Try pdfjs-dist extraction (primary method)
          try {
            const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
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
            const loadingTask = pdfjs.getDocument({ data: uint8, verbosity: 0, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true });
            const doc = await loadingTask.promise;
            diagnostics.pdfjsPageCount = doc.numPages;

            // Extract text from first page
            const page = await doc.getPage(1);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(' ');
            diagnostics.pdfjsTextPreview = pageText.substring(0, 200);
            diagnostics.pdfjsTextLength = pageText.length;
            diagnostics.pdfjsExtractionSuccess = true;

            page.cleanup();
            try { doc.destroy(); } catch {}
          } catch (pdfjsErr: any) {
            diagnostics.pdfjsExtractionError = pdfjsErr.message;
            diagnostics.pdfjsExtractionStack = pdfjsErr.stack?.substring(0, 300);

            // Fallback: try pdf-parse
            try {
              const pdfParseModule = await import("pdf-parse");
              // Set up pdfjs worker before pdf-parse uses it
              try {
                const pdfjsInner = await import("pdfjs-dist/legacy/build/pdf.mjs");
                if (!pdfjsInner.GlobalWorkerOptions.workerSrc) {
                  try {
                    const { createRequire } = await import('module');
                    const require = createRequire(import.meta.url);
                    const workerPath = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
                    pdfjsInner.GlobalWorkerOptions.workerSrc = workerPath;
                  } catch {}
                }
              } catch {}
              const PDFParse = pdfParseModule.PDFParse;
              const uint8 = new Uint8Array(buffer);
              const parser = new PDFParse({ data: uint8, verbosity: 0 });
              await parser.load();
              const textResult = await parser.getText({});
              diagnostics.pdfParsePageCount = textResult.pages?.length || 0;
              if (textResult.pages && textResult.pages.length > 0) {
                diagnostics.pdfParseTextPreview = textResult.pages[0].text?.substring(0, 200) || "(empty)";
                diagnostics.pdfParseTextLength = textResult.pages[0].text?.length || 0;
              }
              diagnostics.pdfParseExtractionSuccess = true;
              try { await parser.destroy(); } catch {}
            } catch (pdfParseErr: any) {
              diagnostics.pdfParseExtractionError = pdfParseErr.message;
            }
          }
        }
      } catch (dlErr: any) {
        diagnostics.blobDownloadError = dlErr.message;
      }
    } else {
      diagnostics.testBlob = "no blobs found";
    }
  } catch (e: any) {
    diagnostics.vercelBlob = `FAILED: ${e.message}`;
  }

  return NextResponse.json(diagnostics);
}
