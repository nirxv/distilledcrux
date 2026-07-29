import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';

export const metadata: Metadata = {
  title: 'UPSC Prelims Preparation | Distilled Crux',
  description:
    'Topic-wise MCQ practice, previous year papers with AI explanations, daily quizzes and performance analytics — built for UPSC Prelims.',
  alternates: { canonical: 'https://distilledcrux.com/prelims' },
};

const subjects = [
  { id: 'history',       name: 'History & Culture',   sub: 'Ancient, Medieval, Modern & Art',             color: '#e8b86d', dim: 'rgba(232,184,109,0.07)',  border: 'rgba(232,184,109,0.18)',  icon: '🏛️', href: '/prelims/history' },
  { id: 'polity',        name: 'Polity & Governance',  sub: 'Constitution, Institutions & Policies',       color: '#4361ee', dim: 'rgba(67,97,238,0.07)',    border: 'rgba(67,97,238,0.18)',    icon: '⚖️', href: '/prelims/polity' },
  { id: 'geography',     name: 'Geography',            sub: 'Physical, Human, Economic & Maps',            color: '#4ade80', dim: 'rgba(74,222,128,0.07)',   border: 'rgba(74,222,128,0.18)',   icon: '🌍', href: '/prelims/geography' },
  { id: 'economy',       name: 'Economy',              sub: 'Concepts, Budgets, Schemes & Data',           color: '#2dd4bf', dim: 'rgba(45,212,191,0.07)',   border: 'rgba(45,212,191,0.18)',   icon: '📊', href: '/prelims/economy' },
  { id: 'environment',   name: 'Environment & Ecology',sub: 'Biodiversity, Climate & Current Affairs',      color: '#86efac', dim: 'rgba(134,239,172,0.07)', border: 'rgba(134,239,172,0.18)', icon: '🌿', href: '/prelims/environment' },
  { id: 'science',       name: 'Science & Technology', sub: 'Physics, Chemistry, Biology & Space',         color: '#f87171', dim: 'rgba(248,113,113,0.07)', border: 'rgba(248,113,113,0.18)', icon: '🔬', href: '/prelims/science' },
  { id: 'current',       name: 'Current Affairs',      sub: 'Monthly digests, Schemes & Reports',          color: '#c084fc', dim: 'rgba(192,132,252,0.07)', border: 'rgba(192,132,252,0.18)', icon: '📰', href: '/prelims/current' },
  { id: 'csat',          name: 'CSAT — Paper II',      sub: 'Reading, Reasoning & Basic Numeracy',         color: '#fb923c', dim: 'rgba(251,146,60,0.07)',  border: 'rgba(251,146,60,0.18)',  icon: '🧮', href: '/prelims/csat' },
];

const features = [
  { num: '01', label: 'Topic-wise MCQ Bank',       desc: '10,000+ MCQs organised by syllabus topic. Filter by year, difficulty, and source. Timed or practice mode.' },
  { num: '02', label: 'PYP with AI Explanations',  desc: '25 years of previous year papers — each question explained by AI with the exact concept, trap, and correct reasoning.' },
  { num: '03', label: 'Daily Quiz — 10 Questions',  desc: 'Ten curated questions every morning, mixed from weak areas and current affairs. Builds the habit that actually works.' },
  { num: '04', label: 'Weakness Radar',             desc: 'After every session, the platform maps your accuracy by subject and topic. Study what matters, skip what you already know.' },
  { num: '05', label: 'CSAT Practice Sets',         desc: 'Full-length CSAT sets with reading comprehension, reasoning, and arithmetic — timed to mirror exam conditions.' },
  { num: '06', label: 'Current Affairs Digest',     desc: 'Monthly digests linking every current affairs story to its Prelims syllabus topic. Mapped, not dumped.' },
];

const stats = [
  { val: '10,000+', label: 'MCQs' },
  { val: '25 yrs',  label: 'PYPs covered' },
  { val: '8',       label: 'Subjects' },
];

const marqueeItems = [
  'History & Culture', 'Polity', 'Geography', 'Economy', 'Environment',
  'Science & Tech', 'Current Affairs', 'CSAT', 'Daily Quiz', 'PYP Analysis',
];

