"""
Add a book to the Chat with Books corpus in Qdrant.

Replaces uploadBook.py, which wrote raw 250-word windows into the Postgres
book_chunks table. That table is gone (lib/vectorStore.ts explains why), and
the windows it cut began and ended mid-sentence with running heads, page
numbers and hyphenated line breaks left in. This reads the PDF's layout
instead of its flat text, so those never get in:

  1. Lines repeated at the same edge of the page (running heads, IGNOU's
     margin titles, NCERT's "Rationalised" footer) and bare page numbers are
     dropped before any text is joined. Two-column pages are read column by
     column.
  2. Words split at a line break are rejoined using the book's own
     vocabulary, so "socio-economic" keeps its hyphen and "move-ment" loses it.
  3. With --profile ignou, the parts of a unit that are not prose are left
     out: the Structure list, Check Your Progress boxes and their answers,
     reading lists and video links, plus the course's credit pages.
  4. The text is cut into passages of about 250 words that start and end on
     sentence boundaries and overlap by up to 50 words, never across files.
  5. Passages that are reference lists, index or contents pages, or too
     garbled to read are marked as junk and are not embedded.

A dry run is the default and touches nothing remote. It writes, under --out:
  <slug>.jsonl      every passage, junk included, as it would be stored
  <slug>-review.md  counts, everything dropped, and sample passages to read
--upload embeds the passages with Voyage (voyage-4-lite, input_type
'document', the counterpart of the 'query' embedding the chat route makes)
and writes them to Qdrant with new ids after the current highest one.

Usage:
  python3 scripts/ingest_book.py "<book title>" <subject> --author "<author>" \
      [--profile ignou|plain] [--out DIR] [--upload [--replace]] PDF_OR_DIR...

  The title must match the value in lib/subjectConfig.ts SUBJECT_BOOKS,
  because single-book chat filters on it exactly. Directories are searched
  for PDFs, and all files are read in natural order (Unit-2 before Unit-10).
  --replace deletes the book's existing points first; without it an upload
  stops if the book is already in the collection.

Needs PyMuPDF (pip install pymupdf) and requests; --upload also needs
VOYAGE_API_KEY, QDRANT_URL and QDRANT_API_KEY in .env.local.
"""
import argparse
import collections
import html
import json
import os
import random
import re
import sys
import time
from pathlib import Path

import fitz  # PyMuPDF

ROOT = Path(__file__).resolve().parent.parent
SUBJECTS = {'sociology', 'anthropology', 'geography', 'polsci', 'pub-admin'}


# ── Layout: lines with their position on the page ────────────────────────────
class Seg:
    """A run of text on one baseline, split wherever the gap between spans
    is wide enough that the two sides belong to different columns."""
    __slots__ = ('page', 'x0', 'y0', 'x1', 'y1', 'text', 'size', 'bold')

    def __init__(self, page, spans):
        self.page = page
        self.x0 = min(s['bbox'][0] for s in spans)
        self.y0 = min(s['bbox'][1] for s in spans)
        self.x1 = max(s['bbox'][2] for s in spans)
        self.y1 = max(s['bbox'][3] for s in spans)
        self.text = ''.join(s['text'] for s in spans).strip()
        chars = [(len(s['text'].strip()), s) for s in spans]
        total = sum(n for n, _ in chars) or 1
        self.size = max(s['size'] for s in spans)
        self.bold = sum(n for n, s in chars if s['flags'] & 16 or 'Bold' in s['font']) / total > 0.5


def page_segments(page, pno):
    segs = []
    for b in page.get_text('dict')['blocks']:
        if b['type'] != 0:
            continue
        for line in b['lines']:
            # Superscript footnote markers ("Mill⁵") would otherwise glue to
            # the word before them.
            spans = [s for s in line['spans'] if s['text'].strip()
                     and not (s['flags'] & 1 and re.fullmatch(r'[\d*†‡,]{1,4}', s['text'].strip()))]
            if not spans:
                continue
            # Horizontal text only: rotated lines are margin furniture.
            if abs(line['dir'][1]) > 0.1:
                continue
            run = [spans[0]]
            for s in spans[1:]:
                if s['bbox'][0] - run[-1]['bbox'][2] > 25:
                    segs.append(Seg(pno, run)); run = []
                run.append(s)
            segs.append(Seg(pno, run))
    return segs


