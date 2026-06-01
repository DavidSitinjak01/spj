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
      blobTokenPrefix: process.env.BLOB_READ_WRITE_TOKEN?.substring(0, 20) + "..." || "NOT SET",
    },
  };

  // Test pdf-parse import (pdf-parse v2.4.5 with PDFParse class)
  try {
    const pdfParseModule = await import("pdf-parse");
    diagnostics.pdfParse = {
      loaded: true,
      hasPDFParse: typeof pdfParseModule.PDFParse === "function",
      exports: Object.keys(pdfParseModule).filter(k => typeof pdfParseModule[k] === "function" || typeof pdfParseModule[k] === "object"),
    };
  } catch (e: any) {
    diagnostics.pdfParse = { loaded: false, error: e.message, stack: e.stack?.substring(0, 300) };
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

          // Try to extract text with pdf-parse
          try {
            const pdfParseModule = await import("pdf-parse");
            const PDFParse = pdfParseModule.PDFParse;
            const uint8 = new Uint8Array(buffer);
            const parser = new PDFParse(uint8, { verbosity: 0 });
            await parser.load();
            const textResult = await parser.getText({});
            diagnostics.pdfPageCount = textResult.pages?.length || 0;
            if (textResult.pages && textResult.pages.length > 0) {
              diagnostics.pdfTextPreview = textResult.pages[0].text?.substring(0, 200) || "(empty)";
              diagnostics.pdfTextLength = textResult.pages[0].text?.length || 0;
            }
            diagnostics.pdfExtractionSuccess = true;
          } catch (pdfErr: any) {
            diagnostics.pdfExtractionError = pdfErr.message;
            diagnostics.pdfExtractionStack = pdfErr.stack?.substring(0, 300);
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
