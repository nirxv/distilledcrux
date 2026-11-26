# Making Distilled Crux fully Hindi, the way History Optional is

Status: plan, not started
Owner: —
Last updated: 26 November 2026

This is the working plan for taking distilledcrux.com to full Hindi parity with
historyoptional.xyz: every page, every note, every past question, every
flashcard and every AI reply available in Hindi, switched with one control,
with English staying the canonical language underneath.

---

## 1. What "as history-optional" actually means

History Optional's Hindi is not a `/hi` site. It is one site with a switch:

| Piece | How history-optional does it | Evidence in that repo |
|---|---|---|
| The switch | `LangProvider` in `lib/i18n/LangContext.tsx`, `langHi` in React context, saved as `localStorage.lang`, `document.documentElement.lang` set to `hi` | 39-line provider |
| UI words | English and Hindi written side by side in the component, `langHi ? 'हिन्दी' : 'English'`; a small shared map in `lib/i18n/ui.ts` for the navbar | ~706 `langHi` uses across 74 files |
| Notes list | `lib/notesHi.ts` — title, description, subtopics, section names, keyed by the English slug | 95 lines |
| Note bodies | `lib/noteContentHi.ts` — full HTML per slug, generated once by a script, **served per note by `/api/note-content?slug&lang=hi`** | 34,879 lines, 6.6 MB, not in the client bundle |
| PYQ bank | `lib/pyqDataHi.ts` + `/api/pyq-hi`, fetched once per visit when Hindi is on | 573 KB |
| Prelims bank | `lib/prelimsDataHi.ts` + `/api/prelims-hi` | 536 KB |
| Flashcards | `front_hi` / `back_hi` columns in Supabase, fallback to English rows | `lib/flashcardStore.ts` |
| Topper copy questions | `lib/topperQuestionsHi.ts`, keyed by normalised question text; a copy that matches a PYQ reuses the PYQ's official Hindi | 589 lines |
| AI chat | Same English books and passages; a system suffix forces a Hindi answer; **citations stay `[Source #N]` in ASCII**; Hindi runs on Haiku because DeepSeek's Hindi was weaker | `app/api/chat/route.ts` |
| Answer evaluation | If the transcript is mostly Devanagari, the JSON output is forced to Hindi regardless of UI language | `app/api/evaluate/route.ts` |
| Handwriting OCR | Pixtral first; mostly-Devanagari pages are re-read with Mistral OCR | `lib/hindiReader.ts` (already ported here) |
| PDFs | Noto Sans covers Devanagari, plus a fontkit patch that fixes Devanagari word-breaking | `app/api/generate-pdf/parts.tsx` |
| Legal pages | English only; Hindi mode still shows English | `privacy/terms/refund` |
| URLs / SEO | No Hindi URLs, no hreflang; canonical stays English | sitemap and metadata are English-only |

Distilled Crux is a fork of the same codebase, so most of this ports directly.
It also already contains the Hindi half of three AI surfaces (see §2.5).

---

## 2. Audit: where distilledcrux stands today

Measured on this checkout (26 Nov 2026).

### 2.1 Content volume

| Surface | Count | Size | Notes |
|---|---|---|---|
| Optionals | 5 | — | Sociology, Anthropology, PSIR, Geography, Public Administration |
| Notes | **163** | **7.48 M chars** of HTML | soc 30, anthro 41, polsci 40, geo 26, pub-admin 26 |
| Note metadata | 163 | 90 KB | titles, descriptions, subtopics, section names |
| PYQs | **4,732** | ~1.2 M chars | years 1981–2026 (subject-dependent); 4,722 unique texts |
| Topper copies | **12,867** | images/PDFs (not translated) | metadata 6.9 MB; **6,945 unique questions**, 6,797 of which are not a PYQ |
| Flashcards | **1,500** | Supabase `flashcards` table | soc 334, anthro 296, psir 295, geo 273, pub-admin 302 |
| Geography map questions | 140 | 48 KB | 2013–2026 map Q1(a) + 12 categories |
| Daily questions | derived | — | picks 5 PYQs per optional per IST day |
| UI copy | ~**2,400 strings** | ~120 files | navbar, pages, components (see appendix) |

### 2.2 What is already Hindi-aware

