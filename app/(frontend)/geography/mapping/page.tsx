'use client';
import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { geoMapData, geoMapYears, GEO_CATEGORIES, GeoCategory, GeoMapEntry } from '@/lib/geoMapData';
import OwlLoader from '@/components/OwlLoader';

const GeoMappingMap = dynamic(() => import('@/components/GeoMappingMap'), {
  ssr: false,
  loading: () => <div className="mp-map-wait"><OwlLoader size="small" label="Loading the map" /></div>,
});

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function pickRandom(entries: GeoMapEntry[]): GeoMapEntry { return entries[Math.floor(Math.random() * entries.length)]; }

/**
 * A place to identify and four names to choose from. The marked place and
 * the options used to come from two separate random picks on the first
 * question, so the right answer could be missing; and a place asked in two
 * years could appear twice among the options.
 */
function newRound(pool: GeoMapEntry[], after?: string) {
  const site = pickRandom(after ? pool.filter(e => e.name !== after) : pool);
  const others: GeoMapEntry[] = [];
  const seen = new Set([site.name]);
  for (const e of shuffle(pool)) {
    if (seen.has(e.name)) continue;
    seen.add(e.name); others.push(e);
    if (others.length === 3) break;
  }
  return { site, options: shuffle([site, ...others]) };
}

/**
 * The significance without the words that give the answer away. Each one
 * opens with the kind of place ("River in Odisha…", "National Park near
 * Srinagar…"), which the quiz used to hide by dropping the first word, and
 * left clues reading "Park near Srinagar". Starting from the first place
 * word instead reads as a sentence; the name itself is masked too.
 */
function clueFor(entry: GeoMapEntry): string {
  const words = entry.significance.split(' ');
  const at = words.findIndex((w, i) => i < 6 && /^(in|near|on|at|along|between|off|across|from)$/i.test(w));
  const text = at > 0 ? `Somewhere ${words.slice(at).join(' ')}` : words.slice(1).join(' ');
  const name = entry.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(name, 'gi'), 'this place');
}

function QuizPanel({ pool }: { pool: GeoMapEntry[] }) {
  const [round, setRound] = useState(() => newRound(pool));
  const [chosen, setChosen] = useState<string | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [streak, setStreak] = useState(0);
  const [hideClue, setHideClue] = useState(false);
  const { site, options } = round;

  const nextQuestion = () => {
    setRound(newRound(pool, site.name));
    setChosen(null); setHideClue(false);
  };
  const handleAnswer = (name: string) => {
    if (chosen) return; setChosen(name);
    const correct = name === site.name;
    setScore(prev => ({ correct: prev.correct + (correct ? 1 : 0), total: prev.total + 1 }));
    setStreak(prev => correct ? prev + 1 : 0);
  };
  const accuracy = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0;
  const right = chosen === site.name;

  return (
    <div className="mp-quiz">
      <div className="mp-quiz-head">
        <span className="mp-quiz-prompt">Which place is marked on the map?</span>
        <span className="mp-quiz-score">
          {streak >= 3 && <span className="mp-streak">{streak} in a row</span>}
          <span>{score.correct} of {score.total} right{score.total > 0 ? ` · ${accuracy}%` : ''}</span>
          {score.total > 0 && (
            <button type="button" className="mp-link" onClick={() => { setScore({ correct: 0, total: 0 }); setStreak(0); nextQuestion(); }}>Start over</button>
          )}
        </span>
      </div>

      <GeoMappingMap entries={[site]} selectedName={chosen ? site.name : null} onEntryClick={() => {}} noLabels={true} disableAutoZoom={true} />

      <div className="mp-clue">
        <div className="mp-clue-head">
          <span>A clue</span>
          <button type="button" className="mp-link" onClick={() => setHideClue(h => !h)}>{hideClue ? 'Show' : 'Hide'}</button>
        </div>
        {!hideClue && <p>{clueFor(site)}</p>}
      </div>

      <div className="mp-options">
        {options.map(opt => {
          const isCorrect = opt.name === site.name, isChosen = opt.name === chosen;
          const state = chosen ? (isCorrect ? ' right' : isChosen ? ' wrong' : ' faded') : '';
          return (
            <button key={opt.name} type="button" className={`mp-option${state}`} onClick={() => handleAnswer(opt.name)} disabled={Boolean(chosen)}>
              {opt.name}
            </button>
          );
        })}
      </div>

      {chosen && (
        <div className={`mp-answer${right ? ' right' : ''}`}>
          <div className="mp-answer-top">
            <strong>{right ? 'Right' : 'Not quite'}: {site.name}</strong>
            <span>{site.year} · {site.category}</span>
          </div>
          <p>{site.significance}</p>
          <button type="button" className="ds-btn ds-btn-solid ds-btn-sm" onClick={nextQuestion}>Next place</button>
        </div>
      )}
    </div>
  );
}

