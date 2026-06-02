import { NextResponse } from "next/server";
import { applyDOMPolyfills } from "@/lib/dom-polyfill";

export async function GET() {
  // Apply DOM polyfills before any pdfjs-dist imports (required for Vercel serverless)
  applyDOMPolyfills();

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

  // Test pdf2json import (primary serverless method — worker-free)
  try {
    const pdf2json = await import("pdf2json");
    diagnostics.pdf2json = {
      loaded: true,
      hasPDFParser: typeof pdf2json.default === "function",
    };
  } catch (e: any) {
    diagnostics.pdf2json = { loaded: false, error: e.message };
  }

  // Test pdfjs-dist import (secondary method)
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

  // Test full text extraction from a blob file
  try {
    const { processPDFBuffer } = await import("@/lib/pdf-processor");
    const { list, get } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: "pdfs/", limit: 1 });

    if (blobs.length > 0) {
      diagnostics.testBlob = blobs[0].pathname;

      try {
        const result = await get(blobs[0].pathname, { access: "private" });
        if (!result || result.statusCode !== 200 || !result.stream) {
          diagnostics.blobDownloadError = `get() returned unexpected result: statusCode=${result?.statusCode}, hasStream=${!!result?.stream}`;
        } else {
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

          // Use the centralized extraction function (tries pdf2json → pdfjs-dist → simple)
          try {
            const info = await processPDFBuffer(blobs[0].pathname.replace('pdfs/', ''), buffer);
            diagnostics.extractionSuccess = true;
            diagnostics.pageCount = info.pageCount;
            const fullText = info.extractedText.map(p => p.text).join('\n');
            diagnostics.textLength = fullText.length;
            diagnostics.textPreview = fullText.substring(0, 200);
          } catch (extractErr: any) {
            diagnostics.extractionError = extractErr.message;
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
