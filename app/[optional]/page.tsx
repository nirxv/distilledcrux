import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';

const OPTIONALS: Record<string, {
  name: string; full: string; sub: string;
  color: string; dim: string; border: string; glow: string; icon: string;
  paper1: string; paper2: string;
  stats: { label: string; value: string }[];
  highlights: string[];
}> = {
  sociology: {
    name: 'Sociology', full: 'Sociology Optional', sub: 'Social Structure, Change & Thinkers',
    color: '#4361ee', dim: 'rgba(67,97,238,0.07)', border: 'rgba(67,97,238,0.22)', glow: 'rgba(67,97,238,0.15)', icon: '🧩',
    paper1: 'Sociological Theory, Research Methods, Social Stratification & Social Change',
    paper2: 'Indian Society, Social Issues, Movements & Contemporary Challenges',
    stats: [{ label: 'PYQs', value: '1500+' }, { label: 'Topics', value: '120+' }, { label: 'Thinkers', value: '60+' }, { label: 'Model Answers', value: '200+' }],
    highlights: ['Structural-functional, conflict and interpretive traditions', 'Thinkers: Marx, Weber, Durkheim, Parsons, Merton, Giddens', 'Indian society: caste, tribe, gender, village & agrarian systems', 'Social movements: peasant, women, environmental, Dalit', 'Contemporary India: globalisation, IT revolution, diaspora'],
  },
  anthropology: {
    name: 'Anthropology', full: 'Anthropology Optional', sub: 'Physical, Social & Applied Anthropology',
    color: '#2dd4bf', dim: 'rgba(45,212,191,0.07)', border: 'rgba(45,212,191,0.22)', glow: 'rgba(45,212,191,0.14)', icon: '🧬',
    paper1: 'Meaning, Scope & Development of Anthropology; Evolution; Genetics; Human Variation',
    paper2: 'Indian Anthropology, Tribal India, Applied Anthropology, Fossil Records',
    stats: [{ label: 'PYQs', value: '1200+' }, { label: 'Topics', value: '100+' }, { label: 'Fossil Records', value: '40+' }, { label: 'Model Answers', value: '180+' }],
    highlights: ['Biological & physical anthropology evolution, genetics, primatology', 'Archaeological anthropology fossil evidence, tools, culture', 'Social & cultural anthropology kinship, marriage, religion', 'Tribal India scheduled tribes, problems, development policy', 'Applied anthropology development, forensics, ethnobotany'],
  },
  polsci: {
    name: 'PSIR', full: 'PSIR Political Science & IR Optional', sub: 'IR, Comparative Politics & Indian Polity',
    color: '#f87171', dim: 'rgba(248,113,113,0.07)', border: 'rgba(248,113,113,0.2)', glow: 'rgba(248,113,113,0.13)', icon: '⚖️',
    paper1: 'Political Theory, Indian Government & Politics, Political Institutions',
    paper2: 'Comparative Politics & International Relations',
    stats: [{ label: 'PYQs', value: '1400+' }, { label: 'Topics', value: '110+' }, { label: 'Thinkers', value: '50+' }, { label: 'Model Answers', value: '190+' }],
    highlights: ['Political theory liberalism, Marxism, feminism, post-colonialism', 'Indian Constitution federalism, fundamental rights, DPSPs', 'Political institutions Parliament, executive, judiciary, election commission', 'Comparative politics presidential vs parliamentary, federalism globally', 'International relations realism, liberalism, constructivism, IR theory'],
  },
  geography: {
    name: 'Geography', full: 'Geography Optional', sub: 'Physical, Human & Economic Geography',
    color: '#4ade80', dim: 'rgba(74,222,128,0.07)', border: 'rgba(74,222,128,0.2)', glow: 'rgba(74,222,128,0.13)', icon: '🌍',
    paper1: 'Physical Geography Geomorphology, Climatology, Oceanography, Biogeography',
    paper2: 'Human & Economic Geography, Regional Planning, India-specific Geography',
    stats: [{ label: 'PYQs', value: '1300+' }, { label: 'Topics', value: '130+' }, { label: 'Diagrams', value: '80+' }, { label: 'Model Answers', value: '200+' }],
    highlights: ['Geomorphology plate tectonics, landforms, fluvial & aeolian processes', 'Climatology atmospheric circulation, monsoon, climate change', 'Oceanography currents, tides, marine resources', 'Human geography population, migration, settlement patterns', 'India geography agriculture, minerals, transport, regional development'],
  },
  'pub-admin': {
    name: 'Public Administration', full: 'Public Administration Optional', sub: 'Administrative Theory & Indian Administration',
    color: '#fb923c', dim: 'rgba(251,146,60,0.07)', border: 'rgba(251,146,60,0.2)', glow: 'rgba(251,146,60,0.13)', icon: '📋',
    paper1: 'Administrative Theory Organisation, Accountability, Comparative Admin',
    paper2: 'Indian Administration Union, State, District, Development Administration',
    stats: [{ label: 'PYQs', value: '1100+' }, { label: 'Topics', value: '90+' }, { label: 'Thinkers', value: '40+' }, { label: 'Model Answers', value: '160+' }],
    highlights: ["Administrative theory Weber's bureaucracy, Taylor, Fayol, Simon", 'Organisation theory classical, human relations, systems, contingency', 'Accountability parliamentary control, CAG, RTI, lokpal', 'Indian administration civil services, central secretariat, cabinet', 'Development administration planning, decentralisation, e-governance'],
  },
};

