import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { SubjectKey } from '@/lib/subjectConfig';
import {
  SUBJECT_THINKER_BOOKS,
  SUBJECT_BROAD_ONLY,
  SUBJECT_DISPLAY,
  SUBJECT_THINKER_PAIRS,
} from '@/lib/subjectConfig';

export const maxDuration = 60;

// ── Rate limit (per IP, 20 msgs / 10 min) ────────────────────
const chatLimits = new Map<string, { count: number; ts: number }>();
const RATE_LIMIT = 20;
const CHAT_FREE_LIMIT = 3;
const OWNER_EMAIL = process.env.OWNER_EMAIL!;

// ── Embed service (same as history-optional) ─────────────────
const EMBED_SERVICE_URL = process.env.EMBED_SERVICE_URL || 'https://rag-embed-rerank.onrender.com';

async function localEmbedBatch(texts: string[]): Promise<number[][]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${EMBED_SERVICE_URL}/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts }),
      signal: controller.signal,
    });
    const data = await res.json();
    if (!data.embeddings) throw new Error('Embed failed: ' + JSON.stringify(data));
    return data.embeddings;
  } finally {
    clearTimeout(timer);
  }
}

// ── RAG: fetch book context from Supabase ────────────────────
// Returns empty string gracefully if:
//   a) embed service is down / cold-starting
//   b) no books embedded yet for this subject
//   c) similarity too low (books don't cover this topic)
async function getBookContext(
  query: string,
  subject: SubjectKey,
  bookTitle?: string,
): Promise<string> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const filter = bookTitle && bookTitle !== 'all' ? bookTitle : null;

    const [embedding] = await localEmbedBatch([query]);

    let results;
    if (!filter) {
      // All books for this subject — use diverse RPC (per-book top-3)
      // subject column lets Postgres filter to only this subject's chunks
      results = await Promise.all([
        supabase.rpc('match_book_chunks_diverse', {
          query_embedding: embedding,
          per_book_count: 3,
          filter_subject: subject,   // Supabase fn must accept this param
        }),
      ]);
    } else {
      results = await Promise.all([
        supabase.rpc('match_book_chunks', {
          query_embedding: embedding,
          match_count: 12,
          filter_book: filter,
        }),
      ]);
    }

    const seen = new Set<unknown>();
    const allChunks: { id: unknown; content: string; book_title: string; author: string; similarity: number }[] = [];
    for (const result of results) {
      if (result.error) console.error('Supabase RPC error:', result.error);
      for (const chunk of result.data ?? []) {
        if (!seen.has(chunk.id)) {
          seen.add(chunk.id);
          allChunks.push({
            id: chunk.id,
            content: chunk.content,
            book_title: chunk.book_title,
            author: chunk.author,
            similarity: chunk.similarity,
          });
        }
      }
    }

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
function buildSystemPrompt(opts: {
  subject: SubjectKey;
  subjectDisplay: string;
  ragContext: string;
  ragSources: { book_title: string; author: string; content: string }[];
  bookTitle?: string;
  responseStyle: 'concise' | 'elaborative';
  brainstormMode: boolean;
  mentorMode: boolean;
  lang: 'en' | 'hi';
  pdfMode: boolean;
}): string {
  const {
    subject,
    subjectDisplay,
    ragContext,
    ragSources,
    bookTitle,
    responseStyle,
    brainstormMode,
    mentorMode,
    lang,
    pdfMode,
  } = opts;

  const whitelistedSurnames = Object.keys(SUBJECT_THINKER_BOOKS[subject] ?? {});
  const broadOnly = SUBJECT_BROAD_ONLY[subject] ?? [];
  const thinkerPairs = SUBJECT_THINKER_PAIRS[subject] ?? '';

  const SCOPE_GUARD = `SCOPE GUARD (apply before anything else): You only help with UPSC ${subjectDisplay} Optional preparation — ${subjectDisplay} theory, thinkers, Indian context, exam strategy, answer writing per the UPSC syllabus. If the user's message is unrelated to this scope (general coding, other subjects, casual chit-chat, entertainment, sports, unrelated current affairs), do NOT attempt it. Politely and briefly explain that you are a UPSC ${subjectDisplay} Optional assistant and ask them to ask a relevant question. Do not partially answer off-topic requests.`;

  if (brainstormMode) {
    return `You are an expert UPSC CSE Mains ${subjectDisplay} Optional strategist.\n\n${SCOPE_GUARD}\n\nIf given a TOPIC: Generate:\n### Key Arguments & Dimensions\n- 6-8 distinct analytical angles with 2-3 sentence explanation each\n### Important Thinkers & Their Stands\n- 5-6 thinkers with their specific thesis on this topic\n### Connecting Themes\n- Links to other syllabus topics, contemporary relevance\n\nIf given a QUESTION: Generate:\n### Decoding the Question\n- What is being asked, keywords, approach (descriptive/argumentative)\n### Must-Include Points\n- Key facts, concepts, thinkers that cannot be missed\n### Theoretical Ammunition\n- Specific thinkers + their arguments relevant to this question\n\nUse **bold** for key terms. Be crisp and scannable — this is a planning tool.`;
  }

  const styleRule = responseStyle === 'elaborative'
    ? `RESPONSE STYLE — ELABORATIVE: Flowing prose paragraphs (3-5 sentences each). Cover sub-arguments and theoretical debates in depth. Bold titles to separate sections.`
    : `RESPONSE STYLE — CONCISE (STRICTLY MANDATORY):
- Bullet points for all arguments/features/causes/consequences.
- Format: **Bold label** — 1 crisp line (max 2 lines). No paragraph after bullet.
- Intro: 1-2 lines max. Conclusion: 1-2 lines max.
- Total response: short and tight. No walls of text.`;

  const basePrompt = `You are an expert UPSC ${subjectDisplay} Optional tutor with deep knowledge of ${subjectDisplay} theory, thinkers, Indian context, and the UPSC Mains exam pattern.

${SCOPE_GUARD}

Always use UPSC format: Introduction, Body (with subheadings), Conclusion.

WRITING RULES:
- NEVER write a thinker name as a bare bullet. Always: "**Durkheim** argues that..." within the bullet.
- NEVER add a separate "Key Thinkers Cited" list. Weave references into the body.
- Use **bold** for key terms, thinker names, pivotal concepts — within sentences only.
- Do NOT use ### headings — use **bold** for section titles only.
- Include specific concepts, debates, and real-world examples.
- Use plain English spellings — no diacritical marks.

${styleRule}
${pdfMode ? '\n\nIMPORTANT: The user has uploaded a PDF. Analyze it carefully. Provide full UPSC-format answers for questions in it.' : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EPISTEMIC INTEGRITY — HIGHEST PRIORITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CRITICAL RULE ON IRRELEVANT SOURCES: If provided book passages are clearly about a different topic, explicitly state: "The selected book does not cover this topic directly." Then answer from general knowledge — WITHOUT inventing quotes, statistics, or citations.

CLASSIFY EVERY CLAIM BEFORE WRITING:
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
  ? `CRITICAL OUTPUT RULE: After EVERY sentence where you draw on a book passage below, append the source number inline as "Source #N" (e.g. Source #1, Source #2). This is non-negotiable.

${bookTitle && bookTitle !== 'all'
    ? `BOOK PASSAGES from "${bookTitle}" — prioritise answering from these passages. Ground the answer specifically in what this book covers:\n\n${ragContext}`
    : `RELEVANT BOOK PASSAGES (multiple books — cite each as Source #N):\n\n${ragContext}`
  }`
  : '(No book passages available for this query — answer from your knowledge following all epistemic rules above.)'
}`;

  const langSuffix = lang === 'hi'
    ? '\n\nCRITICAL INSTRUCTION: You MUST respond ENTIRELY in Hindi (Devanagari script). Every single word in Hindi. Transliterate technical terms. Thinker names and concepts use Hindi equivalents.'
    : '\n\nCRITICAL INSTRUCTION: You MUST respond ENTIRELY in English.';

  return basePrompt + langSuffix;
}

// ── Main POST handler ─────────────────────────────────────────
export async function POST(req: NextRequest) {
  // Rate limit
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown';
  const now = Date.now();
  if (chatLimits.get(ip) && now - chatLimits.get(ip)!.ts > 10 * 60 * 1000) chatLimits.delete(ip);
  const current = chatLimits.get(ip);
  if (current && current.count >= RATE_LIMIT)
    return NextResponse.json({ error: 'too_many_requests' }, { status: 429 });
  chatLimits.set(ip, { count: (current?.count ?? 0) + 1, ts: current?.ts ?? now });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const token = req.headers.get('x-user-token') ?? '';
  const fingerprint = req.headers.get('x-fingerprint') ?? '';

  // Auth
  let isOwner = false;
  let isPremium = false;
  let firebaseUid = '';

  if (token) {
    try {
      const { adminAuth } = await import('@/lib/firebaseAdmin');
      const decoded = await adminAuth.verifyIdToken(token);
      firebaseUid = decoded.uid;
      if (decoded.email === OWNER_EMAIL) isOwner = true;
      if (!isOwner) {
        const nowISO = new Date().toISOString();
        const { data: sub } = await supabase
          .from('subscriptions')
          .select('status')
          .eq('firebase_uid', decoded.uid)
          .eq('status', 'active')
          .gt('expires_at', nowISO)
          .single();
        if (sub) isPremium = true;
      }
    } catch { /* auth failed — treat as free user */ }
  }

  // Usage check
  if (!isOwner && !isPremium) {
    let used = 0;
    if (firebaseUid) {
      try {
        const { data: byUid } = await supabase
          .from('usage_tracking')
          .select('chat_count')
          .eq('firebase_uid', firebaseUid)
          .single();
        used = Math.max(used, byUid?.chat_count ?? 0);
      } catch { /* ignore */ }
    }
    if (fingerprint) {
      const { data: byFp } = await supabase
        .from('usage_tracking')
        .select('chat_count')
        .eq('fingerprint', fingerprint)
        .single();
      used = Math.max(used, byFp?.chat_count ?? 0);
    }
    if (used >= CHAT_FREE_LIMIT)
      return NextResponse.json({ error: 'limit_reached' }, { status: 403 });
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
    } = await req.json();

    // Validate subject
    const validSubjects: SubjectKey[] = ['sociology', 'anthropology', 'polsci', 'geography', 'pub-admin'];
    const subjectKey: SubjectKey = validSubjects.includes(subject) ? subject : 'sociology';
    const subjectDisplay = SUBJECT_DISPLAY[subjectKey];

    const maxTokens = responseStyle === 'elaborative' ? 3500 : 2000;

    const lastMsg = messages?.[messages.length - 1]?.content ?? '';
    if (typeof lastMsg === 'string' && lastMsg.length > 10000)
      return NextResponse.json({ error: 'Message too long' }, { status: 400 });
    if (!Array.isArray(messages) || messages.length > 50)
      return NextResponse.json({ error: 'Too many messages in context' }, { status: 400 });

    // ── RAG ─────────────────────────────────────────────────
    let ragContext = '';
    let ragSources: { book_title: string; author: string; content: string }[] = [];
    const lastQ = typeof messages?.[messages.length - 1]?.content === 'string'
      ? messages[messages.length - 1].content
      : '';

    try {
      if (bookMode) {
        ragContext = await getBookContext(lastQ, subjectKey, bookTitle);
      } else {
        ragContext = await getBookContext(lastQ, subjectKey);
      }
      ragSources = ragContext
        .split('\n\n---\n\n')
        .map((block) => {
          const match = block.match(/^\[Source \d+ — (.+?) \| Author: (.+?)\]\n([\s\S]+)$/);
          if (match) return { book_title: match[1], author: match[2], content: match[3] };
          return null;
        })
        .filter(Boolean) as { book_title: string; author: string; content: string }[];
    } catch (e) {
      console.error('RAG skipped:', e);
    }

    // ── System prompt ────────────────────────────────────────
    const systemPrompt = buildSystemPrompt({
      subject: subjectKey,
      subjectDisplay,
      ragContext,
      ragSources,
      bookTitle,
      responseStyle,
      brainstormMode,
      mentorMode,
      lang,
      pdfMode: !!pdf_base64,
    });

    // ── Streaming ────────────────────────────────────────────
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (chunk: string) => controller.enqueue(encoder.encode(chunk));
        let fullAnswer = '';

        try {
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
                fullAnswer += chunk.delta.text;
              }
            }
          } else if (lang === 'hi') {
            // Hindi mode → Haiku
            const Anthropic = (await import('@anthropic-ai/sdk')).default;
            const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
            const builtMessages = messages.map((m: { role: string; content: string }, i: number) => {
              if (i === messages.length - 1 && m.role === 'user') {
                return { role: m.role, content: m.content + '\n\n[IMPORTANT: Respond entirely in Hindi (Devanagari script)]' };
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
                fullAnswer += chunk.delta.text;
              }
            }
          } else {
            // Normal chat → DeepSeek V4 Flash
            const dsRes = await fetch('https://api.deepseek.com/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
              },
              body: JSON.stringify({
                model: 'deepseek-v4-flash',
                max_tokens: maxTokens,
                stream: true,
                messages: [
                  { role: 'system', content: systemPrompt },
                  ...messages.map((m: { role: string; content: string }) => ({ role: m.role, content: m.content })),
                ],
              }),
            });
            if (!dsRes.ok || !dsRes.body) throw new Error(`DeepSeek API error: ${dsRes.status}`);
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
                    if (delta) fullAnswer += delta;
                  } catch { /* ignore malformed SSE */ }
                }
              }
            }
          }

          // ── Citation verification (same 3-layer system) ──────
          try {
            const whitelistedSurnames = Object.keys(SUBJECT_THINKER_BOOKS[subjectKey] ?? {});
            const broadOnly = SUBJECT_BROAD_ONLY[subjectKey] ?? [];
            const whitelistedBooks = SUBJECT_THINKER_BOOKS[subjectKey] ?? {};

            const specificClaimPattern = /argues|notes|writes|states|claimed|asserts|observes|emphasises|emphasizes|points out|concludes|suggests|contends|maintains/;
            const sentences = fullAnswer.match(/[^.!?]*[.!?]+/g) ?? [fullAnswer];

            for (const sentence of sentences) {
              let shouldStrip = false;
              for (const name of broadOnly) {
                if (sentence.includes(name)) {
                  const hasBracket = /\([^)]+\)/.test(sentence);
                  if (specificClaimPattern.test(sentence) || hasBracket) {
                    shouldStrip = true;
                    break;
                  }
                }
              }
              if (!shouldStrip) {
                for (const [thinker, books] of Object.entries(whitelistedBooks)) {
                  if (sentence.includes(thinker)) {
                    const bracketMatches = sentence.match(/\([^)]+\)/g) ?? [];
                    for (const bracket of bracketMatches) {
                      const bl = bracket.toLowerCase();
                      if (/^\(\d{4}\)$/.test(bracket.trim())) continue;
                      if (/[a-zA-Z]{4,}/.test(bracket)) {
                        const bookVerified = books.some((b) => bl.includes(b.slice(0, 10).toLowerCase()));
                        if (!bookVerified) {
                          fullAnswer = fullAnswer.split(bracket).join('').replace(/\s+([.,;])/g, '$1');
                        }
                      }
                    }
                  }
                }
              }
              if (shouldStrip && fullAnswer.includes(sentence)) {
                fullAnswer = fullAnswer.split(sentence).join('').replace(/[ \t]{2,}/g, ' ');
              }
            }

            // Layer 3 — Groq verifier (only when RAG sources present)
            if (ragSources.length > 0) {
              const updatedSentences = fullAnswer.match(/[^.!?]*[.!?]+/g) ?? [fullAnswer];
              const bracketPattern = /\([A-Z][a-zA-Z.\s]+?,\s*[^)]+?\)/g;
              const flagged = updatedSentences.filter((s) => {
                bracketPattern.lastIndex = 0;
                return bracketPattern.test(s) || whitelistedSurnames.some((name) => s.includes(name));
              });
              if (flagged.length > 0) {
                const sourceBlock = ragSources
                  .map((s, i) => `[Source ${i + 1} — ${s.book_title} | Author: ${s.author}]\n${s.content}`)
                  .join('\n\n---\n\n');
                const verifyRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
                  body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    max_tokens: 800,
                    stream: false,
                    messages: [
                      {
                        role: 'system',
                        content: `You are a strict citation auditor. For each flagged sentence, verify: LAYER 1 — is the thinker under their own [Source N | Author: X] label? LAYER 2 — if a book title is cited, does it match the actual book in the passages for that author? LAYER 3 — does the specific claim actually appear in that author's passage? Classify into "bad_brackets" (bracket failing any layer) and "bad_prose_sentences" (prose attribution failing any layer). Respond ONLY with valid JSON, no markdown: {"bad_brackets": [], "bad_prose_sentences": []}`,
                      },
                      {
                        role: 'user',
                        content: `SOURCE PASSAGES:\n${sourceBlock}\n\n---\n\nFLAGGED SENTENCES:\n${flagged.join('\n')}`,
                      },
                    ],
                  }),
                });
                const verifyJson = await verifyRes.json();
                const verifyText = verifyJson.choices?.[0]?.message?.content?.trim() ?? '';
                const jsonMatch = verifyText.match(/\{[\s\S]*?\}/);
                if (jsonMatch) {
                  const parsed = JSON.parse(jsonMatch[0]) as { bad_brackets: string[]; bad_prose_sentences: string[] };
                  for (const bad of parsed.bad_brackets ?? []) {
                    if (fullAnswer.includes(bad)) fullAnswer = fullAnswer.split(bad).join('').replace(/\s+([.,;])/g, '$1');
                  }
                  for (const bad of parsed.bad_prose_sentences ?? []) {
                    if (fullAnswer.includes(bad)) fullAnswer = fullAnswer.split(bad).join('').replace(/[ \t]{2,}/g, ' ');
                  }
                }
              }
            }
          } catch (verifyErr) {
            console.error('Citation verification failed (non-fatal):', verifyErr);
          }

          send(fullAnswer);

          // Append sources delimiter
          send('\n__SOURCES__' + JSON.stringify(ragSources));

          // Increment usage (track everyone including owner)
          if (firebaseUid) {
            try {
              const { createClient: ccInc } = await import('@supabase/supabase-js');
              const sbInc = ccInc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
              const { data: existing } = await sbInc
                .from('usage_tracking')
                .select('chat_count')
                .eq('firebase_uid', firebaseUid)
                .single();
              const newCount = (existing?.chat_count ?? 0) + 1;
              await sbInc.from('usage_tracking')
                .upsert(
                  { firebase_uid: firebaseUid, fingerprint: fingerprint ?? '', chat_count: newCount, updated_at: new Date().toISOString() },
                  { onConflict: 'firebase_uid' }
                );
            } catch (incErr) {
              console.log('chat_count increment failed', incErr);
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