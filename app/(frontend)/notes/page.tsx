import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';
import HomeToolsList from '@/components/HomeToolsList';

export const metadata: Metadata = {
  title: 'Distilled Crux UPSC Optional Preparation',
  description:
    'AI answer evaluation, curated notes, 1500+ PYQs and real topper copies built for UPSC Mains Optional. History, Sociology, Anthropology and more.',
  alternates: { canonical: 'https://distilledcrux.com' },
};

const optionals = [
  { id: 'sociology',    name: 'Sociology',            sub: 'Social Structure, Change & Thinkers',       color: '#4361ee', dim: 'rgba(67,97,238,0.07)',  border: 'rgba(67,97,238,0.18)',  live: true,  icon: '🧩' },
  { id: 'anthropology', name: 'Anthropology',          sub: 'Physical, Social & Applied Anthropology',   color: '#2dd4bf', dim: 'rgba(45,212,191,0.07)', border: 'rgba(45,212,191,0.18)', live: true,  icon: '🧬' },
  { id: 'polsci',       name: 'PSIR',     sub: 'IR, Comparative Politics & Indian Polity',  color: '#f87171', dim: 'rgba(248,113,113,0.07)',border: 'rgba(248,113,113,0.18)',live: true,  icon: '⚖️' },
  { id: 'geography',    name: 'Geography',             sub: 'Physical, Human & Economic Geography',      color: '#4ade80', dim: 'rgba(74,222,128,0.07)', border: 'rgba(74,222,128,0.18)', live: true,  icon: '🌍' },
  { id: 'pub-admin',    name: 'Public Administration', sub: 'Administrative Theory & Indian Admin',      color: '#fb923c', dim: 'rgba(251,146,60,0.07)', border: 'rgba(251,146,60,0.18)', live: true,  icon: '📋' },
];



const marqueeItems = [
  'AI Answer Evaluation', 'Sociology Optional', 'Anthropology Optional', 'PYQ Bank',
  'Syllabus Notes', 'AI Chat', 'PSIR', 'Geography Optional', 'Public Administration',
];

