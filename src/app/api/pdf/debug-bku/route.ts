import { NextResponse } from 'next/server';
import { isServerless } from '@/lib/serverless';
import { processPDF, getPDFFiles, getBlobInfo } from '@/lib/pdf-processor';
import { applyDOMPolyfills } from '@/lib/dom-polyfill';

/**
 * Diagnostic endpoint to test BKU parsing step by step on Vercel.
 * GET /api/pdf/debug-bku?fileName=1%20bku-output.pdf
 */
export async function GET(request: Request) {
  applyDOMPolyfills();

  const { searchParams } = new URL(request.url);
  const fileName = searchParams.get('fileName');

  if (!fileName) {
    return NextResponse.json({ error: 'fileName parameter required' });
  }

  const result: Record<string, any> = { fileName, steps: {} };

  try {
    // Step 1: Check if file exists in blob
    result.steps.blobCheck = { status: 'pending' };
    try {
      const blobInfo = await getBlobInfo(fileName);
      result.steps.blobCheck = {
        status: blobInfo ? 'found' : 'not_found',
        info: blobInfo ? { size: blobInfo.size, uploadedAt: blobInfo.uploadedAt } : null,
      };
      if (!blobInfo) {
        return NextResponse.json(result);
      }
    } catch (err: any) {
      result.steps.blobCheck = { status: 'error', error: err?.message };
      return NextResponse.json(result);
    }

    // Step 2: Download and extract text
    result.steps.textExtraction = { status: 'pending' };
    let fullText = '';
    try {
      const info = await processPDF(fileName);
      fullText = info.extractedText.map(p => p.text).join('\n');
      result.steps.textExtraction = {
        status: 'ok',
        pageCount: info.pageCount,
        textLength: fullText.length,
        hasTabs: fullText.includes('\t'),
        tabCount: (fullText.match(/\t/g) || []).length,
        lineCount: fullText.split('\n').length,
      };
    } catch (err: any) {
      result.steps.textExtraction = { status: 'error', error: err?.message, stack: err?.stack?.substring(0, 300) };
      return NextResponse.json(result);
    }

    // Step 3: Parse BKU text
    result.steps.bkuParsing = { status: 'pending' };
    try {
      const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean);
      
      // Detect format
      const isPdf2Json = lines.some(l => {
        const tabs = l.split('\t').filter(Boolean);
        if (tabs.length < 3) return false;
        const first = tabs[0]?.trim();
        return /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(first);
      });
      
      const hasTabs = fullText.includes('\t');
      const useTabParsing = isPdf2Json || (hasTabs && !lines.some(l => /^\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?\s+/.test(l) && !l.includes('\t')));

      // Find date lines
      const dateLines = lines.filter(l => /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(l.trim()));
      
      result.steps.bkuParsing = {
        status: 'ok',
        isPdf2Json,
        hasTabs,
        useTabParsing,
        totalLines: lines.length,
        dateLineCount: dateLines.length,
        dateLinesSample: dateLines.slice(0, 5).map(l => l.substring(0, 200)),
        linesWithTabs: lines.filter(l => l.includes('\t')).length,
        textPreview: fullText.substring(0, 2000),
      };
    } catch (err: any) {
      result.steps.bkuParsing = { status: 'error', error: err?.message };
    }

    return NextResponse.json(result);
  } catch (err: any) {
    result.fatalError = { message: err?.message, stack: err?.stack?.substring(0, 300) };
    return NextResponse.json(result, { status: 500 });
  }
}
