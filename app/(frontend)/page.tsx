import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import Script from 'next/script';
import SubjectIcon from '@/components/SubjectIcon';
import HomeAsk from '@/components/home/HomeAsk';
import { HeroActions } from '@/components/home/HomeLinks';
import HomeShowcase from '@/components/home/HomeShowcase';
import { PLANS, PLAN_ORDER, formatRupees } from '@/lib/plans';
import { notesForSubject } from '@/lib/notes';
import { pyqCountForOptional } from '@/lib/pyqCounts';
import { SUBJECT_BOOKS } from '@/lib/subjectConfig';

export const metadata: Metadata = {
  title: 'Distilled Crux UPSC Optional Preparation',
  description:
    'Notes, every past question, answer evaluation and an AI tutor that reads the standard books, for UPSC Mains Sociology, Anthropology, PSIR, Geography and Public Administration.',
  alternates: { canonical: 'https://distilledcrux.com' },
};

type Optional = { id: string; optional: string; name: string; sub: string };

const OPTIONALS: Optional[] = [
  { id: 'sociology', optional: 'sociology', name: 'Sociology', sub: 'Marx to Srinivas, and Indian society' },
  { id: 'anthropology', optional: 'anthropology', name: 'Anthropology', sub: 'From fossils to tribal India' },
  { id: 'polsci', optional: 'political-science', name: 'PSIR', sub: 'Plato to India’s foreign policy' },
  { id: 'geography', optional: 'geography', name: 'Geography', sub: 'Plate tectonics to India’s regions' },
  { id: 'pub-admin', optional: 'public-administration', name: 'Public Administration', sub: 'Weber to the district collector' },
];

const PLAN_NOTE: Record<string, string> = {
  daily: 'For the last few days before the exam.',
  sixmonth: 'For the months leading up to Mains.',
  yearly: 'For the whole cycle, from Prelims to the interview.',
};

const STEPS = [
  { title: 'Read a topic in the evening', text: 'Open the notes for whatever you are on today. Ask the AI about the bits that don’t click.' },
  { title: 'Look at what UPSC has asked on it', text: 'The past questions on that topic show you which way the examiners tend to come at it.' },
  { title: 'Write one answer and get it marked', text: 'Take a photo of it, upload it, and see where the marks went and where they didn’t.' },
];

const Arrow = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);