| File | What exists |
|---|---|
| `app/(frontend)/chat/page.tsx` | `langHi` read from `?lang=hi`; chat chrome, tips, sources panel, follow-ups, PDF button, thinking steps all bilingual |
| `lib/chatStart.ts` | Start-flow labels, goals, "what thinkers argue" in both languages |
| `lib/chatSuggestions.ts` | 18 English + 10–18 Hindi prompts per subject, all five subjects |
| `app/api/chat/route.ts` | `lang` parameter, Hindi output instruction, citation rule |
| `app/api/evaluate/route.ts` | `writtenInHindi()` → forces the whole JSON verdict into Hindi |
| `lib/hindiReader.ts` | Mistral OCR re-read for Devanagari handwriting |
| `lib/textSpacing.ts` | Handles the Devanagari danda `।` |
| `lib/plans.ts` | One offer name in Hindi (`nameHi`) |
| `components/ui/Toast.tsx` | `toastSignInError(err, langHi)` |

### 2.3 What is missing

1. **No global language state.** The only path into Hindi is typing `?lang=hi`
   on `/chat`. There is no switch anywhere in the UI, so today Hindi is
   effectively unreachable.
2. **No Hindi content of any kind.** Notes, PYQs, flashcards, map data, topper
   questions are English only.
3. **No serving path for Hindi content.** Note HTML is imported server-side and
   passed into the reader; adding a second 7 MB corpus naively doubles the
   payload.
4. **RAG retrieval is English-only by construction.**
   `lib/rag/sparse.ts` strips every non-ASCII character, so a Hindi query
   produces zero BM25 terms; `lib/rag/plan.ts` matches English exam directives.
5. **PDF route has no Devanagari fix.** History Optional's fontkit word-break
   patch (`fix_pdf_fonts_all.patch`) was not ported.
6. **No Devanagari web font.** Inter + Neue Haas Grotesk only; Hindi falls back
   to whatever the device has.
7. **No Devanagari UI typography rules.** Global `letter-spacing`, uppercase
   transforms and line heights are tuned for Latin.
8. **No translation pipeline, glossary, coverage check or CI gate.**
9. **Legal pages, sitemap and metadata are English-only** (same as history
   optional, so this is parity, not a gap — but it will be a conscious call in
   §4).

### 2.4 Serving model today

```
app/(frontend)/notes/[subject]/[slug]/page.tsx   (server)
   └─ note_overrides (Supabase)  OR  lib/noteContent/<subject>.ts   ← English HTML
        └─ <NoteReader initialContent=… />        (client, renders immediately)

app/api/chat/route.ts  →  prompts + lib/rag retrieval  →  deepseek / haiku
```

Two consequences for the plan: notes are **pre-rendered per page**, and the
large corpora are **already modular per subject** (`lib/noteContent/index.ts`),
so a Hindi twin can follow the same lazy shape instead of one giant file.

### 2.5 AI surfaces today

* Chat: Hindi output possible, unreachable, grounded in English books.
* Evaluate: Hindi output works when the answer is in Hindi; UI labels and PDF
  are English.
* Model answer (`/api/model-answer`): English only.
* Daily questions: English question text, no Hindi join.
* Topper questions: English only.

---

## 3. Decisions to lock before any code

These five choices change the shape of the work. Recommended answers included.

| # | Decision | Recommendation | Why |
|---|---|---|---|
| D1 | **How the switch works** | Client switch + `localStorage.lang`, exactly like history optional, **plus a `dc-lang` cookie** written by the switch | Parity keeps the diff small; the cookie lets the note page server-render Hindi on the first paint instead of English → blank → Hindi |
| D2 | **Hindi URLs?** | **No** for v1 (parity). Revisit after launch | `/hi/...` doubles the sitemap, adds hreflang and cache work; history optional proves a toggle-only model works |
| D3 | **Official UPSC Hindi for PYQs?** | **Yes** wherever the paper prints Hindi (2013 → 2026 for most optionals) | Better than any translation, legally public, and removes ~40% of the PYQ job |
| D4 | **Devanagari webfont?** | Self-host **Noto Sans Devanagari, subset, 400/700**, used only under `[lang="hi"]` | Predictable rendering on old Android; ~60–80 KB, zero cost to English visits if loaded on demand |
| D5 | **Legal pages** | English only + one Hindi line saying the English text governs | Parity; avoids legal review of three translations and meaning drift |
| D6 | **Topper copy questions** | Translate the 6,797 unique questions, reuse PYQ Hindi where identical | Matches history optional; without it the topper pages stay half-English |

