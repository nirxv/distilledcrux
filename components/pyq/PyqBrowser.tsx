'use client';
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { Pyq, PyqTopic } from '@/lib/pyqs';
import { pyqKey, useAttemptedPyqs } from '@/hooks/useAttemptedPyqs';

type Filters = { q: string; paper: '' | '1' | '2'; topic: string; year: string; marks: string };
const EMPTY: Filters = { q: '', paper: '', topic: '', year: '', marks: '' };

/** Cards rendered at a time; more follow as the reader nears the end. */
const BATCH = 40;

/** Where the question page's back link returns to, filters and all. */
export const listKey = (subject: string) => `dc-pyq-list:${subject}`;

/** How far down a given list (path and filters) the reader was. */
const posKey = () => `dc-pyq-pos:${window.location.pathname}${window.location.search}`;

type Props = { subject: string; subjectName: string; questions: Pyq[]; topics: PyqTopic[] };

/**
 * A subject's past questions: a search box, the papers as tabs, topic, year
 * and marks to narrow by, and the questions newest first under their year.
 *
 * The filters live in the URL so a question opened from a filtered list comes
 * back to that list, and a filtered list can be shared. Reading the URL makes
 * the list render in the browser only, so the server sends the unfiltered list
 * as the fallback and it is swapped for the real one as the page hydrates.
 */
export default function PyqBrowser(props: Props) {
  return (
    <Suspense fallback={<Browser {...props} initial={EMPTY} />}>
      <BrowserFromUrl {...props} />
    </Suspense>
  );
}

function BrowserFromUrl(props: Props) {
  const sp = useSearchParams();
  const paper = sp.get('paper');
  const initial: Filters = {
    q: sp.get('q') ?? '',
    paper: paper === '1' || paper === '2' ? paper : '',
    topic: sp.get('topic') ?? '',
    year: sp.get('year') ?? '',
    marks: sp.get('marks') ?? '',
  };
  return <Browser {...props} initial={initial} />;
}

const PAPER_NAME = { '1': 'Paper I', '2': 'Paper II' } as const;

/** Something each subject's aspirants would actually search for. */
const SEARCH_EXAMPLE: Record<string, string> = {
  sociology: 'dominant caste', anthropology: 'kinship', polsci: 'Rawls', geography: 'monsoon', 'pub-admin': 'Weber',
};

/** The question with each occurrence of the search words marked. */
function highlight(text: string, q: string): ReactNode {
  if (q.length < 2) return text;
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return parts.map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : p));
}

