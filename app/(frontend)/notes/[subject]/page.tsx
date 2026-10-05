import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import SubjectIcon from '@/components/SubjectIcon';
import NotesBrowser, { type BrowserNote } from '@/components/notes/NotesBrowser';
import { NOTE_SUBJECTS, isNoteSubject, notesForSubject } from '@/lib/notes';

/**
 * Every note for one optional. This replaces five copies of the same page,
 * one per subject, that had drifted apart in colour and layout.
 */

const SUBJECTS: Record<string, { name: string; description: string; lede: string }> = {
  sociology: {
    name: 'Sociology',
    description: 'Free notes for every topic of UPSC Sociology Optional, Papers I and II: the thinkers, research methods, Indian society and social change.',
    lede: 'From the founding thinkers to caste, kinship and change in India, cut down to what an answer actually uses.',
  },
  anthropology: {
    name: 'Anthropology',
    description: 'Free notes for every topic of UPSC Anthropology Optional, Papers I and II: human evolution, genetics, archaeology and tribal India.',
    lede: 'From fossils and genetics to kinship, religion and tribal India, cut down to what an answer actually uses.',
  },
  polsci: {
    name: 'PSIR',
    description: 'Free notes for every topic of UPSC PSIR Optional, Papers I and II: political theory, Indian government, comparative politics and international relations.',
    lede: 'From Plato and Rawls to the Constitution and India’s place in the world, cut down to what an answer actually uses.',
  },
  geography: {
    name: 'Geography',
    description: 'Free notes for every topic of UPSC Geography Optional, Papers I and II: physical, human and Indian geography and regional planning.',
    lede: 'From landforms and climate to India’s resources and regions, cut down to what an answer actually uses.',
  },
  'pub-admin': {
    name: 'Public Administration',
    description: 'Free notes for every topic of UPSC Public Administration Optional, Papers I and II: administrative theory and Indian administration.',
    lede: 'From Weber and Simon to the district and the CAG, cut down to what an answer actually uses.',
  },
};

export function generateStaticParams() {
  return NOTE_SUBJECTS.map((subject) => ({ subject }));
}

export async function generateMetadata({ params }: { params: Promise<{ subject: string }> }): Promise<Metadata> {
  const { subject } = await params;
  const s = SUBJECTS[subject];
  if (!s) return {};
  return {
    title: `${s.name} Optional Notes, Paper I and II`,
    description: s.description,
    alternates: { canonical: `https://distilledcrux.com/notes/${subject}` },
  };
}

export default async function SubjectNotesPage({ params }: { params: Promise<{ subject: string }> }) {
  const { subject } = await params;
  const s = SUBJECTS[subject];
  if (!s || !isNoteSubject(subject)) notFound();

  const notes: BrowserNote[] = notesForSubject(subject).map((n) => ({
    slug: n.slug, title: n.title, topic: n.topic, paper: n.paper, section: n.section,
    description: n.description, subtopics: n.subtopics ?? [],
  }));

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: NOTES_INDEX_CSS }} />
      <div className="ni ds" style={{ ['--t' as string]: `var(--tint-${subject})`, ['--w' as string]: `var(--wash-${subject})` }}>
        <section className="ni-hero">
          <div className="ds-container">
            <Link href={`/${subject}`} className="ds-back">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
              {s.name}
            </Link>
            <div className="ni-title">
              <span className="ni-icon" aria-hidden="true"><SubjectIcon id={subject} size={24} /></span>
              <h1 className="ds-h1">{s.name} notes</h1>
            </div>
            <p className="ds-lede ni-lede">{s.lede} {notes.length} topics, free with your account.</p>
          </div>
        </section>

        <section className="ni-body">
          <div className="ds-container">
            <NotesBrowser subject={subject} subjectName={s.name} notes={notes} />
          </div>
        </section>
      </div>
    </>
  );
}

