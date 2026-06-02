import { NextResponse } from 'next/server';
import { isServerless } from '@/lib/serverless';
import { processPDFBuffer, uploadToBlob, getPDFFiles } from '@/lib/pdf-processor';
import { applyDOMPolyfills } from '@/lib/dom-polyfill';

/**
 * Debug endpoint for testing PDF upload and text extraction step by step.
 * POST /api/pdf/debug with FormData containing a 'file' field.
 * Returns detailed diagnostic information about each step.
 */
export async function POST(request: Request) {
  // Apply DOM polyfills before any pdfjs-dist imports (required for Vercel serverless)
  applyDOMPolyfills();

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

    // Step 2: Test pdf2json import (primary — worker-free)
    diagnostics.steps.pdf2jsonImport = { status: 'pending' };
    try {
      const pdf2json = await import('pdf2json');
      diagnostics.steps.pdf2jsonImport = {
        status: 'ok',
        hasPDFParser: typeof pdf2json.default === 'function',
      };
    } catch (err: any) {
      diagnostics.steps.pdf2jsonImport = {
        status: 'failed',
        error: err?.message || String(err),
      };
    }

    // Step 3: Test pdfjs-dist import (secondary)
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
    }

    // Step 4: Test processPDFBuffer (the function used by RKAS route)
    // This tries pdf2json → pdfjs-dist → pdfjs-dist simple
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

    // Step 5: Test blob upload (if serverless)
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
  applyDOMPolyfills();

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

  // Test pdf2json import
  try {
    const pdf2json = await import('pdf2json');
    diagnostics.pdf2json = {
      loaded: true,
      hasPDFParser: typeof pdf2json.default === 'function',
    };
  } catch (err: any) {
    diagnostics.pdf2json = { loaded: false, error: err?.message };
  }

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