Glossary rules to lock with the translators (same as history optional):

* Standard Hindi, Devanagari, nukta where correct (फ़, ज़, क़).
* Proper nouns: Hindi transliteration first, English in brackets on first use —
  `दुर्खीम (Durkheim)`.
* Keep numbers, years, marks and citation markers in Western digits.
* Technical terms stay recognisable: `संस्कृतीकरण (Sanskritisation)`.
* One shared glossary across all five subjects, because Marx, Weber, the State,
  civil services and globalisation appear in more than one optional.

---

## 4. Target architecture

```
                    ┌──────────────────────────────────────────┐
                    │ LangProvider (lib/i18n/LangContext.tsx)   │
                    │  langHi · toggleLang · localStorage.lang  │
                    │  document.documentElement.lang · dc-lang  │
                    └───────────────┬──────────────────────────┘
                                    │
  UI copy ─────────────── inline L(en, hi) + lib/i18n/ui.ts
                                    │
  ┌─────────────────────────────────┼──────────────────────────────────┐
  │                                 │                                  │
  Note page (server)          PYQ browser (client)               Flashcards (client)
  reads dc-lang cookie        fetches /api/pyq-hi?subject        asks ?lang=hi
  → Hindi HTML first paint    → questions, topics, syllabus      → front_hi/back_hi
  → NoteReader fetches        (static, edge-cached 24h)          (Supabase columns)
    /api/note-content
    ?subject&slug&lang=hi
```

### 4.1 New files (proposed)

```
lib/i18n/LangContext.tsx          provider, cookie + localStorage, no flash
lib/i18n/ui.ts                    shared chrome strings (nav, buttons, states)
lib/i18n/L.ts                     const L = (langHi, en, hi) => langHi ? hi : en

lib/notesHi/<subject>.ts          5 files: note titles/descriptions/subtopics
lib/noteContentHi/<subject>.ts    5 files: note HTML (generated, 7–9 MB total)
lib/noteContentHi/index.ts        same lazy loader shape as lib/noteContent

lib/pyqHi/<subject>.ts            5 files: question text + topic/subtopic labels
lib/topperQuestionsHi.ts          normalised question → Hindi
lib/geoMapHi.ts                   place names, categories, notes

app/api/note-content/route.ts     ?subject&slug&lang=en|hi  (CDN cached)
app/api/pyq-hi/route.ts           ?subject                   (static, CDN cached)
app/api/geo-map-hi/route.ts       map labels                 (static)

supabase/migrations/011_flashcards_hindi.sql

scripts/i18n/scan.py              inventory: every translatable string + hash
scripts/i18n/translate.py         resumable, chunked, glossary-constrained
scripts/i18n/assemble.mjs         JSON/TS output, key order, escaping
scripts/i18n/validate.mjs         HTML parity, Devanagari ratio, leftovers
scripts/i18n/coverage.mjs         % per surface, used by build/CI
scripts/i18n/glossary.json        term → Hindi, per subject + shared
docs/HINDI-TRANSLATION-PLAN.md    this file
```

### 4.2 Principles

1. **English is the key.** Slugs, PYQ ids, `questionKey`, card ids, route slugs
   and progress keys never change. Hindi is a view of the same data.
2. **Hindi never ships to an English reader.** Separate modules, separate API
   responses, fetched only when the switch is on.
3. **Generated files are generated.** Each Hindi content file starts with
   `AUTO-GENERATED by scripts/i18n/…` and a CI check refuses hand edits.
4. **No mixed language.** A Hindi page shows no English sentence outside the
   allowlist (proper nouns, book titles, topper names, citation markers,
   "English" as a language label).
5. **The switch is one control, everywhere.** Navbar on desktop, bottom sheet
   on mobile, footer link, and remembered across tabs.

---

## 5. Work plan

Estimates assume one developer familiar with the codebase and a translation
track running in parallel. Calendar: **7–8 weeks**; hands-on dev: **~5 weeks**.

### Phase 0 — Freeze, inventory, decisions (2 days)

- Lock D1–D6 in §3.
- Freeze English UI copy for the duration (no copy PRs while translating).
- Run `scripts/i18n/scan.py`; produce `translation-inventory.json`: file, line,
  English string, hash, context, area, owner.
