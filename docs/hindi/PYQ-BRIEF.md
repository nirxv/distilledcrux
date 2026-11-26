# Hindi translation brief — past questions (PYQs)

Translate UPSC optional question papers from English to Hindi, in the style of
the official Hindi papers.

Repo root: `/Users/nirxv_03/Desktop/distilledcrux`

## Input / output

Input: `scripts/i18n/work/pyq/en/<subject>-<offset>-<count>.json` — an array of
`{ id, year, paper, marks, topic, question }`.

Output: `scripts/i18n/work/pyq/hi/<subject>-<offset>-<count>.json` — a JSON
object mapping **the same ids** to the Hindi question:

```json
{
  "1067": "भारत में जाति व्यवस्था ...",
  "1068": "..."
}
```

Then validate:

```
node scripts/i18n/pyq-validate.mjs <subject> <offset> <count>
```

It must print PASS. It checks ids, numbers, directives, Devanagari ratio and
leftover English.

## Rules

* Translate **only the question**. No answer, no explanation, no headings.
* Keep every number, year, mark and Roman numeral exactly: `2019`, `10`,
  `Paper II`, `[Source #1]`.
* Keep question numbers and sub-parts (`(a)`, `(b)`) as they are.
* Names: Devanagari transliteration, English in brackets the first time in a
  question: `दुर्खीम (Durkheim)`. Book titles transliterated, English in
  brackets.
* Quotes: Hindi quotation marks “…”, translated, not left in English.
* “OR” between alternatives → `अथवा`.
* Directives must match the official Hindi register:
  - Discuss → चर्चा कीजिए
  - Critically examine / analyse → समालोचनात्मक परीक्षण कीजिए / समालोचनात्मक विश्लेषण कीजिए
  - Comment → टिप्पणी कीजिए
  - Elucidate → स्पष्ट कीजिए
  - Evaluate → मूल्यांकन कीजिए
  - Examine → परीक्षण कीजिए
  - Explain → व्याख्या कीजिए
  - Analyse → विश्लेषण कीजिए
  - Justify → औचित्य सिद्ध कीजिए
  - Substantiate → पुष्टि कीजिए
* Keep the question's meaning exact. Do not modernise, simplify or add context.
* Acronyms that UPSC keeps in Latin stay Latin: UN, NPT, WTO, IMF, NGO, GDP,
  SC/ST, PESA, FRA. Institution names are Hindi.
* Output valid JSON only, UTF-8, no comments, no code fences, no trailing text.

## Quality bar

A Hindi-medium aspirant should be able to answer the question without seeing
the English. Word order natural, exam register, no Hinglish.
