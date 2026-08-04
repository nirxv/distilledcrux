// ─────────────────────────────────────────────────────────────────────────────
// app/api/extract-question/route.ts
// Quick vision call: extract the question written at the top of an answer sheet.
// Called after images are uploaded, before the user types the question manually.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ question: '' });
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ question: '' });

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString('base64');
    const mime = (file.type?.startsWith('image/') ? file.type : 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mime, data: base64 },
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

    const raw = (response.content[0] as { type: string; text: string })?.text?.trim() ?? '';

    // Sanity check — if it looks like a full answer (>500 chars) it's probably wrong
    const question = raw.length > 0 && raw.length < 500 ? raw : '';

    return NextResponse.json({ question });
  } catch (err) {
    console.error('extract-question error:', err);
    return NextResponse.json({ question: '' }); // non-fatal, user can type manually
  }
}
