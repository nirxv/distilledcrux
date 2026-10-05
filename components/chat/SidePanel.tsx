'use client';
import { useEffect, useLayoutEffect, useRef } from 'react';
import Link from 'next/link';
import type { RelatedPyq } from './StartFlow';
import type { SubjectKey } from '@/lib/subjectConfig';

export type Source = { book_title: string; author?: string; content: string };

export type PanelContent =
  | { kind: 'sources'; sources: Source[]; focus?: number[] }
  | { kind: 'pyqs'; title: string; pyqs: RelatedPyq[] };

type Props = {
  content: PanelContent;
  /** Whose PYQ pages the questions open. */
  subject: SubjectKey;
  langHi: boolean;
  onClose: () => void;
  onAnswer: (q: RelatedPyq) => void;
  clean: (text: string) => string;
  /** Called as a question's page is opened, with how far the list was scrolled. */
  onOpenPyq?: (scrollTop: number) => void;
  /** Hands over, once, the scroll position to come back to after Back. */
  takeRestoreTop?: () => number | null;
};

/**
 * The third column: what an answer stands on. Book passages for the answer
 * just given, or the past questions on its topic. Each question opens its own
 * page, where its topper copies and answers are, and is a tap away from being
 * answered here.
 */
export default function SidePanel({ content, subject, langHi, onClose, onAnswer, clean, onOpenPyq, takeRestoreTop }: Props) {
  const bodyRef = useRef<HTMLDivElement>(null);

  // Back from a question's page reopens the list where it was left, so the
  // next question is where the reader expects it.
  useLayoutEffect(() => {
    const top = takeRestoreTop?.() ?? null;
    if (top !== null && bodyRef.current) bodyRef.current.scrollTop = top;
  }, [takeRestoreTop]);
  const focusKey = content.kind === 'sources' ? (content.focus ?? []).join(',') : '';

  // A citation opens the panel on the passage it names.
  useEffect(() => {
    if (!focusKey) return;
    const first = Number(focusKey.split(',')[0]);
    bodyRef.current?.querySelector(`[data-source="${first}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [focusKey]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const heading = content.kind === 'sources'
    ? (langHi ? `${content.sources.length} पुस्तक अंश` : `${content.sources.length} book passage${content.sources.length === 1 ? '' : 's'}`)
    : (langHi ? `${content.pyqs.length} पिछले प्रश्न` : `${content.pyqs.length} past question${content.pyqs.length === 1 ? '' : 's'}`);

  return (
    <div className="ch-panel-inner">
      <div className="ch-panel-head">
        <div>
          <div className="ch-panel-title">{heading}</div>
          {content.kind === 'pyqs' && <div className="ch-panel-sub">{content.title}</div>}
        </div>
        <button className="ch-icon-btn" onClick={onClose} aria-label={langHi ? 'बंद करें' : 'Close'}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>

      <div className="ch-panel-body" ref={bodyRef}>
        {content.kind === 'sources'
          ? content.sources.map((s, i) => {
              const n = i + 1;
              const focused = content.focus?.includes(n);
              return (
                <article key={i} data-source={n} className={`ch-source${focused ? ' on' : ''}`}>
                  <div className="ch-source-head">
                    <span className="ch-source-n">{langHi ? `स्रोत ${n}` : `Source ${n}`}</span>
                    <span className="ch-source-book">{s.book_title}</span>
                  </div>
                  {s.author && <div className="ch-source-author">{s.author}</div>}
                  <p>{clean(s.content) || (langHi ? 'अंश उपलब्ध नहीं।' : 'Passage text unavailable.')}</p>
                </article>
              );
            })
          : content.pyqs.map((q) => (
              <article key={q.id} className="ch-panel-pyq">
                {/* The link's ::after covers the card, so the whole card opens
                    the question; Answer this sits above it. A real link, so a
                    middle click or Cmd-click opens it in a new tab. */}
                <Link
                  href={`/${subject}/pyqs/${q.id}`}
                  className="ch-panel-pyq-link"
                  onClick={() => onOpenPyq?.(bodyRef.current?.scrollTop ?? 0)}
                >
                  <div className="ch-panel-pyq-meta">
                    <span>{q.year}</span>
                    <span>{q.marks} {langHi ? 'अंक' : 'marks'}</span>
                    <svg className="ch-panel-pyq-go" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                  </div>
                  <p>{q.question}</p>
                </Link>
                <button className="ch-btn ch-btn-line ch-btn-sm" onClick={() => onAnswer(q)}>
                  {langHi ? 'इसका उत्तर लिखें' : 'Answer this'}
                </button>
              </article>
            ))}
      </div>
    </div>
  );
}
