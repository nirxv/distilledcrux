'use client';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import type { DailyQuestion } from '@/lib/dailyQuestions';
import type { PyqSubject } from '@/lib/pyqs';
import { istDay } from '@/lib/istDay';

/**
 * Today's five questions for one optional, the same for every reader of it
 * that day (IST), with an optional timer set to roughly what the marks allow,
 * as on historyoptional.xyz.
 *
 * `questions` is the set for `day`, the day the page was prerendered. On any
 * later day it fetches that day's set; the page does not re-render itself at
 * midnight.
 */

/** Minutes to write an answer, about what the marks allow in the exam. */
const minutesFor = (marks: number | null) => (!marks || marks <= 10 ? 7 : marks <= 15 ? 11 : 14);
const pad = (n: number) => String(n).padStart(2, '0');

export default function TodayPractice({ subject, questions: built, day, open = false }: {
  subject: PyqSubject;
  questions: DailyQuestion[];
  day: string;
  /** Show all five at once, rather than one with the rest on request. */
  open?: boolean;
}) {
  // A new optional remounts the panel (its key), so this only follows the day.
  const [questions, setQuestions] = useState(built);
  useEffect(() => {
    const today = istDay();
    if (today === day) return;
    let cancelled = false;
    fetch(`/api/daily-questions?subject=${subject}&day=${today}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && Array.isArray(d?.questions)) setQuestions(d.questions); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [subject, day]);

  const totalMins = useMemo(() => questions.reduce((a, q) => a + minutesFor(q.marks), 0), [questions]);
  const [started, setStarted] = useState(false);
  // One question first; the rest on request, or straight away when the reader
  // came for them (links to #daily-answer).
  const [opened, setAll] = useState(open);
  const cameForIt = useSyncExternalStore(
    (cb) => { window.addEventListener('hashchange', cb); return () => window.removeEventListener('hashchange', cb); },
    () => window.location.hash === '#daily-answer',
    () => false,
  );
  const all = opened || cameForIt;
  const [secsLeft, setSecsLeft] = useState(totalMins * 60);
  const [finished, setFinished] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!started || finished) return;
    timer.current = setInterval(() => {
      setSecsLeft((prev) => {
        if (prev <= 1) { if (timer.current) clearInterval(timer.current); setFinished(true); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [started, finished]);

  const shown = all ? questions : questions.slice(0, 1);
  const pct = started ? ((totalMins * 60 - secsLeft) / (totalMins * 60)) * 100 : 0;
  const low = started && secsLeft < 120;

  return (
    <div className="tp ds-card" style={{ ['--t' as string]: `var(--tint-${subject})` }}>
      <style>{TP_CSS}</style>
      <div className="tp-head">
        <div>
          <h3>{all ? 'Today’s five questions' : 'Today’s question'}</h3>
          <p>{all ? `The same set for everyone today. About ${totalMins} minutes for all five.` : 'One of five set for everyone today. Write it, and get it checked.'}</p>
        </div>
        {!all ? null : started ? (
          <div className={`tp-clock${low ? ' low' : ''}`} role="timer" aria-live="off">
            {finished ? 'Time up' : `${pad(Math.floor(secsLeft / 60))}:${pad(secsLeft % 60)}`}
          </div>
        ) : (
          <button type="button" className="ds-btn ds-btn-line ds-btn-sm" onClick={() => { setSecsLeft(totalMins * 60); setStarted(true); }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2 2M9 2h6" /></svg>
            Start a {totalMins}-minute timer
          </button>
        )}
      </div>
      {started && <div className="tp-bar" aria-hidden="true"><span className={low ? 'low' : ''} style={{ width: `${pct}%` }} /></div>}

      <ol className="tp-list">
        {shown.map((q, i) => (
          <li key={q.id} className="tp-q">
            <span className="tp-n">{i + 1}</span>
            <div className="tp-body">
              <Link href={`/${subject}/pyqs/${q.id}`} className="tp-text">{q.question}</Link>
              <span className="tp-meta">
                <span className="tp-dot" aria-hidden="true" />
                <span>{q.paper} · {q.year} · {q.marks} marks · {q.topic}</span>
              </span>
            </div>
            {/* ?question= and &marks= are what the evaluate page reads; it starts a fresh answer with them filled in. */}
            <Link className="tp-write" href={`/evaluate?question=${encodeURIComponent(q.question)}${q.marks ? `&marks=${q.marks}` : ''}`} aria-label={`Write an answer to question ${i + 1}`}>
              Write
            </Link>
          </li>
        ))}
      </ol>
      {!all && questions.length > 1 && (
        <button type="button" className="tp-more" onClick={() => setAll(true)}>
          Show all five, with a timer
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
        </button>
      )}
    </div>
  );
}

const TP_CSS = `
.tp { padding: 0; overflow: hidden; }
.tp-head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-4); padding: var(--space-5); }
.tp-head h3 { margin: 0; font-size: 1.05rem; font-weight: 700; }
.tp-head p { margin: 4px 0 0; font-size: 0.86rem; color: var(--text3); line-height: 1.5; }
.tp-clock { font-family: var(--font-ui); font-variant-numeric: tabular-nums; font-size: 1.6rem; font-weight: 800; letter-spacing: -0.02em; color: var(--text); }
.tp-clock.low { color: var(--danger-text); }
.tp-bar { height: 3px; background: var(--border); }
.tp-bar span { display: block; height: 100%; background: var(--t, var(--accent)); transition: width 1s linear; }
.tp-bar span.low { background: var(--danger-text); }
.tp-list { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--border); }
.tp-q { display: flex; align-items: flex-start; gap: var(--space-3); padding: var(--space-4) var(--space-5); border-bottom: 1px solid var(--border); }
.tp-q:last-child { border-bottom: none; }
.tp-n { flex-shrink: 0; width: 26px; height: 26px; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; background: var(--ds-soft); font-family: var(--font-ui); font-size: 0.8rem; font-weight: 700; color: var(--text2); }
.tp-body { flex: 1; min-width: 0; }
.tp-text { display: block; color: var(--text); font-size: 0.98rem; line-height: 1.55; text-decoration: none; }
.tp-text:hover { text-decoration: underline; text-underline-offset: 3px; }
/* The dot stays beside the first line however the text wraps. */
.tp-meta { display: flex; align-items: flex-start; gap: 6px; margin-top: 6px; font-family: var(--font-ui); font-size: 0.78rem; line-height: 1.45; color: var(--text3); }
.tp-dot { flex-shrink: 0; width: 7px; height: 7px; margin-top: 0.35em; border-radius: 50%; background: var(--t, var(--accent)); }
.tp-write { flex-shrink: 0; align-self: center; padding: 7px 14px; border-radius: var(--radius-full); border: 1px solid var(--border2); color: var(--accent-text); font-size: 0.86rem; font-weight: 700; text-decoration: none; }
.tp-write:hover { border-color: var(--accent); background: var(--accent-dim); }
.tp-more { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; min-height: 48px; border: none; border-top: 1px solid var(--border); background: none; color: var(--accent-text); font: inherit; font-size: 0.9rem; font-weight: 600; cursor: pointer; }
.tp-more:hover { background: var(--ds-soft); }
@media (max-width: 640px) {
  .tp-head { flex-direction: column; padding: var(--space-4); }
  .tp-q { padding: var(--space-4); }
}
@media (prefers-reduced-motion: reduce) { .tp-bar span { transition: none; } }
`;