def norm(t):
    return re.sub(r'\s+', ' ', re.sub(r'\d+', '#', t.lower())).strip()


def edge_zone(s, W, H, col):
    """Which edge of the page a segment sits at, if any. The sides count only
    outside the page's text column, so a list marker or section number at the
    left edge of the body text is not mistaken for a margin title."""
    if s.y1 < 0.12 * H: return 'top'
    if s.y0 > 0.90 * H: return 'bottom'
    if col and s.x1 <= col[0] + 2: return 'left'
    if col and s.x0 >= col[1] - 2: return 'right'
    return None


def text_column(segs):
    body = [s for s in segs if len(s.text) > 40]
    if len(body) < 3: return None
    return (min(s.x0 for s in body), max(s.x1 for s in body))


def drop_furniture(pages, dims, log):
    """Running heads, margin titles, footers and page numbers: text at an edge
    of the page that repeats on at least three pages of the same file. Large
    type is exempt: "UNIT 4" opens a page at its top edge in every unit."""
    sizes = collections.Counter()
    for segs in pages:
        for s in segs: sizes[round(s.size)] += len(s.text)
    big = (sizes.most_common(1)[0][0] if sizes else 11) + 3
    cols = [text_column(segs) for segs in pages]
    seen = collections.defaultdict(set)
    for segs, col in zip(pages, cols):
        for s in segs:
            W, H = dims[s.page]
            z = edge_zone(s, W, H, col)
            if z and s.size < big: seen[(z, norm(s.text))].add(s.page)
    out = []
    for segs, col in zip(pages, cols):
        keep = []
        for s in segs:
            W, H = dims[s.page]
            z = edge_zone(s, W, H, col) if s.size < big else None
            if z and (len(seen[(z, norm(s.text))]) >= 3 or re.fullmatch(r'[\divxlcIVXLC]{1,6}', s.text)):
                log['running head / page number'][norm(s.text)[:70]] += 1
                continue
            keep.append(s)
        out.append(keep)
    return out


def reading_order(segs, W):
    """Single-column pages top to bottom; on two-column pages, each band
    between full-width lines is read left column first, then right."""
    mid = W / 2
    left = [s for s in segs if s.x1 <= mid + 10 and len(s.text) > 25]
    right = [s for s in segs if s.x0 >= mid - 10 and len(s.text) > 25]
    if len(left) < 5 or len(right) < 5:
        return sorted(segs, key=lambda s: (round(s.y0), s.x0))
    spanning = sorted((s for s in segs if s.x0 < mid - 10 and s.x1 > mid + 10), key=lambda s: s.y0)
    cols = [s for s in segs if not (s.x0 < mid - 10 and s.x1 > mid + 10)]
    out, top = [], -1e9
    for cut in spanning + [None]:
        bottom = cut.y0 if cut else 1e9
        band = [s for s in cols if top <= s.y0 < bottom]
        out += sorted((s for s in band if (s.x0 + s.x1) / 2 < mid), key=lambda s: (round(s.y0), s.x0))
        out += sorted((s for s in band if (s.x0 + s.x1) / 2 >= mid), key=lambda s: (round(s.y0), s.x0))
        if cut: out.append(cut); top = cut.y0 + 0.1
    return out


def rows_of(segs):
    """Merge segments sharing a baseline (a heading's number and its words,
    a keyword and its definition) into one row."""
    rows = []
    for s in segs:
        if rows and abs((rows[-1][-1].y0 + rows[-1][-1].y1) / 2 - (s.y0 + s.y1) / 2) <= 3 and s.x0 > rows[-1][-1].x0:
            rows[-1].append(s)
        else:
            rows.append([s])
    out = []
    for r in rows:
        r.sort(key=lambda s: s.x0)
        out.append({'page': r[0].page, 'text': re.sub(r'\s+', ' ', ' '.join(s.text for s in r)).strip(),
                    'size': max(s.size for s in r), 'bold': all(s.bold for s in r),
                    'y0': min(s.y0 for s in r), 'y1': max(s.y1 for s in r)})
    return out


