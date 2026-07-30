// ─────────────────────────────────────────────────────────────────────────────
// app/api/extract-question/route.ts
// Quick vision call: extract the question written at the top of an answer sheet.
// Called after images are uploaded, before the user types the question manually.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB (PDFs can be larger)

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    // Accept either a single image or the first page of a PDF (already rasterized by client)
    // We only need the FIRST image/page — the question is always at the top
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ question: '' });
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ question: '' });

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString('base64');
    const mime = file.type?.startsWith('image/') ? file.type : 'image/jpeg';

    const response = await groq.chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${mime};base64,${base64}` },
            },
            {
              type: 'text',
              text: `Look at the top of this UPSC answer sheet. Extract ONLY the question text written at the top (it may say "Q." or "Question:" before it, or just be written directly). 

Return ONLY the question text itself — no preamble, no "The question is:", no explanation. If you cannot find a question at the top, return an empty string.

Do not include any answer content, only the question.`,
            },
          ],
        },
      ],
    });

    const raw = response.choices[0]?.message?.content?.trim() ?? '';

    // Sanity check — if it looks like a full answer (>300 chars) it's probably wrong
    const question = raw.length > 0 && raw.length < 500 ? raw : '';

    return NextResponse.json({ question });
  } catch (err) {
    console.error('extract-question error:', err);
    return NextResponse.json({ question: '' }); // non-fatal, user can type manually
  }
}