function Browser({ subject, subjectName, questions, topics, initial }: Props & { initial: Filters }) {
  const [f, setF] = useState<Filters>(initial);
  const [shown, setShown] = useState(BATCH);
  const listRef = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const pendingScroll = useRef<number | null>(null);
  const attempts = useAttemptedPyqs();
  const wasAttempted = (x: Pyq) => attempts.ready && attempts.isAttempted(pyqKey(subject, x.id));

  // Back from a question used to return to the first batch alone, so the
  // browser had nowhere to scroll to and the reader lost their place. The
  // batches loaded and the scroll position are kept when a question is
  // opened, and put back here before the first paint.
  useLayoutEffect(() => {
    try {
      const key = posKey();
      const saved = JSON.parse(sessionStorage.getItem(key) ?? 'null') as { shown?: number; y?: number; at?: number } | null;
      // Used once, and only soon after: a list reopened later from the navbar
      // should start at the top, not wherever a question was opened.
      sessionStorage.removeItem(key);
      if (saved && typeof saved.shown === 'number' && typeof saved.y === 'number' && Date.now() - (saved.at ?? 0) < 30 * 60_000) {
        pendingScroll.current = saved.y;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setShown(Math.max(BATCH, saved.shown));
      }
    } catch { /* no saved place: start at the top */ }
  }, []);
  useLayoutEffect(() => {
    if (pendingScroll.current === null) return;
    window.scrollTo(0, pendingScroll.current);
    pendingScroll.current = null;
  }, [shown]);
  const rememberPlace = () => {
    try { sessionStorage.setItem(posKey(), JSON.stringify({ shown, y: Math.round(window.scrollY), at: Date.now() })); } catch { /* storage blocked */ }
  };

  const update = (next: Partial<Filters>) => {
    const merged = { ...f, ...next };
    // A topic with nothing in the chosen paper would leave an empty list
    // with no clue why; let the paper win.
    if (next.paper && merged.topic) {
      const t = topics.find((x) => x.name === merged.topic);
      if (t && (next.paper === '1' ? t.p1 : t.p2) === 0) merged.topic = '';
    }
    setF(merged);
    setShown(BATCH);
    const params = new URLSearchParams();
    (Object.keys(merged) as (keyof Filters)[]).forEach((k) => { if (merged[k]) params.set(k, merged[k]); });
    const url = `${window.location.pathname}${params.size ? `?${params}` : ''}`;
    window.history.replaceState(null, '', url);
    try { sessionStorage.setItem(listKey(subject), url); } catch { /* storage blocked: the back link goes to the plain list */ }
  };

  const q = f.q.trim().toLowerCase();
  const filtered = useMemo(() => questions.filter((x) =>
    (!f.paper || x.paper === PAPER_NAME[f.paper]) &&
    (!f.topic || x.topic === f.topic) &&
    (!f.year || x.year === f.year) &&
    (!f.marks || String(x.marks) === f.marks) &&
    (!q || x.question.toLowerCase().includes(q) || x.topic.toLowerCase().includes(q) || (x.microtheme ?? '').toLowerCase().includes(q)),
  ), [questions, f.paper, f.topic, f.year, f.marks, q]);

  const years = useMemo(() => [...new Set(questions.map((x) => x.year))].filter(Boolean).sort((a, b) => b.localeCompare(a)), [questions]);
  const marksOptions = useMemo(() => [...new Set(questions.map((x) => x.marks).filter((m): m is number => m !== null))].sort((a, b) => a - b), [questions]);
  const paperCount = (p: '1' | '2') => questions.filter((x) => x.paper === PAPER_NAME[p]).length;

  // Questions per year across the whole filtered list, for the year headings.
  const perYear = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of filtered) m.set(x.year, (m.get(x.year) ?? 0) + 1);
    return m;
  }, [filtered]);

  const groups = useMemo(() => {
    const out: { year: string; items: Pyq[] }[] = [];
    for (const x of filtered.slice(0, shown)) {
      const last = out[out.length - 1];
      if (last && last.year === x.year) last.items.push(x);
      else out.push({ year: x.year, items: [x] });
    }
    return out;
  }, [filtered, shown]);

  // Load the next batch a little before the reader reaches the end.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || shown >= filtered.length) return;
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) setShown((s) => s + BATCH);
    }, { rootMargin: '900px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [shown, filtered.length]);

  const filteredAtAll = Boolean(f.q || f.paper || f.topic || f.year || f.marks);
  const topicOptions = f.paper
    ? topics.filter((t) => (f.paper === '1' ? t.p1 : t.p2) > 0)
    : topics;
  const topicLabel = (t: PyqTopic) => `${t.name} (${f.paper === '1' ? t.p1 : f.paper === '2' ? t.p2 : t.p1 + t.p2})`;

  const pickTopic = (name: string) => {
    update({ topic: name });
    const top = listRef.current ? listRef.current.getBoundingClientRect().top + window.scrollY - 150 : 0;
    if (window.scrollY > top) window.scrollTo({ top, behavior: 'smooth' });
  };

  return (
    <div className="pq">
      <div className="pq-bar">
        <label className="pq-search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input
            type="search"
            value={f.q}
            onChange={(e) => update({ q: e.target.value })}
            placeholder={`Search, say “${SEARCH_EXAMPLE[subject] ?? 'a thinker'}”`}
            aria-label={`Search ${subjectName} past questions`}
          />
          {f.q && <button type="button" className="pq-clear" onClick={() => update({ q: '' })} aria-label="Clear search">✕</button>}
        </label>
        <div className="pq-tabs" role="tablist" aria-label="Paper">
          {([['', 'Both papers'], ['1', 'Paper I'], ['2', 'Paper II']] as const).map(([v, label]) => (
            <button key={v} type="button" role="tab" aria-selected={f.paper === v}
              className={`pq-tab${f.paper === v ? ' on' : ''}`} onClick={() => update({ paper: v })}>
              {label}{v && <span>{paperCount(v)}</span>}
            </button>
          ))}
        </div>
        <div className="pq-selects">
          <select className={`pq-select pq-select-topic${f.topic ? ' set' : ''}`} value={f.topic} onChange={(e) => update({ topic: e.target.value })} aria-label="Topic">
            <option value="">Every topic</option>
            {f.paper
              ? topicOptions.map((t) => <option key={t.name} value={t.name}>{topicLabel(t)}</option>)
              : (['Paper I', 'Paper II'] as const).map((p) => (
                <optgroup key={p} label={p}>
                  {topics.filter((t) => t.paper === p).map((t) => <option key={t.name} value={t.name}>{topicLabel(t)}</option>)}
                </optgroup>
              ))}
          </select>
          <select className={`pq-select${f.year ? ' set' : ''}`} value={f.year} onChange={(e) => update({ year: e.target.value })} aria-label="Year">
            <option value="">Every year</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select className={`pq-select${f.marks ? ' set' : ''}`} value={f.marks} onChange={(e) => update({ marks: e.target.value })} aria-label="Marks">
            <option value="">Any marks</option>
            {marksOptions.map((m) => <option key={m} value={String(m)}>{m} marks</option>)}
          </select>
        </div>
      </div>

      <div className="pq-status" aria-live="polite">
        <span>
          {filtered.length.toLocaleString('en-IN')} {filtered.length === 1 ? 'question' : 'questions'}
          {f.topic && <> on <strong>{f.topic}</strong></>}
          {attempts.ready && (() => {
            const n = filtered.filter(wasAttempted).length;
            return n > 0 ? <span className="pq-status-done"> · {n.toLocaleString('en-IN')} attempted</span> : null;
          })()}
        </span>
        {filteredAtAll && <button type="button" className="pq-reset" onClick={() => update(EMPTY)}>Clear filters</button>}
      </div>

      {filtered.length === 0 ? (
        <div className="pq-empty">
          <p>No question matches all of that. Try fewer filters, or a shorter search.</p>
          {f.q.trim() && (
            <Link href={`/chat?subject=${subject}&q=${encodeURIComponent(f.q.trim())}`} className="pq-empty-ask ds-card ds-card-link">
              <strong>Ask the {subjectName} AI about “{f.q.trim()}”</strong>
              <span>It answers from the standard books and shows you where.</span>
            </Link>
          )}
        </div>
      ) : (
        <div className="pq-years" ref={listRef}>
          {groups.map((g) => (
            <section key={g.year} className="pq-year">
              <h2 className="pq-year-head">
                {g.year}
                <span>{perYear.get(g.year)} {perYear.get(g.year) === 1 ? 'question' : 'questions'}</span>
              </h2>
              <div className="pq-cards">
                {g.items.map((x) => (
                  <article key={x.id} className={`pq-card${wasAttempted(x) ? ' done' : ''}`}>
                    <div className="pq-meta">
                      <span className="pq-paper">{x.paper}</span>
                      {wasAttempted(x) && <span className="pq-done">Attempted</span>}
                      {x.section && <span>{x.section}</span>}
                      {x.marks && <span className="pq-marks">{x.marks} marks</span>}
                    </div>
                    <h3 className="pq-q">
                      <Link href={`/${subject}/pyqs/${x.id}`} onClick={rememberPlace}>{highlight(x.question, q)}</Link>
                    </h3>
                    <div className="pq-foot">
                      <button type="button" className={`pq-topic${f.topic === x.topic ? ' on' : ''}`} onClick={() => pickTopic(x.topic)}
                        title={`Every question on ${x.topic}`}>
                        {x.topic}
                      </button>
                      <Link className="pq-write" onClick={rememberPlace}
                        href={`/evaluate?question=${encodeURIComponent(x.question)}${x.marks ? `&marks=${x.marks}` : ''}`}>
                        Write an answer
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
          {shown < filtered.length && (
            <div ref={sentinel} className="pq-more">
              <button type="button" className="ds-btn ds-btn-line ds-btn-sm" onClick={() => setShown((s) => s + BATCH)}>
                Show more ({(filtered.length - shown).toLocaleString('en-IN')} left)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