# ── Per-file reading, with the IGNOU unit rules ──────────────────────────────
# A course's credit pages. The university's and school's names alone are not
# enough: a unit's first page names its writer's department in a footnote.
BOILERPLATE = ['expert committee', 'course preparation team', 'print production', 'course coordinator',
               'programme coordinator', 'unit writers', 'block preparation team', 'content editor',
               'all rights reserved', 'isbn', 'secretarial assistance', 'cover design', 'laser typeset',
               'printed and published', 'faculty members']
NUM_HEAD = re.compile(r'^(\d{1,2}(?:\.\d{1,2}){1,2})\.?\s+(\S.{1,110})$')
UNIT_HEAD = re.compile(r'^UNIT\s+(\d{1,2})\b\s*(.*)$', re.I)
SKIP_SECTION = re.compile(
    r'^(?:references?|suggested (?:further )?readings?|further readings?|select(?:ed)? references|'
    r'bibliography|(?:some )?useful books|books? for further reading|readings|'
    r'instructional videos? recommendations?|check your progress(?: exercises)?|'
    r'answers? to (?:the )?check your progress(?: exercises)?|specimen answers.*|'
    r'answers? to (?:self[- ])?check exercises?|hints? (?:and|to) answers.*)\s*$', re.I)
ANSWER_SPACE = re.compile(r'(?:\.\s?){8,}|…{3,}|_{6,}')
QUESTION = re.compile(r'^(?:\(?[0-9]{1,2}[.)]|\(?[ivx]{1,4}[.)]|\(?[a-e][.)]|Note\b)', re.I)
URL = re.compile(r'https?://\S+|www\.\S+')


def read_file(path, profile, log):
    doc = fitz.open(path)
    dims = {i: (p.rect.width, p.rect.height) for i, p in enumerate(doc)}
    pages = [page_segments(p, i) for i, p in enumerate(doc)]
    if profile == 'ignou':
        kept = []
        for segs in pages:
            low = ' '.join(s.text for s in segs).lower()
            if sum(sig in low for sig in BOILERPLATE) >= 2 or (
                    'indira gandhi national open university' in low and len(low) < 400):
                log['credit / cover page'][f'{Path(path).name} p{segs[0].page + 1 if segs else "?"}'] += 1
                kept.append([])
            else:
                kept.append(segs)
        pages = kept
    pages = drop_furniture(pages, dims, log)
    rows = []
    for segs in pages:
        if segs:
            rows += rows_of(reading_order(segs, dims[segs[0].page][0]))
    doc.close()
    return rows


def body_size(rows):
    c = collections.Counter()
    for r in rows: c[round(r['size'])] += len(r['text'])
    return c.most_common(1)[0][0] if c else 11