function PlaceList({ entries, selectedName, onPick, showCategory }: {
  entries: GeoMapEntry[]; selectedName: string | null; onPick: (name: string) => void; showCategory?: boolean;
}) {
  return (
    <div className="mp-list">
      {entries.map(entry => {
        const on = selectedName === entry.name;
        return (
          <button key={`${entry.year}-${entry.number}`} type="button" className={`mp-place${on ? ' on' : ''}`} onClick={() => onPick(entry.name)} aria-expanded={on}>
            <span className="mp-place-top">
              <strong>{entry.name}</strong>
              <span>{showCategory ? entry.category : entry.year}</span>
            </span>
            {on && <span className="mp-place-sig">{entry.significance}</span>}
          </button>
        );
      })}
    </div>
  );
}

function Section({ id, title, meta, chips, open, onToggle, children }: {
  id: string; title: string; meta: string; chips?: number[]; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <section id={`section-${id}`} className={`mp-section${open ? ' open' : ''}`}>
      <button type="button" className="mp-section-head" onClick={onToggle} aria-expanded={open}>
        <span className="mp-section-title">{title}</span>
        <span className="mp-section-meta">{meta}</span>
        {chips && chips.length > 0 && (
          <span className="mp-chips">{chips.slice(0, 6).map(y => <span key={y}>{y}</span>)}{chips.length > 6 && <span>+{chips.length - 6}</span>}</span>
        )}
        <svg className="mp-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && <div className="mp-section-body">{children}</div>}
    </section>
  );
}

