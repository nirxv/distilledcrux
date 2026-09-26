export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { debug } from "@/lib/debugLog";
import { rejectUpload, toImageContents, IMAGE_AND_PDF_TYPES } from "@/lib/uploadLimits";
import { verifyFirebaseToken } from "@/lib/verifyFirebaseToken";
import { createServerClient } from "@/lib/supabase";
import { hasActiveSubscription, optionalForSubject } from "@/lib/entitlements";
import { resolveUsageIdentity, readUsage, recordUsage } from "@/lib/usageIdentity";
import { getSubjectConfig, buildRosterString, assemblePrompt } from "@/lib/subjects";

const FREE_EVAL_LIMIT = 1;

export async function POST(req: NextRequest) {
  // One parse. This used to clone the request and parse the multipart body a
  // second time just to read `subject` before the auth check, so every upload
  // was decoded twice.
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Malformed request body" }, { status: 400 });
  }

  const token = req.headers.get("x-user-token") ?? "";
  const subjectField = (formData.get("subject") as string) || "sociology";
  const optionalForEval = optionalForSubject(subjectField);

  const user = token ? await verifyFirebaseToken(token) : null;
  const isOwner = Boolean(user?.email && user.email === process.env.OWNER_EMAIL);

  const isPremium = user && !isOwner
    ? await hasActiveSubscription(createServerClient(), user.uid, optionalForEval)
    : false;

  // Identity is resolved server-side. The client's x-fingerprint header is no
  // longer consulted: it was the entire free tier, and the client chose it.
  const identity = resolveUsageIdentity(req, user?.uid ?? null);

  if (!isOwner && !isPremium) {
    const used = await readUsage(identity, "eval_count");
    if (used >= FREE_EVAL_LIMIT) {
      return NextResponse.json({ error: "limit_reached" }, { status: 403 });
    }
  }

  try {
    const files = formData.getAll("files") as File[];
    const question = formData.get("question") as string;
    const lang = (formData.get("lang") as string) || "en";
    const marks = formData.get("marks") as string;
    const extractedText = (formData.get("extractedText") as string) || "";
    const subject = subjectField;

    // ── Resolve subject config + assemble final system prompt ──────────────
    const subjectConfig = getSubjectConfig(subject);
    // RAG context is empty string until the ragTask runs below.
    // assemblePrompt() is called again after ragTask with the real ragContext.
    const rosterStr = buildRosterString(subjectConfig.thinkerRoster);

    if (!question || !marks) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Input length limits
    if (question.length > 600)
      return NextResponse.json({ error: "Question too long (max 600 chars)" }, { status: 400 });

    // Count, types and BOTH size ceilings, checked before anything is read
    // into memory. The total is the one that was missing.
    if (files.length) {
      const rejected = rejectUpload(files, IMAGE_AND_PDF_TYPES);
      if (rejected) {
        return NextResponse.json({ error: rejected.error }, { status: rejected.status });
      }
    }

    // Client converts PDFs to images before sending.
    const imageContents = await toImageContents(files);
    if (imageContents.length === 0 && !extractedText) {
      return NextResponse.json({ error: "No images or PDF provided" }, { status: 400 });
    }

    // ── Helper: Groq fetch with fallback key ─────────────────────
    const groqFetch = async (body: object, key: string) =>
      fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

    // Swap kimi-k2 for llama fallback in a body object
    const withFallbackModel = (body: object): object => {
      const b = body as Record<string, unknown>;
      if (typeof b.model === "string" && b.model.includes("kimi-k2")) {
        return { ...b, model: "openai/gpt-oss-20b" };
      }
      return body;
    };

    const callWithFallback = async (body: object) => {
      let res = await groqFetch(body, process.env.GROQ_API_KEY!);
      // Key 2 fallback for rate limits
      if (res.status === 429 && process.env.GROQ_API_KEY_2) {
        debug("Primary key rate limited, trying key 2...");
        res = await groqFetch(body, process.env.GROQ_API_KEY_2);
      }
      // Model fallback for kimi-k2 over capacity (503 or 429 still failing)
      if ((res.status === 503 || res.status === 429) && (body as Record<string, unknown>).model?.toString().includes("kimi-k2")) {
        debug("Kimi-K2 over capacity, falling back to llama-3.3-70b...");
        const fallbackBody = withFallbackModel(body);
        res = await groqFetch(fallbackBody, process.env.GROQ_API_KEY!);
        if (res.status === 429 && process.env.GROQ_API_KEY_2) {
          res = await groqFetch(fallbackBody, process.env.GROQ_API_KEY_2);
        }
      }
      // 413 — payload too large: trim assistant message content and retry
      if (res.status === 413) {
        debug("413 payload too large, trimming assistant messages and retrying...");
        const b = body as Record<string, unknown>;
        const msgs = (b.messages as any[]) ?? [];
        const trimmed = msgs.map((m: any) => {
          if (m.role === "assistant" && typeof m.content === "string" && m.content.length > 3000) {
            return { ...m, content: m.content.slice(0, 3000) + "\n[trimmed for length]" };
          }
          return m;
        });
        res = await groqFetch({ ...b, messages: trimmed }, process.env.GROQ_API_KEY!);
        if (res.status === 429 && process.env.GROQ_API_KEY_2) {
          res = await groqFetch({ ...b, messages: trimmed }, process.env.GROQ_API_KEY_2);
        }
      }
      return res;
    };

    // ── PASS 0.5: Generate reference answer (internal, never shown to user) ──
    // Runs before evaluation so Pass 1 can judge the student's answer
    // against what a strong answer actually looks like.
    let referenceAnswer = "";
    try {
      const refBulletCount = marks === "10" ? "4-5" : marks === "15" ? "6-8" : "9-12";
      const refRes = await callWithFallback({
        model: "openai/gpt-oss-120b",
        messages: [
          { role: "system", content: assemblePrompt(subjectConfig.systemPromptTemplate, rosterStr, "", subjectConfig.label, lang) },
          {
            role: "user",
            content: `Generate a strong internal reference answer for this UPSC ${subjectConfig.label} question. This will be used only to calibrate evaluation — it will NOT be shown to the student.

Question: ${question} (${marks} marks)

Write a complete model answer as flowing prose:
- Introduction (2-3 sentences): Opens with a theoretical/conceptual debate relevant to this subject, names at least one modern ${subjectConfig.thinkerTerm} with their specific thesis, previews the argument.
- Body (${refBulletCount} points): Each point must have a named modern ${subjectConfig.thinkerTerm} + their specific argument + specific evidence (text/concept/case/policy) + analytical link to the question.
- Conclusion (2-3 sentences): Takes a clear theoretical position, resolves the intro tension, no new material.

Target ~${marks === "10" ? "200" : marks === "15" ? "300" : "400"} words. Be specific — name real thinkers with real arguments from ${subjectConfig.label}. No generic statements.`,
          },
        ],
        temperature: 0.3,
        max_tokens: 1500,
      });

      if (refRes.ok) {
        const refData = await refRes.json();
        referenceAnswer = refData.choices?.[0]?.message?.content?.trim() || "";
        debug("Pass 0.5 reference answer generated:", referenceAnswer.slice(0, 200));
      } else {
        debug("Pass 0.5 skipped (rate limited or failed) — evaluating without reference");
      }
    } catch (refErr) {
      debug("Pass 0.5 error (non-fatal):", refErr);
    }

    // ── PASS 0 + RAG: Run OCR and RAG fetch in parallel ──────────
    let finalTranscript = extractedText;

    const ocrPrompt = `You are the world's most precise handwriting transcription engine, built specifically for UPSC ${subjectConfig.label} answer sheets. Your ONLY function is letter-perfect transcription. A student's evaluation depends entirely on the accuracy of your reading — a single misread word can cause wrong marks, wrong feedback, and wrong ${subjectConfig.thinkerTerm} attribution. Errors are unacceptable.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ABSOLUTE TRANSCRIPTION RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RULE 1 — TRANSCRIBE EVERY SINGLE WORD.
Do not skip, summarise, paraphrase, or compress anything. Every word on every line on every page must appear in your output. If the answer is 300 words, your transcript must be ~300 words. If you produce significantly fewer words than appear on the page, you have failed.

RULE 2 — GO SLOW. READ CHARACTER BY CHARACTER IF NEEDED.
Do not skim. For each word: look at every letter individually, consider the full word context, then commit. Rushing causes errors. Take your time on every single word.

RULE 3 — THINKER NAMES ARE SACRED. NEVER GET THEM WRONG.
Thinker/scholar names are the most critical part of this evaluation. Read them with extreme care.
Known names that may appear — read these exactly:
${subjectConfig.thinkerRoster.map(t => t.name).join(', ')}.
If you see a name that resembles one of these, read it carefully and transcribe it exactly as written — do not auto-correct to the known spelling unless you are certain.

RULE 4 — DATES, NUMBERS, AND YEARS: TRANSCRIBE EXACTLY.
Do not round, approximate, or guess dates. If you see "1857" write "1857". If you cannot read a digit clearly, write [illegible digit].

RULE 5 — TECHNICAL TERMS: TRANSCRIBE EXACTLY AS WRITTEN.
Subject-specific terms may appear — transcribe these exactly as the student wrote them, even if misspelled. Do not auto-correct spellings.

RULE 6 — UNCERTAIN WORDS: USE THE RIGHT FLAG.
- If you are 90%+ confident: transcribe normally.
- If you are 70–89% confident: transcribe with (?) suffix — e.g. "Kosambi(?)"
- If you are below 70% confident: write [illegible] — do NOT guess.
- NEVER silently substitute a wrong word. A flagged uncertainty is infinitely better than a silent error.

RULE 7 — PRESERVE ALL STRUCTURE EXACTLY.
- New paragraph → blank line in transcript
- Underlined heading → [HEADING: text]
- Margin note → [MARGIN: text]
- Numbered point → keep the number
- The question written at top → [QUESTION: text]
- Page break → --- PAGE BREAK ---
- Diagram, flowchart, map sketch, or labelled box/arrow drawing → [DRAWING: brief description of what it shows, e.g. "box labelled 'Vedic Corpus' with arrows to four sub-boxes: Samhita, Brahmana, Aranyaka, Upanishad"]. Transcribe any text written inside or alongside the drawing as part of the description. Do not skip drawings — they can earn presentation/structure credit.

RULE 8 — DO NOT EVALUATE, INTERPRET, OR COMMENT.
You are a transcription machine. Do not add "[good point]" or "[${subjectConfig.thinkerTerm} cited correctly]" or any commentary whatsoever. Pure text output only.

RULE 9 — DO NOT SKIP LINES EVEN IF THEY SEEM REPETITIVE OR UNIMPORTANT.
Every line matters. A line you skip might contain the one ${subjectConfig.thinkerTerm} name the evaluator needs.

RULE 10 — AFTER TRANSCRIBING, DO A MENTAL PASS-CHECK.
Before outputting, ask yourself: Did I get every word? Did I read every ${subjectConfig.thinkerTerm} name carefully? Did I flag uncertainties properly? Only then output.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NOW TRANSCRIBE: ${imageContents.length} PAGE(S)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Go page by page. Do not rush. Every word matters.`;

    // OCR task (only if needed)
    const ocrTask = (!finalTranscript && imageContents.length > 0)
      ? (async () => {
          const geminiParts = [
            ...imageContents.map((img: { type: string; image_url: { url: string } }) => {
              const matches = img.image_url.url.match(/^data:([^;]+);base64,(.+)$/);
              return matches
                ? { inline_data: { mime_type: matches[1], data: matches[2] } }
                : null;
            }).filter(Boolean),
            { text: ocrPrompt },
          ];
          const ocrRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ role: "user", parts: geminiParts }],
                generationConfig: { temperature: 0.0, maxOutputTokens: 4000 },
              }),
            }
          );
          if (ocrRes.ok) {
            const ocrData = await ocrRes.json();
            const transcript = ocrData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
            debug("Pass 0 OCR transcript (Gemini):\n", transcript.slice(0, 300));
            return transcript;
          } else {
            const errText = await ocrRes.text();
            debug("Pass 0 Gemini OCR failed:", errText, "— falling back to in-line image reading in Pass 1");
            return "";
          }
        })()
      : Promise.resolve(finalTranscript);

    // RAG task — subject-aware: only runs when config.rag.enabled = true
    const ragTask = (async () => {
      if (!subjectConfig.rag?.enabled || !subjectConfig.rag.namespace) {
        return ''; // RAG not yet set up for this subject
      }
      try {
        const ragRes = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/rag-search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: question,
            namespace: subjectConfig.rag.namespace,
            topK: subjectConfig.rag.topK,
            scoreThreshold: subjectConfig.rag.scoreThreshold,
          }),
        });
        const ragData = await ragRes.json();
        const ctx = ragData.context || '';
        if (ctx) debug(`RAG context fetched [${subjectConfig.rag.namespace}], length:`, ctx.length);
        return ctx;
      } catch (ragErr) {
        debug('RAG fetch failed (non-fatal):', ragErr);
        return '';
      }
    })();

    // Run both in parallel — saves 3-5s
    const [ocrResult, ragContext] = await Promise.all([ocrTask, ragTask]);

    // ── Assembled system prompt — uses real ragContext now ─────────────────
    const ASSEMBLED_PROMPT = assemblePrompt(
      subjectConfig.systemPromptTemplate,
      rosterStr,
      ragContext,
      subjectConfig.label,
      lang,
    );
    if (ocrResult) finalTranscript = ocrResult;

        // ── PASS 1: Chain-of-thought reasoning ─────────────────────
    const introMax = marks === "10" ? "1.5" : marks === "15" ? "2" : "3";
    const bodyMax  = marks === "10" ? "5.5" : marks === "15" ? "8" : "11";
    const concMax  = marks === "10" ? "1.5" : marks === "15" ? "2" : "3";
    const presMax  = marks === "10" ? "1.5" : "3";

    const cotPrompt = `Paper: ${subjectConfig.label} (UPSC Civil Services Mains)
${ragContext ? `REFERENCE MATERIAL FROM BOOKS:
${ragContext}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━` : ''}
Question: ${question}
Marks: ${marks}

${finalTranscript
  ? "The student's handwritten answer has been transcribed for you below. Use this transcript as the PRIMARY source — it is more reliable than reading the images yourself. The images are provided only as visual reference for presentation/handwriting quality.\n\nTRANSCRIPT:\n" + finalTranscript
  : "The images show the student's handwritten answer sheet (" + imageContents.length + " page" + (imageContents.length > 1 ? "s" : "") + "). Read ALL pages carefully before evaluating."}

${referenceAnswer ? `REFERENCE ANSWER (for calibration only — not shown to student):
The following is what a strong answer to this question looks like. Use it to calibrate your evaluation — judge the student's answer against this standard when assessing which body points are STRONG, WEAK, or NONE, and whether the introduction and conclusion meet the theoretical/analytical bar.

