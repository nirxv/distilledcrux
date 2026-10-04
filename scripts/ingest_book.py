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
     reading lists and video links, plus the course's credit pages. With
     --profile ncert, each chapter's exercises and project work are.
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
      [--profile ignou|ncert|plain] [--out DIR] [--upload [--replace]] PDF_OR_DIR...

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
import itertools
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
    __slots__ = ('page', 'block', 'x0', 'y0', 'x1', 'y1', 'text', 'size', 'bold')

    def __init__(self, page, spans, block=None):
        self.page, self.block = page, block
        self.x0 = min(s['bbox'][0] for s in spans)
        self.y0 = min(s['bbox'][1] for s in spans)
        self.x1 = max(s['bbox'][2] for s in spans)
        self.y1 = max(s['bbox'][3] for s in spans)
        # Spans that touch belong to one word (a small-caps heading is set as
        # "L" + "ANDFORMS"); a gap wider than a fifth of the type is a space.
        text = spans[0]['text']
        for a, b in zip(spans, spans[1:]):
            gap = b['bbox'][0] - a['bbox'][2]
            text += (' ' if gap > 0.2 * b['size'] and not text.endswith(' ') and not b['text'].startswith(' ') else '') + b['text']
        self.text = re.sub(r'\s+', ' ', text).strip()
        chars = [(len(s['text'].strip()), s) for s in spans]
        total = sum(n for n, _ in chars) or 1
        self.size = max(s['size'] for s in spans)
        self.bold = sum(n for n, s in chars if s['flags'] & 16 or 'Bold' in s['font']) / total > 0.5


def page_segments(page, pno):
    """Some PDFs draw a heading several times over, slightly offset, for a
    bold or outlined look, which reads back as "W W W W WORLD ORLD ORLD". A
    character already drawn at the same spot is dropped, so one copy is left."""
    seen = set()

    def dup(c, x, y):
        kx, ky = round(x), round(y)
        return any((c, kx + dx, ky + dy) in seen for dx in (-1, 0, 1) for dy in (-1, 0, 1))
    segs = []
    # Without the image flag: a scanned page's picture would otherwise be
    # copied into every extraction.
    for bi, b in enumerate(page.get_text('rawdict', flags=fitz.TEXTFLAGS_RAWDICT & ~fitz.TEXT_PRESERVE_IMAGES)['blocks']):
        if b['type'] != 0:
            continue
        for line in b['lines']:
            # Horizontal text only: rotated lines are margin furniture.
            if abs(line['dir'][1]) > 0.1:
                continue
            spans = []
            for sp in line['spans']:
                chars = []
                for ch in sp['chars']:
                    if ch['c'].strip():
                        if dup(ch['c'], *ch['origin']): continue
                        seen.add((ch['c'], round(ch['origin'][0]), round(ch['origin'][1])))
                    chars.append(ch)
                text = ''.join(ch['c'] for ch in chars)
                # Some fonts map plain letters into the private-use area
                # (U+F055 for "U"). Symbol fonts are left alone: there U+F061 is α.
                if 'Symbol' not in sp['font']:
                    text = re.sub('[\uf020-\uf07e]', lambda m: chr(ord(m.group(0)) - 0xf000), text)
                ink = [ch for ch in chars if ch['c'].strip()]
                if not ink:
                    continue
                # Superscript footnote markers ("Mill⁵") would glue to the word
                # before them, so they go; after a number they are an exponent.
                if sp['flags'] & 1 and re.fullmatch(r'[\d*†‡,]{1,4}', text.strip()):
                    if spans and spans[-1]['text'].rstrip()[-1:].isdigit() and text.strip().isdigit():
                        text = text.strip().translate(SUPERSCRIPT)
                    else:
                        continue
                spans.append({'bbox': (ink[0]['bbox'][0], sp['bbox'][1], ink[-1]['bbox'][2], sp['bbox'][3]),
                              'text': text, 'size': sp['size'], 'flags': sp['flags'], 'font': sp['font']})
            if not spans:
                continue
            run = [spans[0]]
            for sp in spans[1:]:
                if sp['bbox'][0] - run[-1]['bbox'][2] > 25:
                    segs.append(Seg(pno, run, bi)); run = []
                run.append(sp)
            segs.append(Seg(pno, run, bi))
    return segs