export default function GeoMappingPage() {
  const [viewMode, setViewMode] = useState<'category' | 'year' | 'quiz'>('category');
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [quizYear, setQuizYear] = useState<number | 'all'>('all');
  const [quizCategory, setQuizCategory] = useState<GeoCategory | 'all'>('all');

  const entriesByCategory = useMemo(() => {
    const map: Record<string, GeoMapEntry[]> = {};
    for (const e of geoMapData) { if (!map[e.category]) map[e.category] = []; map[e.category].push(e); }
    return map;
  }, []);

  const entriesByYear = useMemo(() => {
    const map: Record<number, GeoMapEntry[]> = {};
    for (const e of geoMapData) { if (!map[e.year]) map[e.year] = []; map[e.year].push(e); }
    return map;
  }, []);

  const searchResults = useMemo(() => {
    if (search.trim().length < 2) return [];
    const q = search.trim().toLowerCase();
    return geoMapData.filter(e => e.name.toLowerCase().includes(q) || e.significance.toLowerCase().includes(q) || e.category.toLowerCase().includes(q)).slice(0, 15);
  }, [search]);

  const quizPool = useMemo(() => {
    let pool = geoMapData;
    if (quizYear !== 'all') pool = pool.filter(e => e.year === quizYear);
    if (quizCategory !== 'all') pool = pool.filter(e => e.category === quizCategory);
    return pool;
  }, [quizYear, quizCategory]);
  const quizNames = new Set(quizPool.map(e => e.name)).size;

  const toggleSection = (key: string) => {
    setOpenSections(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  };
  const pick = (name: string) => setSelectedName(prev => prev === name ? null : name);

  const jumpToEntry = (entry: GeoMapEntry) => {
    const key = viewMode === 'category' ? entry.category : String(entry.year);
    setOpenSections(prev => new Set(prev).add(key));
    setSelectedName(entry.name); setSearch('');
    setTimeout(() => { document.getElementById(`section-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 150);
  };

  const first = Math.min(...geoMapYears), last = Math.max(...geoMapYears);

  return (
    <div className="mp ds" style={{ ['--t' as string]: 'var(--tint-geography)', ['--w' as string]: 'var(--wash-geography)' }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <header className="mp-hero">
        <div className="ds-container">
          <Link href="/geography" className="ds-back">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
            Geography
          </Link>
          <h1 className="ds-h1 mp-h1">Map practice</h1>
          <p className="ds-lede mp-lede">
            Every place UPSC has asked you to mark on the map of India in Paper II, {geoMapData.length} of them from {first} to {last}. Browse them by topic or by year, or quiz yourself.
          </p>
          <div className="mp-modes" role="tablist" aria-label="View">
            {([['category', 'By topic'], ['year', 'By year'], ['quiz', 'Quiz']] as const).map(([mode, label]) => (
              <button key={mode} type="button" role="tab" aria-selected={viewMode === mode}
                className={`mp-mode${viewMode === mode ? ' on' : ''}`} onClick={() => setViewMode(mode)}>{label}</button>
            ))}
          </div>
        </div>
      </header>

      <div className="ds-container mp-body">
        {viewMode === 'quiz' ? (
          <>
            <div className="mp-filters">
              <select className={`mp-select${quizYear !== 'all' ? ' set' : ''}`} value={quizYear} aria-label="Year"
                onChange={e => setQuizYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
                <option value="all">Every year</option>
                {geoMapYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <select className={`mp-select${quizCategory !== 'all' ? ' set' : ''}`} value={quizCategory} aria-label="Topic"
                onChange={e => setQuizCategory(e.target.value as GeoCategory | 'all')}>
                <option value="all">Every topic</option>
                {GEO_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <span className="mp-filter-count">{quizNames} places</span>
            </div>
            {quizNames >= 4
              // A new pool is a new quiz; it used to keep asking about a place
              // the filter had just removed.
              ? <QuizPanel key={`${quizYear}-${quizCategory}`} pool={quizPool} />
              : <p className="mp-few">That filter leaves fewer than four places to choose between. Widen the year or the topic.</p>}
          </>
        ) : (
          <>
            <div className="mp-search-wrap">
              <label className="mp-search">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
                <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Find a place, say “Chilika” or “pass”" aria-label="Find a place" />
              </label>
              {searchResults.length > 0 && (
                <div className="mp-results">
                  {searchResults.map(entry => (
                    <button key={`${entry.year}-${entry.number}`} type="button" className="mp-result" onClick={() => jumpToEntry(entry)}>
                      <strong>{entry.name}</strong>
                      <span>{entry.category} · {entry.year}</span>
                    </button>
                  ))}
                </div>
              )}
              {search.trim().length >= 2 && searchResults.length === 0 && <p className="mp-few">No place matches “{search.trim()}”.</p>}
            </div>

            {viewMode === 'category' && GEO_CATEGORIES.map(cat => {
              const entries = entriesByCategory[cat] || [];
              if (!entries.length) return null;
              const years = [...new Set(entries.map(e => e.year))].sort((a, b) => b - a);
              return (
                <Section key={cat} id={cat} title={cat} meta={`${entries.length} places`} chips={years}
                  open={openSections.has(cat)} onToggle={() => toggleSection(cat)}>
                  <div className="mp-split">
                    <GeoMappingMap entries={entries} selectedName={selectedName} onEntryClick={pick} />
                    <PlaceList entries={entries} selectedName={selectedName} onPick={pick} />
                  </div>
                </Section>
              );
            })}

            {viewMode === 'year' && geoMapYears.map(year => {
              const entries = entriesByYear[year] || [];
              const key = String(year);
              return (
                <Section key={year} id={key} title={key} meta={`Paper II, Q1(a) · ${entries.length} places · 20 marks`}
                  open={openSections.has(key)} onToggle={() => toggleSection(key)}>
                  <div className="mp-split">
                    <GeoMappingMap entries={entries} selectedName={selectedName} onEntryClick={pick} />
                    <PlaceList entries={entries} selectedName={selectedName} onPick={pick} showCategory />
                  </div>
                </Section>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

const CSS = `
.mp { background: var(--bg); min-height: var(--page-min-h); padding-bottom: clamp(48px, 9vh, 96px); --geo-map-h: 440px; }
.mp-hero { padding: clamp(24px, 4vh, 44px) 0 clamp(16px, 3vh, 24px); background: linear-gradient(180deg, color-mix(in srgb, var(--w) 70%, var(--bg)) 0%, var(--bg) 100%); }
.mp-h1 { font-size: clamp(2rem, 4.4vw, 3rem); margin: var(--space-4) 0 var(--space-2); }
.mp-lede { max-width: 680px; }
.mp-modes { display: inline-flex; gap: 4px; margin-top: var(--space-5); padding: 4px; border-radius: var(--radius-full); background: var(--ds-soft); border: 1px solid var(--border); }
.mp-mode { padding: 9px 18px; border: none; border-radius: var(--radius-full); background: none; color: var(--text2); font: inherit; font-size: 0.94rem; font-weight: 700; cursor: pointer; transition: background 0.18s, color 0.18s, box-shadow 0.18s; }
.mp-mode.on { background: var(--ds-card); color: var(--text); box-shadow: var(--elev-1); }
.mp-mode:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.mp-body { padding-top: var(--space-4); }

.mp-search-wrap { position: relative; max-width: 640px; margin-bottom: var(--space-5); }
.mp-search { display: flex; align-items: center; gap: var(--space-2); height: 48px; padding: 0 var(--space-4); background: var(--ds-card); border: 1.5px solid var(--border2); border-radius: var(--radius-full); color: var(--text3); transition: border-color 0.15s, box-shadow 0.15s; }
.mp-search:focus-within { border-color: color-mix(in srgb, var(--accent) 65%, transparent); box-shadow: 0 0 0 4px var(--accent-glow); }
.mp-search input { flex: 1; min-width: 0; height: 100%; border: none; outline: none; background: none; color: var(--text); font: inherit; font-size: 1rem; }
.mp-results { position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 1000; max-height: 340px; overflow-y: auto; padding: 6px; background: var(--ds-card); border: 1px solid var(--border2); border-radius: var(--radius-lg); box-shadow: var(--elev-3); }
.mp-result { width: 100%; display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border: none; border-radius: var(--radius-md); background: none; color: var(--text); font: inherit; text-align: left; cursor: pointer; }
.mp-result:hover, .mp-result:focus-visible { background: var(--w); outline: none; }
.mp-result span { font-size: 0.82rem; color: var(--text3); }
.mp-few { margin: var(--space-3) 0 0; color: var(--text2); }

.mp-section { margin-bottom: var(--space-3); background: var(--ds-card); border: 1px solid var(--border); border-radius: var(--radius-xl); overflow: hidden; }
.mp-section.open { box-shadow: var(--elev-1); }
.mp-section-head { width: 100%; display: flex; align-items: center; flex-wrap: wrap; gap: 6px var(--space-3); padding: var(--space-4) var(--space-5); border: none; background: none; color: var(--text); font: inherit; text-align: left; cursor: pointer; }
.mp-section-head:hover { background: var(--ds-soft); }
.mp-section-title { font-size: 1.05rem; font-weight: 800; }
.mp-section-meta { font-size: 0.88rem; color: var(--text3); }
.mp-chips { display: flex; flex-wrap: wrap; gap: 4px; }
.mp-chips span { padding: 1px 8px; border-radius: var(--radius-full); background: var(--ds-soft); font-size: 0.76rem; color: var(--text2); font-variant-numeric: tabular-nums; }
.mp-chev { margin-left: auto; color: var(--text3); transition: transform 0.2s; flex-shrink: 0; }
.mp-section.open .mp-chev { transform: rotate(180deg); }
.mp-section-body { padding: 0 var(--space-5) var(--space-5); }
.mp-split { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: var(--space-4); align-items: start; }
.mp-map-wait { height: var(--geo-map-h); display: flex; align-items: center; justify-content: center; border: 1px solid var(--border); border-radius: 14px; background: var(--ds-soft); }
.mp-list { display: flex; flex-direction: column; gap: 6px; max-height: var(--geo-map-h); overflow-y: auto; padding-right: 2px; }
.mp-place { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--bg); color: var(--text); font: inherit; text-align: left; cursor: pointer; transition: border-color 0.15s, background 0.15s; }
.mp-place:hover { border-color: color-mix(in srgb, var(--t) 45%, transparent); }
.mp-place.on { border-color: var(--t); background: var(--w); }
.mp-place-top { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-2); }
.mp-place-top strong { font-size: 0.95rem; }
.mp-place-top span { font-size: 0.78rem; color: var(--text3); white-space: nowrap; }
.mp-place-sig { font-size: 0.88rem; line-height: 1.55; color: var(--text2); }

.mp-filters { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); margin-bottom: var(--space-4); }
.mp-select { appearance: none; -webkit-appearance: none; height: 40px; padding: 0 34px 0 14px; background: var(--ds-card) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E") no-repeat right 13px center; border: 1px solid var(--border2); border-radius: var(--radius-full); color: var(--text); font: inherit; font-size: 0.92rem; font-weight: 500; cursor: pointer; }
.mp-select.set { border-color: color-mix(in srgb, var(--t) 50%, transparent); background-color: var(--w); color: var(--t); font-weight: 600; }
.mp-filter-count { font-size: 0.88rem; color: var(--text3); }

.mp-quiz { display: flex; flex-direction: column; gap: var(--space-4); max-width: 860px; }
.mp-quiz-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-2); }
.mp-quiz-prompt { font-size: 1.1rem; font-weight: 800; }
.mp-quiz-score { display: inline-flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); font-size: 0.92rem; color: var(--text2); font-variant-numeric: tabular-nums; }
.mp-streak { padding: 2px 10px; border-radius: var(--radius-full); background: var(--premium-wash); color: var(--premium-text); font-weight: 700; }
.mp-link { background: none; border: none; padding: 0; font: inherit; font-size: 0.88rem; font-weight: 600; color: var(--accent-text); cursor: pointer; }
.mp-clue { padding: var(--space-3) var(--space-4); border-radius: var(--radius-lg); background: var(--ds-soft); }
.mp-clue-head { display: flex; justify-content: space-between; align-items: baseline; font-size: 0.88rem; font-weight: 700; color: var(--text2); }
.mp-clue p { margin: 4px 0 0; line-height: 1.6; }
.mp-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-2); }
.mp-option { min-height: 52px; padding: var(--space-3) var(--space-4); border: 1.5px solid var(--border2); border-radius: var(--radius-lg); background: var(--ds-card); color: var(--text); font: inherit; font-size: 0.98rem; font-weight: 600; text-align: left; cursor: pointer; transition: border-color 0.15s, background 0.15s; }
.mp-option:hover:not(:disabled) { border-color: var(--t); background: var(--w); }
.mp-option:disabled { cursor: default; }
.mp-option.right { border-color: var(--success-text); background: var(--success-wash); color: var(--success-text); }
.mp-option.wrong { border-color: var(--danger-text); background: var(--danger-wash); color: var(--danger-text); }
.mp-option.faded { opacity: 0.55; }
.mp-answer { padding: var(--space-4) var(--space-5); border-radius: var(--radius-lg); background: var(--danger-wash); }
.mp-answer.right { background: var(--success-wash); }
.mp-answer-top { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 4px var(--space-3); }
.mp-answer-top span { font-size: 0.84rem; color: var(--text3); }
.mp-answer p { margin: var(--space-2) 0 var(--space-3); line-height: 1.6; color: var(--text2); }

@media (max-width: 900px) {
  .mp-split { grid-template-columns: minmax(0, 1fr); }
  .mp-list { max-height: none; }
}
@media (max-width: 640px) {
  .mp { --geo-map-h: 320px; }
  .mp-modes { display: flex; }
  .mp-mode { flex: 1; padding: 8px 6px; }
  .mp-section-head { padding: var(--space-4); }
  .mp-section-body { padding: 0 var(--space-4) var(--space-4); }
  .mp-options { grid-template-columns: minmax(0, 1fr); }
}
@media (prefers-reduced-motion: reduce) { .mp-chev { transition: none; } }
`;
