import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import SubjectIcon from '@/components/SubjectIcon';
import HomeAsk from '@/components/home/HomeAsk';
import SyllabusTabs, { type SyllabusPaper } from '@/components/optional/SyllabusTabs';
import { notesForSubject } from '@/lib/notes';
import { pyqSummaryForOptional } from '@/lib/pyqCounts';
import { SUBJECT_BOOKS, type SubjectKey } from '@/lib/subjectConfig';

/**
 * A subject's front door: what the optional covers, its syllabus as a list of
 * notes to open, the books its AI reads from, and the latest questions UPSC
 * set. Static; every number on it is counted from the data at build time.
 */

type Subject = {
  name: string;
  /** The hero's title, where the full name would run to two lines. */
  title?: string;
  optional: string;
  about: (since: number | null) => string;
};

const since = (y: number | null) => (y ? `past questions back to ${y}` : 'the past questions');

const SUBJECTS: Record<string, Subject> = {
  sociology: {
    name: 'Sociology', optional: 'sociology',
    about: (y) => `Marx, Weber and Durkheim, then caste, kinship and the Indian village. Notes for both papers, ${since(y)}, and an AI that has read the same books you’re reading.`,
  },
  anthropology: {
    name: 'Anthropology', optional: 'anthropology',
    about: (y) => `Fossils and human evolution in one paper, tribal India in the other. Notes for both, ${since(y)}, and an AI that knows its Majumdar from its Hasnain.`,
  },
  polsci: {
    name: 'PSIR', optional: 'political-science',
    about: (y) => `Plato and Rawls, then the Constitution, the UN and India’s neighbours. Notes for both papers, ${since(y)}, and an AI you can argue Rawls with.`,
  },
  geography: {
    name: 'Geography', optional: 'geography',
    about: (y) => `Landforms, climate and the oceans, then India’s farms, cities and regions. Notes for both papers, ${since(y)}, map practice, and an AI that has read Khullar cover to cover.`,
  },
  'pub-admin': {
    name: 'Public Administration', title: 'Pub-Ad', optional: 'public-administration',
    about: (y) => `Weber and Simon in Paper I, the district collector and the CAG in Paper II. Notes for both, ${since(y)}, and an AI that has read everything from Avasthi to the IGNOU blocks.`,
  },
};

export function generateStaticParams() {
  return Object.keys(SUBJECTS).map((optional) => ({ optional }));
}

export async function generateMetadata({ params }: { params: Promise<{ optional: string }> }): Promise<Metadata> {
  const { optional } = await params;
  const s = SUBJECTS[optional];
  if (!s) return { title: 'Not Found' };
  return {
    title: `${s.name} Optional`,
    description: `UPSC ${s.name} optional: notes for every topic, past questions, answer evaluation and an AI that has read the standard books.`,
    alternates: { canonical: `https://distilledcrux.com/${optional}` },
  };
}

/** "Author — Title" as the corpus names a book, split for display. */
function splitBook(value: string): { author: string; title: string } {
  const [author, ...rest] = value.split(' — ');
  return rest.length ? { author, title: rest.join(' — ') } : { author: '', title: value };
}