const CSS = `
  .pr { position: relative; min-height: 100vh; }

  /* ── Hero ── */
  .pr-hero {
    max-width: 1200px; margin: 0 auto;
    padding: 140px 2rem 80px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4rem;
    align-items: end;
    border-bottom: 1px solid var(--border);
  }
  .pr-hero-kicker {
    font-family: var(--font-ui);
    font-size: 0.68rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--text3);
    margin-bottom: 1.5rem;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .pr-hero-kicker::before {
    content: '';
    display: inline-block;
    width: 28px; height: 1px;
    background: var(--text3);
  }
  .pr-hero-h1 {
    font-family: var(--font-body);
    font-size: clamp(3rem, 6.5vw, 5.2rem);
    font-weight: 700;
    line-height: 1.02;
    letter-spacing: -0.035em;
    color: var(--text);
    margin-bottom: 2rem;
  }
  .pr-hero-h1 em { font-style: italic; color: var(--gold); }
  .pr-hero-desc {
    font-family: var(--font-ui);
    font-size: 1rem;
    color: var(--text2);
    line-height: 1.8;
    margin-bottom: 2.5rem;
    max-width: 380px;
  }
  .pr-hero-actions { display: flex; align-items: center; gap: 1.25rem; flex-wrap: wrap; }
  .pr-btn-primary {
    font-family: var(--font-ui);
    font-size: 0.88rem; font-weight: 600;
    background: var(--text); color: var(--bg);
    padding: 12px 28px; border-radius: 6px;
    text-decoration: none; letter-spacing: 0.01em;
    transition: opacity 0.15s;
  }
  .pr-btn-primary:hover { opacity: 0.85; }
  .pr-btn-ghost {
    font-family: var(--font-ui);
    font-size: 0.88rem; color: var(--text3);
    text-decoration: none;
    display: flex; align-items: center; gap: 6px;
    transition: color 0.15s;
  }
  .pr-btn-ghost:hover { color: var(--text); }
  .pr-hero-stat-row {
    display: flex; gap: 2.5rem;
    margin-top: 3.5rem; padding-top: 2rem;
    border-top: 1px solid var(--border);
  }
  .pr-hero-stat-val {
    font-family: var(--font-body);
    font-size: 1.75rem; font-weight: 700;
    color: var(--text); letter-spacing: -0.03em;
    line-height: 1; margin-bottom: 4px;
  }
  .pr-hero-stat-label {
    font-family: var(--font-ui);
    font-size: 0.72rem; color: var(--text3);
    letter-spacing: 0.04em; text-transform: uppercase;
  }

  /* Marquee — identical to main LP */
  .pr-marquee-wrap {
    overflow: hidden; border-bottom: 1px solid var(--border);
    padding: 10px 0; background: var(--bg2);
    mask-image: linear-gradient(90deg, transparent, black 8%, black 92%, transparent);
    -webkit-mask-image: linear-gradient(90deg, transparent, black 8%, black 92%, transparent);
  }
  .pr-marquee-track { display: flex; width: max-content; animation: marquee 36s linear infinite; }
  .pr-marquee-track:hover { animation-play-state: paused; }
  .pr-marquee-item { display: flex; align-items: center; gap: 0.6rem; padding: 0 2.5rem; flex-shrink: 0; }
  .pr-marquee-sep { font-family: var(--font-body); font-size: 0.65rem; color: var(--border3); }
  .pr-marquee-text { font-family: var(--font-ui); font-size: 0.78rem; color: var(--text3); letter-spacing: 0.03em; }

  /* ── Shared section wrapper ── */
  .pr-section {
    max-width: 1200px; margin: 0 auto;
    padding: 5rem 2rem;
    border-bottom: 1px solid var(--border);
  }
  .pr-section-header {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 2rem; align-items: start; margin-bottom: 3.5rem;
  }
  .pr-section-label {
    font-family: var(--font-ui);
    font-size: 0.65rem; letter-spacing: 0.18em;
    text-transform: uppercase; color: var(--text3);
    margin-bottom: 1rem;
    display: flex; align-items: center; gap: 10px;
  }
  .pr-section-label::before {
    content: ''; display: inline-block;
    width: 20px; height: 1px; background: var(--text3);
  }
  .pr-section-h2 {
    font-family: var(--font-body);
    font-size: clamp(1.8rem, 3vw, 2.6rem);
    font-weight: 700; letter-spacing: -0.03em;
    color: var(--text); line-height: 1.1;
  }
  .pr-section-h2 em { font-style: italic; color: var(--gold); }
  .pr-section-desc {
    font-family: var(--font-ui); font-size: 0.92rem;
    color: var(--text2); line-height: 1.8; padding-top: 0.5rem;
  }

  /* ── Subject grid ── */
  .pr-subj-grid {
    display: grid; grid-template-columns: repeat(4, 1fr);
    gap: 1px; background: var(--border);
    border: 1px solid var(--border); border-radius: 12px; overflow: hidden;
  }
  .pr-subj-card {
    background: var(--bg); padding: 1.75rem;
    text-decoration: none; display: flex; flex-direction: column;
    transition: background 0.18s; cursor: pointer;
  }
  .pr-subj-card:hover { background: var(--bg2); }
  .pr-subj-icon { font-size: 1.4rem; margin-bottom: 1.25rem; display: block; }
  .pr-subj-name {
    font-family: var(--font-body); font-size: 0.9rem;
    font-weight: 700; margin-bottom: 0.3rem; letter-spacing: -0.01em;
  }
  .pr-subj-sub {
    font-family: var(--font-ui); font-size: 0.73rem;
    color: var(--text3); line-height: 1.5;
  }

  /* ── Feature list — identical structure to lp-tools-list ── */
  .pr-feat-list {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 1px; background: var(--border);
    border: 1px solid var(--border); border-radius: 12px; overflow: hidden;
  }
  .pr-feat-item {
    background: var(--bg); padding: 1.75rem 2rem;
    display: flex; align-items: flex-start; gap: 1.5rem; transition: background 0.18s;
  }
  .pr-feat-item:hover { background: var(--bg2); }
  .pr-feat-num {
    font-family: var(--font-mono); font-size: 0.65rem;
    color: var(--text3); letter-spacing: 0.06em;
    padding-top: 4px; flex-shrink: 0; width: 24px;
  }
  .pr-feat-label {
    font-family: var(--font-body); font-size: 0.95rem;
    font-weight: 700; color: var(--text); margin-bottom: 0.35rem; letter-spacing: -0.01em;
  }
  .pr-feat-desc { font-family: var(--font-ui); font-size: 0.8rem; color: var(--text3); line-height: 1.65; }

  /* ── Score band / CSAT callout ── */
  .pr-callout {
    display: flex; align-items: flex-start; gap: 1.5rem;
    padding: 1.75rem 2rem;
    background: var(--bg2);
    border: 1px solid var(--border2);
    border-radius: 12px;
    margin-top: 1.5rem;
  }
  .pr-callout-icon {
    font-size: 1.6rem; flex-shrink: 0; padding-top: 2px;
  }
  .pr-callout-title {
    font-family: var(--font-body); font-size: 1rem;
    font-weight: 700; color: var(--text); margin-bottom: 0.35rem;
  }
  .pr-callout-body {
    font-family: var(--font-ui); font-size: 0.82rem;
    color: var(--text2); line-height: 1.7;
  }

  /* ── Cutoff table ── */
  .pr-table-wrap {
    border: 1px solid var(--border); border-radius: 12px; overflow: hidden;
    margin-top: 0;
  }
  .pr-table {
    width: 100%; border-collapse: collapse;
    font-family: var(--font-ui); font-size: 0.82rem;
  }
  .pr-table th {
    background: var(--bg2); color: var(--text3);
    text-align: left; padding: 0.85rem 1.5rem;
    font-size: 0.65rem; font-weight: 600;
    letter-spacing: 0.1em; text-transform: uppercase;
    border-bottom: 1px solid var(--border);
  }
  .pr-table td {
    padding: 0.9rem 1.5rem; color: var(--text2);
    border-bottom: 1px solid var(--border);
    vertical-align: middle;
  }
  .pr-table tr:last-child td { border-bottom: none; }
  .pr-table tr:hover td { background: var(--bg2); }
  .pr-table .cat-label {
    font-family: var(--font-body); color: var(--text);
    font-weight: 700; font-size: 0.88rem;
  }
  .pr-table .score {
    font-family: var(--font-mono); color: var(--gold);
    font-size: 0.85rem;
  }

  /* ── CTA ── */
  .pr-cta {
    max-width: 1200px; margin: 0 auto; padding: 5rem 2rem 6rem;
    display: grid; grid-template-columns: 1fr auto;
    align-items: center; gap: 3rem;
  }
  .pr-cta-h2 {
    font-family: var(--font-body);
    font-size: clamp(2rem, 4vw, 3.2rem);
    font-weight: 700; letter-spacing: -0.03em; color: var(--text); line-height: 1.1;
  }
  .pr-cta-h2 em { font-style: italic; color: var(--gold); }
  .pr-cta-sub { font-family: var(--font-ui); font-size: 0.88rem; color: var(--text3); margin-top: 0.75rem; }
  .pr-cta-right { display: flex; flex-direction: column; gap: 0.75rem; align-items: flex-start; flex-shrink: 0; }

  /* ── Daily quiz strip ── */
  .pr-quiz-strip {
    display: flex; align-items: center; justify-content: space-between; gap: 1.5rem;
    padding: 1.1rem 1.75rem; margin-top: 1px;
    background: var(--bg); border: 1px solid var(--border); border-radius: 12px;
    text-decoration: none; transition: background 0.18s;
  }
  .pr-quiz-strip:hover { background: var(--bg2); }

  /* ── Mains crosslink ── */
  .pr-crosslink {
    display: flex; align-items: center; justify-content: space-between;
    padding: 1.25rem 1.75rem;
    background: var(--bg); border: 1px solid var(--border);
    border-radius: 12px; text-decoration: none; transition: background 0.18s; gap: 1.5rem;
    max-width: 1200px; margin: 0 auto;
    margin-top: -1px;
  }
  .pr-crosslink:hover { background: var(--bg2); }
  .pr-crosslink-left { display: flex; align-items: center; gap: 1rem; }
  .pr-crosslink-name {
    font-family: var(--font-body); font-size: 1rem;
    font-weight: 700; color: var(--accent); margin-bottom: 2px;
  }
  .pr-crosslink-sub { font-family: var(--font-ui); font-size: 0.75rem; color: var(--text3); }
  .pr-crosslink-arrow {
    font-family: var(--font-ui); font-size: 0.78rem; font-weight: 600;
    color: var(--accent); display: flex; align-items: center; gap: 6px; white-space: nowrap; flex-shrink: 0;
  }

  /* ── Footer ── */
  .pr-footer {
    border-top: 1px solid var(--border); max-width: 1200px; margin: 0 auto;
    padding: 1.75rem 2rem; display: flex; justify-content: space-between;
    align-items: center; flex-wrap: wrap; gap: 1rem;
  }
  .pr-footer-logo { font-family: var(--font-body); font-size: 0.95rem; font-weight: 700; color: var(--text); }
  .pr-footer-logo em { font-style: normal; color: var(--accent); }
  .pr-footer-links { display: flex; gap: 1.75rem; flex-wrap: wrap; }
  .pr-footer-link { font-family: var(--font-ui); font-size: 0.78rem; color: var(--text3); text-decoration: none; transition: color 0.15s; }
  .pr-footer-link:hover { color: var(--text); }
  .pr-footer-copy { font-family: var(--font-ui); font-size: 0.72rem; color: var(--text3); }

  /* ── Responsive ── */
  @media (max-width: 900px) {
    .pr-hero { grid-template-columns: 1fr; gap: 2.5rem; padding-top: 120px; }
    .pr-hero-desc { max-width: 100%; }
    .pr-section-header { grid-template-columns: 1fr; }
    .pr-subj-grid { grid-template-columns: repeat(2, 1fr); }
    .pr-feat-list { grid-template-columns: 1fr; }
    .pr-cta { grid-template-columns: 1fr; }
    .pr-cta-right { flex-direction: row; flex-wrap: wrap; }
  }
  @media (max-width: 580px) {
    .pr-subj-grid { grid-template-columns: 1fr 1fr; }
    .pr-hero-stat-row { gap: 1.5rem; }
    .pr-footer { flex-direction: column; text-align: center; }
    .pr-footer-links { justify-content: center; }
  }
  @media (max-width: 380px) {
    .pr-subj-grid { grid-template-columns: 1fr; }
  }
`;

