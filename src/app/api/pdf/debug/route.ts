import { NextResponse } from 'next/server';
import { isServerless } from '@/lib/serverless';
import { processPDFBuffer, processPDF, uploadToBlob, getPDFFiles } from '@/lib/pdf-processor';
import { applyDOMPolyfills } from '@/lib/dom-polyfill';

/**
 * Debug endpoint for testing PDF upload and text extraction step by step.
 * POST /api/pdf/debug with FormData containing a 'file' field.
 * Returns detailed diagnostic information about each step.
 * 
 * GET /api/pdf/debug?fileName=xxx.pdf - Extract text from a blob file
 * GET /api/pdf/debug - Quick environment check
 */
export async function POST(request: Request) {
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

    // Step 2: Test pdf2json import
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

    // Step 3: Test processPDFBuffer
    diagnostics.steps.processPDFBuffer = { status: 'pending' };
    try {
      const info = await processPDFBuffer(file.name, buffer);
      const fullText = info.extractedText.map(p => p.text).join('\n');
      diagnostics.steps.processPDFBuffer = {
        status: 'ok',
        pageCount: info.pageCount,
        textLength: fullText.length,
        textPreview: fullText.substring(0, 2000),
        hasTabs: fullText.includes('\t'),
        tabCount: (fullText.match(/\t/g) || []).length,
        lineCount: fullText.split('\n').length,
        perPageTextLengths: info.extractedText.map(p => ({ page: p.page, length: p.text.length })),
      };
    } catch (err: any) {
      diagnostics.steps.processPDFBuffer = {
        status: 'failed',
        error: err?.message || String(err),
        stack: err?.stack?.substring(0, 500),
      };
    }

    // Step 4: Test blob upload (if serverless)
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
 * If ?fileName=xxx.pdf is provided, extract and return the text from that blob file.
 */
export async function GET(request: Request) {
  applyDOMPolyfills();

  const { searchParams } = new URL(request.url);
  const fileName = searchParams.get('fileName');

  // If fileName is provided, extract text from that blob file
  if (fileName) {
    try {
      const info = await processPDF(fileName);
      const fullText = info.extractedText.map(p => p.text).join('\n');
      
      // Also show some analysis
      const lines = fullText.split('\n');
      const hasTabs = fullText.includes('\t');
      const tabLines = lines.filter(l => l.includes('\t'));
      
      // Find lines that look like data rows
      const dateLines = lines.filter(l => /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(l.trim()));
      const bpuLines = lines.filter(l => /BPU\d+|BNU\d+|BBU\d+/i.test(l));
      
      return NextResponse.json({
        fileName,
        pageCount: info.pageCount,
        textLength: fullText.length,
        hasTabs,
        tabCount: (fullText.match(/\t/g) || []).length,
        lineCount: lines.length,
        tabLineCount: tabLines.length,
        dateLineCount: dateLines.length,
        bpuLineCount: bpuLines.length,
        textPreview: fullText.substring(0, 3000),
        // Show first 30 lines with tab info
        linesPreview: lines.slice(0, 30).map((l, i) => ({
          line: i + 1,
          tabCount: (l.match(/\t/g) || []).length,
          text: l.substring(0, 200),
        })),
        // Show date-matching lines
        dateLinesSample: dateLines.slice(0, 5).map(l => l.substring(0, 200)),
        // Show BPU-matching lines
        bpuLinesSample: bpuLines.slice(0, 5).map(l => l.substring(0, 200)),
      });
    } catch (err: any) {
      return NextResponse.json({
        error: `Failed to extract text from ${fileName}`,
        message: err?.message || String(err),
      }, { status: 500 });
    }
  }

  // Default: environment check
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

  // Test blob connection
  try {
    const files = await getPDFFiles();
    diagnostics.blobFiles = files.length;
    diagnostics.blobFileNames = files;
  } catch (err: any) {
    diagnostics.blobError = err?.message;
  }

  return NextResponse.json(diagnostics);
}
