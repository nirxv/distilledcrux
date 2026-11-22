# Register brief: key facts for one UPSC optional

You draft the key-facts register for one optional on DistilledCrux. The site uses it three ways:
- It plans book searches, by spotting the thinkers and concepts a question names.
- It gives the answering AI facts to rely on, instead of its memory.
- It checks finished answers for wrong attributions and wrong years.

A wrong row puts a wrong fact in front of UPSC students. Each row will later be checked against the standard textbooks, quote by quote. Write only what you are sure the standard textbooks say.

## Input

- **Your optional**: named in your task.
- **Its syllabus units**: `scripts/rag/register/units.json` (paths relative to `/Users/nirxv_03/Desktop/distilledcrux`). Use the list under your optional. Each unit has a `slug`, a `title` and a `paper`.

## Output

Write `scripts/rag/register/<optional>.csv` with the Write tool: a header line, then one row per fact. Columns, in this order:

`kind,id,unit,name,aliases,thinker,start,end,precision,tolerance_years,summary,note,verified`

| column | meaning |
|---|---|
| `kind` | `thinker`, `work`, `concept` or `event` |
| `id` | unique, lowercase letters, digits and `_` only, e.g. `durkheim`, `durkheim_division_of_labour`, `anomie` |
| `unit` | one or more unit slugs from your list, joined with `\|`, where this fact is taught |
| `name` | the standard name: "Émile Durkheim", "The Division of Labour in Society", "Anomie" |
| `aliases` | other names a student or a book might use, joined with `\|`: "Durkheim\|Emile Durkheim". For works, include the short title. Leave out any alias another row could also claim. |
| `thinker` | for `work` and `concept` rows, the `id` of the thinker row it belongs to; empty otherwise |
| `start`, `end` | dates. For a thinker, birth and death years. For a work, its first publication year, with `end` empty. For a concept, the year it was introduced, only if the books state one; otherwise empty. For an event, its date. Formats: `1893`, `1946-06`, `1946-06-25`, `321 BCE`. |
| `precision` | `day`, `month`, `year`, `circa` or `contested`. Use `year` for most rows. For a row with no dates, use `year` and leave the dates empty. |
| `tolerance_years` | 0 unless sources commonly differ, e.g. a translation year against the original year |
| `summary` | one plain sentence, at most about 25 words: what the work argues, what the concept means, or what happened |
| `note` | a short note only where the date or the attribution is commonly confused, e.g. "Often misattributed to Weber." Otherwise empty. |
| `verified` | leave empty |

**Quoting.** Quote a field with `"…"` if it contains a comma, and double any `"` inside it.

## What to include

- **Thinkers:** every thinker the syllabus names, and those the standard books treat as core for a unit.
  - Sociology: Marx, Weber, Durkheim, Parsons, Merton, Mead, plus Srinivas, Ghurye, Dumont, Béteille, Desai and others.
  - PSIR: from Plato to Rawls and Gandhi, plus IR theorists.
  - Anthropology: from Tylor and Frazer to Malinowski, Radcliffe-Brown, Lévi-Strauss, Boas, Elwin, Dube, Vidyarthi and others.
  - Geography: from Ratzel, Mackinder, Christaller and Weber (location) to Davis, Penck, Köppen and Thornthwaite.
  - Public Administration: from Wilson, Taylor, Weber, Fayol, Gulick, Mayo, Simon, Barnard and Riggs to McGregor, Herzberg, Maslow, Argyris, Likert and Osborne.
- **Works:** each core thinker's major works, as the books name them, with the first publication year.
- **Concepts:** key terms and theories, each with the thinker the books credit:
  - Sociology: anomie, verstehen, ideal type, Sanskritisation, dominant caste
  - Geography: Heartland, central place, demographic transition
  - Anthropology: rites de passage, culture area
  - PSIR: balance of power, sovereignty
  - Public Administration: POSDCORB, prismatic society, bounded rationality
- **Events,** where the optional has them:
  - PSIR: constitutional and IR milestones, e.g. 73rd/74th Amendments, Panchsheel, NAM, the UN Charter
  - Public Administration: the Minnowbrook conferences, ARC reports, the RTI Act
  - Geography: few
  - Sociology and Anthropology: few, e.g. the first Census of India, the Mandal Commission
- **Size:** about 80–150 rows for your optional. Fewer correct rows beat more uncertain ones.

## Rules

1. **Sure or leave it out.** Give a year only when you are certain the standard textbooks give it. If two years are common (a book's first edition and its English translation), give the original, set `tolerance_years`, and say so in `note`.
2. **Every row's `unit` uses only slugs from your list.**
3. **No row for the same fact twice,** and no alias shared by two rows.
4. **Your own file only.** Don't write anywhere except your CSV.
5. **Check your file.** When it's written, run `python3 /Users/nirxv_03/Desktop/distilledcrux/scripts/rag/register/check_register.py <optional>`. Fix every problem and run it again until it reports `0 problems`.

## Report

Reply in one or two lines: your optional, the count of each kind, and any row you were unsure about and left out.