export default async function Home() {
  // Counted from the data at build time, so the numbers stay true as
  // questions and notes are added.
  const counts = await Promise.all(OPTIONALS.map(async (o) => ({
    id: o.id,
    topics: notesForSubject(o.id).length,
    pyqs: (await pyqCountForOptional(o.optional)) ?? 0,
  })));
  const byId = Object.fromEntries(counts.map((c) => [c.id, c]));
  const totalPyqs = counts.reduce((n, c) => n + c.pyqs, 0);
  const totalTopics = counts.reduce((n, c) => n + c.topics, 0);
  const totalBooks = Object.values(SUBJECT_BOOKS).flat().flatMap((g) => g.books).filter((b) => !b.soon).length;
  const round = (n: number) => `${(Math.floor(n / 100) * 100).toLocaleString('en-IN')}+`;

  return (
    <>
      <Script id="schema-org" type="application/ld+json">
        {JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: 'Distilled Crux UPSC Optional Preparation',
          url: 'https://distilledcrux.com',
          description: 'Notes, PYQs, answer evaluation and an AI tutor for UPSC optionals',
        })}
      </Script>
      <style dangerouslySetInnerHTML={{ __html: HOME_CSS }} />

      <div className="hm ds">
        {/* ── Hero ── */}
        <section className="hm-hero">
          <div className="ds-container ds-narrow hm-hero-inner">
            <Image src="/mascot/owl.svg" alt="" width={112} height={106} priority className="hm-owl" />
            <h1 className="ds-h1">
              Your optional, <em className="hm-mark">distilled.<svg viewBox="0 0 220 16" preserveAspectRatio="none" aria-hidden="true"><path d="M3 11c34-6 70-8 108-5 30 2 63 3 106-3" /></svg></em>
            </h1>
            <p className="ds-lede hm-lede">
              Notes for every topic, every past question, and an AI that has read your standard books and shows
              you the page it is quoting. For Sociology, Anthropology, PSIR, Geography and Public Administration.
            </p>
            <HomeAsk />
            <HeroActions />
          </div>
          <div className="ds-container hm-cards">
            <HomeShowcase />
          </div>
          <p className="hm-proof ds-container">
            Right now there are <b>{round(totalPyqs)} past questions</b>, <b>{totalTopics} topics</b> and <b>{totalBooks} standard books</b> in here.
          </p>
        </section>

        {/* ── Optionals ── */}
        <section id="optionals" className="hm-section">
          <div className="ds-container">
            <div className="hm-head">
              <h2 className="ds-h2">Which optional is yours?</h2>
              <p className="ds-lede">Everything after this is about that one subject: its notes, its past questions, its books.</p>
            </div>
            <div className="hm-opts">
              {OPTIONALS.map((o) => {
                const c = byId[o.id];
                return (
                  <Link key={o.id} href={`/${o.id}`} className="hm-opt ds-card ds-card-link" style={{ ['--t' as string]: `var(--tint-${o.id})`, ['--w' as string]: `var(--wash-${o.id})` }}>
                    <span className="hm-opt-icon" aria-hidden="true"><SubjectIcon id={o.id} size={22} /></span>
                    <span className="hm-opt-body">
                      <span className="hm-opt-name">{o.name}</span>
                      <span className="hm-opt-sub">{o.sub}</span>
                      <span className="hm-opt-meta">{c.topics} topics · {c.pyqs.toLocaleString('en-IN')} PYQs</span>
                    </span>
                    <span className="hm-opt-go" aria-hidden="true"><Arrow /></span>
                  </Link>
                );
              })}
              <a href="https://historyoptional.xyz" target="_blank" rel="noopener noreferrer" className="hm-opt ds-card ds-card-link" style={{ ['--t' as string]: 'var(--tint-history)', ['--w' as string]: 'var(--wash-history)' }}>
                <span className="hm-opt-icon" aria-hidden="true"><SubjectIcon id="history" size={22} /></span>
                <span className="hm-opt-body">
                  <span className="hm-opt-name">History</span>
                  <span className="hm-opt-sub">Harappa to the Cold War, on its own site</span>
                  <span className="hm-opt-meta">historyoptional.xyz ↗</span>
                </span>
                <span className="hm-opt-go" aria-hidden="true"><Arrow /></span>
              </a>
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section className="hm-section">
          <div className="ds-container">
            <div className="hm-head">
              <h2 className="ds-h2">A good way to use it</h2>
            </div>
            <ol className="hm-steps">
              {STEPS.map((s, i) => (
                <li key={s.title} className="hm-step">
                  <span className="hm-step-n">{i + 1}</span>
                  <span className="ds-h3">{s.title}</span>
                  <span className="hm-step-text">{s.text}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Pricing ── */}
        <section className="hm-section">
          <div className="ds-container">
            <div className="hm-head">
              <h2 className="ds-h2">One payment, and nothing renews behind your back</h2>
              <p className="ds-lede">Notes and past questions are free with an account. A plan gets you unlimited AI chat and answer evaluation for your optional.</p>
            </div>
            <div className="hm-plans">
              {PLAN_ORDER.map((id) => {
                const p = PLANS[id];
                return (
                  <Link key={id} href="/pricing" className={`hm-plan ds-card ds-card-link${id === 'yearly' ? ' featured' : ''}`}>
                    {id === 'yearly' && <span className="ds-tag">Most chosen</span>}
                    <span className="hm-plan-name">{p.label}</span>
                    <span className="hm-plan-price">{formatRupees(p)}</span>
                    <span className="hm-plan-period">{p.period}</span>
                    <span className="hm-plan-text">{PLAN_NOTE[id]}</span>
                  </Link>
                );
              })}
            </div>
            <div className="hm-plans-more"><Link href="/pricing" className="ds-btn ds-btn-ghost">See what each plan includes<Arrow /></Link></div>
          </div>
        </section>

        {/* ── Close ── */}
        <section className="hm-section hm-close">
          <div className="ds-container ds-narrow hm-close-inner">
            <Image src="/mascot/owl-reading.svg" alt="" width={110} height={95} className="hm-close-owl" />
            <h2 className="ds-h2">Start with tonight’s topic</h2>
            <p className="ds-lede">Open the notes for whatever you are reading today and see if it helps. It is free, and there is no card to enter.</p>
            <HeroActions />
          </div>
        </section>
      </div>
    </>
  );
}

