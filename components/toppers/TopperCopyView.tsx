'use client';
import Link from 'next/link';
import { rankLine, type TopperCopy } from '@/lib/toppers/meta';
import TopperPdf from './TopperPdf';
import { gateFor, useTopperStatus } from './useTopperStatus';
import type { PyqRef } from './TopperBrowser';

type Props = {
  subject: string;
  subjectName: string;
  copy: TopperCopy;
  /** Other toppers' answers to the same question, best rank first. */
  others: TopperCopy[];
  pyqs: PyqRef[];
};

/**
 * One topper copy: what was asked, who wrote it, the UPSC questions it would
 * answer, the handwritten pages, and the other toppers' answers to compare it
 * with.
 */
export default function TopperCopyView({ subject, subjectName, copy, others, pyqs }: Props) {
  const allowance = useTopperStatus(subject);
  const left = Math.max(0, allowance.limit - allowance.used);

  return (
    <div className="tv-grid">
      <div className="tv-main">
        <header className="tv-head">
          <div className="tv-meta">
            <span className="tv-paper">{copy.paper}</span>
            <Link href={`/${subject}/toppers?topic=${encodeURIComponent(copy.topic)}`} className="tv-topic">{copy.topic}</Link>
            <span className="tv-marks">{copy.marks} marks</span>
          </div>
          <h1 className="tv-q">{copy.question}</h1>
          <p className="tv-who">
            <strong>{copy.topper}</strong>
            {rankLine(copy) && <span>{rankLine(copy)}</span>}
          </p>
          <p className="tv-source">{copy.source}</p>
          {pyqs.length > 0 && (
            <div className="tv-asked">
              <span className="tv-asked-label">This answer would answer {pyqs.length === 1 ? 'a UPSC question' : `${pyqs.length} UPSC questions`}</span>
              <ul>
                {pyqs.map((p) => (
                  <li key={p.id}>
                    <Link href={`/${subject}/pyqs/${p.id}`} prefetch={false}>
                      <span className="tv-asked-year">{p.year} · {p.paper}</span>
                      <span className="tv-asked-q">{p.question}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </header>

        <TopperPdf key={copy.id} subject={subject} copyId={copy.id} height="min(82vh, 1100px)"
          gate={gateFor(allowance, copy.id)} freeLeft={left} onOpened={allowance.noteOpened} />
      </div>

      <aside className="tv-aside">
        {others.length > 0 ? (
          <div className="tv-side">
            <h2 className="tv-side-title">Other toppers on this question</h2>
            <ul className="tv-others">
              {others.map((o) => (
                <li key={o.id}>
                  <Link href={`/${subject}/toppers/${o.id}`} prefetch={false} className="tv-other">
                    <span className="tv-other-name">{o.topper}</span>
                    <span className="tv-other-rank">{rankLine(o)}</span>
                    {allowance.opened.has(o.id) && <span className="tv-opened">Opened</span>}
                  </Link>
                  <Link href={`/${subject}/toppers/compare?a=${copy.id}&b=${o.id}`} prefetch={false} className="tv-cmp">Compare</Link>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="tv-side">
            <h2 className="tv-side-title">Only one topper so far</h2>
            <p className="tv-side-text">No other topper&apos;s answer to this question is in the collection yet.</p>
          </div>
        )}
        <div className="tv-side">
          <h2 className="tv-side-title">How to read it</h2>
          <p className="tv-side-text">
            Look at how the answer opens, how it is divided, and where the examples, thinkers and diagrams go.
            Then write your own and have it checked.
          </p>
          <Link href={`/evaluate?question=${encodeURIComponent(copy.question)}&marks=${copy.marks}`} className="ds-btn ds-btn-line ds-btn-sm">Write your answer</Link>
        </div>
        <Link href={`/${subject}/toppers`} className="tv-all">All {subjectName} topper copies</Link>
      </aside>
    </div>
  );
}
