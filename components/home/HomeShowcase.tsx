'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { useOptional } from '@/components/useOptional';
import { routeSlugForOptional } from '@/lib/optionals';

/**
 * The tools, one at a time: a row of tabs and one large panel that says what
 * the tool does and shows it, the way Linear and Notion present a product.
 * Five cards side by side gave the eye nowhere to land. The previews are drawn
 * in HTML with real content (the PYQs are real questions from the bank), so
 * they stay sharp and cost no images.
 */

const Book = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 19.5V5a2 2 0 0 1 2-2h13v16H6.5A2.5 2.5 0 0 0 4 21.5" /><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H19" /></svg>
);
const Tick = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);
const Plus = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
);
const Arrow = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="sw" aria-hidden="true">
      <div className="sw-bar"><i /><i /><i /><span>{title}</span></div>
      <div className="sw-body">{children}</div>
    </div>
  );
}

function ChatPreview() {
  return (
    <Frame title="AI Chat · Sociology">
      <div className="sw-ask">What did Durkheim mean by anomie?</div>
      <div className="sw-trace">Researched 6s ›</div>
      <p className="sw-p"><b>Anomie</b> is normlessness: when society changes faster than its rules, people lose the norms that guide them <span className="sw-cite"><Book />Haralambos</span></p>
      <p className="sw-p">Durkheim ties it to a rise in <b>anomic suicide</b> in economic booms and slumps alike <span className="sw-cite"><Book />Ritzer</span></p>
      <div className="sw-sources">
        <span className="sw-sources-n">6 book passages</span>
        <span className="sw-sources-from">from Haralambos, Ritzer and IGNOU Sociology</span>
      </div>
      <div className="sw-compose"><span>Ask a follow-up…</span><i>↑</i></div>
    </Frame>
  );
}

