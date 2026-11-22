"""Write the data files the site reads at chat time.

  lib/rag/register.json     every optional's key-facts register (register/<optional>.csv):
                            thinkers, works, concepts and events, with dates and units
  lib/rag/unitVectors.json  one voyage-4-lite query embedding per syllabus unit, int8-quantised,
                            so a question's own embedding can be matched to units without an
                            extra model call

Rerun after every edit to a register CSV:   python3 scripts/rag/build_runtime_data.py
"""
from __future__ import annotations

import base64
import csv
import json
import re
import sys
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE / "register"))
from check_register import SUBJECTS, check  # noqa: E402

from qdrant_io import REPO, env  # noqa: E402

OUT = REPO / "lib" / "rag"
REG = HERE / "register"
NAMES = {"sociology": "Sociology", "anthropology": "Anthropology", "polsci": "Political Science and International Relations",
         "geography": "Geography", "pub-admin": "Public Administration"}
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
          "November", "December"]


def parse(v: str):
    v = v.strip()
    if not v:
        return None
    m = re.fullmatch(r"(\d{1,4})\s*(BCE|BC)", v)
    if m:
        return [-int(m.group(1)), None, None]
    parts = [int(x) for x in v.split("-")]
    return parts + [None] * (3 - len(parts))


def fmt(d) -> str:
    y, m, day = d
    ys = f"{-y} BCE" if y < 0 else str(y)
    if m and day:
        return f"{day} {MONTHS[m - 1]} {ys}"
    if m:
        return f"{MONTHS[m - 1]} {ys}"
    return ys


def display(r: dict, start, end) -> str:
    if not start:
        return ""
    s = fmt(start)
    e = fmt(end) if end else ""
    if r["kind"] == "thinker":
        return f"{s}–{e}" if e else f"born {s}"
    out = f"{s}–{e}" if e and e != s else s
    if r["precision"] == "circa":
        out = "c. " + out
    elif r["precision"] == "contested":
        out += " (dates differ between sources)"
    return out


def unit_text(subject: str, unit: dict, facts: list[dict]) -> str:
    inside = [f["name"] for f in facts if unit["slug"] in f["units"] and f["kind"] in ("thinker", "concept", "work")]
    return f"{unit['title']}. UPSC {NAMES[subject]} optional, Paper {unit['paper']}. {'; '.join(inside)}"[:1500]


def embed(texts: list[str]) -> list[list[float]]:
    req = urllib.request.Request(
        "https://api.voyageai.com/v1/embeddings",
        json.dumps({"model": "voyage-4-lite", "input": texts, "input_type": "query"}).encode(),
        {"Content-Type": "application/json", "Authorization": "Bearer " + env("VOYAGE_API_KEY")})
    data = json.load(urllib.request.urlopen(req, timeout=120))
    return [d["embedding"] for d in sorted(data["data"], key=lambda d: d["index"])]


def quantise(vec: list[float]) -> dict:
    scale = max(abs(x) for x in vec) / 127 or 1.0
    raw = bytes((round(x / scale) & 0xFF) for x in vec)
    return {"scale": scale, "q": base64.b64encode(raw).decode()}


def main() -> None:
    units = json.loads((REG / "units.json").read_text(encoding="utf-8"))
    facts = []
    for s in SUBJECTS:
        if not (REG / f"{s}.csv").exists():
            print(f"warning: no register for {s}; its questions get no key facts until one is added")
            continue
        problems, _ = check(s, units)
        if problems:
            raise SystemExit(f"register/{s}.csv has problems; run check_register.py {s}")
        for r in csv.DictReader(open(REG / f"{s}.csv", encoding="utf-8")):
            start, end = parse(r["start"]), parse(r["end"])
            facts.append({
                "id": r["id"], "subject": s, "kind": r["kind"], "units": [u for u in r["unit"].split("|") if u],
                "name": r["name"].strip(), "aliases": [a.strip() for a in r["aliases"].split("|") if a.strip()],
                "thinker": r["thinker"].strip(), "start": start, "end": end,
                "y0": start[0] if start else None, "y1": (end or start)[0] if start else None,
                "precision": r["precision"], "tolerance": int(r["tolerance_years"] or 0),
                "summary": r["summary"].strip(), "note": r["note"].strip(), "verified": r["verified"].strip(),
                "display": display(r, start, end),
            })
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "register.json").write_text(json.dumps({"facts": facts}, ensure_ascii=False), encoding="utf-8")

    keys, texts = [], []
    for s in SUBJECTS:
        sf = [f for f in facts if f["subject"] == s]
        for u in units[s]:
            keys.append(f"{s}:{u['slug']}")
            texts.append(unit_text(s, u, sf))
    vectors = []
    for i in range(0, len(texts), 64):
        vectors += embed(texts[i:i + 64])
    titles = {f"{s}:{u['slug']}": {"title": u["title"], "paper": u["paper"]} for s in SUBJECTS for u in units[s]}
    (OUT / "unitVectors.json").write_text(json.dumps(
        {"model": "voyage-4-lite", "units": {k: {**titles[k], **quantise(v)} for k, v in zip(keys, vectors)}}),
        encoding="utf-8")
    print(f"wrote {len(facts)} facts and {len(keys)} unit vectors to {OUT}")


if __name__ == "__main__":
    main()
