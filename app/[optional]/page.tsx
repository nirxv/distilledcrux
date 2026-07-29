import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';

/* ── Subject config ─────────────────────────────────────────── */
const OPTIONALS: Record<string, {
  name: string;
  full: string;
  sub: string;
  color: string;
  dim: string;
  border: string;
  glow: string;
  icon: string;
  paper1: string;
  paper2: string;
  stats: { label: string; value: string }[];
  highlights: string[];
}> = {
  sociology: {
    name: 'Sociology',
    full: 'Sociology Optional',
    sub: 'Social Structure, Change & Thinkers',
    color: '#4361ee',
    dim: 'rgba(67,97,238,0.07)',
    border: 'rgba(67,97,238,0.22)',
    glow: 'rgba(67,97,238,0.15)',
    icon: '🧩',
    paper1: 'Sociological Theory, Research Methods, Social Stratification & Social Change',
    paper2: 'Indian Society, Social Issues, Movements & Contemporary Challenges',
    stats: [
      { label: 'PYQs', value: '1500+' },
      { label: 'Topics Covered', value: '120+' },
      { label: 'Thinkers', value: '60+' },
      { label: 'Model Answers', value: '200+' },
    ],
    highlights: [
      'Structural-functional, conflict and interpretive traditions',
      'Thinkers: Marx, Weber, Durkheim, Parsons, Merton, Giddens',
      'Indian society: caste, tribe, gender, village & agrarian systems',
      'Social movements: peasant, women, environmental, Dalit',
      'Contemporary India: globalisation, IT revolution, diaspora',
    ],
  },
  anthropology: {
    name: 'Anthropology',
    full: 'Anthropology Optional',
    sub: 'Physical, Social & Applied Anthropology',
    color: '#2dd4bf',
    dim: 'rgba(45,212,191,0.07)',
    border: 'rgba(45,212,191,0.22)',
    glow: 'rgba(45,212,191,0.14)',
    icon: '🧬',
    paper1: 'Meaning, Scope & Development of Anthropology; Evolution; Genetics; Human Variation',
    paper2: 'Indian Anthropology, Tribal India, Applied Anthropology, Fossil Records',
    stats: [
      { label: 'PYQs', value: '1200+' },
      { label: 'Topics Covered', value: '100+' },
      { label: 'Fossil Records', value: '40+' },
      { label: 'Model Answers', value: '180+' },
    ],
    highlights: [
      'Biological & physical anthropology — evolution, genetics, primatology',
      'Archaeological anthropology — fossil evidence, tools, culture',
      'Social & cultural anthropology — kinship, marriage, religion',
      'Tribal India — scheduled tribes, problems, development policy',
      'Applied anthropology — development, forensics, ethnobotany',
    ],
  },
  polsci: {
    name: 'Political Science',
    full: 'Political Science & IR Optional',
    sub: 'IR, Comparative Politics & Indian Polity',
    color: '#f87171',
    dim: 'rgba(248,113,113,0.07)',
    border: 'rgba(248,113,113,0.2)',
    glow: 'rgba(248,113,113,0.13)',
    icon: '⚖️',
    paper1: 'Political Theory, Indian Government & Politics, Political Institutions',
    paper2: 'Comparative Politics & International Relations',
    stats: [
      { label: 'PYQs', value: '1400+' },
      { label: 'Topics Covered', value: '110+' },
      { label: 'Thinkers', value: '50+' },
      { label: 'Model Answers', value: '190+' },
    ],
    highlights: [
      'Political theory — liberalism, Marxism, feminism, post-colonialism',
      'Indian Constitution — federalism, fundamental rights, DPSPs',
      'Political institutions — Parliament, executive, judiciary, election commission',
      'Comparative politics — presidential vs parliamentary, federalism globally',
      'International relations — realism, liberalism, constructivism, IR theory',
    ],
  },
  geography: {
    name: 'Geography',
    full: 'Geography Optional',
    sub: 'Physical, Human & Economic Geography',
    color: '#4ade80',
    dim: 'rgba(74,222,128,0.07)',
    border: 'rgba(74,222,128,0.2)',
    glow: 'rgba(74,222,128,0.13)',
    icon: '🌍',
    paper1: 'Physical Geography — Geomorphology, Climatology, Oceanography, Biogeography',
    paper2: 'Human & Economic Geography, Regional Planning, India-specific Geography',
    stats: [
      { label: 'PYQs', value: '1300+' },
      { label: 'Topics Covered', value: '130+' },
      { label: 'Diagrams', value: '80+' },
      { label: 'Model Answers', value: '200+' },
    ],
    highlights: [
      'Geomorphology — plate tectonics, landforms, fluvial & aeolian processes',
      'Climatology — atmospheric circulation, monsoon, climate change',
      'Oceanography — currents, tides, marine resources',
      'Human geography — population, migration, settlement patterns',
      'India geography — agriculture, minerals, transport, regional development',
    ],
  },
  'pub-admin': {
    name: 'Public Administration',
    full: 'Public Administration Optional',
    sub: 'Administrative Theory & Indian Administration',
    color: '#fb923c',
    dim: 'rgba(251,146,60,0.07)',
    border: 'rgba(251,146,60,0.2)',
    glow: 'rgba(251,146,60,0.13)',
    icon: '📋',
    paper1: 'Administrative Theory — Organisation, Accountability, Comparative Admin',
    paper2: 'Indian Administration — Union, State, District, Development Administration',
    stats: [
      { label: 'PYQs', value: '1100+' },
      { label: 'Topics Covered', value: '90+' },
      { label: 'Thinkers', value: '40+' },
      { label: 'Model Answers', value: '160+' },
    ],
    highlights: [
      'Administrative theory — Weber\'s bureaucracy, Taylor, Fayol, Simon',
      'Organisation theory — classical, human relations, systems, contingency',
      'Accountability — parliamentary control, CAG, RTI, lokpal',
      'Indian administration — civil services, central secretariat, cabinet',
      'Development administration — planning, decentralisation, e-governance',
    ],
  },
};

