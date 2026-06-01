import { NextResponse } from 'next/server';
import { processPDF, renderPDFPages, getPDFFiles } from '@/lib/pdf-processor';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fileName = searchParams.get('file');

    if (!fileName) {
      // List all available PDFs
      const files = getPDFFiles();
      return NextResponse.json({ files });
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
    // If file not found, return 404 instead of 500 so the client can handle gracefully
    if (error.message?.includes('not found')) {
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