const HOME_CSS = `
.hm { background: var(--bg); }
.hm em { font-style: normal; color: var(--accent-text); }
/* A marker stroke under the word, drawn by hand rather than set as a line. */
.hm-mark { position: relative; display: inline-block; white-space: nowrap; }
.hm-mark svg { position: absolute; left: 0; right: 0; bottom: -0.12em; width: 100%; height: 0.3em; overflow: visible; }
.hm-mark path { fill: none; stroke: color-mix(in srgb, var(--accent) 45%, transparent); stroke-width: 6; stroke-linecap: round; }

/* Hero */
.hm-hero { padding: clamp(36px, 7vh, 80px) 0 clamp(48px, 8vh, 80px); }
.hm-hero-inner { display: flex; flex-direction: column; align-items: center; text-align: center; gap: var(--space-4); }
.hm-owl { width: auto; height: clamp(80px, 11vh, 106px); }
.hm-lede { max-width: 620px; margin: 0 auto var(--space-2); }
.hm-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: var(--space-2) var(--space-4); margin-top: var(--space-1); }
.hm-proof {
  display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: var(--space-2) var(--space-3);
  margin-top: var(--space-8); font-size: 0.98rem; color: var(--text2); text-align: center;
}
.hm-proof { display: block; max-width: 760px; line-height: 1.7; }
.hm-proof b { color: var(--text); font-weight: 700; }

.hm-cards { margin-top: clamp(32px, 6vh, 56px); }
/* As wide as the navbar, a little wider than the page text. */
.hm-cards.ds-container { max-width: 1248px; }

/* Sections */
.hm-section { padding: clamp(48px, 9vh, 96px) 0; border-top: 1px solid var(--border); }
.hm-head { display: flex; flex-direction: column; gap: var(--space-2); margin-bottom: var(--space-8); max-width: 680px; }

/* Optionals */
.hm-opts { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-4); }
.hm-opt { display: flex; align-items: flex-start; gap: var(--space-4); padding: var(--space-5); }
.hm-opt-icon {
  width: 46px; height: 46px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center;
  border-radius: var(--radius-lg); background: var(--w); color: var(--t);
}
.hm-opt-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.hm-opt-name { font-weight: 700; font-size: 1.06rem; color: var(--text); }
.hm-opt-sub { font-size: 0.88rem; color: var(--text2); line-height: 1.5; }
.hm-opt-meta { font-family: var(--font-ui); font-size: 0.78rem; color: var(--t); font-weight: 600; margin-top: var(--space-2); }
.hm-opt-go { color: var(--text3); transition: color 0.15s, transform 0.15s; padding-top: 2px; }
.hm-opt:hover .hm-opt-go { color: var(--t); transform: translateX(2px); }

/* Steps */
.hm-steps { list-style: none; display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-4); counter-reset: none; }
.hm-step { display: flex; flex-direction: column; gap: var(--space-2); padding: var(--space-5); border-left: 2px solid var(--border); }
.hm-step-n {
  width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: var(--space-1);
  border-radius: var(--radius-circle); background: var(--accent); color: var(--accent-on); font-family: var(--font-ui); font-weight: 700; font-size: 0.9rem;
}
.hm-step-text { font-size: 0.92rem; line-height: 1.6; color: var(--text2); }

/* Plans */
.hm-plans { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-4); }
.hm-plan { position: relative; display: flex; flex-direction: column; gap: 2px; padding: var(--space-6) var(--space-5); }
.hm-plan.featured { border-color: color-mix(in srgb, var(--accent) 50%, transparent); box-shadow: 0 0 0 3px var(--accent-dim); }
.hm-plan .ds-tag { position: absolute; top: var(--space-4); right: var(--space-4); }
.hm-plan-name { font-family: var(--font-ui); font-size: 0.82rem; font-weight: 600; color: var(--text3); }
.hm-plan-price { font-weight: 700; font-size: 2rem; letter-spacing: -0.02em; color: var(--text); margin-top: var(--space-1); }
.hm-plan-period { font-family: var(--font-ui); font-size: 0.8rem; color: var(--text3); }
.hm-plan-text { font-size: 0.9rem; color: var(--text2); margin-top: var(--space-3); }
.hm-plans-more { display: flex; justify-content: center; margin-top: var(--space-5); }

/* Close */
.hm-close-inner { display: flex; flex-direction: column; align-items: center; text-align: center; gap: var(--space-3); }
.hm-close-owl { width: auto; height: 95px; }

/* Tablet */
@media (max-width: 960px) {
  .hm-opts { grid-template-columns: repeat(2, 1fr); }
  .hm-steps, .hm-plans { grid-template-columns: 1fr; }
  .hm-step { border-left: none; border-top: 2px solid var(--border); padding: var(--space-4) 0; flex-direction: row; flex-wrap: wrap; align-items: center; column-gap: var(--space-3); }
  .hm-step-text { flex-basis: 100%; }
  .hm-plans { max-width: 520px; margin: 0 auto; }
}

/* Phone */
@media (max-width: 640px) {
  .hm-hero { padding-top: var(--space-6); }
  .hm-hero-inner { gap: var(--space-3); }
  .hm-owl { height: 76px; }
  .hm-actions { width: 100%; flex-direction: column; }
  .hm-actions .ds-btn-solid { width: 100%; }
  .hm-proof { margin-top: var(--space-6); font-size: 0.9rem; }
  .hm-head { margin-bottom: var(--space-5); }
  .hm-opts { grid-template-columns: 1fr; gap: var(--space-3); }
  .hm-opt { padding: var(--space-4); }
  /* A plan is one compact row on a phone: name and price, then its line. */
  .hm-plan { flex-direction: row; flex-wrap: wrap; align-items: baseline; column-gap: var(--space-2); padding: var(--space-4); }
  .hm-plan-name { flex-basis: 100%; }
  .hm-plan-price { font-size: 1.6rem; margin-top: 0; }
  .hm-plan-text { flex-basis: 100%; margin-top: var(--space-1); }
  .hm-plan .ds-tag { top: var(--space-3); right: var(--space-3); }
}
`;