${referenceAnswer}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━` : ""}
Work through this RIGID RUBRIC — check each box YES or NO and assign marks exactly as the band says. Do not deviate from the bands.

== STEP 1: READING ==
First, identify the EXACT boundary of each section by quoting where it starts: where does the introduction end and the body begin, where does the body end and the conclusion begin? A ${subjectConfig.thinkerTerm} or claim that appears in the conclusion's text belongs ONLY to the conclusion's evaluation — never copy it into the introduction's evaluation, even if it would have made the introduction stronger. Same rule for body vs intro/conclusion.
Write one sentence each for: intro (quote its actual opening text), each body point (list ${subjectConfig.thinkerTerm} named + argument if any, quoting the body text), conclusion (quote its actual closing text). Double-check: does the ${subjectConfig.thinkerTerm}/claim you attributed to "intro" actually appear in the intro's quoted text, not in the body or conclusion? If a ${subjectConfig.thinkerTerm} only appears in the conclusion, do NOT mention them when evaluating the introduction.

== STEP 1B: FACTUAL VERIFICATION ==
List every specific factual claim the student makes — this includes dates/years/named events/movements AND substantive claims about what a person, group, institution, or theoretical school actually argued or did. For each one, check it against what you actually know:
- If the claim is correct → write "VERIFIED: [claim]"
- If the claim is wrong, overstated, or conflates two different things → write "FACTUAL ERROR: student wrote '[claim]', correct is '[correction]'" — this will be flagged as [FACTUAL ERROR] in the relevant section's weaknesses, even if it doesn't change the band. Common overstatement pattern: student says a ${subjectConfig.thinkerTerm} "proved/abolished/ended" something when the scholarly consensus is they only "challenged/critiqued/qualified" it — this counts as a factual error, not just a nuance gap.
- If you are not fully certain either way → write "UNCERTAIN: do not flag" — never invent a correction you are not sure of.
Separately, note if the student presents a one-sided theoretical claim without acknowledging that serious ${subjectConfig.thinkerTerm}s dispute or qualify it. If so, note it as a missed nuance — this belongs in suggestions, not as a factual error.

== STEP 2: WORD COUNT ==
Skip question text at top. Count answer body words only. Write the exact number.

== STEP 3: INTRODUCTION (max ${introMax}M) — pick EXACTLY ONE band, no decimals allowed ==
Reminder: abstract concepts and terms from the subject domain are NOT ${subjectConfig.thinkerTerm}s/scholars — using these terms alone does not satisfy "names a ${subjectConfig.thinkerTerm}."
BAND 0M (ONLY): definition opener, no intro, only generic context, no ${subjectConfig.thinkerTerm} at all — award exactly 0
BAND ${marks === "10" ? "0.5" : "1"}M (ONLY): mentions subject context OR names a primary/foundational source but NO modern ${subjectConfig.thinkerTerm} named — OR names a modern ${subjectConfig.thinkerTerm} but gives NO specific thesis/argument — award exactly ${marks === "10" ? "0.5" : "1"}
BAND ${introMax}M (ONLY): names a MODERN thinker (${subjectConfig.thinkerRoster.slice(0, 4).map(t => t.name).join(' / ')} etc.) AND states their SPECIFIC thesis AND frames a theoretical/conceptual debate AND previews the argument — ALL FOUR required — award exactly ${introMax}
IMPORTANT: Simply naming a ${subjectConfig.thinkerTerm} without their specific thesis = BAND 1M only, NOT full marks.
RULE: You MUST pick one of the three values above.
→ INTRO BAND CHOSEN: [write mark]
== STEP 4: BODY (max ${bodyMax}M) — count then pick band ==
DEFINITIONS — apply equally to THINKER points and ANALYTICAL points (50/50 weight):

THINKER POINTS:
- STRONG-T: modern thinker named (${subjectConfig.thinkerRoster.slice(0, 5).map(t => t.name).join(', ')} etc.) WITH their specific argument clearly stated. "[${subjectConfig.thinkerTerm}] argues..." counts. "[${subjectConfig.thinkerTerm}] has written about this" does NOT count.
- WEAK-T: modern ${subjectConfig.thinkerTerm} named but their argument is vague, absent, or just their name dropped without context.

- STRONG-A: a body point that does ALL THREE — (1) makes a clear causal/structural claim, (2) supports it with specific evidence (event, data, policy, case), (3) links it to the question demand. Example: "NFU reduces first-strike incentives because it signals restraint, as seen post-Kargil where no nuclear escalation occurred."
- WEAK-A: makes a claim with some evidence but lacks the causal link, OR has the link but no specific evidence. Surface-level descriptive statements are NOT analytical — mark NONE.
- NONE: purely descriptive, no thinker, no analytical structure. Abstract concept names alone without argument = NONE.

For each body point write: STRONG-T / STRONG-A / WEAK-T / WEAK-A / NONE
- For STRONG-T or WEAK-T: quote the exact thinker name (e.g. "STRONG-T — Morgenthau")
- For STRONG-A or WEAK-A: one line summarising the claim (e.g. "STRONG-A — NFU + Kargil evidence + restraint link")
- NONE needs no justification.

Tally: STRONG=__ (STRONG-T + STRONG-A) WEAK=__ (WEAK-T + WEAK-A) NONE=__
Sanity check: note if the answer is skewed entirely toward thinkers or entirely toward analysis — a balanced answer has both.

${marks === "10" ? `BAND 1M (ONLY): 0 strong, 0 weak — purely narrative, no ${subjectConfig.thinkerTerm}s at all — award exactly 1
BAND 2M (ONLY): 0 strong, 1-2 weak — ${subjectConfig.thinkerTerm} names dropped without arguments — award exactly 2
BAND 3M (ONLY): 1 strong point only — award exactly 3
BAND 4M (ONLY): 2 strong points — award exactly 4
BAND 5.5M (ONLY): 3+ strong points, all dimensions covered — award exactly 5.5` : marks === "15" ? `BAND 2M (ONLY): 0 strong, 0 weak — purely descriptive, no ${subjectConfig.thinkerTerm}s at all — award exactly 2
BAND 3.5M (ONLY): 0 strong, 1-3 weak — ${subjectConfig.thinkerTerm} names without arguments — award exactly 3.5
BAND 5M (ONLY): 1 strong point only — award exactly 5
BAND 6.5M (ONLY): 2 strong points — award exactly 6.5
BAND 8M (ONLY): 3+ strong points with multi-dimensional coverage — award exactly 8` : `BAND 3M (ONLY): 0 strong, 0 weak — purely narrative, no ${subjectConfig.thinkerTerm}s at all — award exactly 3
BAND 5M (ONLY): 0 strong, 1-3 weak — ${subjectConfig.thinkerTerm} names without arguments — award exactly 5
BAND 7M (ONLY): 1 strong point only — award exactly 7
BAND 8.5M (ONLY): 2 strong points — award exactly 8.5
BAND 9.5M (ONLY): 3-4 strong points — award exactly 9.5
BAND 11M (ONLY): 5+ strong points, all dimensions covered — award exactly 11`}
→ BODY BAND CHOSEN: [write mark]

== STEP 5: CONCLUSION (max ${concMax}M) — pick EXACTLY ONE band, no decimals allowed ==
BAND 0M (ONLY): no conclusion, or just restates intro sentence — award exactly 0
BAND ${marks === "10" ? "0.5" : "1"}M (ONLY): summarises body points but takes NO clear position — award exactly ${marks === "10" ? "0.5" : "1"}
BAND ${concMax}M (ONLY): takes a clear position AND links back to intro debate — award exactly ${concMax}
RULE: You MUST pick one of the three values above. No marks between bands allowed.
→ CONCLUSION BAND CHOSEN: [write mark]

== STEP 6: PRESENTATION (max ${presMax}M) — judge from BOTH the image pages AND the transcribed text ==
[ ] Handwriting is legible and neat — not scratchy or cramped (YES/NO) [judge from images]
[ ] Answer uses headings, underlining, numbered points, or labelled diagrams/flowcharts ([DRAWING: ...] markers) for structure (YES/NO) [judge from images and transcript]
[ ] No significant factual errors found in STEP 1B (YES/NO) [use your STEP 1B findings — any FACTUAL ERROR means NO]
Each YES = ${presMax === "1.5" ? "0.5" : "1"}M. Total checked = PRESENTATION MARK.
→ PRESENTATION MARK: [write mark]

== STEP 7: TOTAL ==
INTRO + BODY + CONCLUSION + PRESENTATION = TOTAL
→ TOTAL: [write number] out of ${marks}

== STEP 8: SELF-AUDIT — re-examine your own STEP 3-7 decisions before finalizing ==
Go back through what you just wrote above and check each box honestly:
[ ] For every name I counted as STRONG or WEAK in body/intro/conclusion, is it an actual modern ${subjectConfig.thinkerTerm} (a real person who writes in this field) — NOT an abstract concept, NOT a primary source text, NOT a historical figure/ruler, NOT a text/book title misread as a person?
[ ] For every ${subjectConfig.thinkerTerm} I credited to the introduction's evaluation, do they actually appear in the introduction's own text (not the body or conclusion)? Same check for body and conclusion — a ${subjectConfig.thinkerTerm} named only in the conclusion must NOT be credited when scoring the introduction, and vice versa. If I cross-attributed a ${subjectConfig.thinkerTerm} to the wrong section, fix that section's band now.
[ ] Did I quote the exact ${subjectConfig.thinkerTerm} name next to every STRONG/WEAK tag, as instructed? If any tag has no quoted name, change it to NONE now.
[ ] Does my STRONG+WEAK tally actually match the count of distinct ${subjectConfig.thinkerTerm} names I quoted? If not, recount and fix the tally now.
[ ] Did I pick a band that is NOT in the allowed list for this section? If so, snap to the nearest allowed band — never award an in-between value.
[ ] Did my STEP 1B factual-error findings actually get reflected in the presentation factual-error checkbox? If STEP 1B found any FACTUAL ERROR, the presentation checkbox for "no significant factual errors" must be NO.
[ ] Is my final TOTAL exactly equal to INTRO + BODY + CONCLUSION + PRESENTATION as I scored them above? Recompute it now to be sure.
If any check above failed, write "CORRECTION:" followed by the fixed band/tally/total. Otherwise write "AUDIT PASSED — no corrections needed."
→ FINAL TOTAL (after audit): [write number] out of ${marks}`;

    // ── Pass 1: Claude Haiku 4.5 (vision + strict rubric following) ──
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Convert Groq image_url format → Anthropic base64 format
    type AnthropicImageBlock = { type: "image"; source: { type: "base64"; media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp"; data: string } };
    const anthropicImageBlocks: AnthropicImageBlock[] = imageContents.map((img) => {
      const dataUri = img.image_url.url;
      const [meta, data] = dataUri.split(",");
      const mediaType = (meta.match(/data:([^;]+);/) ?? [])[1] as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
      return {
        type: "image" as const,
        source: { type: "base64" as const, media_type: mediaType || "image/jpeg", data },
      };
    });

    const cotHaikuRes = await anthropicClient.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2400,
      system: ASSEMBLED_PROMPT,
      messages: [
        {
          role: "user",
          content: finalTranscript
            ? cotPrompt
            : [
                ...anthropicImageBlocks,
                { type: "text" as const, text: cotPrompt },
              ],
        },
      ],
    });

    const cotReasoning = cotHaikuRes.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");
    debug("CoT reasoning:\n", cotReasoning);

    // Wait between passes to avoid TPM rate limiting
    await new Promise(res => setTimeout(res, 1000));

    // ── PASS 2: Convert reasoning to JSON ────────────────────────
    const jsonPrompt = `You already reasoned through this answer. Your reasoning:

<reasoning>
${cotReasoning}
</reasoning>

Now convert this into the exact JSON format from your system prompt.
If your reasoning's STEP 8 self-audit made any CORRECTION to a band, tally, or total, use the CORRECTED values in the JSON — not the original STEP 3-7 values that were corrected. Use the "FINAL TOTAL (after audit)" as the marks total, and the post-correction section bands as section_marks.
If your reasoning's STEP 1B found any "FACTUAL ERROR" entries, make sure each one appears as a [FACTUAL ERROR] weakness in the section it belongs to (introduction/body/conclusion) — do not drop them.
Do not re-evaluate beyond what STEP 8 already corrected. Faithfully convert your reasoning into JSON.
Return ONLY the JSON object, no preamble, no markdown fences.`;

    const response = await callWithFallback({
        model: "openai/gpt-oss-120b",
        messages: [
          { role: "system", content: ASSEMBLED_PROMPT },
          { role: "user", content: cotPrompt },
          { role: "assistant", content: cotReasoning },
          { role: "user", content: jsonPrompt },
        ],
        temperature: 0.1,
        max_tokens: 4000,
        response_format: { type: "json_object" },
    });

    let evaluation: Record<string, unknown> | null = null;

    if (!response.ok) {
      const err = await response.text();
      console.error("Groq Pass 2 error:", response.status, err);
      return NextResponse.json({ error: "Evaluation service is busy. Please try again in a moment." }, { status: 500 });
    }

    if (!evaluation) {
      const data = await response.json();
      let content = data.choices[0].message.content;
      content = content.replace(/```json|```/g, "").trim();
      debug("Pass 2 raw content length:", content.length, "| finish_reason:", data.choices[0].finish_reason);
      try {
        evaluation = JSON.parse(content);
      } catch {
        console.error("Pass 2 JSON.parse failed — finish_reason:", data.choices[0].finish_reason, "| last 300 chars:", content.slice(-300));
        // JSON truncated — try extracting largest valid object
        const match = content.match(/\{[\s\S]*/);
        if (match) {
          let partial = match[0];
          // Try closing unclosed JSON by appending braces
          for (let closes = 1; closes <= 5; closes++) {
            try {
              evaluation = JSON.parse(partial + "}}}}}}".slice(0, closes));
              break;
            } catch { /* keep trying */ }
          }
        }
        if (!evaluation) throw new Error("Could not parse model response");
        console.warn("Pass 2 recovered via brace-closing fallback — evaluation may be missing trailing fields.");
      }
    }

    // ── NULL GUARD ────────────────────────────────────────────────
    if (!evaluation) {
      return NextResponse.json({ error: "Evaluation failed to produce a result. Please try again." }, { status: 500 });
    }
    const eval_ = evaluation as any;
    if (!eval_.section_marks || typeof eval_.section_marks !== "object") {
      console.error("Pass 2 returned without valid section_marks. Keys present:", Object.keys(eval_), "| raw section_marks value:", JSON.stringify(eval_.section_marks));
    }

    // ── SECTION MARKS GUARD ───────────────────────────────────────
    // Reconstruct correct out_of values based on marks if missing or malformed
    const marksNum = parseInt(marks as string);
    const outOfs = marksNum === 10
      ? { introduction: 1.5, body: 5.5, conclusion: 1.5, presentation: 1.5 }
      : marksNum === 20
      ? { introduction: 3, body: 11, conclusion: 3, presentation: 3 }
      : { introduction: 2, body: 8, conclusion: 2, presentation: 3 };

    if (!eval_.section_marks || typeof eval_.section_marks !== "object") {
      eval_.section_marks = {
        introduction: { awarded: 0, out_of: outOfs.introduction, reasoning: "Could not evaluate" },
        body:         { awarded: 0, out_of: outOfs.body,         reasoning: "Could not evaluate" },
        conclusion:   { awarded: 0, out_of: outOfs.conclusion,   reasoning: "Could not evaluate" },
        presentation: { awarded: 0, out_of: outOfs.presentation, reasoning: "Could not evaluate" },
      };
    } else {
      (["introduction","body","conclusion","presentation"] as const).forEach(sec => {
        if (!eval_.section_marks[sec]) {
          eval_.section_marks[sec] = { awarded: 0, out_of: (outOfs as any)[sec], reasoning: "Could not evaluate" };
        } else {
          eval_.section_marks[sec].out_of = (outOfs as any)[sec];
          const raw = eval_.section_marks[sec].awarded;
          const parsed = parseFloat(raw);
          eval_.section_marks[sec].awarded = isNaN(parsed) ? 0 : parsed;
        }
      });
    }

    // Recalculate total from sections if marks missing or zero
    const totalAwarded =
      eval_.section_marks.introduction.awarded +
      eval_.section_marks.body.awarded +
      eval_.section_marks.conclusion.awarded +
      eval_.section_marks.presentation.awarded;
    if (!eval_.marks || eval_.marks === 0) {
      eval_.marks = Math.round(totalAwarded * 10) / 10;
    }
    eval_.marks_out_of = marksNum;

    // ── PASS 3: Rich qualitative feedback ────────────────────────
    const pass3Prompt = `You are a UPSC ${subjectConfig.label} expert examiner. A student has written the following answer.

Question: ${question} (${marks} marks)

Student's answer (transcribed):
${finalTranscript || cotReasoning.slice(0, 800)}

The structured evaluation already concluded:
- Introduction: ${eval_.section_marks?.introduction?.awarded}/${eval_.section_marks?.introduction?.out_of}
- Body: ${eval_.section_marks?.body?.awarded}/${eval_.section_marks?.body?.out_of}
- Conclusion: ${eval_.section_marks?.conclusion?.awarded}/${eval_.section_marks?.conclusion?.out_of}
- Presentation: ${eval_.section_marks?.presentation?.awarded}/${eval_.section_marks?.presentation?.out_of}
- Total: ${eval_.marks}/${eval_.marks_out_of}

${ragContext ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERIFIED BOOK PASSAGES (from uploaded ${subjectConfig.label} texts):
${ragContext}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CRITICAL CITATION RULE — READ BEFORE GENERATING thinkers_to_cite:
You may ONLY cite a ${subjectConfig.thinkerTerm} in the thinkers_to_cite field if:
1. Their name appears in the VERIFIED BOOK PASSAGES above, OR
2. The student cited them in their answer (to give feedback on that citation).

DO NOT invent ${subjectConfig.thinkerTerm} arguments from memory. DO NOT cite ${subjectConfig.thinkerTerm}s not present in the book passages above.
If the book passages contain no ${subjectConfig.thinkerTerm} for this topic, return an empty thinkers_to_cite array — that is honest and correct.
A fabricated citation is worse than no citation — it actively misleads the student.` : `NOTE: No book passages available for this question.
For thinkers_to_cite: you may ONLY suggest thinkers from this verified roster:
${rosterStr}
Only suggest a thinker if you are CERTAIN of their argument for this specific subject (${subjectConfig.label}).
If uncertain, return empty thinkers_to_cite — an honest empty list is better than a fabricated citation.
Do NOT invent arguments. Do NOT cite thinkers outside the roster above.`}