SUPERSCRIPT = str.maketrans('0123456789', '⁰¹²³⁴⁵⁶⁷⁸⁹')


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
    of the page that repeats on at least three pages of the book. Large type
    is exempt ("UNIT 4" opens a page at its top edge in every unit), and so
    are section headings that happen to fall at the top of a page."""
    sizes = collections.Counter()
    for segs in pages:
        for s in segs: sizes[round(s.size)] += len(s.text)
    body = sizes.most_common(1)[0][0] if sizes else 11
    big = body + 3
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
            z = edge_zone(s, W, H, col) if s.size < big and not KEEP_AT_EDGE.match(s.text) else None
            # Small type needs only two sightings: a short chapter shows its
            # running head on just two pages.
            need = 2 if s.size <= 0.85 * body else 3
            if z and (len(seen[(z, norm(s.text))]) >= need or re.fullmatch(r'[\divxlcIVXLC]{1,6}', s.text)):
                log['running head / page number'][norm(s.text)[:70]] += 1
                continue
            keep.append(s)
        out.append(keep)
    return out


def blocks_of(segs):
    """Group segments by the PDF's text block, so a boxed aside or a table
    inside a column is read whole instead of line by line with the text
    beside it. Each block: (x0, y0, x1, y1, segments in reading order)."""
    groups = collections.defaultdict(list)
    for s in segs: groups[s.block].append(s)
    out = []
    for g in groups.values():
        g.sort(key=lambda s: (round(s.y0), s.x0))
        out.append((min(s.x0 for s in g), min(s.y0 for s in g), max(s.x1 for s in g), max(s.y1 for s in g), g))
    return out


def reading_order(segs, W):
    """Single-column pages top to bottom; on two-column pages, each band
    between full-width blocks is read left column first, then right. Text is
    taken a block at a time."""
    mid = W / 2
    # A chapter's first page can have only its title in the left column, so
    # the right column alone decides; single-column body text never starts
    # right of the middle.
    left = [s for s in segs if s.x1 <= mid + 10]
    right = [s for s in segs if s.x0 >= mid - 10 and len(s.text) > 25]
    if len(left) < 2 or len(right) < 3:
        return [s for b in sorted(blocks_of(segs), key=lambda b: (round(b[1]), b[0])) for s in b[4]]
    # A chapter's title comes first wherever it sits (above the right
    # column, or halfway down the left), together with the small letters of
    # a small-caps title.
    sizes = sorted(s.size for s in segs)
    large = 1.4 * sizes[len(sizes) // 2]
    title = {id(s) for s in segs if s.size >= large and len(s.text) >= 3}
    grew = True
    while grew:
        grew = False
        for s in segs:
            if id(s) not in title and any(id(c) in title and touching(c, s) for c in segs):
                title.add(id(s)); grew = True
    out = sorted((s for s in segs if id(s) in title), key=lambda s: (round(s.y0), s.x0))
    blocks = blocks_of([s for s in segs if id(s) not in title])

    def spans_mid(b): return b[0] < mid - 10 and b[2] > mid + 10
    spanning = sorted((b for b in blocks if spans_mid(b)), key=lambda b: b[1])
    cols = [b for b in blocks if not spans_mid(b)]
    top = -1e9
    for cut in spanning + [None]:
        bottom = cut[1] if cut else 1e9
        band = [b for b in cols if top <= b[1] < bottom]
        for side in (lambda b: (b[0] + b[2]) / 2 < mid, lambda b: (b[0] + b[2]) / 2 >= mid):
            for b in sorted((b for b in band if side(b)), key=lambda b: (round(b[1]), b[0])):
                out += b[4]
        if cut: out += cut[4]; top = cut[1] + 0.1
    return out


def touching(a, b):
    """Same line and no real gap: pieces of one word or heading."""
    gap = max(a.x0, b.x0) - min(a.x1, b.x1)
    return abs((a.y0 + a.y1) / 2 - (b.y0 + b.y1) / 2) <= 3 and gap <= 0.5 * max(a.size, b.size)


def rows_of(segs):
    """Merge segments sharing a baseline (a heading's number and its words,
    a keyword and its definition) into one row."""
    rows = []
    for s in segs:
        # Compared with the row's first piece, so a small-caps heading's large
        # and small letters, which do not share a top edge, still join up.
        # Pieces in very different sizes join only if they touch, so a title
        # never swallows the body line level with it in the next column.
        if rows and abs((rows[-1][0].y0 + rows[-1][0].y1) / 2 - (s.y0 + s.y1) / 2) <= 3 and (
                (s.block == rows[-1][0].block and max(s.size, rows[-1][0].size) <= 1.3 * min(s.size, rows[-1][0].size))
                or any(touching(r, s) for r in rows[-1])):
            rows[-1].append(s)
        else:
            rows.append([s])
    out = []
    for r in rows:
        r.sort(key=lambda s: s.x0)
        # Pieces that touch are one word split across draws ("Common Pr" +
        # "operty"); a visible gap is a space.
        text = r[0].text
        for prev, s in zip(r, r[1:]):
            text += ('' if s.x0 - prev.x1 < 0.15 * s.size else ' ') + s.text
        out.append({'page': r[0].page, 'text': re.sub(r'\s+', ' ', text).strip(),
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
FIG_CAPTION = re.compile(r'^(?:Fig(?:ure)?|Plate|Map)\.?\s?\d+(?:\.\d+)?\s?[:.–-]', re.I)
KEEP_AT_EDGE = re.compile(r'^(?:Check Your Progress|\d{1,2}\.\d{1,2}\.?\s+[A-Za-z])', re.I)


def is_credit_page(segs):
    low = ' '.join(s.text for s in segs).lower()
    return sum(sig in low for sig in BOILERPLATE) >= 2 or (
        'indira gandhi national open university' in low and len(low) < 400)


def read_book(files, profile, log):
    """Every file's rows, with running heads judged across the whole book:
    a short NCERT chapter has too few pages to show its head three times."""
    pages, dims, owner, heads = [], [], [], []
    for fi, f in enumerate(files):
        doc = fitz.open(f)
        for i, p in enumerate(doc):
            segs = page_segments(p, len(pages))
            if profile == 'ignou' and segs and is_credit_page(segs):
                log['credit / cover page'][f'{Path(f).name} p{i + 1}'] += 1
                segs = []
            H = p.rect.height
            if profile == 'scan':
                # A scan's watermark lines and running head sit in fixed bands
                # at the top and bottom; OCR spells them differently on every
                # page, so they are cut by position rather than by repetition.
                # The head is kept aside to name the chapter.
                band = lambda s: (s.y0 + s.y1) / 2 / H
                heads.append(' '.join(s.text for s in sorted(segs, key=lambda s: s.x0) if 0.025 <= band(s) < SCAN_TOP))
                cut = [s for s in segs if band(s) < SCAN_TOP or band(s) > SCAN_BOTTOM]
                for s in cut: log['scan margin (watermark, running head)'][norm(s.text)[:50]] += 1
                segs = [s for s in segs if SCAN_TOP <= band(s) <= SCAN_BOTTOM]
            pages.append(segs); dims.append((p.rect.width, H)); owner.append(fi)
        doc.close()
    pages = drop_furniture(pages, dims, log)
    labels = chapter_labels(heads, log) if profile == 'scan' else [None] * len(pages)
    per_file = [[] for _ in files]
    for g, segs in enumerate(pages):
        if profile == 'ncert' and any(s.text.startswith('This unit deals with') for s in segs):
            log['NCERT unit opener page']['UNIT … This unit deals with …'] += 1
            continue
        if segs:
            per_file[owner[g]] += [{**r, 'label': labels[g]} for r in rows_of(reading_order(segs, dims[g][0]))]
    return [tidy_rows(rows, log) for rows in per_file]


SCAN_TOP, SCAN_BOTTOM = 0.064, 0.955
# A footnote's reference: "1 White, L. D. : Introduction to…", "* Tead, Ordway :".
FOOTNOTE = re.compile(r"^(?:\d{1,2}|[*†‡§])\s*[A-Z][A-Za-z'’-]+,\s*(?:(?:[A-Z]\.\s*){1,3}|[A-Z][a-z]+\s*[:;,])")
WATERMARK = re.compile(r'\S*(?:upscpdf|upsepdt|t\.me/|UPSC_?PDF|https?:|ttps?:|nttps)\S*|\bWebsite\s*[=>➡:~-]*', re.I)


def chapter_labels(heads, log):
    """Name each scanned page's chapter from the running heads. Right-hand
    pages carry the chapter's title and left-hand pages the book's; OCR
    spells both a little differently each time, so variants are matched to
    the most common spelling. A page without its own chapter head (a
    left-hand page, a chapter opener) takes the next one that has it."""
    import difflib
    def clean(h):
        h = WATERMARK.sub(' ', h)
        h = re.sub(r'[^A-Za-z&,\- ]', ' ', h)
        return re.sub(r'\s+', ' ', h).strip().upper()
    raw = [clean(h) for h in heads]
    counts = collections.Counter(h for h in raw if len(h) >= 4)
    book = counts.most_common(1)[0][0] if counts else ''
    canon, order = {}, [h for h, _ in counts.most_common()]
    for h in order:
        best = next((c for c in order if counts[c] >= counts[h] and c != h
                     and difflib.SequenceMatcher(None, h, c).ratio() >= 0.8), None)
        canon[h] = canon.get(best, best) if best else h
    page = [canon.get(h) if h and canon.get(h) != book and counts[canon.get(h)] >= 2 else None for h in raw]
    out, nxt = [None] * len(page), None
    for i in range(len(page) - 1, -1, -1):
        nxt = page[i] or nxt
        out[i] = nxt
    last = None                                   # pages after the final head
    for i, lab in enumerate(out):
        last = lab or last
        out[i] = lab or last
    # A misread head can name the wrong chapter for a page or two: a short run
    # whose chapter already came earlier is folded into the run before it.
    runs = [[lab, len(list(g))] for lab, g in itertools.groupby(out)]
    seen, fixed = set(), []
    for k, (lab, n) in enumerate(runs):
        if fixed and n <= 2 and (lab in seen or (k + 1 < len(runs) and runs[k + 1][0] == fixed[-1][0])):
            log['chapter head misread, page folded in'][f'{lab} → {fixed[-1][0]}'] += n
            fixed[-1][1] += n
        elif fixed and fixed[-1][0] == lab:
            fixed[-1][1] += n
        else:
            fixed.append([lab, n]); seen.add(lab)
    out = [smart_title(lab) if lab else None for lab, n in fixed for _ in range(n)]
    for lab, n in collections.Counter(out).most_common():
        log['chapter (pages)'][f'{lab} ({n})'] += 1
    return out


def tidy_rows(rows, log):
    """A drop cap is its own row ("A" then "fter weathering…"): put it back.
    Letter-spaced ornaments ("C H A P T E R") go."""
    if not rows: return rows
    base = body_size(rows)
    out, carry = [], ''
    for r in rows:
        t = r['text']
        if re.fullmatch(r'[A-Z]', t) and r['size'] >= 1.8 * base:
            carry = t; continue
        if re.fullmatch(r'(?:[A-Z] ){3,}[A-Z]', t):
            log['ornament']['C H A P T E R'] += 1; continue
        if carry:
            if re.match(r'[a-z]', t): r = {**r, 'text': carry + t}
            else: out.append({**r, 'text': carry})
            carry = ''
        out.append(r)
    return out


def shifted_font(t):
    """Text from a font whose codes are offset by 29 ("&KDQJHV" for
    "Changes"), as in some NCERT charts: few real words as read, mostly real
    words once shifted back."""
    toks = re.findall(r'[^\s]{4,}', t)
    if len(toks) < 2: return False
    def share(ws): return sum(w.lower().strip('.,;:()') in WORDS for w in ws) / len(ws)
    back = [''.join(chr(ord(c) + 29) if 0x21 <= ord(c) <= 0x5d else c for c in w) for w in toks]
    return share(toks) < 0.2 and share(back) >= 0.4


def is_word(w):
    """In the dictionary, allowing for the inflections it leaves out."""
    lw = w.lower()
    if lw in WORDS: return True
    if '-' in lw: return all(is_word(p) for p in lw.split('-') if p)
    for suf, rep_ in (('ies', 'y'), ('es', ''), ('s', ''), ('ed', ''), ('ed', 'e'), ('d', ''), ('ing', ''), ('ing', 'e'), ('ly', '')):
        if lw.endswith(suf) and len(lw) > len(suf) + 2:
            stem = lw[:-len(suf)]
            if stem + rep_ in WORDS: return True
            if suf in ('ed', 'ing') and len(stem) > 3 and stem[-1] == stem[-2] and stem[:-1] in WORDS: return True  # incurred
    return False


def ocr_garbage(t):
    """A row OCR made from a shaded box, a map or a figure: several tokens,
    few of them words, and the capitals and symbols of map labels. A line of
    prose with a couple of misread words is kept."""
    toks = [w.strip('.,;:()[]"“”‘’\'!?') for w in t.split()]
    toks = [w for w in toks if w]
    if len(toks) < 3: return False
    ok = sum(1 for w in toks if is_word(w) or re.fullmatch(r'[A-Z][a-z]+', w) or re.fullmatch(r'[\d,.%–-]+', w))
    share = ok / len(toks)
    letters = [c for c in t if c.isalpha()]
    upper = sum(c.isupper() for c in letters) / max(1, len(letters))
    symbols = sum(1 for c in t if not (c.isalnum() or c.isspace() or c in ".,;:'’-()")) / max(1, len(t))
    return share < 0.2 or (share < 0.45 and (upper >= 0.5 or symbols >= 0.08))


SMALL_WORDS = set('a an and as at by for from in into of on or the to with its'.split())


def smart_title(t, first=True):
    """Title case for a heading set in capitals; anything else is kept.
    first=False for the second line of a heading, whose opening word is not
    the title's first."""
    t = re.sub(r'\s+', ' ', t).strip(' *')
    letters = [c for c in t if c.isalpha()]
    if not letters or sum(c.isupper() for c in letters) < 0.8 * len(letters):
        return t
    words = t.lower().split(' ')
    return ' '.join(w if ((i or not first) and w in SMALL_WORDS) else '-'.join(p[:1].upper() + p[1:] for p in w.split('-'))
                    for i, w in enumerate(words))