def to_groups(rows, profile, log):
    """Rows -> groups of (kind, text) items, kind 'head' or 'text', one group
    per unit (a file holding a whole course has many). Returns
    [(unit label or None, items)]; what is skipped goes to the log."""
    if not rows: return []
    base = body_size(rows)
    groups, items, label = [], [], None
    skip, i, skipped, skip_title = None, 0, [], ''

    while i < len(rows):
        r = rows[i]; t = r['text']; i += 1
        big = r['size'] >= base + 1.5
        head = NUM_HEAD.match(t) if (big or r['bold']) and len(t) < 120 else None
        um = UNIT_HEAD.match(t) if r['size'] >= base + 3 else None
        if um:
            # The unit's title can run over the next rows at the same size.
            title = um.group(2)
            while i < len(rows) and rows[i]['size'] >= base + 3 and not NUM_HEAD.match(rows[i]['text']) \
                    and not UNIT_HEAD.match(rows[i]['text']) and len(title) < 150:
                title += ' ' + rows[i]['text']; i += 1
            title = re.sub(r'\s+', ' ', title).strip(' *')
            if items: groups.append((label, items))
            label = f'Unit {um.group(1)}: {title.title()}' if title else f'Unit {um.group(1)}'
            items, skip = [('head', label)], None
            continue
        if skip:
            if skip == 'structure':
                ends = head and r['size'] >= base + 2
            else:
                # A section ends at the next heading. A Check Your Progress box
                # can also end with the prose simply resuming: a full line that
                # is neither a question nor answer space, after answer space.
                ends = (head and big) or (big and r['bold'] and len(t) < 100) or (
                    skip == 'box' and skipped and ANSWER_SPACE.search(skipped[-1])
                    and not ANSWER_SPACE.search(t) and not QUESTION.match(t) and len(t) >= 40)
            if not ends:
                skipped.append(t); continue
            if len(skipped) > 40:   # long skips are worth a look in the review
                log['long skips (rows: first … last)'][f"{skip_title} ({len(skipped)} rows): {skipped[0][:50]} … {skipped[-1][:60]}"] += 1
            skip = None
        if profile == 'ignou':
            title = head.group(2) if head else t
            if t.strip() == 'Structure' and (r['bold'] or big):
                skip, skipped, skip_title = 'structure', [], 'Structure'; log['IGNOU section left out']['Structure (unit contents list)'] += 1; continue
            box = re.match(r'^Check Your Progress\b', t, re.I) and r['bold'] and not head
            if box or SKIP_SECTION.match(title.strip()):
                skip, skipped, skip_title = 'box' if box else 'section', [], title.strip()[:40]
                log['IGNOU section left out'][re.sub(r'[-–\s]*\d+$', '', title.strip()).title()] += 1; continue
            if re.match(r'^\*\s?(?:Dr|Prof|Mr|Ms|Mrs|Shri|Smt)\b|^\*\s?(?:Contributed|Adapted|Written|Revised|Edited) by', t):
                log['contributor note']['* Dr. …'] += 1; continue
        if re.fullmatch(r'[.\s…_·-]{3,}', t) or not re.search(r'[A-Za-z]', t):
            continue
        if re.search(r'Photograph Source|Image Source|^Source\s*:\s*(?:https?|www)', t, re.I):
            log['caption source']['Photograph Source: …'] += 1; continue
        if URL.fullmatch(t.strip()):
            log['bare URL']['http…'] += 1; continue
        items.append(('head', head.group(2).strip()) if head and big else ('text', t))
    if items: groups.append((label, items))
    return groups


# ── Text clean-up ─────────────────────────────────────────────────────────────
LIG = {'ﬀ': 'ff', 'ﬁ': 'fi', 'ﬂ': 'fl', 'ﬃ': 'ffi', 'ﬄ': 'ffl', 'ﬅ': 'st', 'ﬆ': 'st'}
WORDS = set()
if os.path.exists('/usr/share/dict/words'):
    WORDS = {w.strip().lower() for w in open('/usr/share/dict/words')}
PREFIXES = set('self non anti pre post semi multi inter co neo ex quasi pan sub super ultra cross counter intra '
               'extra socio macro micro mid pro well ill sino indo afro euro'.split())


def basic(t):
    for k, v in LIG.items(): t = t.replace(k, v)
    t = re.sub(r'[\x00-\x08\x0b-\x1f\x7f​­]', '', t)
    t = re.sub(r'[-•▪■◆●❖☐□➢►✓]', ' ', t)    # bullets, incl. Symbol-font private use
    t = re.sub(r'(?:\.\s?){4,}|…{2,}|_{3,}', ' ', t)        # dot leaders and answer blanks
    return t


