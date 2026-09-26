export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyFirebaseToken } from '@/lib/verifyFirebaseToken';
import { getSubjectConfig, writingRules, DEFAULT_SUBJECT } from '@/lib/subjects';
import { checkRateLimit, clientIp } from '@/lib/rateLimit';
import { hasActiveSubscription, optionalForSubject } from '@/lib/entitlements';

/**
 * A model answer for one PYQ, streamed as plain text.
 *
 * The client reads this with a ReadableStream reader and appends each chunk to
 * the visible answer, so the body must be text rather than JSON. Errors are
 * still JSON, because they are read before the stream starts.
 *
 * The epistemic rules and the verified thinker roster come from the subject's
 * own config, the same text the evaluator is given, minus its marking rubric.
 * Fabricated citations are the failure that matters here: a student who writes
 * an invented quote in the exam loses marks for it.
 */

/** UPSC asks 10, 15 and 20; anything else is mapped onto the nearest band. */
function markBand(raw: unknown): 10 | 15 | 20 {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 10;
  if (n >= 18) return 20;
  if (n >= 14) return 15;
  return 10;
}

const WORDS: Record<10 | 15 | 20, number> = { 10: 200, 15: 300, 20: 400 };
const TOKENS: Record<10 | 15 | 20, number> = { 10: 2500, 15: 4000, 20: 6000 };

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.question) {
    return NextResponse.json({ error: 'Question is required' }, { status: 400 });
  }

  // Generation is the most expensive thing an authenticated user can trigger
  // here, so it is bounded per user as well as gated on a subscription.
  const token = req.headers.get('x-user-token') ?? body.token ?? '';
  if (!token) return NextResponse.json({ error: 'premium_required' }, { status: 403 });

  const user = await verifyFirebaseToken(token).catch(() => null);
  if (!user) return NextResponse.json({ error: 'premium_required' }, { status: 403 });

  const { allowed } = await checkRateLimit(`model-answer:${user.uid}`, {
    limit: 30,
    windowSeconds: 3600,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many model answers in the last hour. Try again shortly.' },
      { status: 429 });
  }

  // Scoped to the optional this question belongs to. A subscription buys one
  // optional, so an anthropology reader asking for a sociology answer is as
  // unentitled as a reader with no subscription at all.
  const db = createServerClient();
  const subject = String(body.subject ?? DEFAULT_SUBJECT);
  const premium =
    (user.email != null && user.email === process.env.OWNER_EMAIL) ||
    (await hasActiveSubscription(db, user.uid, optionalForSubject(subject, DEFAULT_SUBJECT)));
  if (!premium) return NextResponse.json({ error: 'premium_required' }, { status: 403 });

  const config = getSubjectConfig(subject);
  const marks = markBand(body.marks);
  const topic = typeof body.topic === 'string' ? body.topic.slice(0, 120) : '';

  const system = `${writingRules(config)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WRITING THE ANSWER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Write a complete UPSC ${config.label} answer in Markdown. Structure it as:

### Introduction
2-3 sentences. Open with a theoretical frame, name a ${config.thinkerTerm} from the
roster, and preview the argument. Do not restate the question.

### Body
Bullet points, each one a ${config.thinkerTerm} or concept applied to the question
rather than described in the abstract. Where the question invites debate, give
both sides before taking a position.

### Conclusion
2-3 sentences. Take a clear position and link back to the frame in the
introduction. Do not merely summarise the body.

Length: about ${WORDS[marks]} words for ${marks} marks. Output the answer only,
with no preamble, no commentary on your own writing, and no marking scheme.`;

  const prompt = `QUESTION (${marks} marks): ${body.question}${topic ? `\nTOPIC: ${topic}` : ''}

Write the model answer now:`;

  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const stream = anthropic.messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: TOKENS[marks],
      system,
      messages: [{ role: 'user', content: prompt }],
    });

    const encoder = new TextEncoder();
    const out = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
              controller.enqueue(encoder.encode(chunk.delta.text));
            }
          }
        } catch (e) {
          // The response has already begun, so the status is spent. Say so in
          // the body rather than truncating without explanation.
          console.error('[model-answer] stream failed:', e);
          controller.enqueue(encoder.encode('\n\n_Generation was interrupted. Please try again._'));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(out, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'private, no-store',
        // Nothing downstream should buffer a stream whose whole point is to
        // arrive a piece at a time.
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (e) {
    console.error('[model-answer] failed to start:', e);
    return NextResponse.json({ error: 'Could not generate an answer.' }, { status: 500 });
  }
}