const BASE_TOOLS = [
  { icon: (color: string) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  ), label: 'AI Answer Evaluation', desc: 'Upload handwritten answers — get marks, section-wise feedback and a model answer calibrated to the UPSC rubric.', href: '/evaluate', badge: null },
  { icon: (color: string) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ), label: 'AI Chat', desc: 'Ask anything from your syllabus — structured answers with thinkers, arguments and exam-ready language.', href: '/chat', badge: null },
  { icon: (color: string) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  ), label: 'Syllabus Notes', desc: 'Every topic, every thinker, every debate — structured for Mains. Written to be read before the exam.', href: '/notes', badge: 'Free' },
  { icon: (color: string) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  ), label: 'PYQ Bank', desc: '1500+ previous year questions, topic-wise, with model answers written the way toppers actually write them.', href: (opt: string) => `/${opt}/pyqs`, badge: 'Free' },
  { icon: (color: string) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
    </svg>
  ), label: 'Topper Copies', desc: 'Real answer sheets from students who scored 140+. Annotated so you know what worked and why.', href: '/toppers', badge: 'Premium' },
];

const MAP_TOOL = {
  icon: (color: string) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  ),
  label: 'Map Practice',
  desc: 'Every UPSC map question, interactive. Attempt, submit, get evaluated.',
  href: '/mapping',
  badge: null,
};

const TEST_SERIES_TOOL = {
  icon: (color: string) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4"/>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  ),
  label: 'Test Series',
  desc: 'Full-length and sectional tests calibrated to UPSC pattern. Track your score, identify weak areas.',
  href: '/tests',
  badge: 'Premium',
};

const getTools = (optional: string) => [
  ...BASE_TOOLS,
  optional === 'geography' ? MAP_TOOL : TEST_SERIES_TOOL,
];

/* ── generateStaticParams ────────────────────────────────────── */
export function generateStaticParams() {
  return Object.keys(OPTIONALS).map((slug) => ({ optional: slug }));
}

/* ── Metadata ────────────────────────────────────────────────── */
export async function generateMetadata(
  { params }: { params: Promise<{ optional: string }> }
): Promise<Metadata> {
  const { optional } = await params;
  const opt = OPTIONALS[optional];
  if (!opt) return { title: 'Not Found' };
  return {
    title: `${opt.full} — PrepPandit`,
    description: `AI-powered preparation for UPSC ${opt.full}. Notes, PYQs, answer evaluation and AI chat for ${opt.name}.`,
    alternates: { canonical: `https://preppandit.com/${optional}` },
  };
}