const Arrow = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
const Glyph = ({ d }: { d: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);

export default async function OptionalPage({ params }: { params: Promise<{ optional: string }> }) {
  const { optional } = await params;
  const subject = SUBJECTS[optional];
  if (!subject) notFound();
  const slug = optional as SubjectKey;

  const notes = notesForSubject(slug);
  const papers: SyllabusPaper[] = ([1, 2] as const).map((paper) => {
    const sections: SyllabusPaper['sections'] = [];
    for (const n of notes.filter((x) => x.paper === paper)) {
      let sec = sections.find((s) => s.name === n.section);
      if (!sec) { sec = { name: n.section, notes: [] }; sections.push(sec); }
      sec.notes.push({ slug: n.slug, title: n.title, topic: n.topic, subtopics: n.subtopics ?? [] });
    }
    return { paper, sections };
  }).filter((p) => p.sections.length);

  const bookGroups = (SUBJECT_BOOKS[slug] ?? [])
    .map((g) => ({ group: g.group, books: g.books.filter((b) => !b.soon).map((b) => splitBook(b.value)) }))
    .filter((g) => g.books.length);
  const bookCount = bookGroups.reduce((n, g) => n + g.books.length, 0);

  const pyqs = await pyqSummaryForOptional(subject.optional);
  const first = notes[0];
  const tint = { ['--t' as string]: `var(--tint-${slug})`, ['--w' as string]: `var(--wash-${slug})` };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: OP_CSS }} />
      <div className="op ds" style={tint}>

        {/* ── Hero ── */}
        <section className="op-hero">
          <div className="ds-container op-hero-grid">
            <div className="op-hero-copy">
              <Link href="/#optionals" className="ds-back">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
                All optionals
              </Link>
              <div className="op-title">
                <span className="op-icon" aria-hidden="true"><SubjectIcon id={slug} size={28} /></span>
                <h1 className="ds-h1">{subject.title ?? subject.name}</h1>
              </div>
              <p className="ds-lede">{subject.about(pyqs?.firstYear ?? null)}</p>
              <ul className="op-facts">
                <li><strong>{notes.length}</strong> topics</li>
                {pyqs && <li><strong>{pyqs.count.toLocaleString('en-IN')}</strong> past questions</li>}
                <li><strong>{bookCount}</strong> standard books</li>
              </ul>
              <div className="op-actions">
                <Link href={`/notes/${slug}`} className="ds-btn ds-btn-solid ds-btn-lg">Read the notes<Arrow /></Link>
                <Link href={`/${slug}/pyqs`} className="ds-btn ds-btn-line ds-btn-lg">Past questions</Link>
              </div>
            </div>

            <div className="op-ask ds-card">
              <span className="op-ask-label">Ask the {subject.name} AI</span>
              <HomeAsk subject={slug} />
              <p className="op-ask-note">Ask it whatever you’re stuck on. It answers from the {bookCount} books further down this page and shows you the passage it used.</p>
            </div>
          </div>
        </section>

        {/* ── Syllabus ── */}
        <section className="op-section">
          <div className="ds-container">
            <div className="op-head">
              <h2 className="ds-h2">The whole syllabus, one topic at a time</h2>
              <p className="ds-lede">Tap any topic to open its notes. They’re free with your account.</p>
            </div>
            <SyllabusTabs subject={slug} papers={papers} />
          </div>
        </section>

        {/* ── Books ── */}
        {bookGroups.length > 0 && (
          <section className="op-section">
            <div className="ds-container">
              <div className="op-head">
                <h2 className="ds-h2">The books behind the answers</h2>
                <p className="ds-lede">These are the books the {subject.name} AI actually reads. When it uses one, you’ll see a small chip next to the line, and you can open the exact passage.</p>
              </div>
              <ul className="op-books">
                {bookGroups.flatMap((g) => g.books.map((b) => (
                  <li key={`${b.author}${b.title}`} className="op-book">
                    <span className="op-book-group">{g.group}</span>
                    <span className="op-book-title">{b.title}</span>
                    <span className="op-book-author">{b.author || 'IGNOU course material'}</span>
                  </li>
                )))}
              </ul>
            </div>
          </section>
        )}

        {/* ── Latest PYQs ── */}
        {pyqs && pyqs.latest.length > 0 && (
          <section className="op-section">
            <div className="ds-container">
              <div className="op-head">
                <h2 className="ds-h2">What UPSC asked in {pyqs.latest[0].year}</h2>
                <p className="ds-lede">Three from the latest paper. All {pyqs.count.toLocaleString('en-IN')} are here, sorted by topic, whenever you want to practise.</p>
              </div>
              <div className="op-pyqs">
                {pyqs.latest.map((q) => (
                  <Link key={q.id} href={`/${slug}/pyqs/${q.id}`} className="op-pyq ds-card ds-card-link">
                    <span className="op-pyq-meta">
                      <strong>{q.year}</strong> · {q.paper}{q.marks ? ` · ${q.marks} marks` : ''}
                    </span>
                    <span className="op-pyq-q">{q.question}</span>
                    <span className="op-pyq-go">Open the question<Arrow /></span>
                  </Link>
                ))}
              </div>
              <div className="op-more"><Link href={`/${slug}/pyqs`} className="ds-btn ds-btn-ghost">See all {pyqs.count.toLocaleString('en-IN')} questions<Arrow /></Link></div>
            </div>
          </section>
        )}

        {/* ── More tools ── */}
        <section className="op-section">
          <div className="ds-container">
            <div className="op-head">
              <h2 className="ds-h2">When you’re ready to write</h2>
            </div>
            <div className="op-tools">
              <Link href="/evaluate" className="op-tool ds-card ds-card-link">
                <span className="op-tool-icon"><Glyph d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></span>
                <span className="op-tool-title">Get an answer marked</span>
                <span className="op-tool-text">Write an answer by hand, take a photo, and see the marks, what it missed and a model answer.</span>
              </Link>
              <Link href={`/test?optional=${subject.optional}`} className="op-tool ds-card ds-card-link">
                <span className="op-tool-icon"><Glyph d="M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></span>
                <span className="op-tool-title">Take a test</span>
                <span className="op-tool-text">A short test on one topic, to see what actually stayed with you.</span>
              </Link>
              {slug === 'geography' && (
                <Link href="/geography/mapping" className="op-tool ds-card ds-card-link">
                  <span className="op-tool-icon"><Glyph d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14" /></span>
                  <span className="op-tool-title">Practise the maps</span>
                  <span className="op-tool-text">Every map question UPSC has set, with a quiz to test yourself.</span>
                </Link>
              )}
            </div>
          </div>
        </section>

        {/* ── Close ── */}
        {first && (
          <section className="op-section op-close">
            <div className="ds-container ds-narrow op-close-inner">
              <Image src="/mascot/owl-reading.svg" alt="" width={104} height={90} className="op-close-owl" />
              <h2 className="ds-h2">Not sure where to begin?</h2>
              <p className="ds-lede">Start at the top, with {first.title}. It sets up the words and ideas the rest of the syllabus keeps coming back to.</p>
              <Link href={`/notes/${slug}/${first.slug}`} className="ds-btn ds-btn-solid ds-btn-lg">Open {first.title}<Arrow /></Link>
            </div>
          </section>
        )}
      </div>
    </>
  );
}

