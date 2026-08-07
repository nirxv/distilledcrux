import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/verifyFirebaseToken';

export const maxDuration = 60;

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_FILES = 10;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

export async function POST(req: NextRequest) {
  const token = req.headers.get('x-user-token') ?? '';
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const user = await verifyFirebaseToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const rawFiles = formData.getAll('files') as File[];
    const files = [...rawFiles].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true })
    );

    if (!files.length)
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    if (files.length > MAX_FILES)
      return NextResponse.json({ error: `Too many files (max ${MAX_FILES})` }, { status: 400 });

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE)
        return NextResponse.json({ error: 'File too large (max 20MB each)' }, { status: 400 });
      if (!ALLOWED_TYPES.includes(file.type))
        return NextResponse.json({ error: `Invalid file type: ${file.type}` }, { status: 400 });
    }

    const imageBlocks = await Promise.all(
      files.map(async (file) => {
        const b64 = Buffer.from(await file.arrayBuffer()).toString('base64');
        return {
          type: 'image_url',
          image_url: `data:${file.type || 'image/jpeg'};base64,${b64}`,
        };
      })
    );

    const prompt = `You are processing a UPSC Mains Optional answer sheet (${files.length} page(s)).

Return a JSON object with exactly two keys:
{
  "question": "<the question written at the top of page 1, max 200 chars, empty string if not found>",
  "transcript": "<full verbatim transcription of the answer body, all pages in order>"
}

QUESTION extraction rules:
- Extract ONLY the question text at the very top of page 1
- Often preceded by "Q." / "Q.No." / a number
- Stop as soon as the answer body begins
- Do NOT include any answer content
- If not found, return empty string

TRANSCRIPT rules:
- Transcribe ALL words of the answer body exactly as written — do not skip or summarise
- Skip the question text at the top — start from the first word of the answer
- Merge line-breaks within a paragraph into continuous text
- Use a blank line only when a new paragraph or section begins
- Never correct spelling — transcribe letter for letter as written
- Thinker/scholar names: transcribe exactly as written
- If uncertain (70-89% confident): add (?) after the word
- If unreadable (<70%): write [illegible]

Return ONLY the raw JSON object — no markdown, no backticks, no explanation.`;

    const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'pixtral-12b-2409',
        max_tokens: 4000,
        temperature: 0.0,
        messages: [
          {
            role: 'user',
            content: [...imageBlocks, { type: 'text', text: prompt }],
          },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Mistral read-answer failed:', res.status, err);
      return NextResponse.json({ error: 'Failed to read answer sheet.' }, { status: 500 });
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content?.trim() ?? '';
    const clean = raw.replace(/^```json\s*/i, '').replace(/```$/, '').trim();

    let parsed: { question: string; transcript: string };
    try {
      parsed = JSON.parse(clean);
    } catch {
      console.error('JSON parse failed, raw:', raw);
      return NextResponse.json({ error: 'Could not parse response.' }, { status: 500 });
    }

    return NextResponse.json({
      question:   (parsed.question   ?? '').trim(),
      transcript: (parsed.transcript ?? '').trim(),
    });
  } catch (err) {
    console.error('read-answer route error:', err);
    return NextResponse.json({ error: 'Failed to read answer sheet.' }, { status: 500 });
  }
}
