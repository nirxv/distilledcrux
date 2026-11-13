"""
Builds lib/toppers/<subject>.json, the list of topper answer copies the site serves.

Reads the reading of each booklet (topper-state-dc/<subject>/<booklet>/scan.json),
written one booklet at a time when the copies were cut: who wrote it, their rank
and exam year, the test, and per answer the question, marks, page range, the
past questions it answers and its topic. Each answer is one PDF in that
booklet's split/ folder; scripts/toppers/publish.mjs uploads them to R2 under
the key recorded here.

Nothing in the output is secret. The PDFs are, and they are served only as
short-lived signed URLs after the access check (lib/toppers/access.ts).

    python3 scripts/toppers/build-data.py sociology

The subject is the route slug (sociology, anthropology, polsci). PSIR's state
folder is topper-state-dc/psir, reached through a polsci symlink.
"""
import glob, json, os, re, sys
from pypdf import PdfReader

SUBJECT = sys.argv[1] if len(sys.argv) > 1 else 'sociology'
STATE = os.path.expanduser(f'~/Desktop/topper-state-dc/{SUBJECT}')
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'lib', 'toppers', f'{SUBJECT}.json')

def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')

def code_slug(code):
    # "Socio 2401" -> "2401", "Anthro 2503A" -> "2503a", "PSIR CC23-1" -> "cc23-1": the subject is in the URL already.
    return slug(re.sub(r'^(Socio|Anthro|PSIR)\s+', '', code))

def source(s):
    series = re.sub(r'\s*\(presumed\)', '', s.get('series', '')).replace('LevelupIAS', 'LevelUp IAS').strip()
    test = s.get('test', '')
    m = re.match(r'(Test\s+\d+)', test)
    return f'{series}, {m.group(1)}' if m else series

copies, seen = [], set()
for f in sorted(glob.glob(f'{STATE}/*/scan.json')):
    s = json.load(open(f))
    if s.get('status', '').startswith(('dropped', 'waiting')) or not s.get('answers'):
        continue
    folder = os.path.dirname(f)
    name = s.get('topper_full') or s['topper']
    for a in s['answers']:
        cid = f"{code_slug(s['test_code'])}-{a['q']}-{slug(name)}"
        # The same topper answering the same paper twice, in different exam years
        # (Manan Bhat wrote the anthropology 2301 paper as AIR 231 in 2022 and AIR 88 in 2023).
        if cid in seen: cid = f"{cid}-{s.get('exam_year')}"
        assert cid not in seen, f'duplicate id {cid}'
        seen.add(cid)
        pdf = os.path.join(folder, 'split', a['pdf'])
        assert os.path.exists(pdf), pdf
        assert a.get('question'), f'{cid}: no question'
        copies.append({
            'id': cid,
            'paper': 'Paper II' if s.get('paper') == 'II' else 'Paper I',
            'question': a['question'],
            'marks': a['marks'],
            'topic': a['topic'],
            'pyqs': a['pyqs'],
            # Answers to the same printed question, for Compare when no PYQ links them.
            'group': f"{code_slug(s['test_code'])}-{a['q']}",
            'topper': name,
            'rank': s.get('rank'),
            'year': s.get('exam_year'),
            'source': source(s),
            'pages': len(PdfReader(pdf).pages),
            'key': f'{SUBJECT}/{cid}.pdf',
            'file': os.path.relpath(pdf, STATE),
        })

copies.sort(key=lambda c: (c['paper'], c['topic'], c['group'], c['rank'] or 9999))
json.dump({'subject': SUBJECT, 'copies': copies}, open(OUT, 'w'), indent=0, ensure_ascii=False)
print(f'{len(copies)} copies -> {os.path.relpath(OUT)} ({os.path.getsize(OUT) // 1024} KB)')

# Counts for client pages (the dashboard, the home page), which must not load the copy list.
COUNTS = os.path.join(os.path.dirname(OUT), 'counts.json')
counts = json.load(open(COUNTS)) if os.path.exists(COUNTS) else {}
counts[SUBJECT] = {'copies': len(copies), 'toppers': len({c['topper'] for c in copies})}
json.dump(counts, open(COUNTS, 'w'), indent=1)
