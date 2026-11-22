"""Validate a tagger's output against its batch (TAGGING-BRIEF.md).

    python3 scripts/rag/check_tags.py b210            # one batch
    python3 scripts/rag/check_tags.py --all           # every batch: done / missing / broken
    python3 scripts/rag/check_tags.py --todo          # ids of batches not yet tagged or failing
    python3 scripts/rag/check_tags.py b210 --file work/tags/pilot.jsonl

A tag file holds one JSON object per passage:
    {"id": 31234, "u": ["weber-social-action"], "r": ["weber", "verstehen"], "c": "..."}
Exit status 0 only when every id in the batch has exactly one valid line.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
WORK = HERE / "work"


def check(bid: str, meta: dict, path: Path) -> list[str]:
    if not path.exists():
        return ["no tag file"]
    problems, seen = [], {}
    allowed_ids, units, refs = set(meta["ids"]), set(meta["units"]), set(meta["refs"])
    for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        try:
            r = json.loads(line)
        except json.JSONDecodeError as e:
            problems.append(f"line {n}: not JSON ({e})")
            continue
        pid = r.get("id")
        where = f"line {n} id {pid}"
        if pid not in allowed_ids:
            problems.append(f"{where}: id is not in this batch")
            continue
        if pid in seen:
            problems.append(f"{where}: duplicate (first on line {seen[pid]})")
        seen[pid] = n
        u = r.get("u")
        if not isinstance(u, list) or len(u) > 3 or any(x not in units for x in u):
            bad = [x for x in (u or []) if x not in units] if isinstance(u, list) else u
            problems.append(f"{where}: u must be 0-3 unit slugs from the batch list (bad: {bad})")
        t = r.get("r")
        if not isinstance(t, list) or len(t) > 5 or any(x not in refs for x in t):
            bad = [x for x in (t or []) if x not in refs] if isinstance(t, list) else t
            problems.append(f"{where}: r must be 0-5 register ids from the batch list (bad: {bad})")
        c = r.get("c")
        if not isinstance(c, str) or not c.strip():
            problems.append(f"{where}: context sentence missing")
        elif len(c) > 300:
            problems.append(f"{where}: context over 300 characters")
    for pid in sorted(allowed_ids - set(seen)):
        problems.append(f"id {pid}: no line")
    return problems


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("batch", nargs="?")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--todo", action="store_true", help="print the batches not yet tagged or failing the check")
    ap.add_argument("--file")
    args = ap.parse_args()
    index = json.loads((WORK / "batches" / "index.json").read_text(encoding="utf-8"))

    if args.todo:
        print(" ".join(b for b, meta in index.items()
                       if check(b, meta, WORK / "tags" / f"{b}.jsonl")))
        return 0

    if args.all:
        done, todo, broken = [], [], []
        for bid, meta in index.items():
            path = WORK / "tags" / f"{bid}.jsonl"
            if not path.exists():
                todo.append(bid)
            elif check(bid, meta, path):
                broken.append(bid)
            else:
                done.append(bid)
        n_done = sum(len(index[b]["ids"]) for b in done)
        print(f"done {len(done)}/{len(index)} batches ({n_done} passages); broken {len(broken)}; not started {len(todo)}")
        if broken:
            print("broken:", " ".join(broken))
        return 0 if not broken and not todo else 1

    if not args.batch or args.batch not in index:
        print("give a batch id like b210, or --all")
        return 2
    path = Path(args.file) if args.file else WORK / "tags" / f"{args.batch}.jsonl"
    problems = check(args.batch, index[args.batch], path)
    for p in problems[:40]:
        print(p)
    if len(problems) > 40:
        print(f"... and {len(problems) - 40} more")
    print(f"{args.batch}: {len(index[args.batch]['ids'])} passages, {len(problems)} problems")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