def ncert_label(path, rows):
    """'Chapter 6: Landforms and Their Evolution', from the file name and the
    large type that opens the chapter's first page."""
    m = re.search(r'(\d{2})$', Path(path).stem)
    chapter = f'Chapter {int(m.group(1))}' if m else Path(path).stem
    if not rows: return chapter
    base, first = body_size(rows), [r for r in rows if r['page'] == rows[0]['page']]
    big = [r for r in first if r['size'] >= base + 4 and len(r['text']) >= 3
           and not re.fullmatch(r'(?i)(?:unit|chapter)[- ]?[\divxl]*', r['text'])]
    big = [r for r in sorted(big, key=lambda r: r['y0']) if r['y0'] - big[0]['y0'] < 120][:4] if big else []
    parts = []
    for r in sorted(big, key=lambda r: r['y0']):
        if smart_title(r['text']): parts.append(smart_title(r['text'], first=not parts))
    return f'{chapter}: {" ".join(parts)}' if parts else chapter


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
    skip, i, skipped, skip_title, caption = None, 0, [], '', 0

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
            label = f'Unit {um.group(1)}: {smart_title(title)}' if title else f'Unit {um.group(1)}'
            items, skip = [('head', label)], None
            continue
        if skip == 'rest':                 # NCERT exercises run to the chapter's end
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
        if profile == 'scan':
            t = WATERMARK.sub(' ', t).strip()
            if not t: continue
            if re.fullmatch(r'(?:REFERENCES?|SELECTED READINGS?|SUGGESTED READINGS?|BIBLIOGRAPHY|FURTHER READINGS?)', t):
                log['scan section left out'][t.title()] += 1
                skip, skipped, skip_title = 'rest', [], t
                continue
            if ocr_garbage(t):
                log['OCR garbage row (shaded box, figure)'][t[:50]] += 1; continue
            if FOOTNOTE.match(t) or (len(t) < 140 and re.search(r'\bIbid\b|\bop\.\s?cit\b|\bloc\.\s?cit\b', t)):
                log['footnote'][t[:50]] += 1; continue
            toks = t.split()
            if len(toks) >= 4 and sum(bool(re.fullmatch(r'[\d,.:;|*\]\[()%-]+', w)) for w in toks) >= 0.5 * len(toks):
                log['table row (mostly numbers)'][t[:50]] += 1; continue
            r = {**r, 'text': t}
        if profile == 'ncert' and re.fullmatch(r'(?i)(?:unit|chapter)[- ]?[\divxl]+', t.strip()):
            continue                       # "Unit-III", "Chapter-4" above the title
        if profile == 'ncert' and re.fullmatch(r'(?:EXERCISES?|Exercises?|PROJECT WORK|Project Work)', t.strip()):
            log['NCERT section left out'][t.strip().title()] += 1
            skip, skipped, skip_title = 'rest', [], t.strip()
            continue
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
        if shifted_font(t):
            log['chart labels in a broken font']['&KDQJHV… (Changes…)'] += 1; continue
        if FIG_CAPTION.match(t) and r['size'] <= base:
            caption = r['size']; log['figure caption']['Figure n.n: …'] += 1; continue
        if caption and r['size'] <= caption + 0.1 and r['size'] < base - 0.5:
            continue                       # the caption's second line
        caption = 0
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