def vocab_of(items):
    v, h = collections.Counter(), collections.Counter()
    for _, t in items:
        v.update(w.lower() for w in re.findall(r'(?<![\w-])[A-Za-z]+(?![\w-])', t))
        h.update(w.lower() for w in re.findall(r'(?<![\w-])[A-Za-z]+-[A-Za-z]+(?![\w-])', t))
    return v, h


def join_rows(rows_text, V, Hy, log):
    """Join a paragraph's rows, deciding at each line-end hyphen whether the
    word was split by the layout or is really hyphenated."""
    out = rows_text[0]
    for nxt in rows_text[1:]:
        m, n = re.search(r'([A-Za-z]+)-$', out), re.match(r'([a-z]+)', nxt)
        if m and n:
            left, right = m.group(1), n.group(1)
            joined, hyph = (left + right).lower(), f'{left}-{right}'.lower()
            # Typeset text: a hyphen at a line end is a real one (Nafais-ul,
            # watan-jagirs) unless the joined word is known.
            if V[joined] >= 1 and V[joined] >= Hy[hyph]: keep = False
            elif Hy[hyph] >= 1 or left.lower() in PREFIXES: keep = True
            else: keep = joined not in WORDS and joined.rstrip('s') not in WORDS
            if keep: out += nxt
            else: out = out[:-1] + nxt; log['line-break hyphen joined'][f'{left}- {right}'] += 1
        else:
            out += ' ' + nxt
    return out


def finish(t):
    t = html.unescape(t)
    t = re.sub(r'\s+', ' ', t)
    t = re.sub(r' ([,.;:)])', r'\1', t)
    return t.strip()


# ── Sentences and passages ───────────────────────────────────────────────────
ABBR = {'mr', 'mrs', 'dr', 'st', 'sir', 'c', 'ca', 'cf', 'viz', 'vol', 'vols', 'pp', 'p', 'ed', 'eds', 'no', 'nos',
        'fig', 'figs', 'ch', 'chap', 'sec', 'ff', 'op', 'cit', 'ibid', 'e.g', 'i.e', 'etc', 'a.d', 'b.c', 'b.c.e', 'c.e',
        'lt', 'col', 'gen', 'capt', 'jr', 'sr', 'vs', 'v', 's', 'rs', 'mt', 'ft', 'art', 'arts', 'prof', 'sq', 'ms',
        'tr', 'trans', 'comp', 'repr', 'km', 'cm', 'mm', 'approx', 'govt', 'dept', 'est', 'inc', 'ltd', 'co', 'sl'}
END = re.compile(r'[.?!]["”’\')\]]*(?=\s+["“‘(\[]?[A-Z0-9])')


def sentences(t):
    out, start = [], 0
    for m in END.finditer(t):
        if t[m.start()] == '.':
            w = (re.search(r'([A-Za-z.]+)$', t[max(0, m.start() - 12):m.start()]) or [None, ''])[1].lower().strip('.')
            if w in ABBR or len(w) == 1: continue
        out.append(t[start:m.end()].strip()); start = m.end()
    if t[start:].strip(): out.append(t[start:].strip())
    return [s for s in out if s]


TARGET, MAX_WORDS, OVERLAP, MIN_TAIL = 250, 400, 50, 80


def passages(units):
    """units: (kind, text), kind 'head' or 'sent'. Passages of about TARGET
    words. A heading never ends a passage, a passage that would start at a
    heading starts there, and otherwise the next passage repeats up to OVERLAP
    words of whole sentences from the end of the previous one."""
    flat = []
    for kind, t in units:
        w = t.split()
        if len(w) > MAX_WORDS:                              # a table or run-on block: cut by words
            flat += [(kind, ' '.join(w[j:j + TARGET])) for j in range(0, len(w), TARGET)]
        else:
            flat.append((kind, t))
    out, cur = [], []                                       # cur: (kind, text, is_new)

    def size(seq): return sum(len(u[1].split()) for u in seq)

    for kind, t in flat:
        n, add = size(cur), len(t.split())
        if any(u[2] for u in cur) and (n >= TARGET or n + add > MAX_WORDS or (kind == 'head' and n >= 0.6 * TARGET)):
            heads = []
            while cur and cur[-1][0] == 'head': heads.insert(0, cur.pop())
            out.append(' '.join(u[1] for u in cur))
            back, k = [], 0
            if kind != 'head' and not heads:
                for u in reversed(cur):
                    if u[0] == 'head' or k + len(u[1].split()) > OVERLAP: break
                    back.insert(0, (u[0], u[1], False)); k += len(u[1].split())
            cur = back + heads
        cur.append((kind, t, True))
    while cur and cur[-1][0] == 'head': cur.pop()
    new = [u for u in cur if u[2]]
    if new:
        if out and size(new) < MIN_TAIL and len(out[-1].split()) + size(new) <= MAX_WORDS + 60:
            out[-1] += ' ' + ' '.join(u[1] for u in new)    # a short tail joins the passage before it
        else:
            out.append(' '.join(u[1] for u in cur))
    return out