const BASE_TOOLS = [
  { num: '01', label: 'AI Answer Evaluation', desc: 'Upload handwritten answers get marks, section-wise feedback and a model answer calibrated to the UPSC rubric.', href: '/evaluate', badge: null },
  { num: '02', label: 'AI Chat', desc: 'Ask anything from your syllabus structured answers with thinkers, arguments and exam-ready language.', href: '/chat', badge: null },
  { num: '03', label: 'Syllabus Notes', desc: 'Every topic, every thinker, every debate structured for Mains. Written to be read before the exam.', href: (opt: string) => `/notes/${opt}`, badge: 'Free' },
  { num: '04', label: 'PYQ Bank', desc: '1500+ previous year questions, topic-wise, with model answers written the way toppers actually write them.', href: (opt: string) => "/" + opt + "/pyqs", badge: 'Free' },
];

const MAP_TOOL = { num: '06', label: 'Map Practice', desc: 'Every UPSC map question, interactive. Attempt, submit, get evaluated.', href: '/mapping', badge: null };
const TEST_SERIES_TOOL = { num: '06', label: 'Test Series', desc: 'Full-length and sectional tests calibrated to UPSC pattern. Track your score, identify weak areas.', href: '/test', badge: 'Premium' };

const getTools = (_optional: string) => [...BASE_TOOLS, TEST_SERIES_TOOL];

