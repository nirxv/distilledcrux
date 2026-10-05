import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import SubjectIcon from '@/components/SubjectIcon';
import PyqBrowser from '@/components/pyq/PyqBrowser';
import { PYQ_SUBJECT_NAME, isPyqSubject, loadPyqs } from '@/lib/pyqs';

/**
 * Every past question for one optional. This replaces five copies of the
 * same page, one per subject, which had drifted apart in colour, in what the
 * search matched and in which topics the filter offered.
 */

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(PYQ_SUBJECT_NAME).map((optional) => ({ optional }));
}

export async function generateMetadata({ params }: { params: Promise<{ optional: string }> }): Promise<Metadata> {
  const { optional } = await params;
  if (!isPyqSubject(optional)) return {};
  const name = PYQ_SUBJECT_NAME[optional];
  const { questions } = await loadPyqs(optional);
  const first = questions[questions.length - 1]?.year;
  return {
    title: `${name} Optional PYQs, Paper I and II`,
    description: `All ${questions.length.toLocaleString('en-IN')} UPSC ${name} optional questions${first ? ` since ${first}` : ''}, by year, paper, topic and marks. Write an answer to any of them and have it evaluated.`,
    alternates: { canonical: `https://distilledcrux.com/${optional}/pyqs` },
  };
}

export default async function PyqsPage({ params }: { params: Promise<{ optional: string }> }) {
  const { optional } = await params;
  if (!isPyqSubject(optional)) notFound();
  const name = PYQ_SUBJECT_NAME[optional];
  const { questions, topics } = await loadPyqs(optional);
  const first = questions[questions.length - 1]?.year;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PYQ_LIST_CSS }} />
      <div className="pl ds" style={{ ['--t' as string]: `var(--tint-${optional})`, ['--w' as string]: `var(--wash-${optional})` }}>
        <section className="pl-hero">
          <div className="ds-container">
            <Link href={`/${optional}`} className="ds-back">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
              {name}
            </Link>
            <div className="pl-title">
              <span className="pl-icon" aria-hidden="true"><SubjectIcon id={optional} size={24} /></span>
              <h1 className="ds-h1">{name} PYQs</h1>
            </div>
            <p className="ds-lede pl-lede">
              Every question UPSC has set in {name}{first ? ` since ${first}` : ''}, {questions.length.toLocaleString('en-IN')} in all.
              Open one to see how to tackle it, or write an answer and have it checked.
            </p>
          </div>
        </section>

        <section className="pl-body">
          <div className="ds-container">
            <PyqBrowser subject={optional} subjectName={name} questions={questions} topics={topics} />
          </div>
        </section>
      </div>
    </>
  );
}

