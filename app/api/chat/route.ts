import { NextRequest, NextResponse } from 'next/server';
import { isPdfBase64TooLarge } from '@/lib/uploadLimits';
import { checkRateLimit, rateLimitHeaders, clientIp } from '@/lib/rateLimit';
import { verifyFirebaseToken } from '@/lib/verifyFirebaseToken';
import { resolveUsageIdentity, readUsage, recordUsage } from '@/lib/usageIdentity';
import { createServerClient } from '@/lib/supabase';
import { hasActiveSubscription, optionalForSubject } from '@/lib/entitlements';
import { searchBook, searchDiverse } from '@/lib/vectorStore';
import { createSentenceGate } from '@/lib/citationGate';
import { suggestNext } from '@/lib/chatNext';
import { MAINS_ANSWER_STYLE, mentorSystem } from '@/lib/prompts';
import type { SubjectKey } from '@/lib/subjectConfig';
import {
  SUBJECT_THINKER_BOOKS,
  SUBJECT_BROAD_ONLY,
  SUBJECT_DISPLAY,
  SUBJECT_THINKER_PAIRS,
} from '@/lib/subjectConfig';

// Book search, a 45-second model call and the follow-up suggestion run in
// one response.
export const maxDuration = 90;

// ── Rate limit (per IP, 20 msgs / 10 min) ────────────────────
const RATE_LIMIT = 20;
const RATE_WINDOW_SECONDS = 10 * 60;
// Also read by /api/chat/usage, which tells the page how many are left.
const CHAT_FREE_LIMIT = 3;

// ── Voyage AI embed (voyage-4-lite, 1024 dims) ───────────────
async function localEmbedBatch(texts: string[]): Promise<number[][]> {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'voyage-4-lite',
      input: texts,
      input_type: 'query',
    }),
  });
  const data = await res.json();
  if (!data.data) throw new Error('Voyage embed failed: ' + JSON.stringify(data));
  return data.data.map((d: { embedding: number[] }) => d.embedding);
}

// ── RAG: fetch book context from Qdrant ──────────────────────
// Returns empty string gracefully if:
//   a) embed service or Qdrant is down
//   b) no books embedded yet for this subject
//   c) similarity too low (books don't cover this topic)
async function getBookContext(
  query: string,
  subject: SubjectKey,
  bookTitle?: string,
): Promise<string> {
  try {
    const filter = bookTitle && bookTitle !== 'all' ? bookTitle : null;

    const [embedding] = await localEmbedBatch([query]);

    // All books: each book's top 3 for this subject. One book: its top 12.
    const allChunks = filter
      ? await searchBook(embedding, filter, { limit: 12 })
      : await searchDiverse(embedding, subject, { perBook: 3 });

    if (allChunks.length === 0) return '';

    const filtered = allChunks.filter((c) => (c.similarity ?? 1) > 0.45);
    const topChunks = (filtered.length >= 3 ? filtered : allChunks).slice(0, 6);

    // Max 2 chunks per book
    const finalChunks: typeof topChunks = [];
    const bookCount: Record<string, number> = {};
    const overflow: typeof topChunks = [];
    for (const chunk of topChunks) {
      const count = bookCount[chunk.book_title] ?? 0;
      if (count < 2) {
        finalChunks.push(chunk);
        bookCount[chunk.book_title] = count + 1;
      } else {
        overflow.push(chunk);
      }
      if (finalChunks.length >= 6) break;
    }
    for (const chunk of overflow) {
      if (finalChunks.length >= 6) break;
      finalChunks.push(chunk);
    }

    return finalChunks
      .map((c, i) => `[Source ${i + 1} — ${c.book_title} | Author: ${c.author}]\n${c.content}`)
      .join('\n\n---\n\n');
  } catch (e) {
    console.error(`RAG skipped for subject=${subject}:`, e);
    return '';
  }
}

// ── Build system prompt ───────────────────────────────────────
type Style = 'concise' | 'elaborative' | 'mains';

