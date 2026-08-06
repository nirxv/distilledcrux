#!/usr/bin/env python3
"""
Patch: app/api/evaluate/route.ts
  1. Pass 4 prompt — inject FULL thinker roster, remove "use full knowledge" free-roam,
     add hard citation rules per subject
  2. Pass 5 — new model answer verification pass that strips wrong attributions,
     off-roster thinkers, and vague claims before the answer reaches the student
"""

import re, sys

TARGET = "app/api/evaluate/route.ts"

with open(TARGET, "r") as f:
    src = f.read()

# ─────────────────────────────────────────────────────────────────────
# PATCH 1: Tighten Pass 4 prompt
#   Old: "- Use your full knowledge of ${subjectConfig.label} from your training"
#   New: strict citation rules + full roster injection
# ─────────────────────────────────────────────────────────────────────

OLD_PASS4_RULES = """RULES:
- Every bullet MUST name a specific modern thinker (${subjectConfig.thinkerRoster.slice(0, 5).map(t => t.name).join(', ')}, etc.) with their specific argument
- Every bullet MUST cite specific evidence: name the concept, work, empirical case, or theoretical framework
- No bullet under 4 sentences. Write as much as needed — do not cut short for word count.
- Use your full knowledge of ${subjectConfig.label} from your training`;"""

NEW_PASS4_RULES = """CITATION RULES — NON-NEGOTIABLE:
- You may ONLY cite thinkers from this VERIFIED ROSTER for ${subjectConfig.label}:
${rosterStr}

- If RAG passages are available above, you MUST ground arguments in those passages. Quote or closely paraphrase — do NOT invent arguments.
- If no RAG available, cite ONLY thinkers whose core argument you are CERTAIN of for this subject. When in doubt, hedge: "X broadly argues..." — never fabricate specifics.
- DO NOT cite a thinker on a topic outside their known domain (e.g. do not attribute Mead's I-Me distinction to Simmel or Giddens; do not cite Bipan Chandra on ancient India).
- DO NOT invent book titles not listed in the roster above.
- Every bullet MUST name a specific thinker from the roster above WITH their specific argument — "thinkers argue" without a name = not acceptable.
- Every bullet MUST cite specific evidence: concept, work, empirical case, or theoretical framework.
- No bullet under 4 sentences.
- NEVER open with a generic definition. The model answer intro MUST open with a theoretical debate between named thinkers.`;"""

if OLD_PASS4_RULES not in src:
    print("ERROR: Pass 4 old rules block not found — check string match")
    sys.exit(1)

src = src.replace(OLD_PASS4_RULES, NEW_PASS4_RULES)
print("✓ Pass 4 prompt tightened")

# ─────────────────────────────────────────────────────────────────────
# PATCH 2: Inject Pass 5 (model answer checker) after Pass 4 success block
#   Insert after: `console.log("Pass 4 model answer merged successfully");`
#   Before: `} else {`
# ─────────────────────────────────────────────────────────────────────

PASS4_MERGE_MARKER = '''if (pass4.model_answer) {
              evaluation.model_answer = pass4.model_answer;
              console.log("Pass 4 model answer merged successfully");
            }'''

PASS5_BLOCK = '''if (pass4.model_answer) {
              evaluation.model_answer = pass4.model_answer;
              console.log("Pass 4 model answer merged successfully");

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
                      console.log("Pass 5 corrections applied:", pass5.corrections_made);
                    } else {
                      console.log("Pass 5 audit passed — no corrections needed");
                    }
                  }
                } else {
                  console.log("Pass 5 skipped (rate limited) — using unchecked Pass 4 model answer");
                }
              } catch (p5err) {
                console.log("Pass 5 error (non-fatal):", p5err);
              }
              // ── END PASS 5 ────────────────────────────────────────
            }'''

if PASS4_MERGE_MARKER not in src:
    print("ERROR: Pass 4 merge marker not found — check string match")
    sys.exit(1)

src = src.replace(PASS4_MERGE_MARKER, PASS5_BLOCK)
print("✓ Pass 5 model answer integrity checker injected")

# ─────────────────────────────────────────────────────────────────────
# PATCH 3: Also harden thinkers_to_cite in Pass 3 when RAG is absent
#   Currently Pass 3 when no RAG says "return empty thinkers_to_cite array"
#   but still often hallucinates. Add roster constraint even for no-RAG case.
# ─────────────────────────────────────────────────────────────────────

OLD_NO_RAG_NOTE = '''NOTE: No book passages available for this question. Return empty thinkers_to_cite array. Do not invent ${subjectConfig.thinkerTerm} arguments from memory.`}'''

NEW_NO_RAG_NOTE = '''NOTE: No book passages available for this question.
For thinkers_to_cite: you may ONLY suggest thinkers from this verified roster:
${rosterStr}
Only suggest a thinker if you are CERTAIN of their argument for this specific subject (${subjectConfig.label}).
If uncertain, return empty thinkers_to_cite — an honest empty list is better than a fabricated citation.
Do NOT invent arguments. Do NOT cite thinkers outside the roster above.`}'''

if OLD_NO_RAG_NOTE not in src:
    print("ERROR: Pass 3 no-RAG note not found — check string match")
    sys.exit(1)

src = src.replace(OLD_NO_RAG_NOTE, NEW_NO_RAG_NOTE)
print("✓ Pass 3 thinkers_to_cite hardened for no-RAG subjects")

# ─────────────────────────────────────────────────────────────────────
# Write patched file
# ─────────────────────────────────────────────────────────────────────

with open(TARGET, "w") as f:
    f.write(src)

print("\n✅ All patches applied to", TARGET)
print("   Review with: git diff app/api/evaluate/route.ts")