const CSS = `
  .lp { position: relative; min-height: 100vh; }

  .lp-hero {
    max-width: 1200px; margin: 0 auto;
    padding: 140px 2rem 80px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4rem;
    align-items: end;
    border-bottom: 1px solid var(--border);
  }
  .lp-hero-kicker {
    font-family: var(--font-ui);
    font-size: 0.68rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--text3);
    margin-bottom: 1.5rem;
    display: flex;
    align-items: center;
    gap: 12px;
  }  .lp-hero-h1 {
    font-family: var(--font-body);
    font-size: clamp(3rem, 6.5vw, 5.2rem);
    font-weight: 700;
    line-height: 1.02;
    letter-spacing: -0.035em;
    color: var(--text);
    margin-bottom: 2rem;
  }
  .lp-hero-h1 em { font-style: italic; color: var(--accent); }
  .lp-hero-desc {
    font-family: var(--font-ui);
    font-size: 1rem;
    color: var(--text2);
    line-height: 1.8;
    margin-bottom: 2.5rem;
    max-width: 380px;
  }
  .lp-hero-actions { display: flex; align-items: center; gap: 1.25rem; flex-wrap: wrap; }
  .lp-btn-primary {
    font-family: var(--font-ui);
    font-size: 0.88rem; font-weight: 600;
    background: var(--text); color: var(--bg);
    padding: 12px 28px; border-radius: 6px;
    text-decoration: none; letter-spacing: 0.01em;
    transition: opacity 0.15s;
  }
  .lp-btn-primary:hover { opacity: 0.85; }
  .lp-btn-ghost {
    font-family: var(--font-ui);
    font-size: 0.88rem; color: var(--text3);
    text-decoration: none;
    display: flex; align-items: center; gap: 6px;
    transition: color 0.15s;
  }
  .lp-btn-ghost:hover { color: var(--text); }
  .lp-hero-stat-row {
    display: flex; gap: 2.5rem;
    margin-top: 3.5rem; padding-top: 2rem;
    border-top: 1px solid var(--border);
  }
  .lp-hero-stat-val {
    font-family: var(--font-body);
    font-size: 1.75rem; font-weight: 700;
    color: var(--text); letter-spacing: -0.03em;
    line-height: 1; margin-bottom: 4px;
  }
  .lp-hero-stat-label {
    font-family: var(--font-ui);
    font-size: 0.72rem; color: var(--text3);
    letter-spacing: 0.04em; text-transform: uppercase;
  }

  .lp-marquee-wrap {
    overflow: hidden; border-bottom: 1px solid var(--border);
    padding: 10px 0; background: var(--bg2);
    mask-image: linear-gradient(90deg, transparent, black 8%, black 92%, transparent);
    -webkit-mask-image: linear-gradient(90deg, transparent, black 8%, black 92%, transparent);
  }
  .lp-marquee-track { display: flex; width: max-content; animation: marquee 40s linear infinite; }
  .lp-marquee-track:hover { animation-play-state: paused; }
  .lp-marquee-item { display: flex; align-items: center; gap: 0.6rem; padding: 0 2.5rem; flex-shrink: 0; }
  .lp-marquee-sep { font-family: var(--font-body); font-size: 0.65rem; color: var(--border3); }
  .lp-marquee-text { font-family: var(--font-ui); font-size: 0.78rem; color: var(--text3); letter-spacing: 0.03em; }

  .lp-section {
    max-width: 1200px; margin: 0 auto;
    padding: 5rem 2rem;
    border-bottom: 1px solid var(--border);
  }
  .lp-section-header {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 2rem; align-items: start; margin-bottom: 3.5rem;
  }
  .lp-section-label {
    font-family: var(--font-ui);
    font-size: 0.65rem; letter-spacing: 0.18em;
    text-transform: uppercase; color: var(--text3);
    margin-bottom: 1rem;
    display: flex; align-items: center; gap: 10px;
  }  .lp-section-h2 {
    font-family: var(--font-body);
    font-size: clamp(1.8rem, 3vw, 2.6rem);
    font-weight: 700; letter-spacing: -0.03em;
    color: var(--text); line-height: 1.1;
  }
  .lp-section-h2 em { font-style: italic; color: var(--accent); }
  .lp-section-desc {
    font-family: var(--font-ui); font-size: 0.92rem;
    color: var(--text2); line-height: 1.8; padding-top: 0.5rem;
  }

  .lp-opt-grid {
    display: grid; grid-template-columns: repeat(3, 1fr);
    gap: 1px; background: var(--border);
    border: 1px solid var(--border); border-radius: 12px; overflow: hidden;
  }
  .lp-opt-card {
    background: var(--bg); padding: 1.75rem;
    text-decoration: none; display: flex; flex-direction: column;
    transition: background 0.18s, transform 0.18s, box-shadow 0.18s;
  }
  .lp-opt-card:hover { background: var(--bg2); transform: translateY(-2px); box-shadow: 0 6px 24px rgba(0,0,0,0.18); }
  .lp-opt-card-icon { font-size: 1.4rem; margin-bottom: 1.25rem; display: block; }
  .lp-opt-card-name {
    font-family: var(--font-body); font-size: 1rem;
    font-weight: 700; margin-bottom: 0.3rem; letter-spacing: -0.01em;
  }
  .lp-opt-card-sub {
    font-family: var(--font-ui); font-size: 0.75rem;
    color: var(--text3); line-height: 1.5; margin-bottom: 1.25rem; flex: 1;
  }
  .lp-opt-card-body { display: flex; flex-direction: column; flex: 1; }
  .lp-opt-card-arrow {
    font-family: var(--font-ui); font-size: 0.72rem;
    font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase;
    display: flex; align-items: center; gap: 6px; margin-top: auto;
  }

  .lp-history-card {
    display: flex; align-items: center; justify-content: space-between;
    margin-top: 1px; padding: 1.25rem 1.75rem;
    background: var(--bg); border: 1px solid var(--border);
    border-radius: 12px; text-decoration: none; transition: background 0.18s, transform 0.18s, box-shadow 0.18s; gap: 1.5rem;
  }
  .lp-history-card:hover { background: var(--bg2); transform: translateY(-2px); box-shadow: 0 6px 24px rgba(0,0,0,0.18); }
  .lp-history-left { display: flex; align-items: center; gap: 1rem; }
  .lp-history-name { font-family: var(--font-body); font-size: 1rem; font-weight: 700; color: #e8b86d; margin-bottom: 2px; }
  .lp-history-sub { font-family: var(--font-ui); font-size: 0.75rem; color: var(--text3); }
  .lp-history-link {
    font-family: var(--font-ui); font-size: 0.78rem; font-weight: 600;
    color: #e8b86d; display: flex; align-items: center; gap: 6px; white-space: nowrap; flex-shrink: 0;
  }

  .lp-tools-list {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 1px; background: var(--border);
    border: 1px solid var(--border); border-radius: 12px; overflow: hidden;
  }
  .lp-tool-item {
    background: var(--bg); padding: 1.75rem 2rem;
    display: flex; align-items: flex-start; gap: 1.5rem;
    transition: background 0.18s, transform 0.18s, box-shadow 0.18s;
    color: inherit;
  }
  .lp-tool-item:hover { background: var(--bg2); transform: translateY(-2px); box-shadow: 0 6px 24px rgba(0,0,0,0.18); }
  .lp-tool-num {
    font-family: var(--font-mono); font-size: 0.65rem;
    color: var(--text3); letter-spacing: 0.06em;
    padding-top: 4px; flex-shrink: 0; width: 24px;
  }
  .lp-tool-label {
    font-family: var(--font-body); font-size: 0.95rem;
    font-weight: 700; color: var(--text); margin-bottom: 0.35rem; letter-spacing: -0.01em;
  }
  .lp-tool-desc { font-family: var(--font-ui); font-size: 0.8rem; color: var(--text3); line-height: 1.65; }

  .lp-pricing-row {
    display: grid; grid-template-columns: repeat(3, 1fr);
    gap: 1px; background: var(--border);
    border: 1px solid var(--border); border-radius: 12px; overflow: hidden;
  }
  .lp-price-cell { background: var(--bg); padding: 2rem; transition: background 0.18s, transform 0.18s, box-shadow 0.18s; }
  .lp-price-cell:hover { background: var(--bg2); transform: translateY(-2px); box-shadow: 0 6px 24px rgba(0,0,0,0.18); }
  .lp-price-cell.featured { background: var(--bg2); }
  .lp-price-plan {
    font-family: var(--font-ui); font-size: 0.65rem;
    letter-spacing: 0.14em; text-transform: uppercase;
    color: var(--text3); margin-bottom: 0.75rem;
  }
  .lp-price-amount {
    font-family: var(--font-body); font-size: 2rem;
    font-weight: 700; letter-spacing: -0.04em;
    color: var(--text); line-height: 1; margin-bottom: 0;
  }
  .lp-price-period { font-family: var(--font-ui); font-size: 0.75rem; color: var(--text3); margin-bottom: 1rem; }
  .lp-price-desc { font-family: var(--font-ui); font-size: 0.8rem; color: var(--text2); line-height: 1.5; }
  .lp-price-tag {
    display: inline-block; font-family: var(--font-ui); font-size: 0.62rem;
    font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
    padding: 2px 10px; border-radius: 4px; margin-bottom: 0.85rem;
  }

  .lp-cta {
    max-width: 1200px; margin: 0 auto; padding: 5rem 2rem 6rem;
    display: grid; grid-template-columns: 1fr auto;
    align-items: center; gap: 3rem;
  }
  .lp-cta-h2 {
    font-family: var(--font-body);
    font-size: clamp(2rem, 4vw, 3.2rem);
    font-weight: 700; letter-spacing: -0.03em; color: var(--text); line-height: 1.1;
  }
  .lp-cta-h2 em { font-style: italic; color: var(--accent); }
  .lp-cta-sub { font-family: var(--font-ui); font-size: 0.88rem; color: var(--text3); margin-top: 0.75rem; }
  .lp-cta-right { display: flex; flex-direction: column; gap: 0.75rem; align-items: flex-start; flex-shrink: 0; }

  .lp-footer {
    border-top: 1px solid var(--border); max-width: 1200px; margin: 0 auto;
    padding: 1.75rem 2rem; display: flex; justify-content: space-between;
    align-items: center; flex-wrap: wrap; gap: 1rem;
  }
  .lp-footer-logo { font-family: var(--font-monument, 'Neue Haas Grotesk', system-ui); font-size: 0.78rem; font-weight: 900; color: var(--text); letter-spacing: 0.06em; }
  .lp-footer-links { display: flex; gap: 1.75rem; flex-wrap: wrap; }
  .lp-footer-link { font-family: var(--font-ui); font-size: 0.78rem; color: var(--text3); text-decoration: none; transition: color 0.15s; }
  .lp-footer-link:hover { color: var(--text); }
  .lp-footer-copy { font-family: var(--font-ui); font-size: 0.72rem; color: var(--text3); }

  /* ── Tablet ── */
  @media (max-width: 900px) {
    .lp-hero {
      grid-template-columns: 1fr;
      gap: 2rem;
      padding-top: 100px;
      padding-bottom: 3rem;
    }
    .lp-hero-desc { max-width: 100%; }
    .lp-section-header { grid-template-columns: 1fr; gap: 1rem; margin-bottom: 2.5rem; }
    .lp-opt-grid { grid-template-columns: repeat(2, 1fr); }
    .lp-tools-list { grid-template-columns: 1fr; }
    .lp-pricing-row { grid-template-columns: 1fr; }
    .lp-cta { grid-template-columns: 1fr; gap: 2rem; padding: 4rem 2rem 5rem; }
    .lp-cta-right { flex-direction: row; flex-wrap: wrap; }
  }

  /* ── Mobile ── */
  @media (max-width: 640px) {
    /* Hero: tighter, full-bleed feel */
    .lp-hero {
      padding: 88px 1.25rem 2.5rem;
      gap: 1.5rem;
    }
    .lp-hero-kicker { font-size: 0.62rem; letter-spacing: 0.14em; gap: 8px; }
    .lp-hero-h1 { font-size: clamp(2.4rem, 11vw, 3.2rem); margin-bottom: 1.25rem; }
    .lp-hero-desc { font-size: 0.9rem; line-height: 1.75; margin-bottom: 2rem; }
    .lp-hero-actions { gap: 0.85rem; }
    .lp-btn-primary { padding: 11px 22px; font-size: 0.85rem; }
    .lp-btn-ghost { font-size: 0.82rem; }
    .lp-hero-stat-row { gap: 2rem; margin-top: 2.5rem; padding-top: 1.5rem; }
    .lp-hero-stat-val { font-size: 1.5rem; }
    .lp-hero-stat-label { font-size: 0.68rem; }

    /* Marquee: faster on narrow screens */
    .lp-marquee-wrap { padding: 8px 0; }
    .lp-marquee-text { font-size: 0.72rem; }

    /* Sections */
    .lp-section { padding: 3rem 1.25rem; }
    .lp-section-label { font-size: 0.6rem; }
    .lp-section-h2 { font-size: clamp(1.5rem, 7vw, 2rem); }
    .lp-section-desc { font-size: 0.85rem; line-height: 1.7; }

    /* Optionals: single column */
    .lp-opt-grid { grid-template-columns: 1fr; }
    .lp-opt-card { padding: 1.25rem 1.25rem; flex-direction: row; align-items: center; gap: 1rem; }
    .lp-opt-card-icon { font-size: 1.5rem; margin-bottom: 0; flex-shrink: 0; }
    .lp-opt-card-name { font-size: 0.95rem; margin-bottom: 0.15rem; }
    .lp-opt-card-sub { font-size: 0.72rem; margin-bottom: 0; flex: none; }
    .lp-opt-card-body { flex: 1; }
    .lp-opt-card-arrow { margin-top: 0; font-size: 0.7rem; }

    /* History card */
    .lp-history-card { padding: 1rem 1.25rem; }
    .lp-history-name { font-size: 0.9rem; }
    .lp-history-sub { font-size: 0.7rem; }
    .lp-history-link { font-size: 0.72rem; }

    /* Tools: full width, more compact */
    .lp-tool-item { padding: 1.25rem 1.25rem; gap: 1rem; }
    .lp-tool-num { font-size: 0.6rem; width: 20px; }
    .lp-tool-label { font-size: 0.88rem; }
    .lp-tool-desc { font-size: 0.77rem; line-height: 1.6; }

    /* Pricing: compact cells */
    .lp-price-cell { padding: 1.5rem 1.25rem; }
    .lp-price-amount { font-size: 1.75rem; }
    .lp-price-plan { font-size: 0.62rem; }
    .lp-price-desc { font-size: 0.78rem; }

    /* CTA */
    .lp-cta { padding: 3rem 1.25rem 4rem; gap: 1.5rem; }
    .lp-cta-h2 { font-size: clamp(1.6rem, 8vw, 2.4rem); }
    .lp-cta-sub { font-size: 0.82rem; }
    .lp-cta-right { flex-direction: column; gap: 0.65rem; width: 100%; }
    .lp-cta-right .lp-btn-primary { text-align: center; width: 100%; display: block; padding: 14px; }
    .lp-cta-right .lp-btn-ghost { justify-content: center; }

    /* Footer */
    .lp-footer { flex-direction: column; text-align: center; padding: 1.5rem 1.25rem; gap: 0.85rem; }
    .lp-footer-links { justify-content: center; gap: 1.25rem; }
    .lp-footer-link { font-size: 0.75rem; }
    .lp-footer-copy { font-size: 0.7rem; }
    .lp-footer-logo { font-size: 0.72rem; }
  }
`;