# Slips OCR makes on a printed page. Every change is logged for review.
RUPEE = re.compile(r'(?<![\w₹])[F€%]\s?(?=\d[\d,]*(?:\.\d+)?\s?(?:crores?|lakhs?|billion|million|thousand)\b)')
FUNC = ('the', 'and', 'from', 'with', 'for', 'of', 'to', 'in', 'on', 'is', 'as', 'at', 'by')
THE = {'tlie': 'the', 'tlic': 'the', 'thc': 'the', 'tbe': 'the', 'lhe': 'the', 'tiie': 'the', 'Tlie': 'The',
       'Thc': 'The', 'Tbe': 'The', 'Ihe': 'The', 'aud': 'and'}
# Words the dictionary lacks that must not be split or "corrected": modern
# words, British spellings, names that end like a function word.
MODERN = {'online', 'onboard', 'onsite', 'offshore', 'byproduct', 'byproducts', 'ongoing', 'inbuilt', 'infrastructure',
          'offence', 'offences', 'defence', 'defences', 'licence', 'licences', 'pretence', 'zealand', 'finland', 'iceland',
          'holland', 'scotland', 'ireland', 'thailand', 'swaziland', 'nagaland', 'jharkhand', 'uttarakhand'}
# Letter shapes OCR confuses; a misread word is fixed when exactly one swap
# makes a word ("animais" → "animals", "iniand" → "inland").
OCR_CONFUSIONS = [('i', 'l'), ('l', 'i'), ('t', 'l'), ('l', 't'), ('e', 'c'), ('c', 'e'), ('rn', 'm'), ('m', 'rn'),
                  ('li', 'h'), ('h', 'li'), ('ii', 'u'), ('cl', 'd'), ('vv', 'w'), ('f', 't'), ('t', 'f'), ('n', 'u'), ('u', 'n')]


