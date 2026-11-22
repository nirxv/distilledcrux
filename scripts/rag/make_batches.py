"""Split work/passages.jsonl into tagging batches for in-session subagents.

Each batch is one book's consecutive passages, in reading order, so a passage that only
says "he argues" or "this theory" can be read with the passages before it. The batch
file carries what the tagger needs: the book, its optional, the optional's syllabus
units and its key-facts register (register/<optional>.csv). work/batches/index.json
records, per batch, the ids and the allowed values that check_tags.py validates against.

    python3 scripts/rag/make_batches.py [--size 120] [--subjects sociology polsci]

Batch ids carry the optional's letter (s001 Sociology, a001 Anthropology, p001 PSIR,
g001 Geography, m001 Public Administration), so one optional's batches can be made,
and tagged, before another's register exists; the others' entries in index.json stay.
"""
from __future__ import annotations

import argparse
import csv
import json
import textwrap
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
WORK = HERE / "work"
REG = HERE / "register"
PREFIX = {"sociology": "s", "anthropology": "a", "polsci": "p", "geography": "g", "pub-admin": "m"}
SUBJECT_NAMES = {
    "sociology": "Sociology",
    "anthropology": "Anthropology",
    "polsci": "Political Science and International Relations (PSIR)",
    "geography": "Geography",
    "pub-admin": "Public Administration",
}


def load_register(subject: str) -> list[dict]:
    path = REG / f"{subject}.csv"
    if not path.exists():
        raise SystemExit(f"no register for {subject}: {path}")
    return list(csv.DictReader(open(path, encoding="utf-8")))


def register_line(r: dict, names: dict[str, str]) -> str:
    extra = ""
    if r["kind"] in ("work", "concept") and r["thinker"]:
        extra = f", {names.get(r['thinker'], r['thinker'])}"
    if r["kind"] == "work" and r["start"]:
        extra += f", {r['start']}"
    return f"{r['id']} [{r['kind']}{extra}]: {r['name']}"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--size", type=int, default=120)
    ap.add_argument("--subjects", nargs="*", help="default: every optional with a register")
    args = ap.parse_args()
    subjects = args.subjects or [s for s in SUBJECT_NAMES if (REG / f"{s}.csv").exists()]

    units = json.loads((REG / "units.json").read_text(encoding="utf-8"))
    by_book: dict[str, list[dict]] = {}
    for line in open(WORK / "passages.jsonl", encoding="utf-8"):
        r = json.loads(line)
        by_book.setdefault(r["book_title"], []).append(r)

    out_dir = WORK / "batches"
    out_dir.mkdir(parents=True, exist_ok=True)
    index_path = out_dir / "index.json"
    index = json.loads(index_path.read_text(encoding="utf-8")) if index_path.exists() else {}
    for s in subjects:
        for old in out_dir.glob(f"{PREFIX[s]}[0-9][0-9][0-9].txt"):
            old.unlink()
        index = {b: v for b, v in index.items() if v["subject"] != s}
    registers = {s: load_register(s) for s in subjects}
    count = Counter()
    for book in sorted(by_book):
        rows = sorted(by_book[book], key=lambda r: r["id"])
        subject = Counter(r["subject"] for r in rows).most_common(1)[0][0]
        if subject not in SUBJECT_NAMES:
            raise SystemExit(f"{book}: unknown subject {subject!r}")
        if subject not in subjects:
            continue
        reg = registers[subject]
        names = {r["id"]: r["name"] for r in reg}
        unit_lines = [f"  {u['slug']} (Paper {u['paper']}): {u['title']}" for u in units[subject]]
        reg_lines = [f"  {register_line(r, names)}" for r in reg]
        size = args.size
        parts = [rows[i:i + size] for i in range(0, len(rows), size)]
        if len(parts) > 1 and len(parts[-1]) < size // 3:   # fold a small tail into the previous batch
            parts[-2].extend(parts.pop())
        for part in parts:
            count[subject] += 1
            bid = f"{PREFIX[subject]}{count[subject]:03d}"
            lines = [
                f"BATCH {bid}",
                f"BOOK: {book}",
                f"AUTHOR: {part[0]['author']}",
                f"OPTIONAL: {SUBJECT_NAMES[subject]}",
                "",
                "UNITS (slug (paper): title). Use 0-3 per passage, slugs from this list only:",
                *unit_lines,
                "",
                "REGISTER (id [kind, thinker, year]: name). Use 0-5 per passage, ids from this list only:",
                *reg_lines,
                "",
                f"PASSAGES ({len(part)}, in reading order; each starts with '=== <id>'):",
            ]
            for r in part:
                lines.append(f"=== {r['id']}")
                lines.extend(textwrap.wrap(r["text"], 900, break_long_words=False, break_on_hyphens=False))
            (out_dir / f"{bid}.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
            index[bid] = {"book": book, "subject": subject, "ids": [r["id"] for r in part],
                          "units": [u["slug"] for u in units[subject]], "refs": [r["id"] for r in reg]}
    index = dict(sorted(index.items()))
    index_path.write_text(json.dumps(index, ensure_ascii=False, indent=1), encoding="utf-8")
    sizes = [len(v["ids"]) for v in index.values()]
    per_subject = Counter(v["subject"] for v in index.values())
    print(f"made {dict(count)}; index now {len(index)} batches, {sum(sizes)} passages, "
          f"{min(sizes)}-{max(sizes)} per batch -> {out_dir}")
    print("batches per optional:", dict(per_subject))


if __name__ == "__main__":
    main()