export function generateStaticParams() {
  return Object.keys(OPTIONALS).map((slug) => ({ optional: slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ optional: string }> }): Promise<Metadata> {
  const { optional } = await params;
  const opt = OPTIONALS[optional];
  if (!opt) return { title: 'Not Found' };
  return {
    title: `${opt.full} Distilled Crux`,
    description: `AI-powered preparation for UPSC ${opt.full}. Notes, PYQs, answer evaluation and AI chat for ${opt.name}.`,
    alternates: { canonical: `https://distilledcrux.com/${optional}` },
  };
}

const CSS = `
  .op-page { min-height: 100vh; }

  /* ── Hero ── */
  .op-hero {
    max-width: 1200px; margin: 0 auto;
    padding: 120px 2rem 60px;
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 4rem; align-items: end;
    border-bottom: 1px solid var(--border);
  }
  .op-breadcrumb {
    display: flex; align-items: center; gap: 6px;
    font-family: var(--font-ui); font-size: 0.72rem; color: var(--text3);
    margin-bottom: 2rem;
  }
  .op-breadcrumb a { color: var(--text3); text-decoration: none; transition: color 0.15s; }
  .op-breadcrumb a:hover { color: var(--text); }
  .op-kicker {
    font-family: var(--font-ui); font-size: 0.68rem;
    letter-spacing: 0.18em; text-transform: uppercase; color: var(--text3);
    margin-bottom: 1.5rem; display: flex; align-items: center; gap: 12px;
  }  .op-h1 {
    font-family: var(--font-body);
    font-size: clamp(2.8rem, 6vw, 4.8rem);
    font-weight: 700; line-height: 1.02;
    letter-spacing: -0.035em; color: var(--text);
  }
  .op-h1 em { font-style: italic; }
  .op-right-desc {
    font-family: var(--font-ui); font-size: 1rem;
    color: var(--text2); line-height: 1.8; margin-bottom: 2.5rem; max-width: 380px;
  }
  .op-actions { display: flex; align-items: center; gap: 1.25rem; flex-wrap: wrap; }
  .op-btn-primary {
    font-family: var(--font-ui); font-size: 0.88rem; font-weight: 600;
    background: var(--text); color: var(--bg);
    padding: 12px 28px; border-radius: 6px;
    text-decoration: none; transition: opacity 0.15s;
  }
  .op-btn-primary:hover { opacity: 0.85; }
  .op-btn-secondary {
    font-family: var(--font-ui); font-size: 0.88rem; color: var(--text3);
    text-decoration: none; display: flex; align-items: center; gap: 6px; transition: color 0.15s;
  }
  .op-btn-secondary:hover { color: var(--text); }
  .op-stat-row {
    display: flex; gap: 2.5rem;
    margin-top: 3rem; padding-top: 2rem;
    border-top: 1px solid var(--border);
  }
  .op-stat-val {
    font-family: var(--font-body); font-size: 1.75rem; font-weight: 700;
    letter-spacing: -0.03em; line-height: 1; margin-bottom: 4px;
  }
  .op-stat-label {
    font-family: var(--font-ui); font-size: 0.72rem;
    color: var(--text3); letter-spacing: 0.04em; text-transform: uppercase;
  }

  /* ── Section wrapper ── */
  .op-section {
    max-width: 1200px; margin: 0 auto;
    padding: 4.5rem 2rem;
    border-bottom: 1px solid var(--border);
  }
  .op-section-header {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 2rem; align-items: start; margin-bottom: 3rem;
  }
  .op-section-label {
    font-family: var(--font-ui); font-size: 0.65rem;
    letter-spacing: 0.18em; text-transform: uppercase; color: var(--text3);
    margin-bottom: 1rem; display: flex; align-items: center; gap: 10px;
  }  .op-section-h2 {
    font-family: var(--font-body); font-size: clamp(1.7rem, 2.8vw, 2.4rem);
    font-weight: 700; letter-spacing: -0.03em; color: var(--text); line-height: 1.1;
  }
  .op-section-h2 em { font-style: italic; }
  .op-section-desc { font-family: var(--font-ui); font-size: 0.92rem; color: var(--text2); line-height: 1.8; padding-top: 0.5rem; }

  /* ── Syllabus ── */
  .op-syllabus-grid {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 1px; background: var(--border);
    border: 1px solid var(--border); border-radius: 12px; overflow: hidden;
    margin-bottom: 1px;
  }
  .op-paper-cell { background: var(--bg); padding: 2rem; }
  .op-paper-label {
    font-family: var(--font-ui); font-size: 0.65rem;
    letter-spacing: 0.14em; text-transform: uppercase; margin-bottom: 0.75rem;
  }
  .op-paper-text { font-family: var(--font-ui); font-size: 0.88rem; color: var(--text2); line-height: 1.7; }
  .op-highlights {
    display: flex; flex-direction: column;
    border: 1px solid var(--border); border-radius: 12px; overflow: hidden;
  }
  .op-highlight-row {
    display: flex; align-items: flex-start; gap: 1.25rem;
    padding: 1rem 1.5rem; border-bottom: 1px solid var(--border);
    background: var(--bg); transition: background 0.15s;
  }
  .op-highlight-row:last-child { border-bottom: none; }
  .op-highlight-row:hover { background: var(--bg2); }
  .op-highlight-num {
    font-family: var(--font-mono); font-size: 0.62rem;
    color: var(--text3); letter-spacing: 0.06em;
    padding-top: 3px; flex-shrink: 0; width: 20px;
  }
  .op-highlight-text { font-family: var(--font-ui); font-size: 0.84rem; color: var(--text2); line-height: 1.6; }

  /* ── Tools ── */
  .op-tools-list {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 1px; background: var(--border);
    border: 1px solid var(--border); border-radius: 12px; overflow: hidden;
  }
  .op-tool-row {
    background: var(--bg); padding: 1.75rem 2rem;
    display: flex; align-items: flex-start; gap: 1.5rem;
    text-decoration: none; transition: background 0.18s; position: relative;
  }
  .op-tool-row:hover { background: var(--bg2); }
  .op-tool-num {
    font-family: var(--font-mono); font-size: 0.65rem;
    color: var(--text3); letter-spacing: 0.06em;
    padding-top: 4px; flex-shrink: 0; width: 24px;
  }
  .op-tool-label {
    font-family: var(--font-body); font-size: 0.95rem;
    font-weight: 700; color: var(--text); margin-bottom: 0.35rem; letter-spacing: -0.01em;
  }
  .op-tool-desc { font-family: var(--font-ui); font-size: 0.8rem; color: var(--text3); line-height: 1.65; }
  .op-tool-badge {
    position: absolute; top: 1.75rem; right: 2rem;
    font-family: var(--font-ui); font-size: 0.6rem; font-weight: 700;
    letter-spacing: 0.08em; text-transform: uppercase;
    padding: 2px 9px; border-radius: 4px;
  }
  .op-tool-badge.free { background: rgba(74,222,128,0.1); color: #4ade80; border: 1px solid rgba(74,222,128,0.22); }
  .op-tool-badge.premium { background: rgba(232,184,109,0.1); color: #e8b86d; border: 1px solid rgba(232,184,109,0.22); }

  /* ── CTA ── */
  .op-cta {
    max-width: 1200px; margin: 0 auto; padding: 5rem 2rem 6rem;
    display: grid; grid-template-columns: 1fr auto;
    align-items: center; gap: 3rem;
  }
  .op-cta-h2 {
    font-family: var(--font-body);
    font-size: clamp(1.8rem, 3.5vw, 2.8rem);
    font-weight: 700; letter-spacing: -0.03em; color: var(--text); line-height: 1.1;
  }
  .op-cta-h2 em { font-style: italic; }
  .op-cta-sub { font-family: var(--font-ui); font-size: 0.88rem; color: var(--text3); margin-top: 0.75rem; }
  .op-cta-right { display: flex; flex-direction: column; gap: 0.75rem; align-items: flex-start; flex-shrink: 0; }

  @media (max-width: 900px) {
    .op-hero { grid-template-columns: 1fr; gap: 2rem; padding-top: 100px; }
    .op-right-desc { max-width: 100%; }
    .op-section-header { grid-template-columns: 1fr; gap: 1rem; margin-bottom: 2rem; }
    .op-syllabus-grid { grid-template-columns: 1fr; }
    .op-tools-list { grid-template-columns: 1fr; }
    .op-cta { grid-template-columns: 1fr; }
    .op-cta-right { flex-direction: row; flex-wrap: wrap; }
  }
  @media (max-width: 640px) {
    .op-hero { padding:88px 1.25rem 2.5rem; gap:1.5rem; }
    .op-h1 { font-size:clamp(2.4rem,11vw,3.2rem); }
    .op-kicker { font-size:0.62rem; letter-spacing:0.14em; }
    .op-breadcrumb { font-size:0.68rem; margin-bottom:1.5rem; }
    .op-right-desc { font-size:0.88rem; line-height:1.75; margin-bottom:2rem; }
    .op-actions { gap:0.85rem; }
    .op-btn-primary { padding:11px 22px; font-size:0.85rem; }
    .op-stat-row { gap:1.75rem; margin-top:2rem; padding-top:1.5rem; }
    .op-stat-val { font-size:1.5rem; }
    .op-stat-label { font-size:0.68rem; }

    .op-section { padding:2.5rem 1.25rem; }
    .op-section-label { font-size:0.6rem; }
    .op-section-h2 { font-size:clamp(1.4rem,7vw,2rem); }
    .op-section-desc { font-size:0.85rem; }

    .op-paper-cell { padding:1.25rem; }
    .op-paper-text { font-size:0.82rem; }
    .op-highlight-row { padding:0.85rem 1.25rem; gap:1rem; }
    .op-highlight-text { font-size:0.8rem; }

    .op-tool-row { padding:1.25rem; gap:1rem; }
    .op-tool-label { font-size:0.88rem; }
    .op-tool-desc { font-size:0.76rem; }
    .op-tool-badge { top:1.25rem; right:1.25rem; }

    .op-cta { padding:2.5rem 1.25rem 3.5rem; gap:1.5rem; }
    .op-cta-h2 { font-size:clamp(1.5rem,8vw,2.2rem); }
    .op-cta-sub { font-size:0.82rem; }
    .op-cta-right { flex-direction:column; width:100%; gap:0.65rem; }
    .op-btn-primary { text-align:center; display:block; }
  }
`;

export default async function OptionalPage({ params }: { params: Promise<{ optional: string }> }) {
  const { optional } = await params;
  const opt = OPTIONALS[optional];
  if (!opt) notFound();
  const tools = getTools(optional);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="op-page">

        {/* ── Hero ── */}
        <div className="op-hero">
          <div>
            <div className="op-breadcrumb">
              <Link href="/">Home</Link>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4.5 3l3 3-3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <Link href="/#optionals">Optionals</Link>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4.5 3l3 3-3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span>{opt.name}</span>
            </div>
            <div className="op-kicker">UPSC Mains · {opt.name} Optional</div>
            <h1 className="op-h1">
              {opt.name}.<br />
              <em style={{ color: opt.color }}>Built to score.</em>
            </h1>
          </div>

          <div>
            <p className="op-right-desc">
              {opt.sub} every topic, every thinker, every past question.
              AI-calibrated to the actual UPSC rubric.
            </p>
            <div className="op-actions">
              <Link href="/login" className="op-btn-primary">Start free →</Link>
              <Link href="/dashboard" className="op-btn-secondary">
                Go to Dashboard
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M2 6.5h9M6.5 2l4.5 4.5-4.5 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Link>
            </div>
            <div className="op-stat-row">
              {opt.stats.map((s) => (
                <div key={s.label}>
                  <div className="op-stat-val" style={{ color: opt.color }}>{s.value}</div>
                  <div className="op-stat-label">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Syllabus ── */}
        <div className="op-section">
          <div className="op-section-header">
            <div>
              <div className="op-section-label">Syllabus</div>
              <h2 className="op-section-h2">What you&apos;ll<br /><em style={{ color: opt.color }}>cover.</em></h2>
            </div>
            <p className="op-section-desc">
              Two papers, fully mapped. Every topic on the UPSC syllabus notes and PYQs organised exactly the way the paper is structured.
            </p>
          </div>

          <div className="op-syllabus-grid">
            <div className="op-paper-cell">
              <div className="op-paper-label" style={{ color: opt.color }}>Paper I</div>
              <div className="op-paper-text">{opt.paper1}</div>
            </div>
            <div className="op-paper-cell">
              <div className="op-paper-label" style={{ color: opt.color }}>Paper II</div>
              <div className="op-paper-text">{opt.paper2}</div>
            </div>
          </div>

          <div className="op-highlights" style={{ marginTop: '1px' }}>
            {opt.highlights.map((h, i) => (
              <div key={h} className="op-highlight-row">
                <span className="op-highlight-num">0{i + 1}</span>
                <span className="op-highlight-text">{h}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tools ── */}
        <div className="op-section">
          <div className="op-section-header">
            <div>
              <div className="op-section-label">Your Tools</div>
              <h2 className="op-section-h2">Everything<br /><em style={{ color: opt.color }}>you need.</em></h2>
            </div>
            <p className="op-section-desc">
              Six tools, one goal more marks in your {opt.name} paper. Each one built specifically for how UPSC actually tests this subject.
            </p>
          </div>

          <div className="op-tools-list">
            {tools.map((tool) => (
              <Link
                key={tool.label}
                href={typeof tool.href === 'function' ? tool.href(optional) : tool.href}
                className="op-tool-row"
              >
                <span className="op-tool-num">{tool.num}</span>
                <div>
                  <div className="op-tool-label">{tool.label}</div>
                  <div className="op-tool-desc">{tool.desc}</div>
                </div>
                {tool.badge && (
                  <span className={"op-tool-badge " + (tool.badge === 'Free' ? 'free' : 'premium')}>
                    {tool.badge}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>

        {/* ── CTA ── */}
        <div className="op-cta">
          <div>
            <h2 className="op-cta-h2">
              Ready to ace<br /><em style={{ color: opt.color }}>{opt.name}?</em>
            </h2>
            <p className="op-cta-sub">Start free no card needed. Upgrade when you&apos;re ready to go unlimited.</p>
          </div>
          <div className="op-cta-right">
            <Link href="/login" className="op-btn-primary">Start Preparing Free →</Link>
            <Link href="/dashboard" className="op-btn-secondary">
              Go to Dashboard
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M2 6.5h9M6.5 2l4.5 4.5-4.5 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
          </div>
        </div>

      </div>
    </>
  );
}