function EvalPreview() {
  const r = 30, c = 2 * Math.PI * r;
  return (
    <Frame title="Evaluation · 15 marks">
      <div className="sw-score">
        <svg width="78" height="78" viewBox="0 0 78 78">
          <circle cx="39" cy="39" r={r} fill="none" stroke="var(--sw-track)" strokeWidth="7" />
          <circle cx="39" cy="39" r={r} fill="none" stroke="var(--success-text)" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${c * (11 / 15)} ${c}`} transform="rotate(-90 39 39)" />
        </svg>
        <div><strong>11<small>/15</small></strong><span>A good answer</span></div>
      </div>
      <div className="sw-bars">
        <div><em>Structure</em><i style={{ width: '82%' }} /></div>
        <div><em>Content</em><i style={{ width: '74%' }} /></div>
        <div><em>Examples</em><i style={{ width: '52%' }} /></div>
      </div>
      <div className="sw-fb ok"><Tick />Clear introduction and conclusion</div>
      <div className="sw-fb ok"><Tick />Uses Merton&apos;s strain theory well</div>
      <div className="sw-fb add"><Plus />Add an Indian example to the body</div>
    </Frame>
  );
}

function NotesPreview() {
  return (
    <Frame title="Notes · Geography">
      <div className="sw-crumb">Paper I · Geomorphology</div>
      <div className="sw-h">Plate Tectonics</div>
      <p className="sw-p">The lithosphere is broken into <mark>rigid plates</mark> that move over the asthenosphere. Where plates meet, mountains, ocean trenches and earthquakes follow.</p>
      <div className="sw-sub">Plate boundaries</div>
      <ul className="sw-list">
        <li><b>Divergent:</b> plates move apart and new crust forms, as at mid-ocean ridges.</li>
        <li><b>Convergent:</b> one plate sinks beneath another, building trenches and fold mountains.</li>
        <li><b>Transform:</b> plates slide past each other, as along the San Andreas fault.</li>
      </ul>
      <div className="sw-terms"><span>Sea-floor spreading</span><span>Subduction</span><span>Isostasy</span></div>
    </Frame>
  );
}

function PyqPreview() {
  const rows = [
    { year: 2024, marks: 20, q: 'Riggs’ Prismatic Model has been criticised as overly gloomy and technical complex, but it remains as a useful starting point…' },
    { year: 2021, marks: 15, q: 'In modern context, Riggsian terms have not altogether disappeared, but have emerged in different forms with newer meanings…' },
    { year: 2017, marks: 10, q: '“Development Administration and Administrative Development have a chicken and egg kind of relationship” — (Riggs). Elaborate.' },
  ];
  return (
    <Frame title="PYQs · Public Administration">
      <div className="sw-filters"><span>Paper I</span><span className="on">Riggs</span><span>All marks</span></div>
      {rows.map((r) => (
        <div key={r.year} className="sw-pyq">
          <div className="sw-pyq-meta"><b>{r.year}</b> · {r.marks} marks</div>
          <div className="sw-pyq-q">{r.q}</div>
        </div>
      ))}
    </Frame>
  );
}

function TestPreview() {
  return (
    <Frame title="Test · Sociology">
      <div className="sw-progress"><span>Question 4 of 10</span><span className="sw-streak">3 in a row</span></div>
      <div className="sw-track"><i style={{ width: '40%' }} /></div>
      <div className="sw-h sw-q">Who gave us the term Sanskritisation?</div>
      <div className="sw-opt"><i />G.S. Ghurye</div>
      <div className="sw-opt right"><i><Tick size={10} /></i>M.N. Srinivas</div>
      <div className="sw-opt"><i />S.C. Dube</div>
      <div className="sw-explain">Srinivas introduced it in his study of the Coorgs (1952).</div>
    </Frame>
  );
}

type Tab = {
  key: string; tab: string; title: string; text: string; points: string[];
  cta: string; href: string; wash: string; preview: React.ReactNode;
};

export default function HomeShowcase() {
  const slug = routeSlugForOptional(useOptional());
  const [active, setActive] = useState(0);
  const tabsRef = useRef<HTMLDivElement>(null);

  const tabs: Tab[] = [
    {
      key: 'chat', tab: 'AI Chat', title: 'Stuck on a concept at 11pm? Ask.',
      text: 'It answers from the standard books for your optional, and puts a small chip next to every line it took from one, so you can open the page and check.',
      points: ['You can watch it look things up as it goes', 'Ask for a proper Mains answer when you want one', 'Mentor mode, for when you want to be marked hard'],
      cta: 'Open AI Chat', href: '/chat', wash: 'var(--accent-wash)', preview: <ChatPreview />,
    },
    {
      key: 'eval', tab: 'Evaluation', title: 'Write the way you would in the exam hall.',
      text: 'Take a photo of your answer sheet and upload it. You will see the marks, what an examiner would have wanted more of, and a model answer for the same question.',
      points: ['Feedback on each part of the answer', 'A model answer to set beside yours', 'Your handwriting is fine; it reads it'],
      cta: 'Evaluate an answer', href: '/evaluate', wash: 'var(--success-wash)', preview: <EvalPreview />,
    },
    {
      key: 'notes', tab: 'Notes', title: 'Notes you can finish the night before.',
      text: 'Every topic in both papers, cut down to what an answer actually uses: the thinkers, the debates and the examples.',
      points: ['Free to read, no sign-up needed', 'Laid out the way the syllabus is', 'Ask the AI about anything you are reading'],
      cta: 'Read the notes', href: slug ? `/notes/${slug}` : '/notes', wash: 'var(--wash-anthropology)', preview: <NotesPreview />,
    },
    {
      key: 'pyq', tab: 'PYQs', title: 'See what UPSC keeps asking.',
      text: 'Every past question for your optional, sorted by topic. Pick one, see how a good answer goes, then write your own.',
      points: ['Filter by year, paper and marks', 'Model answers when you want one', 'Free to browse'],
      cta: 'Browse PYQs', href: slug ? `/${slug}/pyqs` : '#optionals', wash: 'var(--warning-wash)', preview: <PyqPreview />,
    },
    {
      key: 'test', tab: 'Tests', title: 'Find out what actually stayed with you.',
      text: 'Short tests on one topic at a time. You will know straight away whether you were right, and why.',
      points: ['One topic at a time', 'The answer explained as you go', 'Your scores, kept for you'],
      cta: 'Take a test', href: '/test', wash: 'var(--wash-sociology)', preview: <TestPreview />,
    },
  ];

  const t = tabs[active];

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = (active + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
    setActive(next);
    tabsRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  };

  return (
    <div className="sc">
      <style dangerouslySetInnerHTML={{ __html: SC_CSS }} />
      <div className="sc-tabs" role="tablist" aria-label="What is inside" ref={tabsRef} onKeyDown={onKey}>
        {tabs.map((x, i) => (
          <button
            key={x.key}
            role="tab"
            id={`sc-tab-${x.key}`}
            aria-selected={i === active}
            aria-controls="sc-panel"
            tabIndex={i === active ? 0 : -1}
            className={`sc-tab${i === active ? ' on' : ''}`}
            onClick={() => setActive(i)}
          >
            {x.tab}
          </button>
        ))}
      </div>

      <div className="sc-panel" id="sc-panel" role="tabpanel" aria-labelledby={`sc-tab-${t.key}`} style={{ ['--sc-wash' as string]: t.wash }}>
        <div className="sc-copy" key={`copy-${t.key}`}>
          <h3 className="sc-title">{t.title}</h3>
          <p className="sc-text">{t.text}</p>
          <ul className="sc-points">
            {t.points.map((p) => <li key={p}>{p}</li>)}
          </ul>
          <Link href={t.href} className="ds-btn ds-btn-solid">{t.cta}<Arrow /></Link>
        </div>
        <div className="sc-shot" key={`shot-${t.key}`}>{t.preview}</div>
      </div>
    </div>
  );
}

const SC_CSS = `
.sc { --sw-bg: #111114; --sw-line: rgba(255,255,255,0.08); --sw-track: rgba(255,255,255,0.1); }
[data-theme="light"] .sc { --sw-bg: #ffffff; --sw-line: rgba(0,0,0,0.07); --sw-track: rgba(0,0,0,0.07); }

/* Tabs: one pill track, the chosen one raised. */
.sc-tabs {
  display: flex; gap: 4px; width: max-content; max-width: 100%; margin: 0 auto var(--space-6);
  padding: 4px; border-radius: var(--radius-full); background: var(--ds-soft); border: 1px solid var(--border);
  overflow-x: auto; scrollbar-width: none;
}
.sc-tabs::-webkit-scrollbar { display: none; }
.sc-tab {
  flex-shrink: 0; padding: 9px 18px; border: none; border-radius: var(--radius-full); background: none;
  color: var(--text2); font-size: 0.94rem; font-weight: 600; cursor: pointer; white-space: nowrap;
  transition: background 0.18s, color 0.18s, box-shadow 0.18s;
}
.sc-tab:hover { color: var(--text); }
.sc-tab.on { background: var(--ds-card); color: var(--text); box-shadow: var(--elev-1); }
.sc-tab:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

/* The panel: words on the left, the tool on the right, rising off the bottom edge. */
.sc-panel {
  display: grid; grid-template-columns: 5fr 7fr; gap: var(--space-8); align-items: center;
  min-height: 460px; padding: var(--space-10) 0 0 var(--space-10); overflow: hidden;
  border-radius: 28px; border: 1px solid var(--border);
  background: color-mix(in srgb, var(--sc-wash) 55%, var(--ds-soft));
  transition: background 0.3s ease;
}
.sc-copy { display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-4); padding-bottom: var(--space-10); animation: scIn 0.32s ease both; }
.sc-title { font-weight: 800; font-size: clamp(1.4rem, 2.4vw, 1.9rem); line-height: 1.2; letter-spacing: -0.025em; color: var(--text); }
.sc-text { font-size: 1.02rem; line-height: 1.65; color: var(--text2); }
.sc-points { list-style: none; display: flex; flex-direction: column; gap: var(--space-2); margin-bottom: var(--space-2); }
.sc-points li { position: relative; padding-left: var(--space-4); font-size: 0.95rem; color: var(--text2); }
.sc-points li::before { content: ''; position: absolute; left: 2px; top: 0.62em; width: 5px; height: 5px; border-radius: 50%; background: color-mix(in srgb, var(--text) 35%, transparent); }
.sc-shot { align-self: end; padding-left: var(--space-2); animation: scUp 0.4s cubic-bezier(0.22, 1, 0.36, 1) both; }
@keyframes scIn { from { opacity: 0; transform: translateY(6px); } }
@keyframes scUp { from { opacity: 0; transform: translateY(18px); } }

/* The preview window */
.sw {
  margin-right: -2px; height: 390px; overflow: hidden;
  background: var(--sw-bg); color: var(--text);
  border: 1px solid var(--border); border-bottom: none; border-right: none;
  border-radius: 16px 0 0 0; box-shadow: var(--elev-3);
  font-family: var(--font-ui); font-size: 13.5px; line-height: 1.55;
}
.sw-bar { display: flex; align-items: center; gap: 6px; height: 40px; padding: 0 16px; border-bottom: 1px solid var(--sw-line); font-size: 12px; font-weight: 600; color: var(--text3); }
.sw-bar i { width: 10px; height: 10px; border-radius: 50%; background: var(--sw-line); border: 1px solid var(--border2); }
.sw-bar span { margin-left: 8px; }
.sw-body { display: flex; flex-direction: column; gap: 12px; padding: 20px 22px; }
.sw-ask { align-self: flex-end; max-width: 75%; padding: 9px 13px; border-radius: 14px 14px 4px 14px; background: var(--accent-wash); border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent); font-weight: 500; }
.sw-trace { font-size: 12px; color: var(--text3); }
.sw-p { margin: 0; color: var(--text); }
.sw-p b { font-weight: 700; }
.sw-p mark { background: color-mix(in srgb, #f2c94c 45%, transparent); color: inherit; padding: 0 3px; border-radius: 3px; }
.sw-dim { color: var(--text2); }
.sw-cite { display: inline-flex; align-items: center; gap: 4px; margin-left: 4px; padding: 1px 8px; vertical-align: 1px; border: 1px solid var(--sw-line); border-radius: 6px; background: var(--bg-sunken); font-family: var(--font-mono); font-size: 11px; color: var(--text2); white-space: nowrap; }
.sw-sources { display: flex; flex-direction: column; gap: 2px; padding: 12px 14px; border: 1px solid var(--sw-line); border-radius: 12px; background: var(--ds-soft); }
.sw-sources-n { font-weight: 700; }
.sw-sources-from { font-size: 12.5px; color: var(--text2); }
.sw-score { display: flex; align-items: center; gap: 16px; }
.sw-score div { display: flex; flex-direction: column; }
.sw-score strong { font-size: 32px; font-weight: 800; letter-spacing: -0.03em; line-height: 1.05; }
.sw-score small { font-size: 16px; font-weight: 600; color: var(--text3); }
.sw-score span { font-size: 13px; font-weight: 600; color: var(--success-text); }
.sw-bars { display: flex; flex-direction: column; gap: 8px; margin: 4px 0; }
.sw-bars div { display: grid; grid-template-columns: 76px 1fr; align-items: center; gap: 10px; }
.sw-bars em { font-style: normal; font-size: 12.5px; color: var(--text3); }
.sw-bars i { display: block; height: 7px; border-radius: 4px; background: var(--accent); }
.sw-fb { display: flex; align-items: center; gap: 8px; }
.sw-fb.ok { color: var(--success-text); }
.sw-fb.add { color: var(--warning-text); }
.sw-crumb { font-size: 12px; color: var(--text3); }
.sw-h { font-weight: 800; font-size: 20px; letter-spacing: -0.02em; line-height: 1.25; margin-top: -4px; }
.sw-terms { display: flex; flex-wrap: wrap; gap: 6px; }
.sw-terms span { padding: 3px 10px; border-radius: 999px; border: 1px solid var(--sw-line); background: var(--bg-sunken); font-size: 12px; color: var(--text2); }
.sw-filters { display: flex; gap: 6px; }
.sw-filters span { padding: 4px 12px; border-radius: 999px; border: 1px solid var(--sw-line); font-size: 12px; color: var(--text2); }
.sw-filters span.on { background: var(--accent); border-color: var(--accent); color: var(--accent-on); font-weight: 600; }
.sw-pyq { display: flex; flex-direction: column; gap: 3px; padding: 12px 14px; border: 1px solid var(--sw-line); border-radius: 12px; }
.sw-pyq-meta { font-size: 12px; color: var(--text3); }
.sw-pyq-meta b { color: var(--accent-text); }
.sw-pyq-q { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.sw-progress { display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: var(--text3); }
.sw-streak { padding: 2px 10px; border-radius: 999px; background: var(--warning-wash); color: var(--warning-text); font-weight: 700; }
.sw-track { height: 6px; border-radius: 3px; background: var(--sw-track); overflow: hidden; margin-top: -4px; }
.sw-track i { display: block; height: 100%; border-radius: 3px; background: var(--accent); }
.sw-q { font-size: 18px; margin-top: 2px; }
.sw-opt { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border: 1px solid var(--sw-line); border-radius: 12px; }
.sw-opt i { width: 16px; height: 16px; flex-shrink: 0; border-radius: 50%; border: 1.5px solid var(--border3); display: inline-flex; align-items: center; justify-content: center; }
.sw-opt.right { border-color: color-mix(in srgb, var(--success-text) 50%, transparent); background: var(--success-wash); color: var(--success-text); font-weight: 600; }
.sw-opt.right i { background: var(--success-text); border-color: var(--success-text); color: var(--sw-bg); }
.sw-explain { font-size: 12.5px; color: var(--text2); }
.sw-compose { display: flex; align-items: center; justify-content: space-between; margin-top: 2px; padding: 8px 8px 8px 14px; border: 1.5px solid var(--border2); border-radius: 14px; color: var(--text3); }
.sw-compose i { width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; border-radius: 9px; border: 1px solid var(--border2); font-style: normal; font-size: 13px; }
.sw-sub { font-weight: 700; font-size: 14px; margin-top: 2px; }
.sw-list { margin: -4px 0 0; padding-left: 18px; display: flex; flex-direction: column; gap: 4px; color: var(--text); }
.sw-list b { font-weight: 700; }

@media (max-width: 960px) {
  .sc-panel { grid-template-columns: 1fr; gap: var(--space-6); min-height: 0; padding: var(--space-8) 0 0 var(--space-6); }
  .sc-copy { padding: 0 var(--space-6) 0 0; }
  .sw { height: 360px; }
}
@media (max-width: 640px) {
  .sc-tabs { width: auto; margin-left: calc(-1 * var(--space-4)); margin-right: calc(-1 * var(--space-4)); border-radius: 0; border-left: none; border-right: none; background: none; border: none; padding: 0 var(--space-4); }
  .sc-tab { background: var(--ds-soft); border: 1px solid var(--border); }
  .sc-tab.on { background: var(--text); color: var(--bg); border-color: var(--text); box-shadow: none; }
  .sc-panel { border-radius: 22px; padding: var(--space-6) 0 0 var(--space-5); }
  .sc-copy { padding-right: var(--space-5); gap: var(--space-3); }
  .sc-copy .ds-btn { width: calc(100% - 0px); }
  .sw { height: 320px; font-size: 13px; }
  .sw-body { padding: 16px 16px; gap: 10px; }
}
@media (prefers-reduced-motion: reduce) { .sc-copy, .sc-shot { animation: none; } }
`;