export default function Home() {
  return (
    <>
      <Script id="schema-org" type="application/ld+json">
        {JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: 'Distilled Crux UPSC Optional Preparation',
          url: 'https://distilledcrux.com',
          description: 'AI answer evaluation, notes, PYQs for UPSC optionals',
        })}
      </Script>

      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="lp">

        <div className="lp-hero">
          <div className="lp-hero-left">
            <div className="lp-hero-kicker">UPSC Mains · Optional Subjects</div>
            <h1 className="lp-hero-h1">
              Your optional.<br />
              <em>Built to score.</em>
            </h1>
          </div>
          <div className="lp-hero-right">
            <p className="lp-hero-desc">
              AI answer evaluation, syllabus notes, 1500+ PYQs and real topper copies 
              built specifically for UPSC Mains Optional. No fluff.
            </p>
            <div className="lp-hero-actions">
              <Link href="/login" className="lp-btn-primary">Start free →</Link>
              <Link href="#optionals" className="lp-btn-ghost">
                Pick your optional
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 2l5 5-5 5M2 7h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Link>
            </div>
            <div className="lp-hero-stat-row">
              {[
                { val: '1500+', label: 'PYQs' },
                { val: '5', label: 'Optionals' },
              ].map(s => (
                <div key={s.label}>
                  <div className="lp-hero-stat-val">{s.val}</div>
                  <div className="lp-hero-stat-label">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lp-marquee-wrap">
          <div className="lp-marquee-track">
            {[...marqueeItems, ...marqueeItems].map((item, i) => (
              <span key={i} className="lp-marquee-item">
                <span className="lp-marquee-sep">·</span>
                <span className="lp-marquee-text">{item}</span>
              </span>
            ))}
          </div>
        </div>

        <section id="optionals" className="lp-section">
          <div className="lp-section-header">
            <div>
              <div className="lp-section-label">Choose your optional</div>
              <h2 className="lp-section-h2">One subject.<br /><em>Total mastery.</em></h2>
            </div>
            <p className="lp-section-desc">
              Pick your subject and get a platform built exactly for it 
              notes, PYQs, evaluation and AI chat calibrated to your syllabus.
            </p>
          </div>
          <div className="lp-opt-grid">
            {optionals.map((opt) => (
              <Link key={opt.id} href={"/" + opt.id} className="lp-opt-card">
                <span className="lp-opt-card-icon">{opt.icon}</span>
                <div className="lp-opt-card-body">
                  <div className="lp-opt-card-name" style={{ color: opt.color }}>{opt.name}</div>
                  <div className="lp-opt-card-sub">{opt.sub}</div>
                  <div className="lp-opt-card-arrow" style={{ color: opt.color }}>
                    Explore
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <a href="https://historyoptional.xyz" target="_blank" rel="noopener noreferrer" className="lp-history-card" style={{ marginTop: '1px' }}>
            <div className="lp-history-left">
              <span style={{ fontSize: '1.5rem' }}>🏛️</span>
              <div>
                <div className="lp-history-name">History Optional</div>
                <div className="lp-history-sub">Paper I & II · Ancient to World History dedicated platform</div>
              </div>
            </div>
            <div className="lp-history-link">
              historyoptional.xyz
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M2 6.5h9M6.5 2l4.5 4.5-4.5 4.5" stroke="#e8b86d" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </a>
        </section>

        <section id="features" className="lp-section">
          <div className="lp-section-header">
            <div>
              <div className="lp-section-label">What's inside</div>
              <h2 className="lp-section-h2">Everything you need.<br /><em>Nothing you don't.</em></h2>
            </div>
            <p className="lp-section-desc">
              Every tool on Distilled Crux exists for one reason getting you more marks in your optional paper.
            </p>
          </div>
          <HomeToolsList />
        </section>

        <section className="lp-section">
          <div className="lp-section-header">
            <div>
              <div className="lp-section-label">Pricing</div>
              <h2 className="lp-section-h2">Transparent plans.<br /><em>No surprises.</em></h2>
            </div>
            <p className="lp-section-desc">
              Pay only for what you need. Daily access to full-year coverage 
              no auto-renewals, no hidden fees.
            </p>
          </div>
          <div className="lp-pricing-row">
            {[
              { label: 'Daily',     price: '₹49',    period: 'per day',      desc: 'Exam-day sprints and last-minute revision.',    tag: null,           tagColor: '' },
              { label: '6 Months', price: '₹3,999', period: 'per 6 months', desc: 'Focused preparation leading up to Mains.',      tag: 'Most Popular', tagColor: '#4361ee' },
              { label: 'Yearly',   price: '₹5,999', period: 'per year',     desc: 'Full-year coverage from Prelims to interview.', tag: 'Best Value',   tagColor: '#e8b86d' },
            ].map((p) => (
              <div key={p.label} className={"lp-price-cell" + (p.tag === 'Most Popular' ? ' featured' : '')}>
                {p.tag && (
                  <div className="lp-price-tag" style={{ background: p.tagColor + '18', color: p.tagColor, border: "1px solid " + p.tagColor + "30" }}>
                    {p.tag}
                  </div>
                )}
                <div className="lp-price-plan">{p.label}</div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}><div className="lp-price-amount">{p.price}</div>
                <div className="lp-price-period">{p.period}</div></div>
                <div className="lp-price-desc">{p.desc}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '1.25rem', textAlign: 'right' }}>
            <Link href="/pricing" style={{ fontFamily: 'var(--font-ui)', fontSize: '0.8rem', color: 'var(--accent)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              Full pricing details →
            </Link>
          </div>
        </section>

        <div className="lp-cta">
          <div>
            <h2 className="lp-cta-h2">Ready to crack<br /><em>your optional?</em></h2>
            <p className="lp-cta-sub">Start free no card needed. Upgrade when you're ready.</p>
          </div>
          <div className="lp-cta-right">
            <Link href="/login" className="lp-btn-primary">Start Preparing Free →</Link>
            <Link href="#optionals" className="lp-btn-ghost">
              Browse optionals
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M2 6.5h9M6.5 2l4.5 4.5-4.5 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
          </div>
        </div>

        <footer className="lp-footer">
          <div className="lp-footer-logo">DISTILLEDCRUX.COM</div>
          <div className="lp-footer-links">
            <Link href="/privacy" className="lp-footer-link">Privacy</Link>
            <Link href="/terms" className="lp-footer-link">Terms</Link>
            <Link href="/refund" className="lp-footer-link">Refund</Link>
            <Link href="/contact" className="lp-footer-link">Contact</Link>
          </div>
          <span className="lp-footer-copy">© {new Date().getFullYear()} distilledcrux.com</span>
        </footer>

      </div>
    </>
  );
}