# ── Junk (mirrors the rules used on the existing corpus) ─────────────────────
def readability(t):
    toks = [w for w in t.split() if w.strip('|-–—:')]
    if not toks: return 0.0
    good = 0
    for w in toks:
        core = w.strip('.,;:!?()[]"“”‘’\'—–-')
        if not core: continue
        lc = core.lower()
        if (lc in WORDS or lc.rstrip('s') in WORDS or re.fullmatch(r"[A-Z][a-zāīūṛṣṇṭḍśñ]+(?:[-'][A-Za-z]+)?", core)
                or re.fullmatch(r'\d{1,4}(?:[-–.]\d{1,4})?(?:s|th|st|nd|rd|%)?', core)):
            good += 1
    return good / len(toks)


def junk_reason(t):
    if len(re.findall(r'\b\d{1,4}(?:[-–]\d{1,4})?n?\.?,\s', t)) >= 12 and len(re.findall(r'[A-Za-z\)]\s?,\s\d{1,4}\b', t)) >= 8:
        return 'index'
    if len(re.findall(r'(University Press|Publishers|Publishing House|\beds?\.|\bVol\.|\bpp\.|London:|Delhi:|Calcutta:|'
                      r'Cambridge:|Oxford:|Bombay:|New York:|Jaipur:|Boston:)', t)) >= 7:
        return 'bibliography'
    refs = len(re.findall(r'\b[A-Z][a-z]+, (?:[A-Z]\. ?){1,3}', t)) + len(re.findall(r'\bpp?\.\s?\d|\(eds?\.?\)|\beds?\.', t))
    if len(re.findall(r'\((?:[A-Z][a-z]+\.?,? ?){1,3}\d{4}\)', t)) >= 4 and refs >= 3: return 'bibliography'
    if len(re.findall(r'\bCHAPTER\s+\d+', t)) >= 5 or len(re.findall(r'\b(?:Unit|UNIT) \d+\b', t)) >= 6: return 'contents'
    if re.search(r'ISBN|All rights reserved|Library of Congress|Printed and bound|Printed in India', t, re.I): return 'front matter'
    if len(t) < 250: return 'too short'
    if readability(t) < 0.62: return 'unreadable'
    return None


# ── Book assembly ────────────────────────────────────────────────────────────
def natural_key(p):
    return [int(x) if x.isdigit() else x.lower() for x in re.split(r'(\d+)', str(p))]


def collect(paths):
    files = []
    for p in map(Path, paths):
        files += sorted(p.rglob('*.pdf'), key=natural_key) if p.is_dir() else [p]
    return files


def course_of(path):
    """The course code nearest the file in its path: .../ESO-13/Unit-4.pdf."""
    m = re.findall(r'\b([A-Z]{2,6}[- ]?\d{2,3}[A-Z]?)\b', str(path))
    return m[-1].replace(' ', '-') if m else None


