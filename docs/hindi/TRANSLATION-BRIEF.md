# Hindi translation brief — Distilled Crux

You are translating UPSC optional-subject study notes from English to Hindi.
The output ships to Hindi-medium aspirants, so accuracy and exam register
matter more than elegance. You are one translator in a pipeline; follow this
brief exactly so 161 notes read as one book.

Repository root: `/Users/nirxv_03/Desktop/distilledcrux`

---

## 1. Input and output

Input (already extracted for you by the orchestrator):

```
scripts/i18n/work/en/<subject>/<slug>.html
```

Output (write this file):

```
lib/noteContentHi/parts/<subject>/<slug>.html
```

Then run, from the repo root:

```
node scripts/i18n/validate-note.mjs <subject> <slug>
```

Fix and rerun until it prints `PASS`. Never edit the English source, the
validator, or another note's file.

## 2. The output contract

* Return **only the Hindi HTML**. No preamble, no notes to the reader, no
  markdown fences, no ` ```html `.
* Keep the markup identical: same tags, same nesting, same attributes, same
  order, same number of `<li>`, `<tr>`, `<td>`, `<h2>`, `<h3>`, `<table>`.
* Translate text nodes only. Never translate tag names, class names or
  attributes.
* Keep entities (`&amp;`, `&nbsp;`), the bullet glyphs, and blank-line
  structure between blocks.
* Keep numbers, years, marks, article numbers, dates and `[Source #N]` exactly
  as they are, in Western digits.
* Never leave English number words: `million` → करोड़/लाख conversion
  (300 million = 30 करोड़), `billion` → अरब, `percent` → प्रतिशत. Keep the
  figure, translate the unit.
* Month names in Hindi: जनवरी, फ़रवरी, मार्च, अप्रैल, मई, जून, जुलाई, अगस्त,
  सितंबर, अक्टूबर, नवंबर, दिसंबर. Years stay in digits.
* Do not add headings, examples, explanations, summaries or "translator's
  notes". Do not remove anything either. A shorter Hindi text is fine; a
  thinner one is not.

## 3. Language and register

* Standard Hindi in Devanagari. UPSC Hindi-paper register: `चर्चा कीजिए`,
  `समालोचनात्मक परीक्षण कीजिए`, `टिप्पणी कीजिए`, `स्पष्ट कीजिए`,
  `मूल्यांकन कीजिए`, `विवेचना कीजिए`.
* Academic prose, not spoken Hindi. Avoid English word order; write natural
  Hindi sentences.
* Use the nukta where it belongs: फ़, ज़, क़, ग़ (e.g. फ़्रांस, ज़मींदार).
* Prefer the Hindi term with the English in brackets on **first use in the
  note**, then Hindi only: `संस्कृतीकरण (Sanskritisation)`,
  `दुर्खीम (Durkheim)`, `सामाजिक तथ्य (social fact)`.
* Person names: Devanagari transliteration, English in brackets on first use.
  After that, Hindi only. Keep topper names and test-series names in Latin.
* Book and article titles: Devanagari transliteration, italic tag preserved;
  the English title may sit in brackets on first use.
* Quotes: use Hindi quotation marks “…”. Translate the quoted sentence; do not
  leave it in English.
* Technical abbreviations that Indian students read in Latin (AGIL, PESA, FRA,
  MFP, PVTG, NGO, GDP, POSDCORB, NPM, UPSC) stay in Latin, no brackets.
* International bodies: the name is Hindi, only the acronym stays Latin —
  संयुक्त राष्ट्र (UN), महासभा (General Assembly), सुरक्षा परिषद (UNSC),
  आर्थिक एवं सामाजिक परिषद (ECOSOC), अंतर्राष्ट्रीय न्यायालय (ICJ),
  महासचिव (Secretary-General), सचिवालय (Secretariat), विश्व बैंक,
  अंतर्राष्ट्रीय मुद्रा कोष, विश्व व्यापार संगठन, यूरोपीय संघ.
  Never leave the English name loose in a Hindi sentence.
* Do not transliterate into Sanskritised jargon where the standard Hindi term
  is simpler. `समाज` not `समाजसमुदाय`; `राज्य` not `राष्ट्रकल्प`.

## 4. Chunking long notes

If the English file is longer than ~12,000 characters, translate it in chunks:

1. Split **only** between top-level blocks — after `</h2>`, `</p>`, `</ul>`,
   `</table>`, `</blockquote>` — never inside a tag, table row, list or
   paragraph.
2. Write each translated chunk to `.../<slug>.chunk-01.html`,
   `.../<slug>.chunk-02.html`, … (two-digit, in order).
3. Concatenate: `cat <slug>.chunk-*.html > <slug>.html` and delete the chunks.
4. Run the validator. Chunk boundaries must not add or drop whitespace inside a
   tag.

## 5. Glossary (use these exact spellings)

| English | Hindi |
|---|---|
| Sociology | समाजशास्त्र |
| Anthropology | मानवशास्त्र |
| Political Science and International Relations | राजनीति विज्ञान एवं अंतर्राष्ट्रीय संबंध |
| Geography | भूगोल |
| Public Administration | लोक प्रशासन |
| social fact | सामाजिक तथ्य |
| anomie | अनोमी |
| ideal type | आदर्श प्रारूप |
| historical materialism | ऐतिहासिक भौतिकवाद |
| mode of production | उत्पादन पद्धति |
| alienation | अलगाव |
| class struggle | वर्ग संघर्ष |
| division of labour | श्रम-विभाजन |
| collective conscience | सामूहिक चेतना |
| value consensus | मूल्य-सहमति |
| socialisation | समाजीकरण |
| pattern variables | प्रतिमान चर |
| structural functionalism | संरचनात्मक प्रकार्यवाद |
| manifest / latent function | प्रकट / अप्रकट प्रकार्य |
| reference group | संदर्भ समूह |
| Sanskritisation | संस्कृतीकरण |
| Westernisation | पश्चिमीकरण |
| dominant caste | प्रभुत्वशाली जाति |
| jajmani system | जजमानी व्यवस्था |
| caste system | जाति व्यवस्था |
| untouchability | अस्पृश्यता |
| joint family | संयुक्त परिवार |
| kinship | नातेदारी |
| tribe | जनजाति |
| Scheduled Tribe | अनुसूचित जनजाति |
| denotified tribe | विमुक्त जनजाति |
| assimilation | आत्मसातीकरण |
| integration | एकीकरण |
| isolation | पृथक्करण |
| ethnography | नृवंशविचार |
| participant observation | सहभागी अवलोकन |
| cultural relativism | सांस्कृतिक सापेक्षतावाद |
| structuralism | संरचनावाद |
| diffusionism | विसरणवाद |
| magic | जादू |
| totemism | टोटेमवाद |
| sovereignty | संप्रभुता |
| legitimacy | वैधता |
| hegemony | वर्चस्व |
| federalism | संघवाद |
| separation of powers | शक्तियों का पृथक्करण |
| judicial review | न्यायिक पुनरावलोकन |
| bureaucracy | नौकरशाही |
| New Public Management | नव लोक प्रबंधन (NPM) |
| public policy | लोक नीति |
| accountability | जवाबदेही |
| transparency | पारदर्शिता |
| geomorphology | भू-आकृतिकी |
| climatology | जलवायुविज्ञान |
| monsoon | मानसून |
| plate tectonics | प्लेट विवर्तनिकी |
| erosion | अपरदन |
| deposition | निक्षेपण |
| demographic dividend | जनसांख्यिकीय लाभांश |
| urbanisation | नगरीकरण |
| sustainable development | सतत विकास |

If a term is missing here, use the standard Hindi textbook term and add the
English in brackets on first use.

## 6. Self-check before you finish

- [ ] `node scripts/i18n/validate-note.mjs <subject> <slug>` prints `PASS`
- [ ] No English sentence outside brackets, names, titles, abbreviations
- [ ] Same headings, tables, rows, list items as the source
- [ ] Numbers, years and `[Source #N]` untouched
- [ ] Nothing added or dropped

Report back in one line: `<subject>/<slug> — <chars> chars — PASS`.
