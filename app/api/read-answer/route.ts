import { NextRequest, NextResponse } from 'next/server';
import { rejectUpload, IMAGE_TYPES } from '@/lib/uploadLimits';
import { verifyFirebaseToken } from '@/lib/verifyFirebaseToken';
import { createServerClient } from '@/lib/supabase';
import { hasActiveSubscription, optionalForSubject } from '@/lib/entitlements';

export const maxDuration = 60;

const OWNER_UID = process.env.OWNER_FIREBASE_UID ?? '';
const READ_FREE_LIMIT = 1;

async function mistral(imageBlocks: object[], prompt: string, maxTokens: number): Promise<string> {
  const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'pixtral-12b-2409',
      max_tokens: maxTokens,
      temperature: 0.0,
      messages: [{ role: 'user', content: [...imageBlocks, { type: 'text', text: prompt }] }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('Mistral call failed:', res.status, err);
    throw new Error(`Mistral ${res.status}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? '';
}

const stripHtml = (s: string) =>
  s.replace(/<\/p>/gi, '\n\n').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();

export async function POST(req: NextRequest) {
  const token = req.headers.get('x-user-token') ?? '';
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let verifiedUid: string | null = null;
  try {
    const user = await verifyFirebaseToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    verifiedUid = user.uid;
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // One parse. The body was cloned and parsed twice, once here purely to read
  // `subject`, and again below for the files.
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Malformed request body' }, { status: 400 });
  }

  // Usage gate — optional-scoped subscription check
  if (verifiedUid !== OWNER_UID) {
    const sb = createServerClient();
    const optionalForRead = optionalForSubject(formData.get('subject'));
    const isPremium = await hasActiveSubscription(sb, verifiedUid, optionalForRead);

    if (!isPremium) {
      const { data: usage } = await sb.from('usage_tracking').select('eval_count').eq('firebase_uid', verifiedUid).maybeSingle();
      if ((usage?.eval_count ?? 0) >= READ_FREE_LIMIT)
        return NextResponse.json({ error: 'limit_reached' }, { status: 403 });
    }
  }

  try {
    const rawFiles = formData.getAll('files') as File[];
    const files = [...rawFiles].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true })
    );

    // Count, types and both size ceilings. The total was never checked.
    const rejected = rejectUpload(files, IMAGE_TYPES);
    if (rejected) {
      return NextResponse.json({ error: rejected.error }, { status: rejected.status });
    }

    // Convert all images to base64 once — reused in both calls
    const imageBlocks = await Promise.all(
      files.map(async (file) => {
        const b64 = Buffer.from(await file.arrayBuffer()).toString('base64');
        return { type: 'image_url', image_url: `data:${file.type || 'image/jpeg'};base64,${b64}` };
      })
    );

    // ── Call 1: extract question from page 1 only ─────────────────────────
    const questionPrompt = `This is a UPSC answer sheet. The question is written at the very top of the page, often circled or preceded by "Q." / "Q.No." / a number.

Extract ONLY the question text. Stop immediately when the answer body begins.
Return ONLY the question — no preamble, no explanation, no answer content.
Maximum 200 characters. If not found, return empty string.`;

    // ── Call 2: transcribe answer body ────────────────────────────────────
    const transcriptPrompt = `This is a UPSC Mains answer sheet (${files.length} page(s)).

Transcribe ONLY the answer body — the student's written response. 
Do NOT include the question text at the top of page 1.

Rules:
- Transcribe ALL pages completely — do not truncate
- Merge line-breaks within a paragraph into continuous text  
- Use a blank line between paragraphs/sections
- Never correct spelling — transcribe exactly as written
- Thinker/scholar names: transcribe letter for letter
- If uncertain (70-89% confident): add (?) after the word
- If unreadable: write [illegible]

Return ONLY the transcribed answer text. No explanation, no preamble.`;

    // Run both calls in parallel — same images, different prompts
    const [questionRaw, transcriptRaw] = await Promise.all([
      mistral([imageBlocks[0]], questionPrompt, 200),   // question: page 1 only
      mistral(imageBlocks, transcriptPrompt, 8000),      // transcript: all pages
    ]);

    return NextResponse.json({
      question:   stripHtml(questionRaw),
      transcript: stripHtml(transcriptRaw),
    });

  } catch (err) {
    console.error('read-answer route error:', err);
    return NextResponse.json({ error: 'Failed to read answer sheet.' }, { status: 500 });
  }
}
