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

  // Test pdfjs-dist import
  try {
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
    diagnostics.pdfjsDist = "loaded successfully";
    diagnostics.pdfjsDistGetDocument = typeof pdfjsLib.getDocument;
  } catch (e: any) {
    diagnostics.pdfjsDist = `FAILED: ${e.message}`;
    diagnostics.pdfjsDistStack = e.stack?.substring(0, 500);
  }

  // Test full text extraction from a blob file
  try {
    const { list, get } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: "pdfs/", limit: 1 });

    if (blobs.length > 0) {
      diagnostics.testBlob = blobs[0].pathname;

      // Try to download and parse the blob
      try {
        const blobData = await get(blobs[0].pathname, { access: "private" });
        const arrayBuffer = await blobData.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        diagnostics.blobDownloadSize = buffer.length;

        // Try to extract text with pdfjs-dist
        try {
          const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
          const uint8 = new Uint8Array(buffer);
          const doc = await pdfjsLib.getDocument({ data: uint8 }).promise;
          diagnostics.pdfPageCount = doc.numPages;

          const page = await doc.getPage(1);
          const textContent = await page.getTextContent();
          const text = textContent.items.map((item: any) => item.str).join(" ");
          diagnostics.pdfTextPreview = text.substring(0, 200);
          diagnostics.pdfTextLength = text.length;
        } catch (pdfErr: any) {
          diagnostics.pdfExtractionError = pdfErr.message;
          diagnostics.pdfExtractionStack = pdfErr.stack?.substring(0, 500);
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