"""
Download IGNOU courses from eGyanKosh for ingest_book.py --profile ignou.

Each course is walked from its eGyanKosh handle down to its units (some
courses list units directly, others under blocks or books), and every unit's
PDF is saved as <out>/<group>/<COURSE>/Unit-NN.pdf. Where unit numbers restart
in each block the block goes into the name (B002-Unit-03.pdf). Beside the PDFs
goes titles.json, eGyanKosh's own unit titles, which ingest_book.py uses as
labels: an old scan's OCR layer can lose "UNIT 9" or the title itself.

Files already downloaded are kept, so a run can be repeated to fill gaps.
A few older units are page pictures with no text at all; give those a text
layer before ingesting (ocrmypdf -l eng --skip-text IN.pdf OUT.pdf).
Pages are fetched with curl: eGyanKosh's certificate chain is incomplete for
Python's default trust store.

Usage:
  python3 scripts/fetch_ignou.py [--out DIR] [GROUP...]

  GROUP is one of the keys of GROUPS below (all of them by default). Find a
  course's handle with https://egyankosh.ac.in/simple-search?query=MPA-011.
"""
import argparse
import html
import json
import re
import subprocess
import urllib.parse
from pathlib import Path

SITE = 'https://egyankosh.ac.in'
# The courses behind each IGNOU entry in lib/subjectConfig.ts, with their
# eGyanKosh handles. A course listed twice on the site has both handles; the
# one with more units is used.
GROUPS = {
    'soc-p1': {'ESO-13': ['3804', '18121'], 'ESO-14': ['3828', '63039'], 'MSO-002': ['4907', '4340']},
    'soc-p2': {'ESO-12': ['3795', '18119'], 'MSO-003': ['4358'], 'MSO-004': ['4368']},
    'anth-p1': {'MAN-001': ['41147'], 'MAN-002': ['41144'], 'MANI-002': ['41143']},
    'anth-p2': {'MANE-007': ['87887', '114983'], 'MANE-006': ['87565']},
    'psir-p1': {'MPS-001': ['5486'], 'MPSE-003': ['64004', '24354'], 'MPSE-004': ['5425', '24368'],
                'MPS-003': ['4431', '43903', '4919']},
    'psir-p2': {'MPS-002': ['5490'], 'MPS-004': ['43906']},
    'pa-p1': {'MPA-011': ['25201'], 'MPA-012': ['25205'], 'MPA-013': ['25209'], 'MPA-014': ['25214']},
    'pa-p2': {'BPAE-102': ['18027', '3731'], 'BPAC-114': ['89566'], 'BPAC-108': ['76641', '76719'],
              'MPA-016': ['25227', '27298', '93309']},
}
UNIT = re.compile(r'(?i)^unit[- ]?(\d+)\b')
PART = re.compile(r'(?i)^(?:block|book)[- ]?([\divxl]+)')
ROMAN = {'i': 1, 'ii': 2, 'iii': 3, 'iv': 4, 'v': 5, 'vi': 6}


def get(url):
    return subprocess.run(['curl', '-sS', '--max-time', '60', '-A', 'Mozilla/5.0', url],
                          capture_output=True).stdout.decode('utf8', 'replace')


def children(handle, pattern):
    """(handle, title) of the items under a handle whose title matches. A
    page lists 20 items; more follow at ?offset=20, 40, ..."""
    out, offset = {}, 0
    while offset <= 200:
        page = get(f'{SITE}/handle/123456789/{handle}' + (f'?offset={offset}' if offset else ''))
        new = {}
        for h, t in re.findall(r'href="/handle/123456789/(\d+)"[^>]*>(.*?)</a>', page, re.S):
            t = html.unescape(re.sub('<[^>]+>', '', t)).strip()
            if pattern.match(t) and h not in out: new[h] = t
        if not new: break
        out.update(new); offset += 20
    return list(out.items())


def units_of(handle, depth=0):
    """[(part, unit number, handle, title)] in order: the units listed on the
    page, or under its blocks and books."""
    units = [(0, int(UNIT.match(t).group(1)), h, t) for h, t in children(handle, UNIT)]
    if units or depth >= 3: return units

    def order(title):
        n = PART.match(title).group(1)
        return int(n) if n.isdigit() else ROMAN.get(n.lower(), 9)
    out = []
    parts = sorted(children(handle, PART), key=lambda x: order(x[1]))
    for i, (h, _) in enumerate(parts, 1):
        out += [(i * 100 + sub if depth else i, n, uh, t) for sub, n, uh, t in units_of(h, depth + 1)]
    return out


def pdf_of(unit_handle):
    links = re.findall(r'href="(/bitstream/[^"]+?\.pdf)"', get(f'{SITE}/handle/123456789/{unit_handle}'))
    return SITE + links[0] if links else None


def fetch(group, code, handles, out):
    units = max((units_of(h) for h in handles), key=len)
    folder = out / group / code
    folder.mkdir(parents=True, exist_ok=True)
    repeat = len({n for _, n, _, _ in units}) < len(units)
    titles, got = {}, 0
    for part, n, handle, title in sorted(units):
        f = folder / (f'B{part:03d}-Unit-{n:02d}.pdf' if repeat else f'Unit-{n:02d}.pdf')
        if not (f.exists() and f.stat().st_size > 10000):
            url = pdf_of(handle)
            if url:
                subprocess.run(['curl', '-sS', '--max-time', '300', '-A', 'Mozilla/5.0', '-o', str(f), url])
            if not (f.exists() and f.read_bytes()[:4] == b'%PDF'):
                f.unlink(missing_ok=True); print(f'  not downloaded: {code} {title}'); continue
        got += 1
        name = re.sub(r'(?i)^unit[- ]?\d+\s*[:.-]?\s*', '', title).strip()
        titles[f.name] = f'Unit {n}: {name}'
    (folder / 'titles.json').write_text(json.dumps(titles, indent=1, ensure_ascii=False))
    print(f'{group} {code}: {got}/{len(units)} units')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('groups', nargs='*', metavar='GROUP', help=', '.join(GROUPS))
    ap.add_argument('--out', default=str(Path(__file__).resolve().parent.parent.parent / 'dc-books' / 'ignou'))
    a = ap.parse_args()
    unknown = set(a.groups) - set(GROUPS)
    if unknown: ap.error(f'unknown group: {", ".join(sorted(unknown))}')
    for group in a.groups or GROUPS:
        for code, handles in GROUPS[group].items():
            fetch(group, code, handles, Path(a.out))


if __name__ == '__main__':
    main()
