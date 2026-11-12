'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { TopperCopy } from '@/lib/toppers/meta';
import TopperPdf from './TopperPdf';
import { allowanceLine, gateFor, useTopperStatus } from './useTopperStatus';

type Props = {
  subject: string;
  /** Every copy that can sit in either pane: the same printed question or a shared UPSC question. */
  pool: TopperCopy[];
  a: string;
  b: string;
};

/**
 * Two toppers' answers side by side. Each pane names its own copy's question:
 * two toppers can answer the same UPSC question from different test papers,
 * and on the history site a Compare page that showed one question over both
 * panes was wrong half the time.
 *
 * On a phone there is no room for two pages abreast, so the panes take turns
 * behind a switch; both stay mounted, so switching back does not reload.
 */
export default function TopperCompare({ subject, pool, a, b }: Props) {
  const [ids, setIds] = useState<[string, string]>([a, b]);
  const [front, setFront] = useState<0 | 1>(0);
  const allowance = useTopperStatus(subject);
  const byId = new Map(pool.map((c) => [c.id, c]));
  const left = Math.max(0, allowance.limit - allowance.used);
  const note = allowanceLine(allowance);

  const setPane = (i: 0 | 1, id: string) => {
    const next: [string, string] = [...ids];
    next[i] = id;
    setIds(next);
    window.history.replaceState(null, '', `${window.location.pathname}?a=${next[0]}&b=${next[1]}`);
  };

  return (
    <div className="tc">
      {note && <p className="tc-note">{note}</p>}
      <div className="tc-switch" role="tablist" aria-label="Which answer">
        {[0, 1].map((i) => {
          const c = byId.get(ids[i])!;
          return (
            <button key={i} type="button" role="tab" aria-selected={front === i} className={`tc-tab${front === i ? ' on' : ''}`} onClick={() => setFront(i as 0 | 1)}>
              {c.topper}
            </button>
          );
        })}
      </div>
      <div className="tc-panes">
        {([0, 1] as const).map((i) => {
          const c = byId.get(ids[i])!;
          const other = ids[1 - i];
          return (
            <section key={i} className={`tc-pane${front === i ? ' front' : ''}`} aria-label={`${c.topper}'s answer`}>
              <div className="tc-head">
                <label className="tc-pick">
                  <span className="tc-pick-label">Topper</span>
                  <select value={c.id} onChange={(e) => setPane(i, e.target.value)} aria-label={`Answer ${i + 1}`}>
                    {pool.filter((p) => p.id === c.id || p.id !== other).map((p) => (
                      <option key={p.id} value={p.id}>{p.topper}{p.rank ? `, AIR ${p.rank}` : ''}</option>
                    ))}
                  </select>
                </label>
                {c.year && <p className="tc-rank">CSE {c.year}</p>}
                <p className="tc-q"><span>{c.paper} · {c.marks} marks</span>{c.question}</p>
                <Link href={`/${subject}/topper-copies/${c.id}`} prefetch={false} className="tc-open">Open on its own page</Link>
              </div>
              <TopperPdf key={c.id} subject={subject} copyId={c.id} height="min(76vh, 980px)"
                gate={gateFor(allowance, c.id)} freeLeft={left} onOpened={allowance.noteOpened} />
            </section>
          );
        })}
      </div>
    </div>
  );
}
