import { NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import { processPDF } from '@/lib/pdf-processor';
import { isServerless, serverlessErrorResponse } from '@/lib/serverless';

export async function POST(request: Request) {
  if (isServerless()) {
    return serverlessErrorResponse('Chat PDF');
  }
  try {
    const { fileName, question, history } = await request.json();

    if (!fileName || !question) {
      return NextResponse.json(
        { error: 'fileName and question are required' },
        { status: 400 }
      );
    }

    // Extract text from PDF
    const info = processPDF(fileName);
    const fullText = info.extractedText
      .map(p => `--- Halaman ${p.page} ---\n${p.text}`)
      .join('\n\n');

    // Prepare conversation history
    const messages: any[] = [
      {
        role: 'assistant',
        content: `Kamu adalah asisten AI yang ahli dalam membaca dan menganalisis dokumen PDF. Kamu bisa membaca dokumen dalam bahasa Indonesia dan bahasa lainnya. Berikan jawaban yang detail dan akurat berdasarkan konten dokumen yang diberikan. Jika pertanyaan tidak bisa dijawab dari dokumen, katakan dengan jelas. Format angka dengan rapi (gunakan titik sebagai pemisah ribuan dan koma untuk desimal jika dalam format Indonesia).`
      },
      {
        role: 'user',
        content: `Berikut adalah isi dokumen PDF "${fileName}" yang memiliki ${info.pageCount} halaman:\n\n${fullText}`
      }
    ];

    // Add conversation history
    if (history && Array.isArray(history)) {
      for (const msg of history) {
        messages.push({
          role: msg.role,
          content: msg.content
        });
      }
    }

    // Add current question
    messages.push({
      role: 'user',
      content: question
    });

    const zai = await ZAI.create();
    const response = await zai.chat.completions.create({
      messages,
      stream: false,
      thinking: { type: 'disabled' },
    });

    const reply = response.choices?.[0]?.message?.content || 'Maaf, saya tidak bisa menjawab pertanyaan ini.';

    return NextResponse.json({ answer: reply });
  } catch (error: any) {
    console.error('Chat error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process chat' },
      { status: 500 }
    );
  }
}
