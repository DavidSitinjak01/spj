import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { processPDF, renderPDFPages } from '@/lib/pdf-processor';

const UPLOAD_DIR = path.join(process.cwd(), 'upload');

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    if (!file.name.endsWith('.pdf')) {
      return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 });
    }

    // Ensure upload directory exists
    await mkdir(UPLOAD_DIR, { recursive: true });

    // Save the file
    const filePath = path.join(UPLOAD_DIR, file.name);
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Process the PDF
    const info = processPDF(file.name);
    const pageImages = renderPDFPages(file.name);

    return NextResponse.json({
      success: true,
      fileName: info.fileName,
      pageCount: info.pageCount,
      pageImages,
      extractedText: info.extractedText,
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to upload PDF' },
      { status: 500 }
    );
  }
}
