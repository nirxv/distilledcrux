# Tagging brief: DistilledCrux book passages

You tag one batch of passages from a standard textbook for one UPSC optional: Sociology, Anthropology, PSIR, Geography or Public Administration. The tags feed the search index of the site's AI tutor and answer checker. A wrong tag hides the right passage or shows the wrong one. Read each passage. Do not guess from keywords.

## Input

`scripts/rag/work/batches/<BATCH>.txt` (paths are relative to `/Users/nirxv_03/Desktop/distilledcrux`). The header gives:

- the book, the author and the optional
- `UNITS`: the optional's syllabus units, as slugs you may use
- `REGISTER`: the optional's key thinkers, works, concepts and events, as ids you may use

Then the passages follow in reading order. Each passage starts with `=== <id>`.

The file is large. If Read refuses it, read it in parts with `offset` and `limit` until you reach the end. Tag every passage.

## Output

Write `scripts/rag/work/tags/<BATCH>.jsonl` with the Write tool. Put one line per passage, in the same order, with no other text:

```
{"id": 27701, "u": ["emile-durkheim"], "r": ["durkheim", "anomie", "durkheim_suicide"], "c": "Durkheim's Suicide (1897): anomic suicide rises when economic booms and crises loosen the norms that regulate desire."}
```

- `id`: the passage id, an integer.
- `u`: 0 to 3 unit slugs from the batch's `UNITS` list. Use a unit only when the passage teaches content of that unit. Pick the unit a UPSC student would revise this passage for. `[]` is fine for prefaces, indexes and passages that fit no unit.
- `r`: 0 to 5 register ids from the batch's `REGISTER` list. Use an id when the passage substantially discusses that thinker, work, concept or event. A passing mention in a list of names doesn't count. When a passage explains a concept, give the concept id and also its thinker's id if the passage discusses the thinker. `[]` is fine and common.
- `c`: one plain sentence, at most about 30 words. It names the specific thinker(s), theory, concept, work, place or case the passage is about. Use the book's own facts.
  - When the passage says only "he", "this theory" or "the author", name the thinker or theory from the passages around it. That is the main reason this tagging exists.
  - Examples:
    - "Weber's ideal type of bureaucracy: hierarchy, written rules, impersonality and career officials, contrasted with patrimonial administration."
    - "Srinivas on Sanskritisation in Mysore villages: lower castes adopting the customs of higher castes to claim higher status."
    - "Davis's cycle of erosion: youth, maturity and old age stages of a landscape, and Penck's criticism of it."
  - Don't evaluate. Don't say "this passage". Don't add years, titles or attributions that the passage and its neighbours don't support.

## Rules

1. Tag every passage in the batch once, including short or boring ones. Index pages, footnotes and bibliography fragments still get a line: give them `u: []`, `r: []` and a `c` saying what they are (e.g. "Bibliography entries for the chapter on caste.").
2. Read the passages in order. A passage often continues the one before it.
3. Read every passage in full with the Read tool. Don't use shell commands, scripts or heredocs to read, cut, sample or summarise the batch file, and don't generate the tag file with code: write it with the Write tool from your own reading. A tag file made from partial reads is rejected and redone.
4. Don't write anywhere except your own tag file. Don't edit the batch file or any repo file.
5. When the file is written, run:
   `python3 /Users/nirxv_03/Desktop/distilledcrux/scripts/rag/check_tags.py <BATCH>`
   Fix every problem it lists, then run it again. Stop only when it reports `0 problems`.
6. If the disk is full or a tool fails repeatedly, stop and report it. Don't delete files or work around the sandbox.

## Report

Reply in one or two lines: the batch id, the number of passages tagged, the check result, and anything odd. Examples of odd: garbled OCR, passages from another book or another optional, a long stretch that fits no unit.