Now write RICH, SPECIFIC qualitative feedback grounded only in the verified book passages above.

Return ONLY a JSON object with these exact fields:
{
  "overall_feedback": "3-4 sentences only. Sentence 1: the one thing the student genuinely got right — quote their exact words. Sentence 2: the single most important gap — name the specific ${subjectConfig.thinkerTerm} and argument that was missing and why it mattered. Sentence 3: one concrete thing to do differently next time — name the exact ${subjectConfig.thinkerTerm}, their exact argument, and where it should appear. No generic advice. NEVER mention marks, numbers, scores, bands, or any suggestion of what score a change would produce.",
  "body": {
    "strengths": ["specific strength 1 referencing exactly what student wrote", "specific strength 2 if any"],
    "weaknesses": ["[missed demand]: exactly what was missed and which ${subjectConfig.thinkerTerm} fills this gap", "[too descriptive]: where student listed facts without arguing — quote the specific part", "[needs ${subjectConfig.thinkerTerm}]: which specific ${subjectConfig.thinkerTerm} with which specific argument was needed here"],
    "suggestions": ["Specific ${subjectConfig.thinkerTerm} name + their exact argument that must appear for THIS question — ONLY from verified book passages", "Specific structural suggestion for THIS answer"]
  },
  "thinkers_to_cite": [
    { "name": "Full Name — ONLY from verified book passages above", "argument": "Their EXACT argument as it appears in the book passage — quote or closely paraphrase" }
  ]
}

