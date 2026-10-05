import type { Metadata } from 'next';
import Link from 'next/link';
import SubjectIcon from '@/components/SubjectIcon';
import ContinueNotes from '@/components/notes/ContinueNotes';
import { NOTE_SUBJECTS, notesForSubject } from '@/lib/notes';

export const metadata: Metadata = {
  title: 'Notes for UPSC Optional Subjects',
  description: 'Free notes for every topic of Sociology, Anthropology, PSIR, Geography and Public Administration, Papers I and II.',
  alternates: { canonical: 'https://distilledcrux.com/notes' },
};

const NAMES: Record<string, string> = {
  sociology: 'Sociology', anthropology: 'Anthropology', polsci: 'PSIR', geography: 'Geography', 'pub-admin': 'Public Administration',
};

const Arrow = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);

/**
 * The way into the notes: one card per optional, with what is in it. It used
 * to be a copy of the old home page, canonical tag and all.
 */
export default function NotesPage() {
  const subjects = NOTE_SUBJECTS.map((id) => {
    const notes = notesForSubject(id);
    return { id, name: NAMES[id], topics: notes.length, sections: [...new Set(notes.map((n) => n.section))] };
  });
  const total = subjects.reduce((n, s) => n + s.topics, 0);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: NL_CSS }} />
      <div className="nl ds">
        <section className="nl-hero">
          <div className="ds-container ds-narrow">
            <h1 className="ds-h1">Notes</h1>
            <p className="ds-lede">Every topic in both papers of five optionals, {total} in all, free with your account. Pick yours.</p>
            <ContinueNotes />
          </div>
        </section>
        <section className="nl-body">
          <div className="ds-container ds-narrow nl-list">
            {subjects.map((s) => (
              <Link key={s.id} href={`/notes/${s.id}`} className="nl-card ds-card ds-card-link" style={{ ['--t' as string]: `var(--tint-${s.id})`, ['--w' as string]: `var(--wash-${s.id})` }}>
                <span className="nl-icon" aria-hidden="true"><SubjectIcon id={s.id} size={24} /></span>
                <span className="nl-text">
                  <span className="nl-name">{s.name}</span>
                  <span className="nl-meta">{s.topics} topics · Paper I and II</span>
                  <span className="nl-sections">{s.sections.join(' · ')}</span>
                </span>
                <span className="nl-go"><Arrow /></span>
              </Link>
            ))}
            <a href="https://historyoptional.xyz/notes" target="_blank" rel="noopener noreferrer" className="nl-card ds-card ds-card-link" style={{ ['--t' as string]: 'var(--tint-history)', ['--w' as string]: 'var(--wash-history)' }}>
              <span className="nl-icon" aria-hidden="true"><SubjectIcon id="history" size={24} /></span>
              <span className="nl-text">
                <span className="nl-name">History</span>
                <span className="nl-meta">On historyoptional.xyz ↗</span>
                <span className="nl-sections">Ancient · Medieval · Modern India · World History</span>
              </span>
              <span className="nl-go"><Arrow /></span>
            </a>
          </div>
        </section>
      </div>
    </>
  );
}

const NL_CSS = `
.nl { background: var(--bg); min-height: var(--page-min-h); }
.nl-hero { padding: clamp(36px, 6vh, 72px) 0 var(--space-6); }
.nl-hero .ds-narrow { display: flex; flex-direction: column; gap: var(--space-3); }
.nl-continue {
  display: flex; align-items: center; justify-content: space-between; gap: var(--space-3);
  margin-top: var(--space-3); padding: var(--space-4) var(--space-5);
  border-radius: var(--radius-xl); background: var(--w); color: var(--t); text-decoration: none;
  border: 1px solid color-mix(in srgb, var(--t) 25%, transparent); transition: transform 0.15s;
}
.nl-continue:hover { transform: translateY(-1px); }
.nl-continue-text { color: var(--text); font-size: 1rem; }
.nl-continue-text b { color: var(--t); }
.nl-body { padding: 0 0 clamp(48px, 9vh, 96px); }
.nl-list { display: flex; flex-direction: column; gap: var(--space-3); }
.nl-card { display: flex; align-items: center; gap: var(--space-4); padding: var(--space-5); }
.nl-icon { width: 52px; height: 52px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: var(--radius-lg); background: var(--w); color: var(--t); }
.nl-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.nl-name { font-weight: 700; font-size: 1.1rem; }
.nl-meta { font-size: 0.86rem; font-weight: 600; color: var(--t); }
.nl-sections { font-size: 0.88rem; color: var(--text3); line-height: 1.5; margin-top: 2px; }
.nl-go { color: var(--text3); flex-shrink: 0; transition: color 0.15s, transform 0.15s; }
.nl-card:hover .nl-go { color: var(--t); transform: translateX(2px); }
@media (max-width: 640px) {
  .nl-card { padding: var(--space-4); gap: var(--space-3); align-items: flex-start; }
  .nl-icon { width: 44px; height: 44px; }
  .nl-go { display: none; }
}
`;