def ocr_fix(t, V, log):
    def known(w):
        return is_word(w) or V[w.lower()] >= 3 or w.lower() in MODERN

    def rupee(m):
        log['OCR fix: rupee sign']['F/€/% → ₹'] += 1; return '₹'
    t = RUPEE.sub(rupee, t)
    t = re.sub(r'(?<=\d)\](?=[\s.,;:)]|$)|£(?=\d{3})', '1', t)        # "201]", "£970s"
    t = re.sub(r'\s?\^', '', t)                                          # "Ibid.^", "Sinifieftnce ^"

    def star(m):                                     # ‘welfare of man* → ’ ; a footnote star goes
        before = t[max(0, m.start() - 80):m.start()]
        return '’' if before.rfind('‘') > before.rfind('’') else ''
    t = re.sub(r'(?<=[A-Za-z.,”’)\d])\*+(?=[\s.,;:)]|$)', star, t)

    def the(m):                                      # "tlie", "thc", "tbe" — the most-read word misread
        log['OCR fix: misread "the"/"and"'][f'{m.group(0)} → {THE[m.group(0)]}'] += 1; return THE[m.group(0)]
    t = re.sub(r'(?<![\w-])(?:' + '|'.join(THE) + r')(?![\w-])', the, t)

    def bracket(m):                                  # "mil]" → "mill", "oi]" → "oil"
        c = m.group(0)[:-1] + 'l'
        if known(c):
            log['OCR fix: ] for l'][f'{m.group(0)} → {c}'] += 1; return c
        return m.group(0)
    t = re.sub(r'(?<![\w\]])[A-Za-z]+\](?![\w\]])', bracket, t)

    def speck(m):                                    # "There are.about", "plant more. trees"
        w = m.group(1)
        if w.lower() in ABBR: return m.group(0)
        log['OCR fix: speck read as a full stop'][f'{w}.{m.group(2)}…'] += 1
        return w + ' '
    t = re.sub(r'(?<![\w.])([a-z]{2,})\.\s?(?=([a-z]{2,}))', speck, t)
    t = re.sub(r'(?<=[a-z])[‘’](?=[a-z]{2,}\b)', ' ', t)    # "raising‘of"

    def bang(m):                                     # "soi!" → "soil"
        w = m.group(0); c = w.replace('!', 'l')
        if known(c):
            log['OCR fix: ! for l'][f'{w} → {c}'] += 1; return c
        return w
    t = re.sub(r'(?<![\w!])[A-Za-z]*[a-z]![a-z]*(?![\w!])', bang, t)

    def confusion(m):                                # "animais" → "animals", "tocated" → "located"
        w = m.group(0)
        if known(w) or V[w.lower()] >= 2 or not w.islower() or w in MODERN: return w
        if any(w.startswith(f) and is_word(w[len(f):]) and len(w) - len(f) >= 3 for f in FUNC):
            return w                                 # "ofher" is "of her", for unglue
        found = set()
        for a, b in OCR_CONFUSIONS:
            i = w.find(a)
            while i >= 0:
                c = w[:i] + b + w[i + len(a):]
                # The fix must be a word this book prints correctly elsewhere;
                # the dictionary alone offers "scabed" for "seabed".
                if is_word(c) and V[c] >= 3: found.add(c)
                i = w.find(a, i + 1)
        if len(found) == 1:
            c = found.pop(); log['OCR fix: misread letter'][f'{w} → {c}'] += 1; return c
        return w
    t = re.sub(r'(?<![\w-])[a-z]{4,}(?![\w-])', confusion, t)

    def double_l(m):                                 # "milion", "rainfal", "smal": one l of two lost
        w = m.group(0)
        if is_word(w) or w in MODERN or len(w) < 3: return w
        found = {c for i in range(len(w)) if w[i] == 'l' for c in [w[:i] + 'l' + w[i:]] if is_word(c) and V[c] >= 3}
        if len(found) == 1:
            c = found.pop(); log['OCR fix: lost l of ll'][f'{w} → {c}'] += 1; return c
        return w
    t = re.sub(r'(?<![\w-])[a-z]*l[a-z]*(?![\w-])', double_l, t)

    def unglue(m):                                   # "ofIndian", "problemof"
        w = m.group(0)
        # Names and acronyms are left alone (Menon, Paterson, LANDSAT), as is
        # anything the book itself spells this way more than once.
        pair = next((f for f in FUNC if w.lower().startswith(f) and w.lower()[len(f):] in FUNC + ('a', 'an')), None)
        if pair and not is_word(w):                  # "ofthe", "inthe": however often the book has it
            log['OCR fix: words run together'][f'{w} → {w[:len(pair)]} {w[len(pair):]}'] += 1
            return w[:len(pair)] + ' ' + w[len(pair):]
        if known(w) or w.isupper() or V[w.lower()] >= 2 or w.lower() in MODERN: return w
        camel = re.search(r'[a-z][A-Z]', w)
        lw = w.lower()
        for f in FUNC:
            rest = w[len(f):]
            if lw.startswith(f) and len(rest) >= 4 and (rest.lower() in WORDS or is_word(rest) or re.fullmatch(r'[A-Z][a-z]{3,}', rest)) \
                    and (w[:len(f)].islower()):
                log['OCR fix: words run together'][f'{w} → {w[:len(f)]} {rest}'] += 1
                return w[:len(f)] + ' ' + rest
        for f in ('of', 'in', 'is', 'and', 'the', 'for'):
            rest = w[:-len(f)]
            # A capitalised word splits only where the book uses the first
            # part on its own ("Krishnais", not "Gramin" or "Dhanis").
            if lw.endswith(f) and len(rest) >= 4 and is_word(rest) and not camel \
                    and (rest.islower() or V[rest.lower()] >= 3):
                log['OCR fix: words run together'][f'{w} → {rest} {w[-len(f):]}'] += 1
                return rest + ' ' + w[-len(f):]
        return w
    return re.sub(r'(?<![\w-])[A-Za-z]{5,}(?![\w-])', unglue, t)