function buildSystemPrompt(opts: {
  subject: SubjectKey;
  subjectDisplay: string;
  ragContext: string;
  bookTitle?: string;
  style: Style;
  brainstorm: boolean;
  mentor: boolean;
  lang: 'en' | 'hi';
  pdfMode: boolean;
}): string {
  const { subject, subjectDisplay, ragContext, bookTitle, style, brainstorm, mentor, lang, pdfMode } = opts;

  const whitelistedSurnames = Object.keys(SUBJECT_THINKER_BOOKS[subject] ?? {});
  const broadOnly = SUBJECT_BROAD_ONLY[subject] ?? [];
  const thinkerPairs = SUBJECT_THINKER_PAIRS[subject] ?? '';

  const SCOPE_GUARD = `SCOPE GUARD (apply before anything else): You only help with UPSC ${subjectDisplay} Optional preparation — ${subjectDisplay} theory, thinkers, Indian context, exam strategy, answer writing per the UPSC syllabus. If the user's message is unrelated to this scope (general coding, other subjects, casual chit-chat, entertainment, sports, unrelated current affairs), do NOT attempt it. Politely and briefly explain that you are a UPSC ${subjectDisplay} Optional assistant and ask them to ask a relevant question. Do not partially answer off-topic requests.`;

  const styleRule = style === 'mains'
    ? MAINS_ANSWER_STYLE
    : style === 'elaborative'
    ? `RESPONSE STYLE — ELABORATIVE: Flowing prose paragraphs (3-5 sentences each). Cover sub-arguments and theoretical debates in depth. Bold titles to separate sections.`
    : `RESPONSE STYLE — CONCISE (STRICTLY MANDATORY):
- Bullet points for all arguments/features/causes/consequences.
- Format: **Bold label** — 1 crisp line (max 2 lines). No paragraph after bullet.
- Intro: 1-2 lines max. Conclusion: 1-2 lines max.
- Total response: short and tight. No walls of text.`;

  // The mentor keeps its own sections and Brainstorm its own plan; both still
  // answer to the integrity rules and cite the passages below.
  const head = mentor
    ? `${mentorSystem(subject)}\n\n${SCOPE_GUARD}`
    : brainstorm
    ? `You are an expert UPSC CSE Mains ${subjectDisplay} Optional strategist.\n\n${SCOPE_GUARD}\n\nIf given a TOPIC: Generate:\n**Key Arguments & Dimensions**\n- 6-8 distinct analytical angles with 2-3 sentence explanation each\n**Important Thinkers & Their Stands**\n- 5-6 thinkers with their specific thesis on this topic\n**Connecting Themes**\n- Links to other syllabus topics, contemporary relevance\n\nIf given a QUESTION: Generate:\n**Decoding the Question**\n- What is being asked, keywords, approach (descriptive/argumentative)\n**Must-Include Points**\n- Key facts, concepts, thinkers that cannot be missed\n**Theoretical Ammunition**\n- Specific thinkers + their arguments relevant to this question\n\nUse **bold** for key terms. Be crisp and scannable — this is a planning tool.`
    : `You are an expert UPSC ${subjectDisplay} Optional tutor with deep knowledge of ${subjectDisplay} theory, thinkers, Indian context, and the UPSC Mains exam pattern.

${SCOPE_GUARD}

Always use UPSC format: Introduction, Body (with subheadings), Conclusion.

WRITING RULES:
- NEVER write a thinker name as a bare bullet. Always: "**Durkheim** argues that..." within the bullet.
- NEVER add a separate "Key Thinkers Cited" list. Weave references into the body.
- Use **bold** for key terms, thinker names, pivotal concepts — within sentences only.
- Do NOT use ### headings — use **bold** for section titles only.
- Include specific concepts, debates, and real-world examples.
- Use plain English spellings — no diacritical marks.

${styleRule}`;

  const basePrompt = `${head}
${pdfMode ? '\n\nIMPORTANT: The user has uploaded a PDF. Analyze it carefully. Provide full UPSC-format answers for questions in it.' : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EPISTEMIC INTEGRITY — HIGHEST PRIORITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CRITICAL RULE ON IRRELEVANT SOURCES: If provided book passages are clearly about a different topic, explicitly state: "The selected book does not cover this topic directly." Then answer from general knowledge — WITHOUT inventing quotes, statistics, or citations.

CLASSIFY EVERY CLAIM BEFORE WRITING (internal only: never write "Tier", "CERTAIN", "PROBABLE" or any other confidence label in the answer):
- TIER 1 CERTAIN: Standard textbook facts → write normally.
- TIER 2 PROBABLE: Fairly confident but not 100% → hedge explicitly.
- TIER 3 UNCERTAIN: Reconstructing or guessing → DO NOT WRITE.

RED FLAG CHECKLIST (stop if any apply):
☐ A direct quote attributed to a thinker
☐ A book title you are not 100% certain exists
☐ A specific statistic or percentage
☐ A secondary person's name or institutional name in a specific context

THINKER CITATION RULES:
You may cite a thinker ONLY when ALL THREE hold:
(a) You are certain this thinker wrote about this topic
(b) You are citing their KNOWN argument, not inventing one
(c) You are NOT putting specific words in their mouth

NEVER PERMITTED: Any sentence of the form "[Thinker] writes: [quote you invented]"
NEVER PERMITTED: "[Thinker] argues that [specific claim you are not certain they made]"

${thinkerPairs}

WHITELISTED THINKER SURNAMES (safe to mention broadly): ${whitelistedSurnames.join(', ')}
BROAD-ONLY THINKERS (mention only, no specific claims): ${broadOnly.join(', ')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RAG CITATION RULE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${ragContext
  ? `CRITICAL OUTPUT RULE: After EVERY sentence where you draw on a book passage below, append the citation in square brackets before the full stop, e.g. "...the division of labour [Source #1]." For two passages write [Source #1, #3]. Never make a source part of the sentence ("Source #2 argues", "according to Source #2"): the brackets render as a small citation chip, so the sentence must read complete without them. If a claim has no supporting passage, write it with no marker at all. This is non-negotiable.

${bookTitle && bookTitle !== 'all'
    ? `BOOK PASSAGES from "${bookTitle}" — prioritise answering from these passages. Ground the answer specifically in what this book covers:\n\n${ragContext}`
    : `RELEVANT BOOK PASSAGES (multiple books — cite each as [Source #N]):\n\n${ragContext}`
  }`
  : '(No book passages available for this query — answer from your knowledge following all epistemic rules above.)'
}`;

  const langSuffix = lang === 'hi'
    ? '\n\nCRITICAL INSTRUCTION: You MUST respond ENTIRELY in Hindi (Devanagari script). Every single word in Hindi. Transliterate technical terms. Thinker names and concepts use Hindi equivalents. The one exception is citation markers: write them exactly as [Source #1] or [Source #1, #3], in English with Western digits, never translated, so they can be linked to their passages.'
    : '\n\nCRITICAL INSTRUCTION: You MUST respond ENTIRELY in English.';

  return basePrompt + langSuffix;
}

type RagSource = { book_title: string; author: string; content: string };

/** The passages as the page lists them, read back out of the prompt block. */
function parseSources(ragContext: string): RagSource[] {
  return ragContext
    .split('\n\n---\n\n')
    .map((block) => {
      const match = block.match(/^\[Source \d+ — (.+?) \| Author: (.+?)\]\n([\s\S]+)$/);
      return match ? { book_title: match[1], author: match[2], content: match[3] } : null;
    })
    .filter(Boolean) as RagSource[];
}

// ── Main POST handler ─────────────────────────────────────────
export async function POST(req: NextRequest) {
  // Rate limit, shared across instances rather than per-lambda.
  const rl = await checkRateLimit(`chat:${clientIp(req)}`, {
    windowSeconds: RATE_WINDOW_SECONDS,
    limit: RATE_LIMIT,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'too_many_requests' },
      { status: 429, headers: rateLimitHeaders(rl, RATE_LIMIT) },
    );
  }

  const supabase = createServerClient();

  const token = req.headers.get('x-user-token') ?? '';

  // One parse. The body used to be cloned and read a second time just to get
  // `subject` before the auth check.
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request body' }, { status: 400 });
  }

  const optionalForAuth = optionalForSubject(body.subject);

  const user = token ? await verifyFirebaseToken(token) : null;

  const isPremium = user
    ? await hasActiveSubscription(supabase, user.uid, optionalForAuth)
    : false;

  // Free chats need an account, as on history-optional. The page asks a
  // signed-out reader to sign in before it sends anything, so this only turns
  // away callers that skip the page.
  if (!isPremium && !user) {
    return NextResponse.json({ error: 'login_required' }, { status: 401 });
  }

  // Server-derived. The client's x-fingerprint header is no longer trusted: it
  // was the whole free tier, and the client picked its own value.
  const identity = resolveUsageIdentity(req, user?.uid ?? null);

  if (!isPremium) {
    const used = await readUsage(identity, 'chat_count');
    if (used >= CHAT_FREE_LIMIT) {
      return NextResponse.json({ error: 'limit_reached' }, { status: 403 });
    }
  }

  try {
    const {
      messages,
      subject,
      bookMode,
      bookTitle,
      pdf_base64,
      pdf_name,
      lang = 'en',
      responseStyle = 'concise',
      brainstormMode = false,
      mentorMode = false,
      format,
      stages,
    } = body as Record<string, any>;

    // A PDF is a premium feature, and one sent anyway cannot simply be
    // dropped: the answer would be about a document the model never saw.
    if (pdf_base64 && !isPremium) {
      return NextResponse.json({ error: 'premium_required' }, { status: 403 });
    }
    // The other premium modes fall back to plain chat, rather than taking the
    // client's word for a subscription.
    const mentor = Boolean(mentorMode) && isPremium;
    const brainstorm = Boolean(brainstormMode) && isPremium && !mentor;
    const books = Boolean(bookMode) && isPremium;

    // Validate subject
    const validSubjects: SubjectKey[] = ['sociology', 'anthropology', 'polsci', 'geography', 'pub-admin'];
    const subjectKey: SubjectKey = validSubjects.includes(subject) ? subject : 'sociology';
    const subjectDisplay = SUBJECT_DISPLAY[subjectKey];

    // One message can ask for a Mains answer whatever the chosen style is:
    // "Turn this into a Mains answer" does. The mentor has its own format.
    const style: Style = format === 'mains' && !mentor
      ? 'mains'
      : responseStyle === 'elaborative' ? 'elaborative' : 'concise';
    const maxTokens = mentor || style === 'elaborative' ? 3500 : style === 'mains' ? 2500 : 2000;

    const lastMsg = messages?.[messages.length - 1]?.content ?? '';
    if (typeof lastMsg === 'string' && lastMsg.length > 10000)
      return NextResponse.json({ error: 'Message too long' }, { status: 400 });
    if (!Array.isArray(messages) || messages.length > 50)
      return NextResponse.json({ error: 'Too many messages in context' }, { status: 400 });
    // The PDF arrives as base64 in the JSON body and is resent with every
    // message, so it is bounded here as well as in the browser.
    if (isPdfBase64TooLarge(pdf_base64))
      return NextResponse.json({ error: 'PDF too large (max 20MB)' }, { status: 413 });

    const lastQ = typeof lastMsg === 'string' ? lastMsg : '';
    const chosenBook = books && bookTitle && bookTitle !== 'all' ? String(bookTitle) : undefined;

    // ── RAG ─────────────────────────────────────────────────
    // Run inside the stream, not before it. The search takes seconds, and
    // while it ran ahead of the response the page could only show a spinner;
    // now the reader is told it is searching and what it found.
    const retrieve = async (): Promise<{ ragContext: string; ragSources: RagSource[] }> => {
      try {
        const ragContext = await Promise.race([
          getBookContext(lastQ, subjectKey, chosenBook),
          new Promise<string>((_, reject) => setTimeout(() => reject(new Error('RAG timeout')), 10000)),
        ]);
        return { ragContext, ragSources: parseSources(ragContext) };
      } catch (e) {
        console.error('RAG skipped:', e);
        return { ragContext: '', ragSources: [] };
      }
    };

    // ── Streaming ────────────────────────────────────────────
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (chunk: string) => controller.enqueue(encoder.encode(chunk));
        // Sentences are released as soon as they are complete and audited,
        // rather than the whole answer being held back for a post-pass. See
        // lib/citationGate.ts for why the buffer existed and why it no longer
        // has to.
        const gate = createSentenceGate(send, subjectKey);
        // The raw answer is kept as well, for writing the follow-up suggestion.
        let answerText = '';
        const collect = (chunk: string) => { answerText += chunk; gate.push(chunk); };
        // Progress lines for the page's checklist, ahead of any answer text.
        // Only for a client that asked: one still running the old script
        // would print them into the answer.
        const stage = (event: Record<string, unknown>) => {
          if (stages) send('__STAGE__' + JSON.stringify(event) + '\n');
        };
        let ragSources: RagSource[] = [];

        try {
          let ragContext = '';
          if (!pdf_base64 && lastQ.length > 3) {
            stage({ id: 'search', book: chosenBook ?? null });
            ({ ragContext, ragSources } = await retrieve());
            stage({ id: 'found', passages: ragSources.length, books: [...new Set(ragSources.map((r) => r.book_title))] });
          } else if (pdf_base64) {
            stage({ id: 'pdf', name: pdf_name ?? null });
          }
          stage({ id: 'write' });

          const systemPrompt = buildSystemPrompt({
            subject: subjectKey,
            subjectDisplay,
            ragContext,
            bookTitle: chosenBook,
            style,
            brainstorm,
            mentor,
            lang,
            pdfMode: !!pdf_base64,
          });

          if (pdf_base64) {
            // PDF mode → Haiku (supports document input)
            const Anthropic = (await import('@anthropic-ai/sdk')).default;
            const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
            const msgsCopy = messages.map((m: { role: string; content: string }) => ({ role: m.role, content: m.content as any })) as any[];
            const firstUserIdx = msgsCopy.findIndex((m: { role: string }) => m.role === 'user');
            if (firstUserIdx !== -1) {
              msgsCopy[firstUserIdx] = {
                role: 'user',
                content: [
                  { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdf_base64 }, title: pdf_name ?? 'Uploaded PDF', cache_control: { type: 'ephemeral' } },
                  { type: 'text', text: typeof messages[firstUserIdx].content === 'string' ? messages[firstUserIdx].content : 'Please analyse this PDF.' },
                ],
              };
            }
            const anthropicStream = anthropic.messages.stream({
              model: 'claude-haiku-4-5-20251001',
              max_tokens: maxTokens,
              system: systemPrompt,
              messages: msgsCopy,
            });
            for await (const chunk of anthropicStream) {
              if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
                collect(chunk.delta.text);
              }
            }
          } else if (lang === 'hi') {
            // Hindi mode → Haiku
            const Anthropic = (await import('@anthropic-ai/sdk')).default;
            const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
            const builtMessages = messages.map((m: { role: string; content: string }, i: number) => {
              if (i === messages.length - 1 && m.role === 'user') {
                return { role: m.role, content: m.content + '\n\n[IMPORTANT: Respond entirely in Hindi (Devanagari script), keeping citation markers as [Source #N]]' };
              }
              return { role: m.role, content: m.content };
            });
            const anthropicStream = anthropic.messages.stream({
              model: 'claude-haiku-4-5-20251001',
              max_tokens: maxTokens,
              system: systemPrompt,
              messages: builtMessages as any,
            });
            for await (const chunk of anthropicStream) {
              if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
                collect(chunk.delta.text);
              }
            }
          } else {
            // Normal chat → GPT-OSS-120B on Groq
            const dsRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
              },
              signal: AbortSignal.timeout(45000),
              body: JSON.stringify({
                model: 'openai/gpt-oss-120b',
                max_tokens: maxTokens,
                stream: true,
                messages: [
                  { role: 'system', content: systemPrompt },
                  ...messages.map((m: { role: string; content: string }) => ({ role: m.role, content: m.content })),
                ],
              }),
            });
            if (!dsRes.ok || !dsRes.body) throw new Error(`Groq API error: ${dsRes.status}`);
            const reader = dsRes.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() ?? '';
              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed === 'data: [DONE]') continue;
                if (trimmed.startsWith('data: ')) {
                  try {
                    const json = JSON.parse(trimmed.slice(6));
                    const delta = json.choices?.[0]?.delta?.content;
                    if (delta) collect(delta);
                  } catch { /* ignore malformed SSE */ }
                }
              }
            }
          }

          gate.flush();
          const answered = gate.emitted() > 0;
          if (!answered) send('Something went wrong. Please try again.');
          else if (stages) {
            // Before the sources, whose JSON runs to the end of the stream.
            // Only for a client that asked for stages; older ones would print it.
            const next = await suggestNext(lastQ, answerText, lang === 'hi' ? 'hi' : 'en', subjectKey);
            if (next) send('\n__NEXT__' + JSON.stringify(next));
          }

          send('\n__SOURCES__' + JSON.stringify(ragSources));

          // Count the call once an answer actually went out. Anonymous callers
          // no longer reach this point; they are asked to sign in above.
          if (answered && !isPremium) {
            try {
              await recordUsage(identity, 'chat_count');
            } catch (incErr) {
              console.error('chat_count increment failed', incErr);
            }
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error('Chat stream error:', errMsg);
          let userMsg = 'Something went wrong. Please try again.';
          if (errMsg.includes('503') || errMsg.includes('high demand'))
            userMsg = 'AI is experiencing high demand. Please try again in a moment.';
          else if (errMsg.includes('429') || errMsg.includes('quota'))
            userMsg = 'Too many requests. Please wait a moment and try again.';
          send(userMsg);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Accel-Buffering': 'no',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    console.error('Chat API error:', err);
    const errMsg = err instanceof Error ? err.message : String(err);
    let userMsg = 'Something went wrong. Please try again.';
    if (errMsg.includes('503') || errMsg.includes('high demand'))
      userMsg = 'AI is experiencing high demand right now. Please try again in a moment.';
    else if (errMsg.includes('429') || errMsg.includes('rate limit'))
      userMsg = 'Too many requests. Please wait a moment and try again.';
    else if (errMsg.includes('413') || errMsg.includes('too large'))
      userMsg = 'PDF is too large. Please try a smaller file (under 20MB).';
    return NextResponse.json({ content: [{ text: userMsg }] });
  }
}