const cutoffRows = [
  { cat: 'General',  gs: '98.66',  csat: '51.34' },
  { cat: 'OBC',      gs: '96.00',  csat: '51.34' },
  { cat: 'SC',       gs: '84.00',  csat: '51.34' },
  { cat: 'ST',       gs: '78.66',  csat: '51.34' },
  { cat: 'EWS',      gs: '95.34',  csat: '51.34' },
];

export default function PrelimsPage() {
  return (
    <>
      <Script id="schema-prelims" type="application/ld+json">
        {JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: 'UPSC Prelims Preparation | Distilled Crux',
          url: 'https://distilledcrux.com/prelims',
          description: 'Topic-wise MCQs, PYPs with AI explanations, daily quiz and weakness radar for UPSC Prelims.',
        })}
      </Script>

      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="pr">

        {/* ── Hero ── */}
        <div className="pr-hero">
          <div>
            <div className="pr-hero-kicker">UPSC Prelims · GS Paper I & CSAT</div>
            <h1 className="pr-hero-h1">
              Clear the cut.<br />
              <em>Every time.</em>
            </h1>
          </div>
          <div>
            <p className="pr-hero-desc">
              10,000+ topic-wise MCQs, 25 years of PYPs explained by AI, a daily quiz habit, and a
              weakness radar that tells you exactly what to fix — built for aspirants who are serious about Prelims.
            </p>
            <div className="pr-hero-actions">
              <Link href="/login" className="pr-btn-primary">Start free →</Link>
              <Link href="#subjects" className="pr-btn-ghost">
                Browse subjects
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 2l5 5-5 5M2 7h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Link>
            </div>
            <div className="pr-hero-stat-row">
              {stats.map(s => (
                <div key={s.label}>
                  <div className="pr-hero-stat-val">{s.val}</div>
                  <div className="pr-hero-stat-label">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Marquee ── */}
        <div className="pr-marquee-wrap">
          <div className="pr-marquee-track">
            {[...marqueeItems, ...marqueeItems].map((item, i) => (
              <span key={i} className="pr-marquee-item">
                <span className="pr-marquee-sep">·</span>
                <span className="pr-marquee-text">{item}</span>
              </span>
            ))}
          </div>
        </div>

        {/* ── Subjects ── */}
        <section id="subjects" className="pr-section">
          <div className="pr-section-header">
            <div>
              <div className="pr-section-label">Syllabus coverage</div>
              <h2 className="pr-section-h2">Eight subjects.<br /><em>One platform.</em></h2>
            </div>
            <p className="pr-section-desc">
              Every Prelims topic — GS Paper I and CSAT — covered with MCQs, notes and
              year-wise question breakdowns. No jumping between resources.
            </p>
          </div>
          <div className="pr-subj-grid">
            {subjects.map((s) => (
              <Link key={s.id} href={s.href} className="pr-subj-card" style={{ textDecoration: 'none' }}>
                <span className="pr-subj-icon">{s.icon}</span>
                <div className="pr-subj-name" style={{ color: s.color }}>{s.name}</div>
                <div className="pr-subj-sub">{s.sub}</div>
              </Link>
            ))}
          </div>

          {/* Daily quiz strip */}
          <Link href="/prelims/quiz" className="pr-quiz-strip">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ fontSize: '1.4rem' }}>⚡</span>
              <div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>Daily Quiz — 10 Questions</div>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '0.75rem', color: 'var(--text3)' }}>Mixed subjects · 60 seconds per question · Explanations included</div>
              </div>
            </div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '0.78rem', fontWeight: 600, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              Take Quiz
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M2 6.5h9M6.5 2l4.5 4.5-4.5 4.5" stroke="var(--accent)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </Link>
        </section>

        {/* ── Features ── */}
        <section id="features" className="pr-section">
          <div className="pr-section-header">
            <div>
              <div className="pr-section-label">What&apos;s inside</div>
              <h2 className="pr-section-h2">Prep that&apos;s precise.<br /><em>Not just vast.</em></h2>
            </div>
            <p className="pr-section-desc">
              Every feature is built around one metric — your Prelims score. No content dumping,
              no passive reading. Active recall, evaluation, and iteration.
            </p>
          </div>
          <div className="pr-feat-list">
            {features.map((f) => (
              <div key={f.label} className="pr-feat-item">
                <span className="pr-feat-num">{f.num}</span>
                <div>
                  <div className="pr-feat-label">{f.label}</div>
                  <div className="pr-feat-desc">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* CSAT callout */}
          <div className="pr-callout">
            <span className="pr-callout-icon">🧮</span>
            <div>
              <div className="pr-callout-title">Don&apos;t treat CSAT as an afterthought</div>
              <div className="pr-callout-body">
                CSAT is qualifying but it has failed thousands of aspirants who assumed they&apos;d clear it easily.
                Distilled Crux includes a dedicated CSAT module — full-length sets, reading comprehension strategies,
                and timed drills — so Paper II is never a surprise.
              </div>
            </div>
          </div>
        </section>

        {/* ── Cutoff reference ── */}
        <section className="pr-section">
          <div className="pr-section-header">
            <div>
              <div className="pr-section-label">Know your target</div>
              <h2 className="pr-section-h2">2024 cutoffs.<br /><em>Set your benchmark.</em></h2>
            </div>
            <p className="pr-section-desc">
              Cutoffs shift every year but the gap between your current mock score
              and the cutoff is the only number that matters. Track it.
            </p>
          </div>
          <div className="pr-table-wrap">
            <table className="pr-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>GS Paper I (out of 200)</th>
                  <th>CSAT qualifying (out of 200)</th>
                </tr>
              </thead>
              <tbody>
                {cutoffRows.map(row => (
                  <tr key={row.cat}>
                    <td className="cat-label">{row.cat}</td>
                    <td className="score">{row.gs}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text2)' }}>{row.csat}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Crosslink to Mains Optionals ── */}
        <section className="pr-section" style={{ paddingBottom: '2rem' }}>
          <div className="pr-section-label" style={{ marginBottom: '1.5rem' }}>Also preparing for Mains?</div>
          <Link href="/" className="pr-crosslink">
            <div className="pr-crosslink-left">
              <span style={{ fontSize: '1.5rem' }}>📖</span>
              <div>
                <div className="pr-crosslink-name">Distilled Crux — Optional Subjects</div>
                <div className="pr-crosslink-sub">Sociology, Anthropology, Political Science, Geography, Public Administration</div>
              </div>
            </div>
            <div className="pr-crosslink-arrow">
              Explore optionals
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M2 6.5h9M6.5 2l4.5 4.5-4.5 4.5" stroke="var(--accent)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </Link>
        </section>

        {/* ── CTA ── */}
        <div className="pr-cta">
          <div>
            <h2 className="pr-cta-h2">Start your Prelims prep.<br /><em>The right way.</em></h2>
            <p className="pr-cta-sub">Free to start. No card needed. Upgrade when you&apos;re ready.</p>
          </div>
          <div className="pr-cta-right">
            <Link href="/login" className="pr-btn-primary">Start Preparing Free →</Link>
            <Link href="#subjects" className="pr-btn-ghost">
              Browse subjects
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M2 6.5h9M6.5 2l4.5 4.5-4.5 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
          </div>
        </div>

        {/* ── Footer ── */}
        <footer className="pr-footer">
          <div className="pr-footer-logo">Distilled<em>Crux</em></div>
          <div className="pr-footer-links">
            <Link href="/privacy" className="pr-footer-link">Privacy</Link>
            <Link href="/terms" className="pr-footer-link">Terms</Link>
            <Link href="/refund" className="pr-footer-link">Refund</Link>
            <Link href="/contact" className="pr-footer-link">Contact</Link>
          </div>
          <span className="pr-footer-copy">© {new Date().getFullYear()} Distilled Crux</span>
        </footer>

      </div>
    </>
  );
}
