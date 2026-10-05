'use client';
import { useEffect, useState } from 'react';
import Mascot from '@/components/Mascot';

/**
 * The evaluate page's two waits, reading the answer sheet and marking it,
 * shown as a panel over the blurred page, with the reading owl and a
 * checklist.
 *
 * Every tick is a step that actually finished: the browser's own work
 * (turning a PDF into pages) or a stage the server reported on its progress
 * stream (x-ocr-stages, x-eval-stages). Nothing advances on a timer.
 */

export type Row = { key: string; state: 'pending' | 'active' | 'done'; text: string };

function clock(ms: number) {
  const t = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

export function ProgressOverlay({ title, note, rows, startedAt }: {
  title: string;
  /** A line about how long this takes; omitted where there is no data for it. */
  note?: string;
  rows: Row[];
  startedAt: number;
}) {
  const [now, setNow] = useState(startedAt);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // The page behind should not scroll under the panel.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const done = rows.filter((r) => r.state === 'done').length;

  return (
    <div className="evp-scrim">
      <style>{EVP_CSS}</style>
      <div className="evp" role="dialog" aria-modal="true" aria-label={title}>
        <Mascot pose="reading" width={124} className="evp-owl" preload />
        <h2 className="evp-title">{title}</h2>
        <div className="evp-sub">
          {note && <span>{note}</span>}
          <span className="evp-clock" aria-hidden="true">{clock(now - startedAt)}</span>
        </div>
        <div className="evp-bar" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${rows.length}, 1fr)` }}>
          {rows.map((r) => <span key={r.key} className={r.state} />)}
        </div>
        <ul className="evp-steps" role="status" aria-live="polite" aria-label={`${done} of ${rows.length} steps done`}>
          {rows.map((r) => (
            <li key={r.key} className={r.state}>
              {r.state === 'done' ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.8 2.8L16.5 9.5" /></svg>
              ) : r.state === 'active' ? (
                <svg className="evp-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /></svg>
              ) : (
                <span className="evp-dot" aria-hidden="true" />
              )}
              <span>{r.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ── Reading the answer sheet ─────────────────────────────────────────────────

export type ReadStages = {
  /** Set when the reading starts; pdf means pages must be rendered first. */
  preparing?: { files: number; pdf: boolean };
  prepared?: { pages: number };
  transcribing?: true;
  transcribed?: { words: number };
  /** Only when no question was typed: the server looks for it on the sheet. */
  askQuestion?: boolean;
  question?: true;
  question_done?: { found: boolean };
};

export function applyReadStage(s: ReadStages, e: { id?: string } & Record<string, unknown>): ReadStages {
  switch (e.id) {
    case 'transcribing':  return { ...s, transcribing: true };
    case 'transcribed':   return { ...s, transcribed: { words: Number(e.words) || 0 } };
    case 'question':      return { ...s, question: true };
    case 'question_done': return { ...s, question_done: { found: Boolean(e.found) } };
    default:              return s;
  }
}

function readRows(s: ReadStages): Row[] {
  const pages = s.prepared?.pages ?? s.preparing?.files ?? 0;
  const pl = pages === 1 ? '' : 's';
  const rows: Row[] = [];

  rows.push(s.prepared
    ? { key: 'prep', state: 'done', text: s.preparing?.pdf ? `Turned your PDF into ${pages} page${pl}` : `Prepared ${pages} page${pl}` }
    : { key: 'prep', state: 'active', text: s.preparing?.pdf ? 'Turning your PDF into pages' : 'Preparing your pages' });

  rows.push(s.transcribed
    ? { key: 'read', state: 'done', text: s.transcribed.words > 0 ? `Read your handwriting: ${s.transcribed.words} words` : "Couldn't make out the handwriting clearly" }
    : { key: 'read', state: s.prepared ? 'active' : 'pending', text: 'Reading your handwriting' });

  if (s.askQuestion) {
    rows.push(s.question_done
      ? { key: 'q', state: 'done', text: s.question_done.found ? 'Found the question at the top of the page' : 'No question on the page; you can type it in next' }
      : { key: 'q', state: s.question ? 'active' : 'pending', text: 'Finding the question on the page' });
  }
  return rows;
}

export function ReadProgress({ stages, startedAt }: { stages: ReadStages; startedAt: number }) {
  return <ProgressOverlay title="Reading your answer sheet" rows={readRows(stages)} startedAt={startedAt} />;
}

// ── Marking the answer ───────────────────────────────────────────────────────

export type EvalStages = {
  read?: { pages: number; typed: boolean };
  transcribed?: { words: number };
  reference?: { ok: boolean };
  marking?: true;
  marked?: true;
  scoring?: true;
  scored?: true;
  feedback?: true;
  feedback_done?: true;
  finishing?: true;
  finished?: true;
};

export function applyEvalStage(s: EvalStages, e: { id?: string } & Record<string, unknown>): EvalStages {
  switch (e.id) {
    case 'read':          return { ...s, read: { pages: Number(e.pages) || 0, typed: Boolean(e.typed) } };
    case 'transcribed':   return { ...s, transcribed: { words: Number(e.words) || 0 } };
    case 'reference':     return { ...s, reference: { ok: Boolean(e.ok) } };
    case 'marking':       return { ...s, marking: true };
    case 'marked':        return { ...s, marked: true };
    case 'scoring':       return { ...s, scoring: true };
    case 'scored':        return { ...s, scored: true };
    case 'feedback':      return { ...s, feedback: true };
    case 'feedback_done': return { ...s, feedback_done: true };
    case 'finishing':     return { ...s, finishing: true };
    case 'finished':      return { ...s, finished: true };
    default:              return s;
  }
}

function evalRows(s: EvalStages): Row[] {
  const pages = s.read?.pages ?? 0;
  const plural = pages === 1 ? '' : 's';
  const started = Boolean(s.read);

  const read: Row = s.transcribed
    ? {
        key: 'read', state: 'done',
        text: s.read?.typed
          ? `Read your answer: ${s.transcribed.words} words`
          : s.transcribed.words > 0
            ? `Read your handwriting: ${s.transcribed.words} words across ${pages} page${plural}`
            : "Couldn't transcribe the handwriting cleanly; the marker will read the pages directly",
      }
    : {
        key: 'read', state: 'active',
        text: !started ? 'Sending your answer' : s.read?.typed ? 'Reading your answer' : `Reading your handwriting (${pages} page${plural})`,
      };

  const reference: Row = s.reference
    ? { key: 'reference', state: 'done', text: s.reference.ok ? 'Drafted a strong answer to mark against' : "Couldn't draft a reference answer; marking against the rubric" }
    : { key: 'reference', state: started ? 'active' : 'pending', text: 'Drafting a strong answer to mark against' };

  const step = (key: string, begun: true | undefined, ended: true | undefined, doing: string, did: string, todo: string): Row =>
    ended ? { key, state: 'done', text: did } : begun ? { key, state: 'active', text: doing } : { key, state: 'pending', text: todo };

  return [
    read, reference,
    step('marking', s.marking, s.marked, 'Marking against the UPSC rubric', 'Marked against the UPSC rubric', 'Mark against the UPSC rubric'),
    step('scoring', s.scoring, s.scored, 'Scoring introduction, body, conclusion and presentation', 'Scored each section', 'Score each section'),
    step('feedback', s.feedback, s.feedback_done, 'Writing your feedback', 'Feedback written', 'Write your feedback'),
    step('finishing', s.finishing, s.finished, 'Running final checks', 'Final checks done', 'Final checks'),
  ];
}

export default function EvalProgress({ stages, startedAt }: { stages: EvalStages; startedAt: number }) {
  return (
    <ProgressOverlay
      title="Marking your answer"
      note="This usually takes under a minute"
      rows={evalRows(stages)}
      startedAt={startedAt}
    />
  );
}

const EVP_CSS = `
.evp-scrim {
  position: fixed; inset: 0; z-index: 10001;
  display: flex; align-items: center; justify-content: center; padding: var(--space-4);
  background: color-mix(in srgb, var(--bg) 50%, transparent);
  backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
  animation: evpFade 0.2s ease;
}
.evp {
  width: 100%; max-width: 500px; max-height: calc(100dvh - var(--space-8)); overflow-y: auto;
  display: flex; flex-direction: column; align-items: center; text-align: center;
  padding: var(--space-8) var(--space-6) var(--space-6);
  background: var(--ds-card); border: 1px solid var(--border2); border-radius: var(--radius-xl);
  box-shadow: var(--elev-3); font-family: var(--font-ui);
  animation: evpIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.evp-owl { display: block; width: 124px; height: auto; margin: 0 auto var(--space-4); }
.evp-title { margin: 0 0 var(--space-2); font-size: 1.3rem; font-weight: 800; letter-spacing: -0.02em; color: var(--text); }
.evp-sub { font-size: 0.92rem; color: var(--text2); display: flex; align-items: center; justify-content: center; gap: var(--space-3); margin-bottom: var(--space-5); flex-wrap: wrap; }
.evp-clock { font-variant-numeric: tabular-nums; font-size: 0.82rem; font-weight: 600; color: var(--text3); padding: 2px 10px; border: 1px solid var(--border); border-radius: var(--radius-full); }
.evp-bar { width: 100%; display: grid; gap: 4px; margin-bottom: var(--space-5); }
.evp-bar span { height: 4px; border-radius: var(--radius-full); background: var(--ds-soft); transition: background 0.4s; }
.evp-bar span.active { background: color-mix(in srgb, var(--accent) 40%, var(--ds-soft)); animation: evpPulse 1.4s ease-in-out infinite; }
.evp-bar span.done { background: var(--accent); }
.evp-steps { width: 100%; list-style: none; margin: 0; padding: var(--space-4) var(--space-5); text-align: left;
  background: var(--ds-soft); border: 1px solid var(--border); border-radius: var(--radius-lg);
  display: flex; flex-direction: column; gap: var(--space-3); }
.evp-steps li { display: flex; align-items: center; gap: var(--space-3); font-size: 0.92rem; line-height: 1.45; }
.evp-steps li svg, .evp-dot { flex-shrink: 0; }
.evp-steps li.done { color: var(--text); }
.evp-steps li.done svg { color: var(--success-text); }
.evp-steps li.active { color: var(--text); font-weight: 600; }
.evp-steps li.active svg { color: var(--accent); }
.evp-steps li.pending { color: var(--text3); }
.evp-dot { width: 18px; height: 18px; display: inline-flex; align-items: center; justify-content: center; }
.evp-dot::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--border3); }
.evp-spin { animation: evpSpin 1.1s linear infinite; }
@keyframes evpSpin { to { transform: rotate(360deg); } }
@keyframes evpPulse { 50% { opacity: 0.55; } }
@keyframes evpFade { from { opacity: 0; } to { opacity: 1; } }
@keyframes evpIn { from { opacity: 0; transform: translateY(12px) scale(0.97); } to { opacity: 1; transform: none; } }
@media (max-width: 600px) {
  .evp { padding: var(--space-6) var(--space-4) var(--space-5); }
  .evp-owl { width: 100px; }
  .evp-steps { padding: var(--space-3) var(--space-4); }
  .evp-steps li { font-size: 0.86rem; }
}
@media (prefers-reduced-motion: reduce) { .evp-spin, .evp-bar span.active, .evp-scrim, .evp { animation: none; } }
`;
