import { NextResponse } from 'next/server';
import { processPDF, renderPDFPages, getPDFFiles, getBlobInfo } from '@/lib/pdf-processor';
import { applyDOMPolyfills } from '@/lib/dom-polyfill';
import { isServerless } from '@/lib/serverless';
import fs from 'fs';
import path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'upload');

export async function GET(request: Request) {
  applyDOMPolyfills();
  try {
    const { searchParams } = new URL(request.url);
    const fileName = searchParams.get('file');

    if (!fileName) {
      // List all available PDFs
      const files = await getPDFFiles();
      return NextResponse.json({ files });
    }

    if (isServerless()) {
      // Serverless: check blob storage
      const blobInfo = await getBlobInfo(fileName);
      if (!blobInfo) {
        return NextResponse.json(
          { error: 'PDF file not found', notFound: true },
          { status: 404 }
        );
      }
    } else {
      // Local: check file system
      const filePath = path.join(UPLOAD_DIR, fileName);
      if (!fs.existsSync(filePath)) {
        return NextResponse.json(
          { error: 'PDF file not found', notFound: true },
          { status: 404 }
        );
      }
    }

    const info = await processPDF(fileName);
    const pageImages = await renderPDFPages(fileName);

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