const OP_CSS = `
.op { background: var(--bg); }

/* Hero, in the subject's own colour */
.op-hero {
  padding: clamp(28px, 5vh, 56px) 0 clamp(40px, 7vh, 72px);
  background: linear-gradient(180deg, color-mix(in srgb, var(--w) 75%, var(--bg)) 0%, var(--bg) 100%);
  border-bottom: 1px solid var(--border);
}
.op-hero-grid { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: var(--space-10); align-items: center; }
.op-hero-copy { display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-4); }
.op-title { display: flex; align-items: center; gap: var(--space-4); margin-top: var(--space-2); }
.op-title .ds-h1 { font-size: clamp(2.1rem, 4.2vw, 3.3rem); }
.op-icon { width: 60px; height: 60px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 18px; background: var(--ds-card); color: var(--t); box-shadow: var(--elev-1); border: 1px solid var(--border); }
.op-facts { list-style: none; display: flex; flex-wrap: wrap; gap: var(--space-2) var(--space-5); font-size: 0.95rem; color: var(--text2); }
.op-facts strong { color: var(--t); font-weight: 800; }
.op-actions { display: flex; flex-wrap: wrap; gap: var(--space-3); margin-top: var(--space-2); }
.op-ask { padding: var(--space-6); display: flex; flex-direction: column; gap: var(--space-3); box-shadow: var(--elev-2); }
.op-ask-label { font-weight: 700; font-size: 1.02rem; }
.op-ask .ha { box-shadow: none; }
.op-ask-note { font-size: 0.86rem; color: var(--text3); line-height: 1.55; }

/* Sections */
.op-section { padding: clamp(44px, 8vh, 88px) 0; border-top: 1px solid var(--border); }
.op-hero + .op-section { border-top: none; }
.op-head { display: flex; flex-direction: column; gap: var(--space-2); margin-bottom: var(--space-6); max-width: 720px; }

/* Syllabus */
.sy-tabs {
  display: inline-flex; gap: 4px; padding: 4px; margin-bottom: var(--space-6);
  border-radius: var(--radius-full); background: var(--ds-soft); border: 1px solid var(--border);
}
.sy-tab { display: inline-flex; align-items: baseline; gap: var(--space-2); padding: 9px 18px; border: none; border-radius: var(--radius-full); background: none; color: var(--text2); font-size: 0.95rem; font-weight: 700; cursor: pointer; transition: background 0.18s, color 0.18s, box-shadow 0.18s; }
.sy-tab span { font-size: 0.8rem; font-weight: 500; color: var(--text3); }
.sy-tab.on { background: var(--ds-card); color: var(--text); box-shadow: var(--elev-1); }
.sy-sections { display: flex; flex-direction: column; }
/* A section is a row: its name on the left, its topics in a grid beside it. */
.sy-section { display: grid; grid-template-columns: 230px minmax(0, 1fr); gap: var(--space-6); padding: var(--space-6) 0; border-top: 1px solid var(--border); }
.sy-section:first-child { border-top: none; padding-top: 0; }
.sy-section-head { display: flex; flex-direction: column; gap: 2px; padding-top: var(--space-2); }
.sy-section-name { font-size: 1rem; font-weight: 700; color: var(--text); line-height: 1.35; }
.sy-section-count { font-size: 0.84rem; color: var(--t); font-weight: 600; }
.sy-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-3); }
.sy-topic {
  display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3) var(--space-4);
  background: var(--ds-card); border: 1px solid var(--border); border-radius: var(--radius-lg);
  color: var(--text); text-decoration: none; transition: border-color 0.15s, box-shadow 0.15s;
}
.sy-topic:hover { border-color: color-mix(in srgb, var(--t) 45%, transparent); box-shadow: var(--elev-1); }
.sy-n { width: 28px; height: 28px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: var(--radius-circle); background: var(--w); color: var(--t); font-size: 0.8rem; font-weight: 700; }
.sy-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.sy-title { font-weight: 600; font-size: 0.95rem; line-height: 1.35; }
.sy-subs { font-size: 0.8rem; color: var(--text3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sy-go { color: var(--text3); flex-shrink: 0; transition: color 0.15s, transform 0.15s; }
.sy-topic:hover .sy-go { color: var(--t); transform: translateX(2px); }

/* Books: one even grid, each card naming its group */
.op-books { list-style: none; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-3); }
.op-book {
  position: relative; display: flex; flex-direction: column; gap: 2px; padding: var(--space-4) var(--space-4) var(--space-4) var(--space-6);
  background: var(--ds-card); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden;
}
.op-book::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 6px; background: color-mix(in srgb, var(--t) 75%, transparent); }
.op-book-group { font-size: 0.74rem; font-weight: 600; color: var(--text3); margin-bottom: var(--space-1); }
.op-book-title { font-weight: 700; font-size: 0.96rem; line-height: 1.4; color: var(--text); }
.op-book-author { font-size: 0.86rem; color: var(--text2); }

/* Latest PYQs */
.op-pyqs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-4); }
.op-pyq { display: flex; flex-direction: column; gap: var(--space-2); padding: var(--space-5); }
.op-pyq-meta { font-size: 0.82rem; color: var(--text3); }
.op-pyq-meta strong { color: var(--t); }
.op-pyq-q { flex: 1; font-size: 0.98rem; line-height: 1.55; color: var(--text); display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
.op-pyq-go { display: inline-flex; align-items: center; gap: var(--space-1); font-size: 0.86rem; font-weight: 700; color: var(--accent-text); }
.op-more { display: flex; justify-content: center; margin-top: var(--space-5); }

/* Tools */
.op-tools { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: var(--space-4); }
.op-tool { display: flex; flex-direction: column; gap: var(--space-2); padding: var(--space-5); }
.op-tool-icon { width: 42px; height: 42px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: var(--space-1); border-radius: var(--radius-lg); background: var(--w); color: var(--t); }
.op-tool-title { font-weight: 700; font-size: 1.02rem; }
.op-tool-text { font-size: 0.92rem; line-height: 1.6; color: var(--text2); }

/* Close */
.op-close-inner { display: flex; flex-direction: column; align-items: center; text-align: center; gap: var(--space-3); }
.op-close-owl { width: auto; height: 90px; }

@media (max-width: 960px) {
  .op-hero-grid { grid-template-columns: minmax(0, 1fr); gap: var(--space-6); }
  .sy-section { grid-template-columns: minmax(0, 1fr); gap: var(--space-3); }
  .sy-section-head { flex-direction: row; align-items: baseline; gap: var(--space-2); padding-top: 0; }
  .op-books { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .op-pyqs { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 640px) {
  .op-title { gap: var(--space-3); }
  .op-icon { width: 50px; height: 50px; border-radius: 14px; }
  .op-actions { width: 100%; flex-direction: column; }
  .op-actions .ds-btn { width: 100%; }
  .op-ask { padding: var(--space-4); }
  .sy-tabs { display: flex; }
  .sy-tab { flex: 1; justify-content: center; padding: 9px 10px; }
  .sy-list { grid-template-columns: minmax(0, 1fr); gap: var(--space-2); }
  .sy-topic { padding: var(--space-3); }
  .op-books { grid-template-columns: minmax(0, 1fr); }
  .op-pyq { padding: var(--space-4); }
  .op-close-inner .ds-btn { width: 100%; white-space: normal; text-align: center; line-height: 1.3; padding-top: 12px; padding-bottom: 12px; }
}
`;