def build(files, profile, log):
    per_file = []
    for f in files:
        per_file.append((f, course_of(f.relative_to(f.anchor)), to_groups(read_file(f, profile, log), profile, log)))
    V, Hy = vocab_of([it for _, _, groups in per_file for _, items in groups for it in items])
    chunks = []
    for f, course, groups in per_file:
        for label, items in groups:
            source = ' · '.join(x for x in (course, label) if x) or f.stem
            units, para = [], []

            def close_para():
                if para:
                    units.extend(('sent', s) for s in sentences(finish(basic(join_rows(para, V, Hy, log)))))
                    para.clear()
            for kind, t in items:
                if kind == 'head':
                    close_para(); h = finish(basic(t))
                    if h: units.append(('head', h))
                else:
                    para.append(t)
            close_para()
            for text in passages(units):
                text = finish(text)
                chunks.append({'source': source, 'file': f.name, 'text': text, 'junk_reason': junk_reason(text)})
    return chunks


# ── Remote: Voyage and Qdrant ────────────────────────────────────────────────
def load_env():
    env = dict(os.environ)
    f = ROOT / '.env.local'
    if f.exists():
        for line in f.read_text().splitlines():
            m = re.match(r'^([A-Z0-9_]+)=(.*)$', line.strip())
            if m and m.group(1) not in os.environ: env[m.group(1)] = m.group(2).strip().strip('"\'')
    return env


class Remote:
    def __init__(self, env):
        import requests
        self.rq = requests
        self.base = env.get('QDRANT_URL', '').rstrip('/')
        self.key = env.get('QDRANT_API_KEY')
        self.coll = env.get('QDRANT_COLLECTION') or 'book_chunks'
        self.voyage = env.get('VOYAGE_API_KEY')
        if not (self.base and self.key and self.voyage):
            sys.exit('Set QDRANT_URL, QDRANT_API_KEY and VOYAGE_API_KEY in .env.local first.')

    def q(self, method, path, body=None):
        for attempt in range(5):
            r = self.rq.request(method, f'{self.base}/collections/{self.coll}{path}', json=body,
                                headers={'api-key': self.key}, timeout=120)
            if r.status_code < 500: break
            time.sleep(5 * (attempt + 1))
        if not r.ok: sys.exit(f'Qdrant {method} {path} -> {r.status_code}: {r.text[:300]}')
        return r.json().get('result')

    def book_filter(self, title):
        return {'must': [{'key': 'book_title', 'match': {'value': title}}]}

    def count(self, title=None):
        body = {'exact': True}
        if title: body['filter'] = self.book_filter(title)
        return self.q('POST', '/points/count', body)['count']

    def max_id(self):
        best, offset = 0, None
        while True:
            body = {'limit': 10000, 'with_payload': False, 'with_vector': False}
            if offset is not None: body['offset'] = offset
            res = self.q('POST', '/points/scroll', body)
            for p in res['points']:
                if isinstance(p['id'], int): best = max(best, p['id'])
            offset = res.get('next_page_offset')
            if offset is None: return best

    def delete_book(self, title):
        self.q('POST', '/points/delete?wait=true', {'filter': self.book_filter(title)})

    def embed(self, texts):
        for attempt in range(6):
            r = self.rq.post('https://api.voyageai.com/v1/embeddings', timeout=120,
                             headers={'Authorization': f'Bearer {self.voyage}'},
                             json={'model': 'voyage-4-lite', 'input': texts, 'input_type': 'document'})
            if r.ok: return [d['embedding'] for d in sorted(r.json()['data'], key=lambda d: d['index'])], r.json()['usage']['total_tokens']
            if r.status_code in (429, 500, 502, 503, 504):
                wait = 20 * (attempt + 1); print(f'  Voyage {r.status_code}, retrying in {wait}s'); time.sleep(wait); continue
            sys.exit(f'Voyage -> {r.status_code}: {r.text[:300]}')
        sys.exit('Voyage: gave up after retries')

    def upsert(self, points):
        self.q('PUT', '/points?wait=true', {'points': points})


