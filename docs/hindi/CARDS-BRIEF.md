# Hindi translation brief — flashcards

Translate flashcard fronts and answers for UPSC optionals. A student reads the
front and recalls the answer, so the Hindi must be as self-contained as the
English.

Repo root: `/Users/nirxv_03/Desktop/distilledcrux`

## Input / output

Input: `scripts/i18n/work/cards/en/<subject>-<offset>-<count>.json` —
`[{ id, front, back }]`.

Output: `scripts/i18n/work/cards/hi/<subject>-<offset>-<count>.json`:

```json
{
  "soc-01-01": {
    "front": "सोरोकिन की संस्कृति के तीन प्रकार क्या हैं ...?",
    "back": "सोशल एंड कल्चरल डायनेमिक्स में ...\n• भावनात्मक: ...\n• ..."
  }
}
```

Same ids, no extras, no missing.

Then run:

```
node scripts/i18n/cards-validate.mjs <subject> <offset> <count>
```

It must print PASS. It checks ids, Devanagari ratio, leftover English, bullet
count in the answer, and answer line count.

## Rules

* Translate `front` as a question or prompt of the same length and intent.
* Translate `back` faithfully, keeping its structure:
  - keep the same number of `•` bullets, in the same order;
  - keep paragraph breaks (`\n`) where the English has them (line-count drift
    of 1–2 is tolerated, more is not);
  - keep every number, year, percentage, book title and name;
* Names: Devanagari transliteration with the English in brackets on first use
  inside that card: `दुर्खीम (Durkheim)`.
* Keep acronyms in Latin (AGIL, NPM, PESA, FRA, UPSC, NGO, GDP).
* Exam register; no Hinglish. Do not add examples or explanations that were
  not in the card.
* JSON only, UTF-8, no comments, no code fences.

## Pilot before scaling

Run one batch, validate, and only then continue. If a card's English is itself
ambiguous or truncated, translate what is there; do not invent the missing half.