/* ── Page ────────────────────────────────────────────────────── */
export default async function OptionalPage(
  { params }: { params: Promise<{ optional: string }> }
) {
  const { optional } = await params;
  const opt = OPTIONALS[optional];
  if (!opt) notFound();

  return (
    <>
      <style>{`
        .op-wrap {
          min-height: 100vh;
          padding: 80px 0 5rem;
          position: relative; overflow: hidden;
        }
        .op-orb1 {
          position: absolute; border-radius: 50%; pointer-events: none; z-index: 0;
          width: 700px; height: 700px;
          top: -200px; left: -200px;
          filter: blur(100px);
          animation: float 10s ease-in-out infinite;
        }
        .op-orb2 {
          position: absolute; border-radius: 50%; pointer-events: none; z-index: 0;
          width: 500px; height: 500px;
          bottom: 100px; right: -150px;
          filter: blur(90px);
          animation: float 14s ease-in-out infinite reverse;
        }
        .op-inner { max-width: 1100px; margin: 0 auto; padding: 0 2rem; position: relative; z-index: 1; }

        /* hero */
        .op-hero { padding: 4rem 0 3.5rem; border-bottom: 1px solid var(--border); }
        .op-breadcrumb {
          display: flex; align-items: center; gap: 6px;
          font-family: var(--font-ui); font-size: 0.78rem;
          color: var(--text3); margin-bottom: 1.5rem;
        }
        .op-breadcrumb a { color: var(--text3); text-decoration: none; transition: color 0.15s; }
        .op-breadcrumb a:hover { color: var(--text2); }
        .op-badge {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 5px 14px; border-radius: 999px;
          font-family: var(--font-ui); font-size: 0.7rem;
          font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;
          margin-bottom: 1.25rem;
        }
        .op-badge-dot { width: 6px; height: 6px; border-radius: 50%; animation: pulse-ring 2s ease infinite; }
        .op-title {
          font-family: var(--font-body);
          font-size: clamp(2.2rem, 5vw, 3.8rem);
          font-weight: 700; letter-spacing: -0.03em;
          color: var(--text); line-height: 1.08;
          margin-bottom: 0.75rem;
        }
        .op-sub {
          font-family: var(--font-ui);
          font-size: 1rem; color: var(--text2);
          max-width: 560px; line-height: 1.7; margin-bottom: 2rem;
        }
        .op-actions { display: flex; gap: 0.75rem; flex-wrap: wrap; }
        .op-btn-primary {
          display: inline-flex; align-items: center; gap: 8px;
          font-family: var(--font-ui); font-size: 0.88rem; font-weight: 600;
          padding: 11px 24px; border-radius: 999px;
          text-decoration: none; color: #fff;
          transition: transform 0.18s, box-shadow 0.18s;
        }
        .op-btn-primary:hover { transform: translateY(-2px); }
        .op-btn-secondary {
          display: inline-flex; align-items: center; gap: 8px;
          font-family: var(--font-ui); font-size: 0.88rem; font-weight: 500;
          padding: 11px 24px; border-radius: 999px;
          text-decoration: none; color: var(--text2);
          background: var(--glass-bg2); border: 1px solid var(--glass-border2);
          transition: background 0.18s, transform 0.18s;
        }
        .op-btn-secondary:hover { background: var(--bg3); transform: translateY(-2px); }

        /* stats */
        .op-stats {
          display: grid; grid-template-columns: repeat(4, 1fr);
          gap: 1px; background: var(--border);
          border: 1px solid var(--border); border-radius: 14px;
          overflow: hidden; margin: 2.5rem 0;
        }
        .op-stat {
          background: var(--bg2); padding: 1.25rem 1rem;
          text-align: center;
        }
        .op-stat-val {
          font-family: var(--font-body); font-size: 1.7rem;
          font-weight: 700; letter-spacing: -0.03em;
          line-height: 1; margin-bottom: 4px;
        }
        .op-stat-lbl {
          font-family: var(--font-ui); font-size: 0.75rem;
          color: var(--text3);
        }

        /* syllabus */
        .op-syllabus {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 1rem; margin-top: 2rem;
        }
        .op-paper {
          background: var(--bg2); border: 1px solid var(--border);
          border-radius: 14px; padding: 1.5rem;
        }
        .op-paper-label {
          font-family: var(--font-ui); font-size: 0.68rem;
          font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
          margin-bottom: 0.5rem;
        }
        .op-paper-text {
          font-family: var(--font-ui); font-size: 0.83rem;
          color: var(--text2); line-height: 1.65;
        }

        /* what's covered */
        .op-highlights {
          display: flex; flex-direction: column; gap: 0;
          border: 1px solid var(--border); border-radius: 14px;
          overflow: hidden; margin-top: 2rem;
        }
        .op-highlight-item {
          display: flex; align-items: flex-start; gap: 12px;
          padding: 0.9rem 1.25rem;
          border-bottom: 1px solid var(--border);
          background: var(--bg2);
          font-family: var(--font-ui); font-size: 0.84rem;
          color: var(--text2); line-height: 1.5;
        }
        .op-highlight-item:last-child { border-bottom: none; }
        .op-check { flex-shrink: 0; margin-top: 1px; }

        /* tools */
        .op-tools-grid {
          display: grid; grid-template-columns: repeat(3, 1fr);
          gap: 1rem; margin-top: 2rem;
        }
        .op-tool-card {
          background: var(--bg2); border: 1px solid var(--border);
          border-radius: 14px; padding: 1.5rem;
          text-decoration: none; display: block;
          transition: border-color 0.2s, transform 0.2s, background 0.2s;
          position: relative;
        }
        .op-tool-card:hover {
          transform: translateY(-3px);
          background: var(--bg3);
          border-color: var(--op-color, var(--border2));
        }
        .op-tool-icon {
          width: 44px; height: 44px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 1rem;
        }
        .op-tool-badge {
          position: absolute; top: 1rem; right: 1rem;
          font-family: var(--font-ui); font-size: 0.65rem;
          font-weight: 700; letter-spacing: 0.06em;
          padding: 2px 10px; border-radius: 999px;
        }
        .op-tool-label {
          font-family: var(--font-body); font-size: 0.95rem;
          font-weight: 700; color: var(--text); margin-bottom: 0.35rem;
        }
        .op-tool-desc {
          font-family: var(--font-ui); font-size: 0.8rem;
          color: var(--text3); line-height: 1.6;
        }

        /* section headers */
        .op-section { margin-top: 3.5rem; }
        .op-section-tag {
          font-family: var(--font-ui); font-size: 0.68rem;
          letter-spacing: 0.12em; text-transform: uppercase;
          margin-bottom: 0.4rem;
        }
        .op-section-title {
          font-family: var(--font-body);
          font-size: clamp(1.4rem, 2.5vw, 1.9rem);
          font-weight: 700; letter-spacing: -0.03em;
          color: var(--text); line-height: 1.15;
        }

        /* cta strip */
        .op-cta {
          margin-top: 3.5rem;
          padding: 3rem 2.5rem;
          border-radius: 20px;
          text-align: center; position: relative; overflow: hidden;
        }
        .op-cta-glow {
          position: absolute; width: 400px; height: 300px;
          border-radius: 50%;
          top: 50%; left: 50%; transform: translate(-50%,-50%);
          pointer-events: none; filter: blur(60px);
        }
        .op-cta-title {
          font-family: var(--font-body);
          font-size: clamp(1.4rem, 2.5vw, 2rem);
          font-weight: 700; letter-spacing: -0.03em;
          color: var(--text); margin-bottom: 0.6rem;
          position: relative; z-index: 1;
        }
        .op-cta-sub {
          font-family: var(--font-ui); font-size: 0.9rem;
          color: var(--text2); margin-bottom: 1.5rem;
          position: relative; z-index: 1;
        }

        @media (max-width: 900px) {
          .op-stats { grid-template-columns: repeat(2, 1fr); }
          .op-tools-grid { grid-template-columns: repeat(2, 1fr); }
          .op-syllabus { grid-template-columns: 1fr; }
        }
        @media (max-width: 580px) {
          .op-tools-grid { grid-template-columns: 1fr; }
          .op-stats { grid-template-columns: repeat(2, 1fr); }
          .op-cta { padding: 2rem 1.25rem; }
        }
      `}</style>

      <style>{`.op-tool-card:hover { border-color: ${opt.border} !important; }`}</style>
      <div className="op-wrap">
        {/* orbs */}
        <div className="op-orb1" style={{ background: `radial-gradient(circle, ${opt.glow} 0%, transparent 65%)` }} />
        <div className="op-orb2" style={{ background: `radial-gradient(circle, ${opt.dim} 0%, transparent 65%)` }} />

        <div className="op-inner">

          {/* ── Hero ── */}
          <div className="op-hero">
            <div className="op-breadcrumb">
              <Link href="/">Home</Link>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4.5 3l3 3-3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <Link href="/#optionals">Optionals</Link>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4.5 3l3 3-3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span style={{ color: 'var(--text2)' }}>{opt.name}</span>
            </div>

            <div className="op-badge" style={{ background: opt.dim, border: `1px solid ${opt.border}`, color: opt.color }}>
              <span className="op-badge-dot" style={{ background: opt.color }} />
              UPSC Mains · {opt.name} Optional
            </div>

            <h1 className="op-title">
              {opt.name}.<br />
              <span style={{ color: opt.color }}>Built to score.</span>
            </h1>
            <p className="op-sub">
              {opt.sub} — every topic, every thinker, every past question. AI-calibrated to the actual UPSC rubric.
            </p>

            <div className="op-actions">
              <Link
                href="/login"
                className="op-btn-primary"
                style={{ background: opt.color, boxShadow: `0 0 32px ${opt.glow}` }}
              >
                Start Preparing Free
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 7h10M7 2l5 5-5 5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Link>
              <Link href="/dashboard" className="op-btn-secondary">
                Go to Dashboard
              </Link>
            </div>
          </div>

          {/* ── Stats ── */}
          <div className="op-stats">
            {opt.stats.map((s) => (
              <div key={s.label} className="op-stat">
                <div className="op-stat-val" style={{ color: opt.color }}>{s.value}</div>
                <div className="op-stat-lbl">{s.label}</div>
              </div>
            ))}
          </div>

          {/* ── Syllabus ── */}
          <div className="op-section">
            <div className="op-section-tag" style={{ color: opt.color }}>Syllabus</div>
            <div className="op-section-title">What you&apos;ll cover</div>
            <div className="op-syllabus">
              <div className="op-paper">
                <div className="op-paper-label" style={{ color: opt.color }}>Paper I</div>
                <div className="op-paper-text">{opt.paper1}</div>
              </div>
              <div className="op-paper">
                <div className="op-paper-label" style={{ color: opt.color }}>Paper II</div>
                <div className="op-paper-text">{opt.paper2}</div>
              </div>
            </div>

            <div className="op-highlights">
              {opt.highlights.map((h) => (
                <div key={h} className="op-highlight-item">
                  <svg className="op-check" width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="8" fill={opt.color} fillOpacity="0.15"/>
                    <path d="M4.5 8l2.5 2.5 4.5-5" stroke={opt.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {h}
                </div>
              ))}
            </div>
          </div>

          {/* ── Tools ── */}
          <div className="op-section">
            <div className="op-section-tag" style={{ color: opt.color }}>Your Tools</div>
            <div className="op-section-title">Everything you need</div>
            <div className="op-tools-grid">
              {getTools(optional).map((tool) => (
                <Link key={tool.label} href={typeof tool.href === 'function' ? tool.href(optional) : tool.href} className="op-tool-card">
                  {tool.badge && (
                    <span
                      className="op-tool-badge"
                      style={{
                        background: tool.badge === 'Free' ? 'rgba(74,222,128,0.12)' : 'rgba(232,184,109,0.12)',
                        color: tool.badge === 'Free' ? '#4ade80' : '#e8b86d',
                        border: `1px solid ${tool.badge === 'Free' ? 'rgba(74,222,128,0.25)' : 'rgba(232,184,109,0.25)'}`,
                      }}
                    >
                      {tool.badge}
                    </span>
                  )}
                  <div className="op-tool-icon" style={{ background: `${opt.color}18` }}>
                    {tool.icon(opt.color)}
                  </div>
                  <div className="op-tool-label">{tool.label}</div>
                  <div className="op-tool-desc">{tool.desc}</div>
                </Link>
              ))}
            </div>
          </div>

          {/* ── CTA ── */}
          <div className="op-cta" style={{ background: opt.dim, border: `1px solid ${opt.border}` }}>
            <div className="op-cta-glow" style={{ background: opt.glow }} />
            <h2 className="op-cta-title">Ready to ace {opt.name}?</h2>
            <p className="op-cta-sub">
              Start free — no card needed. Upgrade when you&apos;re ready to go unlimited.
            </p>
            <Link
              href="/login"
              className="op-btn-primary"
              style={{ background: opt.color, boxShadow: `0 0 28px ${opt.glow}` }}
            >
              Start Preparing Free →
            </Link>
          </div>

        </div>
      </div>
    </>
  );
}
