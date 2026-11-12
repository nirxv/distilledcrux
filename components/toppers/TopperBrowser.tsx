'use client';
import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { rankLine, type TopperCopy } from '@/lib/toppers/meta';
import { allowanceLine, useTopperStatus } from './useTopperStatus';
import TopperPassOffer from './TopperPassOffer';

type Filters = { q: string; paper: '' | '1' | '2'; topic: string; topper: string; asked: boolean };
const EMPTY: Filters = { q: '', paper: '', topic: '', topper: '', asked: false };
const BATCH = 30;

export type PyqRef = { id: number; year: string; paper: 'Paper I' | 'Paper II'; question: string };

type Props = {
  subject: string;
  subjectName: string;
  copies: TopperCopy[];
  /** Topics in syllabus order, with the paper they mostly belong to. */
  topics: { name: string; paper: 'Paper I' | 'Paper II' }[];
  /** The past questions the copies answer, for the "Asked by UPSC" line. */
  pyqs: Record<number, PyqRef>;
};

/**
 * A subject's topper copies: one card per test question, listing each topper
 * who answered it, the past questions it answers, and Compare where two or
 * more toppers wrote it. Filters live in the URL, as on the PYQ list, so a
 * copy opened from a filtered list comes back to it.
 */
export default function TopperBrowser(props: Props) {
  return (
    <Suspense fallback={<Browser {...props} initial={EMPTY} />}>
      <BrowserFromUrl {...props} />
    </Suspense>
  );
}

function BrowserFromUrl(props: Props) {
  const sp = useSearchParams();
  const paper = sp.get('paper');
  return (
    <Browser {...props} initial={{
      q: sp.get('q') ?? '',
      paper: paper === '1' || paper === '2' ? paper : '',
      topic: sp.get('topic') ?? '',
      topper: sp.get('topper') ?? '',
      asked: sp.get('asked') === '1',
    }} />
  );
}

function highlight(text: string, q: string): ReactNode {
  if (q.length < 2) return text;
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return parts.map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : p));
}

type Group = { key: string; question: string; paper: TopperCopy['paper']; marks: number; topic: string; pyqs: number[]; copies: TopperCopy[] };