- Build `glossary.json` with ~250 shared terms + 5 subject sections, reviewed by
  one Hindi-medium mentor per subject (5 × 1 hour).
- Draft the translator prompt (adapted from history optional's `translate_all.py`)
  and run a 3-note blind pilot per subject.

Exit: inventory exists and is reviewed; glossary v1 signed off; pilot output
passes the validator on 10 notes.

### Phase 1 — Language plumbing (3 days)

- `LangContext`: state, `localStorage`, `dc-lang` cookie (1 year, `SameSite=Lax`),
  `document.documentElement.lang`, cross-tab sync via `storage` event.
- Provider in `app/(frontend)/layout.tsx` inside `AuthProvider`, above `Navbar`.
- Extend the existing `<head>` script (which already restores the theme) to also
  set `lang`/`data-lang` before paint → no flash, no hydration warning.
- Navbar switch `EN | हिं`; mobile bottom-sheet entry; `aria-label` both ways.
- `lib/i18n/ui.ts` + `L()` helper; convert `Toaster`, `OwlLoader`, `ConfirmDialog`
  first as the proving ground.
- Devanagari CSS: `:lang(hi)` rules — `letter-spacing: normal`, no uppercase,
  reader `line-height: 1.75`, slightly larger base on mobile, `font-family`
  falls back to Noto Sans Devanagari.
- Font: add `@fontsource/noto-sans-devanagari` (400/700, subset) loaded with
  `next/font/local` or the fontsource CSS behind `:lang(hi)`; verify with
  `font-check`-style script.

Exit: switching language changes chrome copy, persists across reloads and tabs,
sets `<html lang>`, and costs English readers 0 bytes of Hindi font/content.

### Phase 2 — UI translation (8–10 days)

Work in PR-sized batches, one area at a time, each with its own screenshot diff.

| Batch | Files (approx.) | Strings |
|---|---|---|
| 1. Chrome | Navbar, Footer, BottomNav, CommandPalette, Toaster, ConfirmDialog, OwlLoader, 404 | ~180 |
| 2. Home + auth | `app/page.tsx`, `components/home/*`, login, onboarding, AuthGuard | ~320 |
| 3. Notes | NotesBrowser, NoteReader, ContinueNotes, SidebarNotes | ~260 |
| 4. PYQs | PyqBrowser, PyqDetail, compare, AttemptedRing, resume | ~240 |
| 5. Evaluate | upload, progress, results, share prompt, PDF button | ~280 |
| 6. Chat | remaining chrome outside the already-bilingual parts | ~120 |
| 7. Flashcards | deck, review, reveal, limits, upsell | ~150 |
| 8. Topper copies | list, detail, compare, pass/paywall | ~200 |
| 9. Dashboard + profile | progress, streaks, settings, optional switch | ~240 |
| 10. Pricing + payments | plans, offer copy, checkout states, success/failure | ~180 |
| 11. Invite/referral + share | invite page, share view, copy, WhatsApp text | ~140 |
| 12. Test (mock) | config, timer, upload, results | ~190 |
| 13. Geography mapping | map UI, categories, legend, quiz | ~120 |
| 14. Misc | contact, legal notice line, error/empty/loading states | ~80 |

Rules: `aria-label`, `title`, `placeholder`, empty states, toasts, validation
errors and `<option>` labels all count as copy. Any string containing a number
keeps Western digits. English copy stays in the source, never replaced.

Exit: `coverage.mjs --area ui` reports 100%; a scripted crawl in Hindi mode
finds zero English sentences outside the allowlist.

### Phase 3 — Content translation (3 weeks, parallel with Phase 2)

#### 3.1 Notes (163 notes, 7.48 M chars)

* Split per subject; split each note at ~24,000 chars on tag boundaries.
* Prompt: translate only text nodes; preserve every tag, attribute, `id`,
  bullet character and blockquote; do not summarise; keep `[Source #N]`,
  numbers, dates, formulas; glossary enforced.
* Output `lib/noteContentHi/<subject>.ts`, same slug keys, same order.
* Resume from `translation-progress.json`; 3 retries with backoff; reject any
  chunk whose tag inventory differs from the source and re-ask.
* Cost: ~1.9 M input tokens, ~4.5–5 M Hindi output tokens → **$80–120** on a
  Sonnet-class model, **$25–40** on a cheaper one.
* Time: 20–30 h of machine time (parallelisable 8×), plus 20–25 h of human
  spot-checks: 100% of each subject's first three notes, 20% random sample of
  the rest, every heading in every note.

#### 3.2 Note metadata (163 × title/description/subtopics + section names)

One pass, ~90 KB, output `lib/notesHi/*.ts`. This is also the source for PYQ
`Paper I, 20. Akbar`-style syllabus labels (see `pyq-hi` route pattern).

#### 3.3 PYQs (4,732 questions)

Two sources, in this order:

1. **Official UPSC Hindi papers** (2013 → 2026 where printed): fetch PDFs from
   upsc.gov.in, extract, align each Hindi question to its English id by year,
   paper, question number and marks. This is an extraction/alignment job, not a
   translation job — budget 2–3 days and expect ~40% coverage.
2. **Translate the remainder** (~2,800 questions, including pre-2013): glossary
   constrained, UPSC Hindi register ("चर्चा कीजिए", "समालोचनात्मक परीक्षण कीजिए",
   "टिप्पणी कीजिए"). Cost ~$12–18. Output `lib/pyqHi/<subject>.ts`.
3. Topic, subtopic and microtheme labels: ~150 strings, one pass.

Quality gate: every Hindi question must carry the same directive as the English
one (`Discuss` → `चर्चा कीजिए`, `Critically examine` → `समालोचनात्मक परीक्षण
कीजिए`, `Comment` → `टिप्पणी कीजिए`); a reviewer checks 500 random pairs.

#### 3.4 Topper copy questions (6,797 unique)

Deduplicate by normalised question text (`questionKey`). Translate once, store
in `lib/topperQuestionsHi.ts`. Copies whose question matches a PYQ word for word
reuse the PYQ's Hindi. Cost ~$20–25.

#### 3.5 Flashcards (1,500)

* Migration `011_flashcards_hindi.sql`: `front_hi text`, `back_hi text`.
* Translate from the source decks in `~/Desktop/dc-design/flashcards-*`, write
  into the columns (script upserts, ids unchanged).
* `flashcardStore.ts`: include `front_hi` in `FRONT_COLUMNS`; reveal returns
  `back_hi` when `lang=hi`, falling back to English per card.
* Cost ~$10–15.

#### 3.6 Geography map data

`lib/geoMapHi.ts`: 140 place names (transliteration + English), 12 categories,
note lines, years unchanged. ~$2.

#### 3.7 Validator (build-blocking)

For every generated file: tag inventory parity, no untranslated English
paragraphs (allowlist), Devanagari ratio > 0.85 for prose (excluding numbers,
URLs, book titles), balanced quotes/danda, no duplicated or dropped `<li>`,
same key set as English. Wire into `npm run build` next to `design-lint`.

Exit: 163/163 notes, 4,732/4,732 PYQs, 1,500/1,500 cards, ≥99% topper
questions, 140/140 map entries; validator green.

### Phase 4 — Serving Hindi content (3–4 days)

* `GET /api/note-content?subject=&slug=&lang=`:
  - `lang=hi` → `lib/noteContentHi` lazy import, one note per request;
  - `lang=en` → `note_overrides` first, then `lib/noteContent` (today's logic);
  - `Cache-Control: public, s-maxage=86400, stale-while-revalidate=604800`;
  - slug/subject shape validated like history optional's route.
* Note page: if `dc-lang=hi` cookie is present, render Hindi HTML server-side;
  otherwise render English, and `NoteReader` fetches Hindi on switch (showing a
  skeleton, never stale English prose).
* `GET /api/pyq-hi?subject=` returns `{ q, topics, subtopics, syllabus }`,
  `force-static`, 24 h edge cache; `lib/pyqHi.ts` client hook loads once per
  visit (pattern copied from history optional).
* Flashcards: `?lang=hi` on list + reveal; the answer allowance logic is
  language-independent.
* Bundle guard: assert English route JS change < 5%; Hindi-note payload ≤
  1.2× the English one; add a size check to CI.

Exit: Hindi note opens with Hindi text on first paint; no Hindi corpus in any
English page's JS; Lighthouse mobile within 5 points of English.

### Phase 5 — Hindi AI quality (4–6 days)

1. **Wire `lang` through the app** instead of `?lang=hi`: chat, evaluate, model
   answer, daily questions, PDF, share card inherit context.
2. **Retrieval** (the real work):
   - Detect Devanagari in the question.
   - Translate the query to exam-English with the cheap model once, cache by
     hash (Redis/table), then run `plan.ts` + `sparse.ts` + rerank in English.
   - Optionally append transliterated names (`सांस्कृतीकरण` → "sanskritisation")
     to the sparse query.
   - Measure recall on 100 Hindi queries per subject against the English
     equivalent; target ≥ 90% of English hit rate and ≥ 0.35 rerank scores.
3. **Model routing:** Hindi chat, mentor mode and model answers on a
   Hindi-strong model (Haiku-class or Gemini Flash), as history optional does;
   keep DeepSeek for English. A/B on 50 questions with 2 reviewers.
4. **Prompts:** extend the Hindi suffix to model-answer, daily-question
   explanation and share copy; keep citation markers strictly `[Source #N]`.
5. **Evaluation:** Hindi UI labels; question extraction from Devanagari
   transcripts; verdict and section names in Hindi; marks/dates Western digits.
6. **PDF:** port `fix_pdf_fonts_all.patch` (fontkit code-point word breaking),
   Hindi labels (`प्रश्न`, `आदर्श उत्तर`, `अंक`), check conjuncts and matras in a
   real PDF (क्, त्र, ज्ञ, र्म), keep Noto Sans.
7. **Handwriting:** verify `hindiReader.ts` on 20 Hindi answer sheets across
   subjects; keep the Pixtral → Mistral fallback threshold.

Exit: 50-question Hindi chat eval (5 subjects × 10) with no English sentences,
citations resolving, ≥ 90% retrieval parity; Hindi evaluation PDF renders
correctly; model answers in Hindi.

### Phase 6 — SEO, metadata, legal (2 days)

* Keep canonical English URLs; `<html lang>` follows the switch; note JSON-LD
  `inLanguage: 'en-IN'` for English pages, `hi-IN` when the cookie says Hindi.
* Sitemap unchanged (English only), matching history optional.
* Add one Hindi line on the three legal pages: "यह पृष्ठ अंग्रेज़ी में है; कानूनी
  रूप से अंग्रेज़ी पाठ ही मान्य है।"
* Confirm `og:`/Twitter cards stay English (they are shared into mixed feeds).
* Analytics event `lang_switch` with `{from, to, page}`; no PII.

Exit: no duplicate-content warnings, Search Console unchanged, legal pages
honest in Hindi mode.

### Phase 7 — QA and rollout (5 days)

**Test matrix:** 5 optionals × 9 flows (home, notes list, note, PYQs, evaluate
upload → result → PDF, chat, flashcards, topper copy, pricing) × 2 languages ×
{mobile 360 px, tablet, desktop} × {fast, 3G}. Plus: sign-in error, paywall,
expired subscription, 404, offline/refresh-safe restore.

**Checks:**
- Script crawl in Hindi mode: no English sentence outside allowlist.
- Devanagari rendering on: Chrome Android 8, Safari iOS 15, Firefox, low-end
  Android with only system fonts.
- Screen reader: `<html lang="hi">`, Hindi `aria-label`s, headings.
- Copy review by subject: 1 mentor per optional, 2 h each.
- Performance: English unchanged; Hindi note ≤ +20% payload; no font on English.
- Regression: `npm test` + translation validator + a new
  `tests/i18n.test.mts` (coverage, tag parity, key sets).

**Rollout:** internal account → 25 Hindi-medium beta readers (invite list) →
everyone with the switch in the navbar. Keep `HINDI_UI=off` env kill switch that
hides the toggle. Feedback link in the footer: "अनुवाद में गड़बड़ी? बताइए" →
Supabase `translation_reports` table (id, page, text, note, created_at).

Exit: two weeks of reports with no severity-1 mistranslation; support load
flat; Hindi users completing evaluation flows at parity with English.

---

## 6. Cost and time summary

| Item | Machine cost | Human time |
|---|---|---|
| Notes (7.48 M chars) | $80–120 (Sonnet-class) / $25–40 (cheap) | 25 h review |
| PYQ official extraction | ~$0 (OCR if needed) | 16–24 h |
| PYQ translation (~2,800) | $12–18 | 12 h spot-check |
| Topper questions (6,797) | $20–25 | 6 h |
| Flashcards (1,500) | $10–15 | 4 h |
| Map + UI strings | $5–8 | 10 h |
| Glossary + terminology | — | 10 h |
| **Total translation** | **$130–185** (≈$50 with a cheap model) | **~85 h** |

| Phase | Dev days |
|---|---|
| 0 Inventory & decisions | 2 |
| 1 Plumbing | 3 |
| 2 UI | 9 |
| 3 Content (pipeline + QA) | 12 (runs in parallel) |
| 4 Serving | 4 |
| 5 AI | 5 |
| 6 SEO/legal | 2 |
| 7 QA/rollout | 5 |
| **Total** | **~42 dev days, 7–8 calendar weeks** |

---

## 7. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Hindi output is 2–3× the tokens of English; costs spiral on re-translation | Budget | Translate once per content hash; store hash in generated file header; validator refuses to regenerate unchanged notes |
| Retrieval degrades in Hindi (sparse tokenizer is ASCII-only, plan matches English cues) | Weak Hindi answers | Query→English bridge, measured on 500 queries before launch; fall back to dense-only if needed |
| Devanagari word-breaking in PDFs | Broken exam-style PDFs | Port the fontkit patch; render a fixed sample set (क्, त्र, ज्ञ, र्म, हिन्दी) in CI |
| Font fallback inconsistency on old Android | Ugly notes | Self-hosted Noto Sans Devanagari subset, `font-display: swap`, CSS fallback chain |
| Mixed-language leaks as new features ship | Credibility | Build-blocking coverage check; every new string must add a Hindi twin in the same PR |
| Translation drift across subjects (Marx spelt two ways) | Looks careless | One shared glossary; validator enforces it for the 250 core terms |
| `note_overrides` (admin English edits) diverge from Hindi | Stale Hindi | Overrides English-only, as history optional; mark the Hindi note "अंग्रेज़ी संस्करण नया है" when an override is newer, and regenerate in the next batch |
| Hindi display of topper names / test-series names | Minor | Keep proper nouns in Latin script inside Hindi sentences |
| Legal meaning drift | Risk | English governs; explicit Hindi notice |
| Toggle-only model hides Hindi from search | Growth | Accepted for v1; revisit `/hi` + hreflang once content is stable |
| Razorpay checkout UI is English | Cosmetic | Hindi plan copy around an English payment sheet; note it in the Hindi FAQ |

---

## 8. Definition of done

- [ ] Switch in navbar, mobile sheet and footer; persists; sets `<html lang>`;
      no flash on reload; reachable on every page.
- [ ] UI coverage 100% (`coverage.mjs --area ui`), allowlist-only English.
- [ ] 163/163 notes with Hindi bodies served per note, never bundled.
- [ ] 4,732/4,732 PYQs in Hindi (official where printed), plus topic labels.
- [ ] 1,500/1,500 flashcards with `front_hi`/`back_hi`, English fallback.
- [ ] ≥ 99% of 6,945 topper questions in Hindi; PYQ matches reuse official text.
- [ ] Hindi chat answers entirely in Hindi, cites `[Source #N]`, retrieval within
      10% of English.
- [ ] Hindi evaluation: verdict, labels and PDF all correct; handwriting OCR
      verified on 20 sheets.
- [ ] Model answers and daily-question explanations in Hindi.
- [ ] Build fails on missing/invalid translation; `tests/i18n.test.mts` green.
- [ ] English performance and SEO unchanged; legal notice shipped.
- [ ] Feedback loop live; first post-launch fix batch shipped.

---

## Appendix A — UI inventory (top files by translatable string count)

Counted 26 Nov 2026, excluding `.kilo` worktrees and node_modules. "Strings" is
prose-like JSX text and literals of 10+ characters with two or more words.

| File | Strings |
|---|---|
| `app/(frontend)/chat/page.tsx` | 131 (partly done) |
| `app/(frontend)/test/page.tsx` | 92 |
| `components/home/HomeShowcase.tsx` | 86 |
| `app/(frontend)/pricing/page.tsx` | 61 |
| `app/(frontend)/notes/[subject]/[slug]/NoteReader.tsx` | 68 |
| `app/(frontend)/geography/mapping/page.tsx` | 66 |
| `app/(frontend)/prelims/page.tsx` | 72 (feature-flagged off) |
| `app/(frontend)/dashboard/page.tsx` | 52 |
| `app/api/evaluate/route.ts` | 74 (AI-facing) |
| `lib/pyqs.ts` | 74 (labels/topics) |
| `lib/geoMapData.ts` | 256 (data) |
| `lib/notes/*.ts` | 862 (metadata) |
| `lib/subjectConfig.ts` + `lib/subjects/*` | ~400 (prompts, partly user-facing) |

A machine-readable inventory is produced in Phase 0 by `scripts/i18n/scan.py`.

## Appendix B — Starting glossary (extract)

| English | Hindi | Note |
|---|---|---|
| Sociology | समाजशास्त्र | subject label |
| Anthropology | मानवशास्त्र | subject label |
| Political Science & IR (PSIR) | राजनीति विज्ञान एवं अंतर्राष्ट्रीय संबंध | subject label |
| Geography | भूगोल | subject label |
| Public Administration | लोक प्रशासन | subject label |
| social fact | सामाजिक तथ्य | Durkheim |
| anomie | अनोमी (एनोमी) | keep both spellings once, then अनोमी |
| ideal type | आदर्श प्रारूप | Weber |
| historical materialism | ऐतिहासिक भौतिकवाद | Marx |
| Sanskritisation | संस्कृतीकरण | Srinivas |
| bureaucracy | नौकरशाही | Weber / Pub-Admin |
| New Public Management | नव लोक प्रबंधन (NPM) | Pub-Admin |
| federalism | संघवाद | PSIR |
| sovereignty | संप्रभुता | PSIR |
| ethnography | नृवंशविचार / एथ्नोग्राफ़ी | Anthropology |
| participant observation | सहभागी अवलोकन | Anthropology |
| monsoons | मानसून | Geography |
| geomorphology | भू-आकृतिकी | Geography |
| Discuss | चर्चा कीजिए | directive |
| Critically examine | समालोचनात्मक परीक्षण कीजिए | directive |
| Comment | टिप्पणी कीजिए | directive |
| Elucidate | स्पष्ट कीजिए | directive |
| Evaluate | मूल्यांकन कीजिए | directive |

## Appendix C — Reference files in history-optional

| Need | Read this in `~/Desktop/history-optional` |
|---|---|
| Provider | `lib/i18n/LangContext.tsx` |
| Shared strings | `lib/i18n/ui.ts` |
| Bilingual server text | `components/ui/HiText.tsx` |
| Note bodies served per request | `app/api/note-content/route.ts` |
| PYQ Hindi serving | `app/api/pyq-hi/route.ts`, `lib/pyqHi.ts` |
| Note metadata | `lib/notesHi.ts` |
| Translation script | `translate_all.py` |
| Topper question map | `lib/topperQuestionsHi.ts` |
| Flashcard columns | `lib/flashcardStore.ts` |
| Hindi chat routing | `app/api/chat/route.ts` (lines ~242–380) |
| Hindi evaluation output | `app/api/evaluate/route.ts` (`outLang`) |
| Devanagari PDF fix | `app/api/generate-pdf/parts.tsx` + `fix_pdf_fonts_all.patch` |
| Original port of OCR | `lib/hindiReader.ts` (already here) |

---

## Status — completed

| Surface | Result |
|---|---|
| Notes | 161/161 bodies, 7.37M chars, each passing tag/Devanagari/e leftover-English checks |
| Note catalogue | 163 titles, descriptions, subtopics, section names |
| PYQs | 4,732/4,732 questions |
| PYQ labels | 480/480 topic + microtheme labels |
| Flashcards | 1,500/1,500 cards (front + back) |
| UI | every page/component surface, shared chrome, legal notice |
| AI | chat, evaluation, model answers, daily practice, PDF — Hindi behaviour identical to history-optional, wording subject-neutral |

Serving and safeguards:
- `/api/note-content` per note, edge-cached; Hindi corpus server-only.
- `/api/pyq-hi/<subject>` five static bodies, no runtime function.
- Flashcards carry `front_hi`/`back_hi`; English responses never include them.
- `scripts/i18n/guard.mjs` fails the build if a client file imports a corpus.
- `npm run hindi:coverage`, `hindi:pyq`, `hindi:assemble` for maintenance.

Operational step (done): `supabase/migrations/011_flashcards_hindi.sql` applied,
then `node --env-file=.env.local scripts/seed-flashcards-hi.mjs --write`.
Verified: 1,500 rows with both `front_hi` and `back_hi`.
