import { NextResponse } from 'next/server';
import { processPDF, renderPDFPages, getPDFFiles } from '@/lib/pdf-processor';
import fs from 'fs';
import path from 'path';
import { isServerless, serverlessErrorResponse } from '@/lib/serverless';

const UPLOAD_DIR = path.join(process.cwd(), 'upload');

export async function GET(request: Request) {
  if (isServerless()) {
    return serverlessErrorResponse('Info PDF');
  }
  try {
    const { searchParams } = new URL(request.url);
    const fileName = searchParams.get('file');

    if (!fileName) {
      // List all available PDFs
      const files = getPDFFiles();
      return NextResponse.json({ files });
    }

    // Check file existence first before processing
    const filePath = path.join(UPLOAD_DIR, fileName);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: 'PDF file not found', notFound: true },
        { status: 404 }
      );
    }

    const info = processPDF(fileName);
    const pageImages = renderPDFPages(fileName);

    return NextResponse.json({
      fileName: info.fileName,
      pageCount: info.pageCount,
      pageImages,
      extractedText: info.extractedText,
    });
  } catch (error: any) {
    // If file not found or any related error, return 404
    const msg = (error.message || '').toLowerCase();
    if (msg.includes('not found') || msg.includes('enoent') || msg.includes('no such file')) {
      return NextResponse.json(
        { error: 'PDF file not found', notFound: true },
        { status: 404 }
      );
    }
    console.error('PDF info error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process PDF' },
      { status: 500 }
    );
  }
}