function Browser({ subject, subjectName, copies, topics, pyqs, initial }: Props & { initial: Filters }) {
  const [f, setF] = useState<Filters>(initial);
  const [shown, setShown] = useState(BATCH);
  const sentinel = useRef<HTMLDivElement>(null);
  const allowance = useTopperStatus(subject);

  const update = (patch: Partial<Filters>) => {
    const nf = { ...f, ...patch };
    setF(nf);
    setShown(BATCH);
    const sp = new URLSearchParams();
    if (nf.q) sp.set('q', nf.q);
    if (nf.paper) sp.set('paper', nf.paper);
    if (nf.topic) sp.set('topic', nf.topic);
    if (nf.topper) sp.set('topper', nf.topper);
    if (nf.asked) sp.set('asked', '1');
    const qs = sp.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
  };

  // One card per printed test question; every topper who answered it underneath.
  const groups = useMemo(() => {
    const m = new Map<string, Group>();
    for (const c of copies) {
      const g = m.get(c.group) ?? { key: c.group, question: c.question, paper: c.paper, marks: c.marks, topic: c.topic, pyqs: c.pyqs, copies: [] };
      g.copies.push(c);
      m.set(c.group, g);
    }
    for (const g of m.values()) g.copies.sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999));
    const order = new Map(topics.map((t, i) => [t.name, i]));
    return [...m.values()].sort((a, b) =>
      a.paper.localeCompare(b.paper) || (order.get(a.topic) ?? 99) - (order.get(b.topic) ?? 99)
      || b.copies.length - a.copies.length);
  }, [copies, topics]);

  const toppers = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of copies) if (!m.has(c.topper) || (c.rank ?? 9999) < (m.get(c.topper) ?? 9999)) m.set(c.topper, c.rank ?? 9999);
    return [...m.entries()].sort((a, b) => a[1] - b[1]).map(([name, rank]) => ({ name, rank: rank === 9999 ? null : rank }));
  }, [copies]);

  const q = f.q.trim().toLowerCase();
  const filtered = useMemo(() => groups.filter((g) =>
    (!f.paper || g.paper === (f.paper === '1' ? 'Paper I' : 'Paper II'))
    && (!f.topic || g.topic === f.topic)
    && (!f.asked || g.pyqs.length > 0)
    && (!f.topper || g.copies.some((c) => c.topper === f.topper))
    && (!q || g.question.toLowerCase().includes(q) || g.copies.some((c) => c.topper.toLowerCase().includes(q)))),
  [groups, f.paper, f.topic, f.asked, f.topper, q]);

  const answers = filtered.reduce((n, g) => n + g.copies.length, 0);
  const paperCount = (p: '1' | '2') => groups.filter((g) => g.paper === (p === '1' ? 'Paper I' : 'Paper II')).length;
  const topicOptions = topics.filter((t) => groups.some((g) => g.topic === t.name && (!f.paper || g.paper === (f.paper === '1' ? 'Paper I' : 'Paper II'))));

  useEffect(() => {
    const el = sentinel.current;
    if (!el || shown >= filtered.length) return;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) setShown((s) => s + BATCH); }, { rootMargin: '900px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [shown, filtered.length]);

  const note = allowanceLine(allowance, subject);
  const filteredAtAll = Boolean(f.q || f.paper || f.topic || f.topper || f.asked);

  return (
    <div className="tb">
      {!allowance.loading && (
        allowance.unlimited ? (
          <p className="tb-allow on">
            {allowance.via === 'pass' && allowance.passUntil
              ? `Your topper pass opens every ${subjectName} copy until ${new Date(allowance.passUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}.`
              : `Your ${subjectName} subscription opens every copy.`}
          </p>
        ) : !allowance.signedIn ? (
          <p className="tb-allow">Browse freely. <Link href={`/login?next=/${subject}/topper-copies`}>Sign in</Link> to open copies, and your first five are free.</p>
        ) : (
          <div className="tb-allow tb-allow-offer">
            {note && <p className="tb-allow-note">{note}</p>}
            <TopperPassOffer subject={subject} look="line" own={allowance.own} />
          </div>
        )
      )}

      <div className="tb-bar">
        <label className="tb-search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input type="search" value={f.q} onChange={(e) => update({ q: e.target.value })}
            placeholder="Search a question or a topper" aria-label={`Search ${subjectName} topper copies`} />
          {f.q && <button type="button" className="tb-clear" onClick={() => update({ q: '' })} aria-label="Clear search">✕</button>}
        </label>
        <div className="tb-tabs" role="tablist" aria-label="Paper">
          {([['', 'Both papers'], ['1', 'Paper I'], ['2', 'Paper II']] as const).map(([v, label]) => (
            <button key={v} type="button" role="tab" aria-selected={f.paper === v}
              className={`tb-tab${f.paper === v ? ' on' : ''}`} onClick={() => update({ paper: v, topic: '' })}>
              {label}{v && <span>{paperCount(v)}</span>}
            </button>
          ))}
        </div>
        <div className="tb-selects">
          <select className={`tb-select tb-select-topic${f.topic ? ' set' : ''}`} value={f.topic} onChange={(e) => update({ topic: e.target.value })} aria-label="Topic">
            <option value="">Every topic</option>
            {topicOptions.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
          </select>
          <select className={`tb-select${f.topper ? ' set' : ''}`} value={f.topper} onChange={(e) => update({ topper: e.target.value })} aria-label="Topper">
            <option value="">Every topper</option>
            {toppers.map((t) => <option key={t.name} value={t.name}>{t.name}{t.rank ? `, AIR ${t.rank}` : ''}</option>)}
          </select>
          <button type="button" className={`tb-toggle${f.asked ? ' on' : ''}`} aria-pressed={f.asked} onClick={() => update({ asked: !f.asked })}>
            Asked by UPSC
          </button>
        </div>
      </div>

      <div className="tb-status" aria-live="polite">
        <span>
          {filtered.length.toLocaleString('en-IN')} {filtered.length === 1 ? 'question' : 'questions'}, {answers.toLocaleString('en-IN')} {answers === 1 ? 'answer' : 'answers'}
          {f.topic && <> on <strong>{f.topic}</strong></>}
        </span>
        {filteredAtAll && <button type="button" className="tb-reset" onClick={() => update(EMPTY)}>Clear filters</button>}
      </div>

      {filtered.length === 0 ? (
        <p className="tb-empty">No question matches all of that. Try fewer filters, or a shorter search.</p>
      ) : (
        <div className="tb-cards">
          {filtered.slice(0, shown).map((g) => (
            <article key={g.key} className="tb-card">
              <div className="tb-meta">
                <span className="tb-paper">{g.paper}</span>
                <button type="button" className={`tb-topic${f.topic === g.topic ? ' on' : ''}`} onClick={() => update({ topic: g.topic })}>{g.topic}</button>
                <span className="tb-marks">{g.marks} marks</span>
              </div>
              <h3 className="tb-q">{highlight(g.question, f.q.trim())}</h3>
              {g.pyqs.length > 0 && (
                <p className="tb-asked">
                  <span>Asked by UPSC</span>
                  {g.pyqs.filter((id) => pyqs[id]).sort((a, b) => pyqs[b].year.localeCompare(pyqs[a].year)).map((id) => (
                    <Link key={id} href={`/${subject}/pyqs/${id}`} prefetch={false} title={pyqs[id].question}>
                      {pyqs[id].year} {pyqs[id].paper === 'Paper I' ? 'P-I' : 'P-II'}
                    </Link>
                  ))}
                </p>
              )}
              <ul className="tb-toppers">
                {g.copies.map((c) => (
                  <li key={c.id}>
                    <Link href={`/${subject}/topper-copies/${c.id}`} prefetch={false} className={`tb-copy${f.topper === c.topper ? ' hit' : ''}`}>
                      <span className="tb-name">{highlight(c.topper, f.q.trim())}</span>
                      <span className="tb-rank">{rankLine(c)}</span>
                      {allowance.opened.has(c.id) && <span className="tb-opened">Opened</span>}
                    </Link>
                  </li>
                ))}
              </ul>
              {g.copies.length > 1 && (
                <Link className="tb-compare" prefetch={false}
                  href={`/${subject}/topper-copies/compare?a=${g.copies[0].id}&b=${g.copies[1].id}`}>
                  Compare {g.copies.length === 2 ? 'the two answers' : `${g.copies.length} answers side by side`}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                </Link>
              )}
            </article>
          ))}
          {shown < filtered.length && (
            <div ref={sentinel} className="tb-more">
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
