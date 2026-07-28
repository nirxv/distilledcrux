import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';

export const metadata: Metadata = {
  title: 'PrepPandit — UPSC Optional Preparation',
  description:
    'AI answer evaluation, curated notes, 1500+ PYQs and real topper copies — built for UPSC Mains Optional. History, Sociology, Anthropology and more.',
  alternates: { canonical: 'https://preppandit.com' },
};

const optionals = [
  {
    id: 'sociology',
    name: 'Sociology',
    sub: 'Social Structure, Change & Thinkers',
    color: '#4361ee',
    dim: 'rgba(67,97,238,0.08)',
    border: 'rgba(67,97,238,0.18)',
    live: true,
    count: 'Now available',
    icon: '🧩',
  },
  {
    id: 'anthropology',
    name: 'Anthropology',
    sub: 'Physical, Social & Applied Anthropology',
    color: '#2dd4bf',
    dim: 'rgba(45,212,191,0.08)',
    border: 'rgba(45,212,191,0.18)',
    live: true,
    count: 'Now available',
    icon: '🧬',
  },
  {
    id: 'polsci',
    name: 'Political Science',
    sub: 'IR, Comparative Politics & Indian Polity',
    color: '#f87171',
    dim: 'rgba(248,113,113,0.08)',
    border: 'rgba(248,113,113,0.18)',
    live: true,
    count: 'Now available',
    icon: '⚖️',
  },
  {
    id: 'geography',
    name: 'Geography',
    sub: 'Physical, Human & Economic Geography',
    color: '#4ade80',
    dim: 'rgba(74,222,128,0.08)',
    border: 'rgba(74,222,128,0.18)',
    live: true,
    count: 'Now available',
    icon: '🌍',
  },
  {
    id: 'pub-admin',
    name: 'Public Administration',
    sub: 'Administrative Theory & Indian Admin',
    color: '#fb923c',
    dim: 'rgba(251,146,60,0.08)',
    border: 'rgba(251,146,60,0.18)',
    live: true,
    count: 'Now available',
    icon: '📋',
  },
];

const features = [
  {
    icon: '📝',
    title: 'AI Answer Evaluation',
    desc: 'Upload handwritten answers. Get marks, section-wise feedback and a model answer — calibrated to the actual UPSC rubric.',
    color: '#7c6af7',
  },
  {
    icon: '📚',
    title: 'Syllabus-Mapped Notes',
    desc: 'Every topic, every thinker, every debate — structured for Mains. Written to be read before the exam, not instead of the syllabus.',
    color: '#e8b86d',
  },
  {
    icon: '🗂️',
    title: 'PYQ Bank',
    desc: '1500+ previous year questions, topic-wise. With model answers written the way toppers actually write them.',
    color: '#2dd4bf',
  },
  {
    icon: '🏆',
    title: 'Topper Answer Copies',
    desc: 'Real answer sheets from students who scored 140+. Annotated so you know what worked and why.',
    color: '#4ade80',
  },
  {
    icon: '💬',
    title: 'AI Chat',
    desc: 'Ask anything from your syllabus. Get structured answers with thinkers, arguments and exam-ready language — not Wikipedia summaries.',
    color: '#f87171',
  },
  {
    icon: '🗺️',
    title: 'Map Practice',
    desc: 'Every UPSC map question, interactive. Attempt, submit, get evaluated. The part everyone ignores until it is too late.',
    color: '#fb923c',
  },
];

const marqueeItems = [
  'AI Answer Evaluation',
  'Sociology Optional',
  'Anthropology Optional',
  'PYQ Bank',
  'Topper Copies',
  'Syllabus Notes',
  'Map Practice',
  'Political Science Optional',
  'Geography Optional',
  'Public Administration',
  'UPSC Mains Prep',
];