Be brutally specific. Name exactly which ${subjectConfig.thinkerTerm}s were missing. Quote exactly which part of the answer was weak. No generic advice like "cite more thinkers" — say WHICH ${subjectConfig.thinkerTerm} and WHAT argument. All citations must come from the verified book passages only.`;

    try {
      const pass3Res = await callWithFallback({
        model: "openai/gpt-oss-120b",
        messages: [
          { role: "system", content: ASSEMBLED_PROMPT },
          { role: "user", content: pass3Prompt },
        ],
        temperature: 0.2,
        max_tokens: 2000,
        response_format: { type: "json_object" },
      });

      if (pass3Res.ok) {
        const pass3Data = await pass3Res.json();
        let pass3Content = pass3Data.choices[0].message.content;
        pass3Content = pass3Content.replace(/```json|```/g, "").trim();
        const pass3 = JSON.parse(pass3Content);

        // Merge Pass 3 rich feedback into evaluation
        if (pass3.overall_feedback) evaluation.overall_feedback = pass3.overall_feedback;
        if (pass3.body) evaluation.body = pass3.body;
        if (pass3.thinkers_to_cite?.length) evaluation.thinkers_to_cite = pass3.thinkers_to_cite;
        debug("Pass 3 feedback merged successfully");

        // ── PASS 4: Rich model answer ─────────────────────────────
        const bulletCount = marks === "10" ? "4-5" : marks === "15" ? "6-8" : "9-12";
        const pass4Prompt = `Write a model answer for this UPSC ${subjectConfig.label} question.

