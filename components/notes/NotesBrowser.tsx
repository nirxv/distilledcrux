'use client';
import { useMemo, useState } from 'react';
import Link from '@/components/Link';
import { topicKey, useSyllabusTracker } from '@/hooks/useSyllabusTracker';
import { useLang } from '@/lib/i18n/LangContext';

export type BrowserNote = {
  slug: string; title: string; topic: number; paper: 1 | 2; section: string;
  description: string; subtopics: string[];
};

/**
 * A subject's notes: a box to find a topic by any word in it, and the papers
 * as tabs, each section a row of topic cards. Typing searches both papers at
 * once; with nothing typed, the tabs decide what shows.
 */
export default function NotesBrowser({ subject, subjectName, notes: notesProp, notesHi, sectionsHi }: {
  subject: string;
  subjectName: string;
  notes: BrowserNote[];
  notesHi?: Record<string, { title: string; description: string; subtopics: string[] }>;
  sectionsHi?: Record<string, string>;
}) {
  const { L, langHi } = useLang();
  const notes = useMemo<BrowserNote[]>(() => notesProp.map((n) => {
    const hi = langHi ? notesHi?.[n.slug] : undefined;
    if (!hi) return n;
    return { ...n, title: hi.title, description: hi.description, subtopics: hi.subtopics, section: sectionsHi?.[n.section] ?? n.section };
  }), [notesProp, notesHi, sectionsHi, langHi]);
  const [paper, setPaper] = useState<1 | 2>(1);
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const tracker = useSyllabusTracker();
  const done = (n: BrowserNote) => tracker.ready && tracker.isCompleted(topicKey(subject, n.slug));
  const doneCount = tracker.ready ? notes.filter(done).length : 0;

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
            placeholder={L('Find a topic, a thinker or an idea', 'किसी विषय, विचारक या विचार को खोजें')}
            aria-label={L(`Search ${subjectName} notes`, `${subjectName} के नोट्स खोजें`)}
            type="search"
          />
          {query && <button type="button" className="nb2-clear" onClick={() => setQuery('')} aria-label={L('Clear search', 'खोज साफ़ करें')}>✕</button>}
        </label>
        {!q && papers.length > 1 && (
          <div className="nb2-tabs" role="tablist" aria-label={L('Papers', 'पेपर')}>
            {papers.map((p) => (
              <button key={p} role="tab" aria-selected={paper === p} className={`nb2-tab${paper === p ? ' on' : ''}`} onClick={() => setPaper(p)}>
                {L(`Paper ${p === 1 ? 'I' : 'II'}`, `पेपर ${p === 1 ? 'I' : 'II'}`)}<span>{count(p)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {!q && doneCount > 0 && (
        <div className="nb2-progress">
          <span>{L(
            `${doneCount} of ${notes.length} topics done${doneCount === notes.length ? ', the whole syllabus' : ''}`,
            `${notes.length} में से ${doneCount} विषय पूरे${doneCount === notes.length ? ', पूरा पाठ्यक्रम' : ''}`,
          )}</span>
          <span className="nb2-progress-bar"><span style={{ width: `${(doneCount / notes.length) * 100}%` }} /></span>
        </div>
      )}

      {q && (
        <p className="nb2-found" aria-live="polite">
          {shown.length
            ? L(
              `${shown.length} ${shown.length === 1 ? 'topic mentions' : 'topics mention'} “${query.trim()}”`,
              `${query.trim()} का उल्लेख ${shown.length} ${shown.length === 1 ? 'विषय में' : 'विषयों में'}`,
            )
            : L(`No topic mentions “${query.trim()}”.`, `“${query.trim()}” का किसी विषय में उल्लेख नहीं मिला।`)}
        </p>
      )}

      {q && !shown.length && (
        <Link href={`/chat?subject=${subject}&q=${encodeURIComponent(query.trim())}`} className="nb2-ask ds-card ds-card-link">
          <span className="nb2-ask-title">{L(`Ask the ${subjectName} AI instead`, `इसके बजाय ${subjectName} AI से पूछें`)}</span>
          <span className="nb2-ask-text">{L(
            `It will look for “${query.trim()}” in the standard books and show you where it found it.`,
            `यह मानक पुस्तकों में “${query.trim()}” खोजेगा और बताएगा कि यह कहाँ मिला।`,
          )}</span>
        </Link>
      )}

      <div className="nb2-sections">
        {sections.map((sec) => (
          <section key={sec.key} className="nb2-section">
            <div className="nb2-section-head">
              <h2 className="nb2-section-name">{sec.name}</h2>
              <span className="nb2-section-meta">
                {q ? L(`Paper ${sec.paper === 1 ? 'I' : 'II'} · `, `पेपर ${sec.paper === 1 ? 'I' : 'II'} · `) : ''}{sec.notes.length} {L(sec.notes.length === 1 ? 'topic' : 'topics', 'विषय')}
                {doneCount > 0 && sec.notes.some(done) ? L(` · ${sec.notes.filter(done).length} done`, ` · ${sec.notes.filter(done).length} पूरे`) : ''}
              </span>
            </div>
            <div className="nb2-cards">
              {sec.notes.map((n) => (
                <Link key={n.slug} href={`/notes/${subject}/${n.slug}`} className={`nb2-card${done(n) ? ' done' : ''}`}>
                  <span className="nb2-card-top">
                    <span className="nb2-n" aria-label={done(n) ? L(`Topic ${n.topic}, done`, `विषय ${n.topic}, पूरा`) : undefined}>
                      {done(n)
                        ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                        : n.topic}
                    </span>
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
