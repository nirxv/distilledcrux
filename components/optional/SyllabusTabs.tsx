'use client';
import { useState } from 'react';
import Link from 'next/link';

export type SyllabusPaper = {
  paper: 1 | 2;
  /** `topic` is the note's own number within its paper, as the notes pages show it. */
  sections: { name: string; notes: { slug: string; title: string; topic: number; subtopics: string[] }[] }[];
};

/**
 * A subject's syllabus as the list of its notes, one paper at a time. Every
 * topic is a link straight into its notes, so the syllabus doubles as the way
 * in. Each section is a row of its own, so a section of two topics never sits
 * beside one of eight and leaves a hole.
 */
export default function SyllabusTabs({ subject, papers }: { subject: string; papers: SyllabusPaper[] }) {
  const [active, setActive] = useState(0);
  const paper = papers[active];

  return (
    <div className="sy">
      <div className="sy-tabs" role="tablist" aria-label="Papers">
        {papers.map((p, i) => {
          const count = p.sections.reduce((s, x) => s + x.notes.length, 0);
          return (
            <button
              key={p.paper}
              role="tab"
              aria-selected={i === active}
              className={`sy-tab${i === active ? ' on' : ''}`}
              onClick={() => setActive(i)}
            >
              Paper {p.paper === 1 ? 'I' : 'II'}<span>{count} topics</span>
            </button>
          );
        })}
      </div>

      <div className="sy-sections" role="tabpanel">
        {paper.sections.map((sec) => (
          <section key={sec.name} className="sy-section">
            <div className="sy-section-head">
              <h3 className="sy-section-name">{sec.name}</h3>
              <span className="sy-section-count">{sec.notes.length} {sec.notes.length === 1 ? 'topic' : 'topics'}</span>
            </div>
            <div className="sy-list">
              {sec.notes.map((note) => {
                return (
                  <Link key={note.slug} href={`/notes/${subject}/${note.slug}`} className="sy-topic">
                    <span className="sy-n">{note.topic}</span>
                    <span className="sy-text">
                      <span className="sy-title">{note.title}</span>
                      {note.subtopics.length > 0 && <span className="sy-subs">{note.subtopics.slice(0, 3).join(' · ')}</span>}
                    </span>
                    <svg className="sy-go" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