Question: ${question} (${marks} marks)

Return ONLY a JSON object:
{
  "model_answer": {
    "introduction": "2-3 sentences. MUST open with a theoretical/conceptual debate — name at least one ${subjectConfig.thinkerTerm} with their specific thesis. Preview the argument. Never start with a definition.",
    "body": [
      "Bullet 1: Bold theme heading — specific evidence/concept/case — named ${subjectConfig.thinkerTerm} + their exact argument — analytical sentence linking to the question. Minimum 4 sentences.",
      "Bullet 2: same structure",
      "... ${bulletCount} bullets total"
    ],
    "conclusion": "2-3 sentences that: (1) resolve the specific theoretical tension from the intro by name — affirm, qualify or reject a named ${subjectConfig.thinkerTerm}'s position based on the evidence presented in the body, (2) synthesise the 2-3 strongest body threads into one overarching argument, (3) end with a statement of significance tied to THIS question specifically. No new material, no generic summary."
  }
}

CITATION RULES — NON-NEGOTIABLE:
- You may ONLY cite thinkers from this VERIFIED ROSTER for ${subjectConfig.label}:
${rosterStr}

- If RAG passages are available above, you MUST ground arguments in those passages. Quote or closely paraphrase — do NOT invent arguments.
- If no RAG available, cite ONLY thinkers whose core argument you are CERTAIN of for this subject. When in doubt, hedge: "X broadly argues..." — never fabricate specifics.
- DO NOT cite a thinker on a topic outside their known domain (e.g. do not attribute Mead's I-Me distinction to Simmel or Giddens; do not cite Bipan Chandra on ancient India).
- DO NOT invent book titles not listed in the roster above.
- Every bullet MUST name a specific thinker from the roster above WITH their specific argument — "thinkers argue" without a name = not acceptable.
- Every bullet MUST cite specific evidence: concept, work, empirical case, or theoretical framework.
- No bullet under 4 sentences.
- NEVER open with a generic definition. The model answer intro MUST open with a theoretical debate between named thinkers.`;

        try {
          const pass4Res = await callWithFallback({
            model: "openai/gpt-oss-120b",
            messages: [
              { role: "system", content: ASSEMBLED_PROMPT },
              { role: "user", content: pass4Prompt },
            ],
            temperature: 0.3,
            max_tokens: 4500,
            response_format: { type: "json_object" },
          });

          if (pass4Res.ok) {
            const pass4Data = await pass4Res.json();
            let pass4Content = pass4Data.choices[0].message.content;
            pass4Content = pass4Content.replace(/```json|```/g, "").trim();
            const pass4 = JSON.parse(pass4Content);
            if (pass4.model_answer) {
              evaluation.model_answer = pass4.model_answer;
              debug("Pass 4 model answer merged successfully");

              // ── PASS 5: Model answer integrity checker ─────────────
              // Strips wrong attributions, off-roster thinkers, vague claims
              const rosterNames = subjectConfig.thinkerRoster.map(t => t.name);
              const pass5Prompt = `You are a strict UPSC ${subjectConfig.label} fact-checker. Below is a model answer generated for a student. Your job is to audit it and return a corrected version.

SUBJECT: ${subjectConfig.label}
QUESTION: ${question}

VERIFIED THINKER ROSTER (ONLY these thinkers are allowed in the model answer for this subject):
${rosterStr}

MODEL ANSWER TO AUDIT:
${JSON.stringify(evaluation.model_answer, null, 2)}

AUDIT RULES — apply every single one:
1. WRONG ATTRIBUTION: If a thinker is credited with a concept/argument that actually belongs to a DIFFERENT thinker in the roster (e.g. "Simmel's I-Me distinction" when it is Mead's; "Durkheim's Protestant Ethic" when it is Weber's), correct the attribution to the right thinker, or remove the claim entirely.
2. OFF-ROSTER THINKER: If a thinker's name appears in the model answer but is NOT in the roster above, remove that thinker entirely. Rewrite the sentence using a roster thinker with a similar argument, or remove the sentence.
3. VAGUE CLAIM: If a thinker is named but no specific argument, concept, or work is mentioned (e.g. "Weber discusses this topic"), either add their specific known argument from the roster or remove the vague mention.
4. FABRICATED BOOK TITLE: If a book title is cited that is NOT in the roster's known works, remove the title. Keep the thinker name and argument if they are otherwise correct.
5. CROSS-DOMAIN ERROR: If a thinker is cited on a topic outside their known domain (per the roster), remove or reassign.
6. INTRO CHECK: If the introduction opens with a generic definition rather than a theoretical debate between named roster thinkers, rewrite it to open with a debate.

Return ONLY a JSON object with exactly this structure (same structure as the model_answer, corrected):
{
  "model_answer": {
    "introduction": "corrected introduction string",
    "body": ["corrected bullet 1", "corrected bullet 2", "..."],
    "conclusion": "corrected conclusion string"
  },
  "corrections_made": ["brief description of each correction, e.g. 'Removed Simmel as originator of I-Me — corrected to Mead'"]
}

If no corrections are needed, return the original model_answer unchanged with corrections_made as an empty array.`;

              try {
                const pass5Res = await callWithFallback({
                  model: "openai/gpt-oss-120b",
                  messages: [
                    { role: "system", content: ASSEMBLED_PROMPT },
                    { role: "user", content: pass5Prompt },
                  ],
                  temperature: 0.1,
                  max_tokens: 4000,
                  response_format: { type: "json_object" },
                });

                if (pass5Res.ok) {
                  const pass5Data = await pass5Res.json();
                  let pass5Content = pass5Data.choices[0].message.content;
                  pass5Content = pass5Content.replace(/```json|```/g, "").trim();
                  const pass5 = JSON.parse(pass5Content);
                  if (pass5.model_answer) {
                    evaluation.model_answer = pass5.model_answer;
                    if (pass5.corrections_made?.length) {
                      debug("Pass 5 corrections applied:", pass5.corrections_made);
                    } else {
                      debug("Pass 5 audit passed — no corrections needed");
                    }
                  }
                } else {
                  debug("Pass 5 skipped (rate limited) — using unchecked Pass 4 model answer");
                }
              } catch (p5err) {
                debug("Pass 5 error (non-fatal):", p5err);
              }
              // ── END PASS 5 ────────────────────────────────────────
            }
          } else {
            debug("Pass 4 skipped (rate limited) — using Pass 2 model answer");
          }
        } catch (p4err) {
          debug("Pass 4 error (non-fatal):", p4err);
        }
      } else {
        debug("Pass 3 skipped (rate limited or failed) — using Pass 2 feedback");
      }
    } catch (p3err) {
      debug("Pass 3 error (non-fatal):", p3err);
    }

    // Count the call. Anonymous ones are counted too; this was gated on a
    // verified token, so an anonymous caller incremented nothing and the free
    // limit could never actually be reached.
    if (!isOwner && !isPremium) {
      try {
        await recordUsage(identity, "eval_count");
      } catch (incErr) {
        console.error("eval_count increment failed", incErr);
      }
    }

    return NextResponse.json(evaluation);

  } catch (err) {
    console.error("Evaluation error:", err);
    return NextResponse.json({ error: "Failed to evaluate answer. Please try again." }, { status: 500 });
  }
}

