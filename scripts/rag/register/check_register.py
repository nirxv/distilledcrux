"""Validate an optional's key-facts register (REGISTER-BRIEF.md).

    python3 scripts/rag/register/check_register.py sociology
    python3 scripts/rag/register/check_register.py --all
"""
from __future__ import annotations

import csv
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SUBJECTS = ["sociology", "anthropology", "polsci", "geography", "pub-admin"]
COLS = ["kind", "id", "unit", "name", "aliases", "thinker", "start", "end", "precision", "tolerance_years",
        "summary", "note", "verified"]
KINDS = {"thinker", "work", "concept", "event"}
PRECISIONS = {"day", "month", "year", "circa", "contested"}
DATE = re.compile(r"^(\d{1,4}\s*(BCE|BC)|\d{4}(-\d{2}(-\d{2})?)?)$")


def check(subject: str, units: dict) -> tuple[list[str], dict]:
    path = HERE / f"{subject}.csv"
    if not path.exists():
        return ["no file"], {}
    allowed = {u["slug"] for u in units[subject]}
    problems, ids, aliases, counts = [], {}, {}, {}
    with open(path, newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        if reader.fieldnames != COLS:
            return [f"header must be: {','.join(COLS)}"], {}
        rows = list(reader)
    for n, r in enumerate(rows, 2):
        where = f"line {n} {r.get('id')}"
        if None in r or any(v is None for v in r.values()):
            problems.append(f"{where}: wrong number of fields (quote fields that contain commas)")
            continue
        k = r["kind"]
        counts[k] = counts.get(k, 0) + 1
        if k not in KINDS:
            problems.append(f"{where}: kind {k!r}")
        if not re.fullmatch(r"[a-z0-9_]+", r["id"]):
            problems.append(f"{where}: id must be lowercase letters, digits and _")
        if r["id"] in ids:
            problems.append(f"{where}: duplicate id (also line {ids[r['id']]})")
        ids[r["id"]] = n
        bad = [u for u in r["unit"].split("|") if u and u not in allowed]
        if not r["unit"] or bad:
            problems.append(f"{where}: unit must be slugs from units.json (bad: {bad or 'empty'})")
        if not r["name"].strip():
            problems.append(f"{where}: name missing")
        for a in [r["name"], *r["aliases"].split("|")]:
            a = a.strip().lower()
            if not a:
                continue
            if a in aliases and aliases[a] != r["id"]:
                problems.append(f"{where}: name/alias {a!r} also used by {aliases[a]}")
            aliases[a] = r["id"]
        for f in ("start", "end"):
            if r[f] and not DATE.match(r[f].strip()):
                problems.append(f"{where}: {f} {r[f]!r} must look like 1893, 1946-06, 1946-06-25 or 321 BCE")
        if r["end"] and not r["start"]:
            problems.append(f"{where}: end without start")
        if r["precision"] not in PRECISIONS:
            problems.append(f"{where}: precision {r['precision']!r}")
        if r["precision"] in ("year", "circa", "contested") and re.match(r"^\d{4}-", r["start"] or ""):
            problems.append(f"{where}: a {r['precision']} row takes years only")
        if r["precision"] == "day" and not re.match(r"^\d{4}-\d{2}-\d{2}$", r["start"]):
            problems.append(f"{where}: precision day needs a full date")
        if not re.fullmatch(r"\d*", r["tolerance_years"] or ""):
            problems.append(f"{where}: tolerance_years must be a whole number")
        if not r["summary"].strip():
            problems.append(f"{where}: summary missing")
        if r["verified"] and not r["verified"].startswith("books: "):
            problems.append(f"{where}: leave verified empty (apply_verify.py fills it)")
    for n, r in enumerate(rows, 2):
        if r.get("kind") in ("work", "concept") and r.get("thinker"):
            if r["thinker"] not in ids:
                problems.append(f"line {n} {r['id']}: thinker {r['thinker']!r} has no thinker row")
        elif r.get("kind") == "work":
            problems.append(f"line {n} {r['id']}: a work needs its thinker")
    return problems, counts


def main() -> int:
    units = json.loads((HERE / "units.json").read_text())
    subs = SUBJECTS if (len(sys.argv) > 1 and sys.argv[1] == "--all") else sys.argv[1:2]
    if not subs or any(s not in SUBJECTS for s in subs):
        print(f"give one of {SUBJECTS}, or --all")
        return 2
    bad = 0
    for s in subs:
        problems, counts = check(s, units)
        for p in problems[:40]:
            print(p)
        print(f"{s}: {sum(counts.values())} rows {counts}, {len(problems)} problems")
        bad += len(problems)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