def vocab_of(items):
    v, h = collections.Counter(), collections.Counter()
    for _, t in items:
        v.update(w.lower() for w in re.findall(r'(?<![\w-])[A-Za-z]+(?![\w-])', t))
        h.update(w.lower() for w in re.findall(r'(?<![\w-])[A-Za-z]+-[A-Za-z]+(?![\w-])', t))
    return v, h


def join_rows(rows_text, V, Hy, log):
    """Join a paragraph's rows, deciding at each line-end hyphen whether the
    word was split by the layout or is really hyphenated."""
    # OCR leaves a mark after a line-end hyphen ("depart-*", "-^").
    rows_text = [re.sub(r'-[*^]$', '-', r) for r in rows_text]
    out = rows_text[0]
    for nxt in rows_text[1:]:
        # Only the tail matters; searching the whole paragraph each time made
        # a long scanned chapter quadratic.
        m, n = re.search(r'([A-Za-z]+)-$', out[-80:]), re.match(r'([a-z]+)', nxt)
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


def build(files, profile, log, labels=None):
    fix = (lambda t: ocr_fix(t, V, log)) if profile == 'scan' else (lambda t: t)
    per_file = []
    for f, rows in zip(files, read_book(files, profile, log)):
        if profile == 'scan':                      # one group per chapter
            groups = []
            for lab, run in itertools.groupby(rows, key=lambda r: r.get('label')):
                groups += [(lab, items) for _, items in to_groups(list(run), profile, log)]
        else:
            groups = to_groups(rows, profile, log)
        if profile == 'ncert' and groups:
            groups = [(ncert_label(f, rows), items) for _, items in groups]
        if labels and f.stem in labels:
            groups = [(labels[f.stem], items) for _, items in groups]
        elif labels:                               # renaming a chapter label
            groups = [(labels.get(lab, lab), items) for lab, items in groups]
        per_file.append((f, course_of(f.relative_to(f.anchor)), groups))
    V, Hy = vocab_of([it for _, _, groups in per_file for _, items in groups for it in items])
    chunks = []
    for f, course, groups in per_file:
        for label, items in groups:
            source = ' · '.join(x for x in (course, label) if x) or f.stem
            units, para = [], []

            def close_para():
                if para:
                    units.extend(('sent', s) for s in sentences(fix(finish(basic(join_rows(para, V, Hy, log))))))
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
        for k, n in c.most_common(2000 if rule.startswith(('OCR fix: words', 'OCR fix: misread')) else 25): L.append(f'  - {n} × {k}')
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
    ap.add_argument('--profile', choices=['ignou', 'ncert', 'scan', 'plain'], default='plain')
    ap.add_argument('--out', default=str(ROOT.parent / 'dc-books' / 'out'))
    ap.add_argument('--label', action='append', default=[], metavar='FILE=LABEL',
                    help='override the label of one file (by name, without .pdf), or rename a label (OLD=NEW)')
    ap.add_argument('--scan-margins', default=None, metavar='TOP,BOTTOM',
                    help='scan profile: page fractions cut at the top and bottom (default 0.064,0.955)')
    ap.add_argument('--upload', action='store_true')
    ap.add_argument('--replace', action='store_true')
    a = ap.parse_args()

    if a.scan_margins:
        global SCAN_TOP, SCAN_BOTTOM
        SCAN_TOP, SCAN_BOTTOM = (float(x) for x in a.scan_margins.split(','))
    files = collect(a.inputs)
    if not files: sys.exit('no PDFs found')
    log = collections.defaultdict(collections.Counter)
    chunks = build(files, a.profile, log, dict(x.split('=', 1) for x in a.label))
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
