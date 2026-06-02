import { NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import { processPDF } from '@/lib/pdf-processor';
import { applyDOMPolyfills } from '@/lib/dom-polyfill';

export async function POST(request: Request) {
  applyDOMPolyfills();
  try {
    const { fileName } = await request.json();

    if (!fileName) {
      return NextResponse.json(
        { error: 'fileName is required' },
        { status: 400 }
      );
    }

    // Extract text from PDF (works in both modes via processPDF)
    const info = await processPDF(fileName);
    const fullText = info.extractedText
      .map(p => `--- Halaman ${p.page} ---\n${p.text}`)
      .join('\n\n');

    const zai = await ZAI.create();
    const response = await zai.chat.completions.create({
      messages: [
        {
          role: 'assistant',
          content: `Kamu adalah asisten AI yang ahli dalam menganalisis dokumen. Berikan ringkasan dalam format JSON.`
        },
        {
          role: 'user',
          content: `Analisis dokumen berikut dan berikan ringkasan dalam format JSON dengan struktur berikut:
{
  "title": "Judul dokumen",
  "type": "Jenis dokumen",
  "summary": "Ringkasan singkat 2-3 kalimat",
  "keyPoints": ["Poin penting 1", "Poin penting 2", ...],
  "totalAmount": "Jumlah total anggaran jika ada",
  "entity": "Nama entitas/organisasi",
  "period": "Periode/tahun anggaran jika ada"
}

Dokumen:
${fullText}

Berikan HANYA JSON tanpa markdown code block.`
        }
      ],
      stream: false,
      thinking: { type: 'disabled' },
    });

    const reply = response.choices?.[0]?.message?.content || '{}';
    
    let summary;
    try {
      // Try to parse JSON, handle possible markdown code blocks
      const jsonStr = reply.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      summary = JSON.parse(jsonStr);
    } catch {
      summary = {
        title: fileName,
        type: 'Dokumen',
        summary: reply,
        keyPoints: [],
        totalAmount: '',
        entity: '',
        period: ''
      };
    }

    return NextResponse.json({ summary });
  } catch (error: any) {
    console.error('Summarize error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to summarize PDF' },
      { status: 500 }
    );
  }
}