def upload(chunks, title, author, subject, replace):
    rm = Remote(load_env())
    existing = rm.count(title)
    if existing and not replace:
        sys.exit(f'"{title}" already has {existing} points in Qdrant. Re-run with --replace to rebuild it.')
    if existing:
        print(f'deleting {existing} existing points for "{title}"'); rm.delete_book(title)
    keep = [c for c in chunks if not c['junk_reason']]
    start = rm.max_id() + 1
    print(f'embedding and writing {len(keep)} passages as ids {start}–{start + len(keep) - 1}')
    tokens, BATCH = 0, 64
    for i in range(0, len(keep), BATCH):
        batch = keep[i:i + BATCH]
        vecs, used = rm.embed([c['text'] for c in batch]); tokens += used
        rm.upsert([{'id': start + i + j, 'vector': v,
                    'payload': {'content': c['text'], 'text': c['text'], 'book_title': title, 'author': author,
                                'subject': subject, 'junk': False, 'source': c['source']}}
                   for j, (c, v) in enumerate(zip(batch, vecs))])
        for j, c in enumerate(batch): c['id'] = start + i + j
        print(f'  {min(i + BATCH, len(keep))}/{len(keep)}', flush=True)
    got = rm.count(title)
    print(f'done: {got} points for "{title}" in Qdrant, {tokens:,} Voyage tokens')
    if got != len(keep): sys.exit(f'expected {len(keep)} points, found {got}')


# ── Report ────────────────────────────────────────────────────────────────────
def report(chunks, log, files, title, path):
    junk = collections.Counter(c['junk_reason'] for c in chunks if c['junk_reason'])
    keep = [c for c in chunks if not c['junk_reason']]
    words = [len(c['text'].split()) for c in keep]
    L = [f'# {title}', '', f'{len(files)} files, {len(chunks)} passages: {len(keep)} kept, '
         f'{sum(junk.values())} junk ({", ".join(f"{k} {v}" for k, v in junk.most_common()) or "none"}).']
    if words:
        words.sort()
        L.append(f'Words per kept passage: median {words[len(words) // 2]}, min {words[0]}, max {words[-1]}.')
    L += ['', '## Left out while reading', '']
    for rule, c in log.items():
        L.append(f'- **{rule}**: {sum(c.values())}')
        for k, n in c.most_common(25): L.append(f'  - {n} × {k}')
    L += ['', '## Junk passages', '']
    for c in chunks:
        if c['junk_reason']: L.append(f"- [{c['junk_reason']}] {c['source']}: {c['text'][:160]}…")
    L += ['', '## Sample passages', '']
    for c in random.Random(7).sample(keep, min(20, len(keep))):
        L += [f"### {c['source']}", '', c['text'], '']
    Path(path).write_text('\n'.join(L))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('title'); ap.add_argument('subject', choices=sorted(SUBJECTS))
    ap.add_argument('inputs', nargs='+')
    ap.add_argument('--author', required=True)
    ap.add_argument('--profile', choices=['ignou', 'plain'], default='plain')
    ap.add_argument('--out', default=str(ROOT.parent / 'dc-books' / 'out'))
    ap.add_argument('--upload', action='store_true')
    ap.add_argument('--replace', action='store_true')
    a = ap.parse_args()

    files = collect(a.inputs)
    if not files: sys.exit('no PDFs found')
    log = collections.defaultdict(collections.Counter)
    chunks = build(files, a.profile, log)
    slug = re.sub(r'[^a-z0-9]+', '-', a.title.lower()).strip('-')
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    if a.upload:
        upload(chunks, a.title, a.author, a.subject, a.replace)
    with open(out / f'{slug}.jsonl', 'w') as f:
        for c in chunks:
            f.write(json.dumps({'book_title': a.title, 'author': a.author, 'subject': a.subject, **c}, ensure_ascii=False) + '\n')
    report(chunks, log, files, a.title, out / f'{slug}-review.md')
    kept = sum(1 for c in chunks if not c['junk_reason'])
    print(f'{a.title}: {len(chunks)} passages, {kept} kept -> {out / (slug + "-review.md")}')


if __name__ == '__main__':
    main()