export default function Home() {
  return (
    <>
      <Script id="schema-org" type="application/ld+json">
        {JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: 'PrepPandit — UPSC Optional Preparation',
          url: 'https://preppandit.com',
          description: 'AI answer evaluation, notes, PYQs for UPSC optionals',
        })}
      </Script>

      <style>{`
        .orb {
          position: absolute; border-radius: 50%;
          filter: blur(90px); pointer-events: none; z-index: 0;
        }
        .orb-1 {
          width: 700px; height: 700px;
          background: radial-gradient(circle, rgba(67,97,238,0.13) 0%, transparent 65%);
          top: -250px; left: -180px;
          animation: float 9s ease-in-out infinite;
        }
        .orb-2 {
          width: 550px; height: 550px;
          background: radial-gradient(circle, rgba(232,184,109,0.09) 0%, transparent 65%);
          top: 80px; right: -140px;
          animation: float 12s ease-in-out infinite reverse;
        }
        .orb-3 {
          width: 450px; height: 450px;
          background: radial-gradient(circle, rgba(45,212,191,0.07) 0%, transparent 65%);
          bottom: 300px; left: 25%;
          animation: float 15s ease-in-out infinite;
        }


        /* hero */
        .pp-hero {
          padding: 148px 2rem 72px;
          text-align: center; position: relative; z-index: 1;
          max-width: 860px; margin: 0 auto;
        }
        .pp-badge {
          display: inline-flex; align-items: center; gap: 8px;
          background: rgba(67,97,238,0.07);
          border: 1px solid rgba(67,97,238,0.18);
          color: var(--accent3);
          font-family: var(--font-ui);
          font-size: 0.7rem; letter-spacing: 0.09em; text-transform: uppercase;
          padding: 5px 16px; border-radius: var(--radius-pill);
          margin-bottom: 2rem;
        }
        .pp-badge-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--accent);
          animation: pulse-ring 2s ease infinite;
        }
        .pp-h1 {
          font-family: var(--font-body);
          font-size: clamp(2.6rem, 7.5vw, 5rem);
          font-weight: 700; line-height: 1.08;
          letter-spacing: -0.03em;
          color: var(--text); margin-bottom: 1.4rem;
        }
        .pp-h1 .hl { color: var(--accent); }
        .pp-sub {
          font-family: var(--font-ui);
          font-size: clamp(1rem, 1.8vw, 1.15rem);
          color: var(--text2); line-height: 1.75;
          max-width: 540px; margin: 0 auto 2.5rem;
        }
        .pp-actions { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }
        .pp-btn-primary {
          font-family: var(--font-ui);
          background: var(--accent); color: #fff;
          padding: 13px 30px; border-radius: var(--radius-pill);
          font-size: 0.95rem; font-weight: 600;
          text-decoration: none;
          box-shadow: 0 0 36px rgba(67,97,238,0.28);
          transition: all 0.2s;
        }
        .pp-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 0 52px rgba(67,97,238,0.38); }
        .pp-btn-secondary {
          font-family: var(--font-ui);
          background: var(--glass-bg2);
          color: var(--text);
          padding: 13px 30px; border-radius: var(--radius-pill);
          font-size: 0.95rem; font-weight: 500;
          text-decoration: none;
          border: 1px solid var(--glass-border2);
          backdrop-filter: blur(10px);
          transition: all 0.2s;
        }
        .pp-btn-secondary:hover { background: rgba(255,255,255,0.07); transform: translateY(-2px); }

        /* marquee */
        .pp-marquee-wrap {
          overflow: hidden; position: relative; z-index: 1;
          border-top: 1px solid var(--border); border-bottom: 1px solid var(--border);
          padding: 10px 0; background: var(--bg2);
          mask-image: linear-gradient(90deg, transparent, black 7%, black 93%, transparent);
          -webkit-mask-image: linear-gradient(90deg, transparent, black 7%, black 93%, transparent);
        }
        .pp-marquee-track {
          display: flex; width: max-content; gap: 0;
          animation: marquee 36s linear infinite;
        }
        .pp-marquee-track:hover { animation-play-state: paused; }
        .pp-marquee-item {
          display: flex; align-items: center; gap: 0.5rem;
          padding: 0 2.5rem; flex-shrink: 0;
        }
        .pp-marquee-dot { width: 4px; height: 4px; border-radius: 50%; background: var(--accent); }
        .pp-marquee-text {
          font-family: var(--font-body);
          font-size: 0.82rem; color: var(--text2);
        }

        /* section */
        .pp-section { padding: 5rem 2rem; max-width: 1200px; margin: 0 auto; position: relative; z-index: 1; }
        .pp-tag {
          font-family: var(--font-ui);
          font-size: 0.68rem; letter-spacing: 0.12em; text-transform: uppercase;
          color: var(--accent); margin-bottom: 0.6rem;
        }
        .pp-section-title {
          font-family: var(--font-body);
          font-size: clamp(1.7rem, 3.5vw, 2.6rem);
          font-weight: 700; letter-spacing: -0.03em;
          color: var(--text); line-height: 1.15; margin-bottom: 0.9rem;
        }
        .pp-section-sub {
          font-family: var(--font-ui);
          font-size: 0.975rem; color: var(--text2);
          max-width: 520px; line-height: 1.7;
        }

        /* optionals grid */
        .pp-opt-grid {
          display: grid; grid-template-columns: repeat(3, 1fr);
          gap: 1rem; margin-top: 2.5rem;
        }
        .pp-opt-card {
          background: var(--glass-bg);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-lg);
          padding: 1.5rem;
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          transition: transform 0.22s, border-color 0.22s, box-shadow 0.22s;
          text-decoration: none; display: block;
          position: relative; overflow: hidden;
        }
        .pp-opt-card.live:hover {
          transform: translateY(-4px);
          box-shadow: 0 10px 40px rgba(0,0,0,0.35);
        }
        .pp-opt-card.soon { opacity: 0.52; pointer-events: none; }
        .pp-history-card {
          display: flex; align-items: center; justify-content: space-between;
          margin-top: 1rem; padding: 1.25rem 1.5rem;
          background: rgba(232,184,109,0.06);
          border: 1px solid rgba(232,184,109,0.2);
          border-radius: var(--radius-lg);
          text-decoration: none; transition: all 0.2s; gap: 1rem;
        }
        .pp-history-card:hover {
          background: rgba(232,184,109,0.11);
          border-color: rgba(232,184,109,0.35);
          transform: translateY(-2px);
        }
        .pp-opt-icon { font-size: 1.8rem; margin-bottom: 0.9rem; display: block; }
        .pp-opt-name {
          font-family: var(--font-body);
          font-size: 1.1rem; font-weight: 700;
          margin-bottom: 0.25rem;
        }
        .pp-opt-sub {
          font-family: var(--font-ui);
          font-size: 0.78rem; color: var(--text3);
          margin-bottom: 1rem; line-height: 1.5;
        }
        .pp-opt-badge {
          display: inline-flex; align-items: center; gap: 5px;
          font-family: var(--font-ui);
          font-size: 0.7rem; font-weight: 500;
          padding: 3px 12px; border-radius: var(--radius-pill);
        }
        .pp-opt-badge-dot { width: 5px; height: 5px; border-radius: 50%; }

        /* features */
        .pp-feat-grid {
          display: grid; grid-template-columns: repeat(3, 1fr);
          gap: 1px; background: var(--border);
          border: 1px solid var(--border); border-radius: var(--radius-md);
          overflow: hidden; margin-top: 2.5rem;
        }
        .pp-feat-tile {
          background: var(--bg2);
          padding: 1.75rem 1.5rem;
          transition: background 0.18s;
        }
        .pp-feat-tile:hover { background: var(--bg3); }
        .pp-feat-icon-wrap {
          width: 44px; height: 44px;
          border-radius: var(--radius-sm);
          display: flex; align-items: center; justify-content: center;
          font-size: 1.25rem; margin-bottom: 1rem;
        }
        .pp-feat-title {
          font-family: var(--font-body);
          font-size: 0.95rem; font-weight: 700;
          margin-bottom: 0.4rem;
        }
        .pp-feat-desc {
          font-family: var(--font-ui);
          font-size: 0.82rem; color: var(--text3); line-height: 1.65;
        }

        /* cta */
        .pp-cta {
          margin: 1rem 2rem 4rem;
          max-width: 880px; margin-left: auto; margin-right: auto;
          padding: 4rem 3rem; text-align: center;
          background: var(--glass-bg);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-xl);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          position: relative; z-index: 1; overflow: hidden;
        }
        .pp-cta-glow {
          position: absolute; width: 500px; height: 350px;
          background: radial-gradient(circle, rgba(67,97,238,0.13) 0%, transparent 70%);
          top: 50%; left: 50%; transform: translate(-50%, -50%);
          pointer-events: none;
        }
        .pp-cta-title {
          font-family: var(--font-body);
          font-size: clamp(1.7rem, 3.5vw, 2.5rem);
          font-weight: 700; letter-spacing: -0.03em;
          color: var(--text); margin-bottom: 0.85rem;
          position: relative; z-index: 1;
        }
        .pp-cta-sub {
          font-family: var(--font-ui);
          font-size: 0.975rem; color: var(--text2);
          margin-bottom: 2rem;
          position: relative; z-index: 1;
        }

        /* footer */
        .pp-footer {
          border-top: 1px solid var(--border);
          padding: 2rem 2rem;
          display: flex; justify-content: space-between; align-items: center;
          flex-wrap: wrap; gap: 1rem;
          max-width: 1200px; margin: 0 auto;
          position: relative; z-index: 1;
        }
        .pp-footer-logo {
          font-family: var(--font-body);
          font-size: 1rem; font-weight: 700; color: var(--text);
        }
        .pp-footer-logo em { font-style: normal; color: var(--accent); }
        .pp-footer-links { display: flex; gap: 1.5rem; flex-wrap: wrap; }
        .pp-footer-link {
          font-family: var(--font-ui);
          font-size: 0.8rem; color: var(--text3);
          text-decoration: none; transition: color 0.18s;
        }
        .pp-footer-link:hover { color: var(--accent); }
        .pp-footer-copy { font-family: var(--font-ui); font-size: 0.75rem; color: var(--text3); }

        @media (max-width: 900px) {
          .pp-opt-grid { grid-template-columns: repeat(2, 1fr); }
          .pp-feat-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 600px) {
          .pp-opt-grid { grid-template-columns: 1fr 1fr; }
          .pp-feat-grid { grid-template-columns: 1fr; }
          .pp-cta { padding: 2.5rem 1.5rem; margin: 1rem; }
          .pp-footer { flex-direction: column; text-align: center; }
        }
        @media (max-width: 400px) {
          .pp-opt-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden' }}>
        {/* orbs */}
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />

        {/* nav */}

        {/* hero */}
        <section className="pp-hero">
          <div className="pp-badge">
            <span className="pp-badge-dot" />
            UPSC Mains · Optional Subjects
          </div>

          <h1 className="pp-h1">
            Your Optional.<br />
            <span className="hl">Done Right.</span>
          </h1>

          <p className="pp-sub">
            AI answer evaluation, syllabus-mapped notes, 1500+ PYQs and real topper copies — built specifically for UPSC Mains Optional.
          </p>

          <div className="pp-actions">
            <Link href="/login" className="pp-btn-primary">Start Preparing Free →</Link>
            <Link href="#optionals" className="pp-btn-secondary">Pick Your Optional</Link>
          </div>
        </section>

        {/* marquee */}
        <div className="pp-marquee-wrap">
          <div className="pp-marquee-track">
            {[...marqueeItems, ...marqueeItems].map((item, i) => (
              <span key={i} className="pp-marquee-item">
                <span className="pp-marquee-dot" />
                <span className="pp-marquee-text">{item}</span>
              </span>
            ))}
          </div>
        </div>

        {/* optionals */}
        <section id="optionals" className="pp-section">
          <p className="pp-tag">Choose Your Optional</p>
          <h2 className="pp-section-title">One optional. Total mastery.</h2>
          <p className="pp-section-sub">
            Pick your subject — get a platform built exactly for it. Notes, PYQs, evaluation and AI chat calibrated to your syllabus.
          </p>

          <div className="pp-opt-grid">
            {optionals.map((opt) => (
              <Link
                key={opt.id}
                href={opt.live ? `/${opt.id}` : '#'}
                className={`pp-opt-card ${opt.live ? 'live' : 'soon'}`}
                style={{
                  borderColor: opt.live ? opt.border : undefined,
                  background: opt.live ? opt.dim : undefined,
                }}
              >
                <span className="pp-opt-icon">{opt.icon}</span>
                <div className="pp-opt-name" style={{ color: opt.color }}>{opt.name}</div>
                <div className="pp-opt-sub">{opt.sub}</div>
                <span
                  className="pp-opt-badge"
                  style={{
                    background: opt.live ? opt.dim : 'rgba(255,255,255,0.04)',
                    color: opt.live ? opt.color : 'var(--text3)',
                    border: `1px solid ${opt.live ? opt.border : 'rgba(255,255,255,0.07)'}`,
                  }}
                >
                  <span
                    className="pp-opt-badge-dot"
                    style={{ background: opt.live ? opt.color : 'var(--text3)' }}
                  />
                  {opt.count}
                </span>
              </Link>
            ))}
          </div>

          {/* History — external card */}
          <a
            href="https://historyoptional.xyz"
            target="_blank"
            rel="noopener noreferrer"
            className="pp-history-card"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ fontSize: '1.8rem' }}>🏛️</span>
              <div>
                <div style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '1.05rem', fontWeight: 700,
                  color: '#e8b86d', marginBottom: 2,
                }}>
                  History Optional
                </div>
                <div style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '0.78rem', color: 'var(--text3)',
                }}>
                  Paper I & II · Ancient to World History — hosted on a dedicated platform
                </div>
              </div>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              fontFamily: 'var(--font-ui)',
              fontSize: '0.8rem', fontWeight: 600,
              color: '#e8b86d', whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              Visit historyoptional.xyz
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 7h10M7 2l5 5-5 5" stroke="#e8b86d" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </a>
        </section>

        {/* features */}
        <section id="features" className="pp-section">
          <p className="pp-tag">What&apos;s Inside</p>
          <h2 className="pp-section-title">Everything you need.<br />Nothing you don&apos;t.</h2>
          <p className="pp-section-sub">
            Every tool on PrepPandit is built for one thing — getting you more marks in your optional paper.
          </p>

          <div className="pp-feat-grid">
            {features.map((f) => (
              <div key={f.title} className="pp-feat-tile">
                <div
                  className="pp-feat-icon-wrap"
                  style={{ background: `${f.color}18` }}
                >
                  {f.icon}
                </div>
                <div className="pp-feat-title">{f.title}</div>
                <div className="pp-feat-desc">{f.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* cta */}
        <div className="pp-cta">
          <div className="pp-cta-glow" />
          <h2 className="pp-cta-title">Ready to crack your optional?</h2>
          <p className="pp-cta-sub">
            Start free — no card needed. Upgrade when you&apos;re ready to go unlimited.
          </p>
          <Link href="#optionals" className="pp-btn-primary">Choose Your Optional →</Link>
        </div>

        {/* footer */}
        <footer className="pp-footer">
          <div className="pp-footer-logo">Prep<em>Pandit</em></div>
          <div className="pp-footer-links">
            <Link href="/privacy" className="pp-footer-link">Privacy</Link>
            <Link href="/terms" className="pp-footer-link">Terms</Link>
            <Link href="/refund" className="pp-footer-link">Refund</Link>
            <Link href="/contact" className="pp-footer-link">Contact</Link>
          </div>
          <span className="pp-footer-copy">© {new Date().getFullYear()} PrepPandit</span>
        </footer>
      </div>
    </>
  );
}