const NOTES_INDEX_CSS = `
.ni { background: var(--bg); min-height: var(--page-min-h); }
.ni-hero {
  padding: clamp(24px, 4vh, 44px) 0 clamp(20px, 3vh, 32px);
  background: linear-gradient(180deg, color-mix(in srgb, var(--w) 70%, var(--bg)) 0%, var(--bg) 100%);
}
.ni-title { display: flex; align-items: center; gap: var(--space-3); margin: var(--space-4) 0 var(--space-2); }
.ni-title .ds-h1 { font-size: clamp(1.9rem, 4vw, 2.8rem); }
.ni-icon { width: 48px; height: 48px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 14px; background: var(--ds-card); color: var(--t); border: 1px solid var(--border); box-shadow: var(--elev-1); }
.ni-lede { max-width: 720px; }
.ni-body { padding: var(--space-4) 0 clamp(48px, 9vh, 96px); }

/* Search and tabs */
.nb2-bar { position: sticky; top: 60px; z-index: 5; display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); padding: var(--space-3) 0; margin-bottom: var(--space-4); background: color-mix(in srgb, var(--bg) 92%, transparent); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
.nb2-search { flex: 1 1 340px; display: flex; align-items: center; gap: var(--space-2); height: 48px; padding: 0 var(--space-2) 0 var(--space-4); background: var(--ds-card); border: 1.5px solid var(--border2); border-radius: var(--radius-full); color: var(--text3); transition: border-color 0.15s, box-shadow 0.15s; }
.nb2-search:focus-within { border-color: color-mix(in srgb, var(--accent) 65%, transparent); box-shadow: 0 0 0 4px var(--accent-glow); }
.nb2-search input { flex: 1; min-width: 0; height: 100%; border: none; outline: none; background: none; color: var(--text); font-size: 1rem; }
.nb2-search input::-webkit-search-cancel-button { display: none; }
.nb2-clear { width: 32px; height: 32px; border: none; border-radius: 50%; background: var(--ds-soft); color: var(--text3); cursor: pointer; font-size: 0.8rem; }
.nb2-tabs { display: inline-flex; gap: 4px; padding: 4px; border-radius: var(--radius-full); background: var(--ds-soft); border: 1px solid var(--border); }
.nb2-tab { display: inline-flex; align-items: center; gap: var(--space-2); padding: 9px 18px; border: none; border-radius: var(--radius-full); background: none; color: var(--text2); font-size: 0.95rem; font-weight: 700; cursor: pointer; transition: background 0.18s, color 0.18s, box-shadow 0.18s; }
.nb2-tab span { min-width: 24px; padding: 1px 7px; border-radius: var(--radius-full); background: var(--ds-card); font-size: 0.78rem; font-weight: 600; color: var(--text3); }
.nb2-tab.on { background: var(--ds-card); color: var(--text); box-shadow: var(--elev-1); }
.nb2-tab.on span { background: var(--w); color: var(--t); }
.nb2-progress { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2) var(--space-4); margin: 0 0 var(--space-2); font-size: 0.95rem; color: var(--text2); }
.nb2-progress strong { color: var(--text); }
.nb2-progress-bar { flex: 1 1 200px; max-width: 360px; height: 6px; border-radius: var(--radius-full); background: var(--ds-soft); overflow: hidden; }
.nb2-progress-bar span { display: block; height: 100%; border-radius: inherit; background: var(--success-text); }
.nb2-card.done .nb2-n { background: var(--success-wash); color: var(--success-text); }
.nb2-found { margin: 0 0 var(--space-4); font-size: 0.95rem; color: var(--text2); }
.nb2-ask { display: flex; flex-direction: column; gap: var(--space-1); padding: var(--space-5); margin-bottom: var(--space-6); max-width: 560px; }
.nb2-ask-title { font-weight: 700; color: var(--accent-text); }
.nb2-ask-text { font-size: 0.92rem; color: var(--text2); }

/* Sections: name on the left, the topics beside it */
.nb2-sections { display: flex; flex-direction: column; }
.nb2-section { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: var(--space-6); padding: var(--space-6) 0; border-top: 1px solid var(--border); }
.nb2-section:first-child { border-top: none; padding-top: var(--space-2); }
.nb2-section-head { display: flex; flex-direction: column; gap: 2px; padding-top: var(--space-2); }
.nb2-section-name { font-size: 1rem; font-weight: 700; line-height: 1.35; }
.nb2-section-meta { font-size: 0.84rem; font-weight: 600; color: var(--t); }
.nb2-cards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-3); }
.nb2-card {
  display: flex; flex-direction: column; gap: var(--space-2); padding: var(--space-4);
  background: var(--ds-card); border: 1px solid var(--border); border-radius: var(--radius-xl);
  color: var(--text); text-decoration: none; transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
}
.nb2-card:hover { border-color: color-mix(in srgb, var(--t) 45%, transparent); box-shadow: var(--elev-2); transform: translateY(-1px); }
.nb2-card-top { display: flex; align-items: center; gap: var(--space-3); }
.nb2-n { width: 28px; height: 28px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: var(--radius-circle); background: var(--w); color: var(--t); font-size: 0.8rem; font-weight: 700; }
.nb2-title { font-weight: 700; font-size: 1rem; line-height: 1.35; }
.nb2-desc { font-size: 0.88rem; line-height: 1.55; color: var(--text2); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.nb2-subs { display: flex; flex-wrap: wrap; gap: 5px; margin-top: auto; padding-top: var(--space-1); }
.nb2-subs span { padding: 2px 9px; border-radius: var(--radius-full); border: 1px solid var(--border); background: var(--ds-soft); font-size: 0.74rem; color: var(--text2); }
.nb2-subs span.more { color: var(--text3); }

@media (max-width: 960px) {
  .nb2-section { grid-template-columns: minmax(0, 1fr); gap: var(--space-3); }
  .nb2-section-head { flex-direction: row; align-items: baseline; gap: var(--space-2); padding-top: 0; }
}
@media (max-width: 640px) {
  .nb2-bar { gap: var(--space-2); }
  .nb2-search { flex-basis: 100%; height: 46px; }
  .nb2-tabs { display: flex; width: 100%; }
  .nb2-tab { flex: 1; justify-content: center; padding: 8px 10px; }
  .nb2-cards { grid-template-columns: minmax(0, 1fr); gap: var(--space-2); }
  .nb2-card { padding: var(--space-3) var(--space-4); }
}
@media (prefers-reduced-motion: reduce) { .nb2-card { transition: none; } .nb2-card:hover { transform: none; } }
`;
