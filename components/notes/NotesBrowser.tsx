'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';

export type BrowserNote = {
  slug: string; title: string; topic: number; paper: 1 | 2; section: string;
  description: string; subtopics: string[];
};

/**
 * A subject's notes: a box to find a topic by any word in it, and the papers
 * as tabs, each section a row of topic cards. Typing searches both papers at
 * once; with nothing typed, the tabs decide what shows.
 */
export default function NotesBrowser({ subject, subjectName, notes }: { subject: string; subjectName: string; notes: BrowserNote[] }) {
  const [paper, setPaper] = useState<1 | 2>(1);
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const papers = ([1, 2] as const).filter((p) => notes.some((n) => n.paper === p));
  const count = (p: 1 | 2) => notes.filter((n) => n.paper === p).length;

  const shown = useMemo(() => {
    if (!q) return notes.filter((n) => n.paper === paper);
    return notes.filter((n) =>
      n.title.toLowerCase().includes(q) ||
      n.description.toLowerCase().includes(q) ||
      n.subtopics.some((s) => s.toLowerCase().includes(q)));
  }, [notes, paper, q]);

  // Sections in the order the notes run, each keeping its topics' order.
  const sections = useMemo(() => {
    const out: { key: string; name: string; paper: 1 | 2; notes: BrowserNote[] }[] = [];
    for (const n of shown) {
      const key = `${n.paper}-${n.section}`;
      let sec = out.find((s) => s.key === key);
      if (!sec) { sec = { key, name: n.section, paper: n.paper, notes: [] }; out.push(sec); }
      sec.notes.push(n);
    }
    return out;
  }, [shown]);

  return (
    <div className="nb2">
      <div className="nb2-bar">
        <label className="nb2-search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a topic, a thinker or an idea"
            aria-label={`Search ${subjectName} notes`}
            type="search"
          />
          {query && <button type="button" className="nb2-clear" onClick={() => setQuery('')} aria-label="Clear search">✕</button>}
        </label>
        {!q && papers.length > 1 && (
          <div className="nb2-tabs" role="tablist" aria-label="Papers">
            {papers.map((p) => (
              <button key={p} role="tab" aria-selected={paper === p} className={`nb2-tab${paper === p ? ' on' : ''}`} onClick={() => setPaper(p)}>
                Paper {p === 1 ? 'I' : 'II'}<span>{count(p)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {q && (
        <p className="nb2-found" aria-live="polite">
          {shown.length
            ? `${shown.length} ${shown.length === 1 ? 'topic mentions' : 'topics mention'} “${query.trim()}”`
            : `No topic mentions “${query.trim()}”.`}
        </p>
      )}

      {q && !shown.length && (
        <Link href={`/chat?subject=${subject}&q=${encodeURIComponent(query.trim())}`} className="nb2-ask ds-card ds-card-link">
          <span className="nb2-ask-title">Ask the {subjectName} AI instead</span>
          <span className="nb2-ask-text">It will look for “{query.trim()}” in the standard books and show you where it found it.</span>
        </Link>
      )}

      <div className="nb2-sections">
        {sections.map((sec) => (
          <section key={sec.key} className="nb2-section">
            <div className="nb2-section-head">
              <h2 className="nb2-section-name">{sec.name}</h2>
              <span className="nb2-section-meta">{q ? `Paper ${sec.paper === 1 ? 'I' : 'II'} · ` : ''}{sec.notes.length} {sec.notes.length === 1 ? 'topic' : 'topics'}</span>
            </div>
            <div className="nb2-cards">
              {sec.notes.map((n) => (
                <Link key={n.slug} href={`/notes/${subject}/${n.slug}`} className="nb2-card">
                  <span className="nb2-card-top">
                    <span className="nb2-n">{n.topic}</span>
                    <span className="nb2-title">{n.title}</span>
                  </span>
                  <span className="nb2-desc">{n.description}</span>
                  {n.subtopics.length > 0 && (
                    <span className="nb2-subs">
                      {n.subtopics.slice(0, 3).map((s) => <span key={s}>{s}</span>)}
                      {n.subtopics.length > 3 && <span className="more">+{n.subtopics.length - 3}</span>}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
