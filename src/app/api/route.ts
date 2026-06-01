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
  }

  // Test Vercel Blob
  try {
    const { list } = await import("@vercel/blob");
    const result = await list({ prefix: "pdfs/", limit: 1 });
    diagnostics.vercelBlob = `connected, ${result.blobs.length} blob(s) found`;
  } catch (e: any) {
    diagnostics.vercelBlob = `FAILED: ${e.message}`;
  }

  return NextResponse.json(diagnostics);
}