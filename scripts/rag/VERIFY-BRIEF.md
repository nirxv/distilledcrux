# Verify brief: key facts against the textbooks

You check one batch of register rows against passages from the standard textbooks of a UPSC optional. Each row is a key fact: a thinker's life years, a work's author and first publication year, the thinker a concept is credited to, or an event's date. Decide from the passages alone whether the books confirm the row. A wrong verdict puts a wrong fact in front of UPSC students, so read carefully and never guess.

## Input

`scripts/rag/work/verify/<BATCH>.txt` (paths relative to `/Users/nirxv_03/Desktop/distilledcrux`). The file holds up to 30 rows. Each row starts with `### ROW <optional>:<id>` and gives:

- its kind, name and aliases
- `claims`: what the row says and you must check
  - a thinker: `life: <birth>–<death>`
  - a work: `by: <thinker>` and `published: <year>`
  - a concept: `by: <thinker>`, and sometimes `introduced: <year>`
  - an event: `date: <date>`
- a one-line summary
- up to 5 book passages, each starting `[P<number>] <book>:`

If Read refuses the file, read it in parts with `offset` and `limit`. Check every row.

## Output

Write `scripts/rag/work/verify/<BATCH>.out.jsonl` with the Write tool. Put one line per row, in the same order:

```
{"id": "sociology:durkheim_division_of_labour", "verdict": "confirmed", "books": [{"p": 4211, "date": "1893", "who": "Durkheim", "quote": "In The Division of Labour in Society (1893), Durkheim argued that..."}], "why": "Haralambos names Durkheim as the author and gives 1893."}
```

- `id`: the row id exactly as in its `### ROW` line, `<optional>:<id>`.
- `verdict` is one of:
  - `confirmed`: passages about **this same** thinker, work, concept or event state **every** claim of the row, and no passage contradicts any of them. A year claim needs the same year (or within the row's tolerance). A `by` claim needs a passage that credits the work or concept to that thinker.
  - `partial`: passages state some claims and say nothing against the others. Example: a book credits the concept to the thinker but gives no year.
  - `corrected`: passages give a different year or a different thinker from the row, and they don't contradict each other.
  - `disputed`: passages disagree with each other, or one confirms the row while another gives a different year or thinker.
  - `unsupported`: no passage states any of the claims. Use this when passages only mention the name.
- `books`: every passage you relied on, with:
  - `p`: the passage number, as an integer
  - `date`: the year as the passage gives it (e.g. "1893", "1858-1917"), or `""` when the passage gives no year for this row
  - `who`: the thinker the passage credits, as it writes the name (e.g. "Durkheim"), or `""` when it credits no one
  - `quote`: the exact words from the passage, **copied character for character**, 8 to 40 words long, containing the year or the credit

  Give `[]` only for `unsupported`.
- `suggest`: only for `corrected` and `disputed`. The values the books support: any of `start`, `end` (as `1893`, `1946-06` or `1946-06-25`), `thinker` (the name the books give), `precision` (`year`, `circa` or `contested`), `tolerance` in years, and a `note` naming which book says what. For `disputed`, set `precision` to `contested` or widen `tolerance` so that every book's year fits, and say so in the note.
- `why`: one short sentence.

## Rules

1. **Same thing only.** A passage about a related but different work or concept is not evidence. Merton's anomie is not Durkheim's. A book's English translation year is not its first publication year, unless the passage says so; when a passage gives a translation year, say so in `why`.
2. **Facts must be written in the passage.** Don't use your own knowledge to confirm, correct or fill in a year or an author. If you "know" a year but no passage states it, that claim is unsupported.
3. **Text that may be garbled.** Passages come from OCR and can be garbled. A year that is clearly an OCR slip ("l893", "18 93") still counts. A year you can't read with certainty doesn't.
4. **Books against the row.** When books disagree with the row but agree with each other, the books win (`corrected`). When books disagree with each other, use `disputed`.
5. **Your own file only.** Don't write anywhere except your output file. Don't write helper scripts.
6. **Check your file.** When it's written, run `python3 /Users/nirxv_03/Desktop/distilledcrux/scripts/rag/check_verify.py <BATCH>`. Fix every problem it lists and run it again. Stop only when it reports `0 problems`.

## Report

Reply in one or two lines: the batch id, the count of each verdict, and anything odd.
