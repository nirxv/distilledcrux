import { NextRequest, NextResponse } from 'next/server';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ question: '' });
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ question: '' });

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString('base64');
    const mime = file.type?.startsWith('image/') ? file.type : 'image/jpeg';

    const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'pixtral-12b-2409',
        max_tokens: 200,
        temperature: 0.0,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: `data:${mime};base64,${base64}` },
              {
                type: 'text',
                text: `Look at this UPSC answer sheet. The question is written at the very top, often preceded by "Q." or "Q.No." or a number. It ends before the answer begins.

Extract ONLY the question text — one or two sentences at most. Stop as soon as the answer body begins (the answer usually starts with an introduction, definition, or thinker name).

Rules:
- Return ONLY the question text, nothing else
- No preamble, no "The question is:", no explanation
- Do NOT include any part of the answer
- If no question found, return empty string
- Maximum 200 characters`,
              },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      console.error('Mistral extract-question failed:', res.status, await res.text());
      return NextResponse.json({ question: '' });
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content?.trim() ?? '';
    const question = raw.length > 0 && raw.length < 500 ? raw : '';
    return NextResponse.json({ question });
  } catch (err) {
    console.error('extract-question error:', err);
    return NextResponse.json({ question: '' });
  }
}