const PYQ_LIST_CSS = `
.pl { background: var(--bg); min-height: var(--page-min-h); }
.pl-hero {
  padding: clamp(24px, 4vh, 44px) 0 clamp(16px, 2.5vh, 28px);
  background: linear-gradient(180deg, color-mix(in srgb, var(--w) 70%, var(--bg)) 0%, var(--bg) 100%);
}
.pl-title { display: flex; align-items: center; gap: var(--space-3); margin: var(--space-4) 0 var(--space-2); }
.pl-title .ds-h1 { font-size: clamp(1.9rem, 4vw, 2.8rem); }
.pl-icon { width: 48px; height: 48px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 14px; background: var(--ds-card); color: var(--t); border: 1px solid var(--border); box-shadow: var(--elev-1); }
.pl-lede { max-width: 720px; }
.pl-body { padding: var(--space-2) 0 clamp(48px, 9vh, 96px); }
.pq { max-width: 880px; }

/* Search and filters */
.pq-bar { position: sticky; top: 60px; z-index: 5; display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); padding: var(--space-3) 0; background: color-mix(in srgb, var(--bg) 92%, transparent); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
.pq-search { flex: 1 1 340px; display: flex; align-items: center; gap: var(--space-2); height: 48px; padding: 0 var(--space-2) 0 var(--space-4); background: var(--ds-card); border: 1.5px solid var(--border2); border-radius: var(--radius-full); color: var(--text3); transition: border-color 0.15s, box-shadow 0.15s; }
.pq-search:focus-within { border-color: color-mix(in srgb, var(--accent) 65%, transparent); box-shadow: 0 0 0 4px var(--accent-glow); }
.pq-search input { flex: 1; min-width: 0; height: 100%; border: none; outline: none; background: none; color: var(--text); font-size: 1rem; }
.pq-search input::-webkit-search-cancel-button { display: none; }
.pq-clear { width: 32px; height: 32px; border: none; border-radius: 50%; background: var(--ds-soft); color: var(--text3); cursor: pointer; font-size: 0.8rem; }
.pq-tabs { display: inline-flex; gap: 4px; padding: 4px; border-radius: var(--radius-full); background: var(--ds-soft); border: 1px solid var(--border); }
.pq-tab { display: inline-flex; align-items: center; gap: var(--space-2); padding: 9px 16px; border: none; border-radius: var(--radius-full); background: none; color: var(--text2); font-size: 0.92rem; font-weight: 700; cursor: pointer; white-space: nowrap; transition: background 0.18s, color 0.18s, box-shadow 0.18s; }
.pq-tab span { min-width: 24px; padding: 1px 7px; border-radius: var(--radius-full); background: var(--ds-card); font-size: 0.76rem; font-weight: 600; color: var(--text3); }
.pq-tab.on { background: var(--ds-card); color: var(--text); box-shadow: var(--elev-1); }
.pq-tab.on span { background: var(--w); color: var(--t); }
.pq-selects { display: flex; gap: var(--space-2); width: 100%; }
.pq-select {
  appearance: none; -webkit-appearance: none; min-width: 0; height: 40px; padding: 0 34px 0 14px;
  background: var(--ds-card) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E") no-repeat right 13px center;
  border: 1px solid var(--border2); border-radius: var(--radius-full);
  color: var(--text); font: inherit; font-size: 0.9rem; font-weight: 500; cursor: pointer; text-overflow: ellipsis;
  transition: border-color 0.15s;
}
.pq-select:hover { border-color: var(--border3); }
.pq-select:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.pq-select.set { border-color: color-mix(in srgb, var(--t) 50%, transparent); background-color: var(--w); color: var(--t); font-weight: 600; }
.pq-select-topic { flex: 1 1 auto; max-width: 420px; }

.pq-status { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); margin: var(--space-2) 0 var(--space-2); font-size: 0.95rem; color: var(--text2); }
.pq-status strong { color: var(--text); font-weight: 600; }
.pq-reset { background: none; border: none; padding: 4px 0; font: inherit; font-size: 0.9rem; font-weight: 600; color: var(--accent-text); cursor: pointer; white-space: nowrap; }

/* Years and cards */
.pq-year { padding-top: var(--space-5); }
.pq-year-head { display: flex; align-items: baseline; gap: var(--space-2); margin: 0 0 var(--space-3); font-size: 1.35rem; font-weight: 800; letter-spacing: -0.02em; }
.pq-year-head span { font-size: 0.86rem; font-weight: 500; letter-spacing: 0; color: var(--text3); }
.pq-cards { display: flex; flex-direction: column; gap: var(--space-3); }
.pq-card {
  position: relative; display: flex; flex-direction: column; gap: var(--space-2); padding: var(--space-4) var(--space-5);
  background: var(--ds-card); border: 1px solid var(--border); border-radius: var(--radius-xl);
  transition: border-color 0.15s, box-shadow 0.15s;
}
.pq-card:hover { border-color: color-mix(in srgb, var(--t) 45%, transparent); box-shadow: var(--elev-2); }
.pq-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; font-size: 0.82rem; color: var(--text3); }
.pq-paper { font-weight: 700; color: var(--t); }
.pq-done { padding: 1px 9px; border-radius: var(--radius-full); background: var(--success-wash); color: var(--success-text); font-weight: 700; }
.pq-status-done { color: var(--success-text); font-weight: 600; }
.pq-marks { margin-left: auto; padding: 2px 10px; border-radius: var(--radius-full); background: var(--ds-soft); color: var(--text2); font-weight: 600; }
.pq-q { margin: 0; font-size: 1.04rem; font-weight: 500; line-height: 1.6; }
.pq-q a { color: var(--text); text-decoration: none; }
/* The whole card opens the question; the topic and the write link sit above. */
.pq-q a::after { content: ''; position: absolute; inset: 0; border-radius: inherit; }
.pq-q a:focus-visible { outline: none; }
.pq-card:has(.pq-q a:focus-visible) { outline: 2px solid var(--accent); outline-offset: 2px; }
.pq-q mark { background: color-mix(in srgb, var(--premium-text) 26%, transparent); color: inherit; border-radius: 3px; padding: 0 1px; }
.pq-foot { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); margin-top: 2px; }
.pq-topic { position: relative; z-index: 1; min-width: 0; padding: 3px 11px; border-radius: var(--radius-full); border: 1px solid var(--border); background: var(--ds-soft); color: var(--text2); font: inherit; font-size: 0.8rem; text-align: left; cursor: pointer; transition: border-color 0.15s, color 0.15s; }
.pq-topic:hover, .pq-topic.on { border-color: color-mix(in srgb, var(--t) 45%, transparent); color: var(--t); background: var(--w); }
.pq-write { position: relative; z-index: 1; display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; font-size: 0.88rem; font-weight: 600; color: var(--accent-text); text-decoration: none; }
.pq-write:hover { text-decoration: underline; text-underline-offset: 3px; }
.pq-more { display: flex; justify-content: center; padding: var(--space-6) 0 0; }

.pq-empty { padding: var(--space-8) 0; color: var(--text2); }
.pq-empty p { margin: 0 0 var(--space-4); }
.pq-empty-ask { display: flex; flex-direction: column; gap: 4px; max-width: 560px; padding: var(--space-5); }
.pq-empty-ask strong { color: var(--accent-text); }
.pq-empty-ask span { font-size: 0.92rem; color: var(--text2); }

@media (max-width: 900px) {
  .pq-bar { position: static; }
}
@media (max-width: 640px) {
  .pq-bar { gap: var(--space-2); }
  .pq-search { flex-basis: 100%; height: 46px; }
  .pq-tabs { display: flex; width: 100%; }
  .pq-tab { flex: 1; justify-content: center; padding: 8px 6px; font-size: 0.86rem; }
  .pq-selects { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .pq-select-topic { grid-column: 1 / -1; max-width: none; }
  .pq-card { padding: var(--space-4); }
  .pq-q { font-size: 1rem; }
  .pq-foot { flex-wrap: wrap; }
}
@media (prefers-reduced-motion: reduce) { .pq-card, .pq-select, .pq-tab { transition: none; } }
`;
