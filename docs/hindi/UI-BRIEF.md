# Hindi translation brief — UI

Translate one page or component's user-facing English to Hindi, without
changing behaviour.

Repo root: `/Users/nirxv_03/Desktop/distilledcrux`

## Rules

* Only touch the file you are given. Do not edit shared helpers, styles or
  other pages.
* Client components (`'use client'`): import `useLang` from
  `@/lib/i18n/LangContext` and inside the component take `const { L } = useLang()`.
  Wrap copy as `L('English', 'हिंदी')`.
* Server components: import `HiText` from `@/components/ui/HiText` and use
  `<HiText en="..." hi="..." />` (or JSX in the props) for visible copy.
* Module-level data (FAQ lists, step arrays, tab labels) keeps the English
  fields and gains `*Hi` fields; render with `L(item.en, item.enHi)`.
* Translate: headings, body copy, buttons, labels, placeholders, empty states,
  toasts, validation messages, aria-labels, titles, option labels.
* Do NOT translate: class names, ids, hrefs, API fields, plan ids, slugs,
  email addresses, code, numbers, prices, brand names, acronyms (PSIR, UPSC,
  AI, PDF, MCQ), or anything inside `{"{"} … {"}"}` that is not a string.
* Do not reword English copy. Do not restructure JSX, change props, rename
  variables, move components or alter logic. Add only the import, the hook and
  the `L(...)`/`HiText` wrappers.
* Where Hindi word order needs a different sentence shape, still use one
  `L('...', '...')` per sentence.
* Keep ternaries intact: `{loading ? L('Saving…', 'सहेजा जा रहा है…') : ...}`.

## Gate

Run from the repo root:

```
npx --no-install tsc --noEmit
```

It must pass. Then report: file, number of strings wrapped, and that tsc passed.
If the file is too large to finish reliably, say so rather than leaving a
half-edited file.
