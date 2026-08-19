'use client';
import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { geoMapData, geoMapYears, GEO_CATEGORIES, GeoCategory, GeoMapEntry } from '@/lib/geoMapData';

const GeoMappingMap = dynamic(() => import('@/components/GeoMappingMap'), { ssr: false });
const ACCENT = '#4361ee';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function pickRandom(entries: GeoMapEntry[]): GeoMapEntry { return entries[Math.floor(Math.random() * entries.length)]; }
function getDistractors(correct: GeoMapEntry, pool: GeoMapEntry[], count = 3): GeoMapEntry[] {
  return shuffle(pool.filter(e => e.name !== correct.name)).slice(0, count);
}

function QuizPanel({ pool }: { pool: GeoMapEntry[] }) {
  const [site, setSite] = useState<GeoMapEntry>(() => pickRandom(pool));
  const [options, setOptions] = useState<GeoMapEntry[]>(() => { const s = pickRandom(pool); return shuffle([s, ...getDistractors(s, pool)]); });
  const [chosen, setChosen] = useState<string | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [streak, setStreak] = useState(0);
  const [hideClue, setHideClue] = useState(false);

  const nextQuestion = () => {
    const next = pickRandom(pool.filter(e => e.name !== site.name));
    setSite(next); setOptions(shuffle([next, ...getDistractors(next, pool)]));
    setChosen(null); setHideClue(false);
  };
  const handleAnswer = (name: string) => {
    if (chosen) return; setChosen(name);
    const correct = name === site.name;
    setScore(prev => ({ correct: prev.correct + (correct ? 1 : 0), total: prev.total + 1 }));
    setStreak(prev => correct ? prev + 1 : 0);
  };
  const accuracy = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text2)' }}>Identify the location marked on the map.</div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          {streak >= 3 && <span style={{ color: '#f59e0b', fontSize: 13 }}>🔥 {streak}</span>}
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text2)' }}>
            {score.correct}/{score.total}{score.total > 0 && <span style={{ color: accuracy >= 70 ? '#4ade80' : '#f87171', marginLeft: 6 }}>{accuracy}%</span>}
          </span>
          <button onClick={() => { setScore({ correct: 0, total: 0 }); setStreak(0); nextQuestion(); }}
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text3)', fontSize: 12, padding: '4px 10px', cursor: 'pointer' }}>Reset</button>
        </div>
      </div>
      <GeoMappingMap entries={[site]} selectedName={chosen ? site.name : null} onEntryClick={() => {}} noLabels={true} disableAutoZoom={true} />
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: hideClue ? 0 : 6 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text3)' }}>SIGNIFICANCE CLUE</span>
          <span role="button" onClick={() => setHideClue((h: boolean) => !h)} style={{ fontSize: 10, cursor: 'pointer', color: 'var(--text3)', padding: '2px 8px', borderRadius: 4, border: '1px solid var(--border)', userSelect: 'none' }}>{hideClue ? 'Show' : 'Hide'}</span>
        </div>
        {!hideClue && <span>{site.significance.split(' ').slice(1).join(' ')}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {options.slice(0, 4).map((opt: GeoMapEntry) => {
          const isCorrect = opt.name === site.name, isChosen = opt.name === chosen;
          let bg = 'var(--bg3)', border = 'var(--border)', color = 'var(--text)';
          if (chosen) { if (isCorrect) { bg = 'rgba(67,97,238,0.12)'; border = ACCENT; color = ACCENT; } else if (isChosen) { bg = 'rgba(248,113,113,0.12)'; border = '#f87171'; color = '#f87171'; } }
          return (
            <button key={opt.name} onClick={() => handleAnswer(opt.name)}
              style={{ padding: '14px 16px', borderRadius: 8, border: `1.5px solid ${border}`, background: bg, color, fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 500, cursor: chosen ? 'default' : 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
              {opt.name}
            </button>
          );
        })}
      </div>
      {chosen && (
        <div style={{ padding: '14px 16px', borderRadius: 8, background: 'var(--bg3)', border: '1px solid var(--border)', fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--text)', display: 'block', marginBottom: 4 }}>{site.name}</strong>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>{site.year} · {site.category} · #{site.number}</div>
          {site.significance}
        </div>
      )}
      {chosen && (
        <button onClick={nextQuestion} style={{ alignSelf: 'flex-end', padding: '10px 28px', borderRadius: 8, background: ACCENT, color: '#fff', border: 'none', fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Next →</button>
      )}
    </div>
  );
}

function CategorySection({ category, entries, isOpen, onToggle, selectedName, onEntryClick }: {
  category: GeoCategory; entries: GeoMapEntry[]; isOpen: boolean; onToggle: () => void; selectedName: string | null; onEntryClick: (name: string) => void;
}) {
  const years = [...new Set(entries.map(e => e.year))].sort((a, b) => b - a);
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, marginBottom: 10, overflow: 'hidden', background: 'var(--bg3)' }}>
      <button onClick={onToggle} style={{ width: '100%', textAlign: 'left', padding: '14px 18px', background: isOpen ? 'rgba(67,97,238,0.06)' : 'var(--bg3)', border: 'none', borderBottom: isOpen ? `1px solid ${ACCENT}33` : 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text)', fontFamily: 'var(--font-ui)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ color: ACCENT, fontWeight: 700, fontSize: 15 }}>{category}</span>
          <span style={{ color: 'var(--text3)', fontSize: 12 }}>{entries.length} locations</span>
          <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {years.map(y => (
              <span key={y} style={{ fontSize: 10, fontFamily: 'var(--font-mono)', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 5px', color: 'var(--text3)' }}>{y}</span>
            ))}
          </span>
        </span>
        <span style={{ color: ACCENT, fontSize: 18, flexShrink: 0 }}>{isOpen ? '−' : '+'}</span>
      </button>
      {isOpen && (
        <div style={{ padding: 18 }}>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 400px', minWidth: 300 }}>
              <GeoMappingMap entries={entries} selectedName={selectedName} onEntryClick={onEntryClick} />
            </div>
            <div style={{ flex: '1 1 320px', minWidth: 260, maxHeight: 420, overflowY: 'auto' }}>
              {entries.map((entry: GeoMapEntry) => {
                const isSelected = selectedName === entry.name;
                return (
                  <div key={`${entry.year}-${entry.number}`} onClick={() => onEntryClick(entry.name)} style={{ padding: '10px 12px', borderRadius: 8, marginBottom: 6, cursor: 'pointer', background: isSelected ? 'rgba(67,97,238,0.1)' : 'var(--bg4)', border: isSelected ? `1px solid ${ACCENT}` : '1px solid var(--border)', transition: 'background 0.15s' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <strong style={{ color: 'var(--text)', fontFamily: 'var(--font-ui)', fontSize: 14 }}>{entry.name}</strong>
                      <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--font-mono)', marginLeft: 8, whiteSpace: 'nowrap' }}>{entry.year} · #{entry.number}</span>
                    </div>
                    {isSelected && <div style={{ color: 'var(--text2)', fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>{entry.significance}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
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

  const toggleSection = (key: string) => {
    setOpenSections((prev: Set<string>) => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  };

  const jumpToEntry = (entry: GeoMapEntry) => {
    const key = viewMode === 'category' ? entry.category : String(entry.year);
    setOpenSections((prev: Set<string>) => new Set(prev).add(key));
    setSelectedName(entry.name); setSearch('');
    setTimeout(() => { document.getElementById(`section-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 150);
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px 60px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 8 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>
            {viewMode === 'quiz' ? 'Map Quiz' : 'Geography Map Questions'}
          </h1>
          <p style={{ color: 'var(--text2)', fontSize: 15 }}>
            {viewMode === 'quiz'
              ? 'Identify the marked location. Paper II, Q1(a) — 20 marks.'
              : <span>PYQ map locations 2013–2025. <span style={{ color: ACCENT }}>131 locations</span> across 13 years · Paper II Q1(a).</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['category', 'year', 'quiz'] as const).map(mode => (
            <button key={mode} onClick={() => setViewMode(mode)}
              style={{ padding: '8px 16px', borderRadius: 8, border: `1.5px solid ${viewMode === mode ? ACCENT : 'var(--border)'}`, background: viewMode === mode ? 'rgba(67,97,238,0.12)' : 'var(--bg3)', color: viewMode === mode ? ACCENT : 'var(--text2)', fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              {mode === 'category' ? '🗂 Topic' : mode === 'year' ? '📅 Year' : '🎯 Quiz'}
            </button>
          ))}
        </div>
      </div>

      {/* Quiz Mode */}
      {viewMode === 'quiz' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text2)' }}>Filter:</span>
            <select value={quizYear} onChange={(e: any) => setQuizYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              style={{ fontSize: 12, fontWeight: 600, padding: '6px 10px', borderRadius: 7, fontFamily: 'var(--font-ui)', cursor: 'pointer', background: quizYear !== 'all' ? 'rgba(67,97,238,0.12)' : 'var(--bg3)', color: quizYear !== 'all' ? ACCENT : 'var(--text2)', border: `1px solid ${quizYear !== 'all' ? ACCENT : 'var(--border)'}`, outline: 'none' }}>
              <option value="all">All Years</option>
              {geoMapYears.map((y: number) => <option key={y} value={y}>{y}</option>)}
            </select>
            <select value={quizCategory} onChange={(e: any) => setQuizCategory(e.target.value as GeoCategory | 'all')}
              style={{ fontSize: 12, fontWeight: 600, padding: '6px 10px', borderRadius: 7, fontFamily: 'var(--font-ui)', cursor: 'pointer', background: quizCategory !== 'all' ? 'rgba(67,97,238,0.12)' : 'var(--bg3)', color: quizCategory !== 'all' ? ACCENT : 'var(--text2)', border: `1px solid ${quizCategory !== 'all' ? ACCENT : 'var(--border)'}`, outline: 'none' }}>
              <option value="all">All Topics</option>
              {GEO_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {quizPool.length < 4 && <span style={{ color: '#f87171', fontSize: 12, fontFamily: 'var(--font-ui)' }}>Need at least 4 locations.</span>}
          </div>
          {quizPool.length >= 4 && <QuizPanel pool={quizPool} />}
        </div>
      )}

      {/* Browse Mode */}
      {viewMode !== 'quiz' && (
        <>
          <div style={{ position: 'relative', marginBottom: 24 }}>
            <input type="text" value={search} onChange={(e: any) => setSearch(e.target.value)} placeholder="Search by name, topic or significance..."
              style={{ width: '100%', padding: '12px 16px', borderRadius: 8, border: `1px solid ${ACCENT}55`, background: 'var(--bg3)', color: 'var(--text)', fontFamily: 'var(--font-ui)', fontSize: 14, outline: 'none' }} />
            {searchResults.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'var(--bg3)', border: `1px solid ${ACCENT}55`, borderRadius: 8, maxHeight: 320, overflowY: 'auto', zIndex: 1000 }}>
                {searchResults.map((entry: GeoMapEntry) => (
                  <div key={`${entry.year}-${entry.number}`} onClick={() => jumpToEntry(entry)}
                    style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-ui)' }}
                    onMouseEnter={(e: any) => e.currentTarget.style.background = 'rgba(67,97,238,0.08)'}
                    onMouseLeave={(e: any) => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <strong style={{ color: 'var(--text)', fontSize: 14 }}>{entry.name}</strong>
                      <span style={{ color: 'var(--text3)', fontSize: 11, marginLeft: 8 }}>{entry.year} · #{entry.number}</span>
                    </div>
                    <div style={{ fontSize: 11, color: ACCENT, marginTop: 2 }}>{entry.category}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Category View */}
          {viewMode === 'category' && GEO_CATEGORIES.map(cat => {
            const entries = entriesByCategory[cat] || [];
            if (!entries.length) return null;
            return (
              <div id={`section-${cat}`} key={cat}>
                <CategorySection
                  category={cat}
                  entries={entries}
                  isOpen={openSections.has(cat)}
                  onToggle={() => toggleSection(cat)}
                  selectedName={selectedName}
                  onEntryClick={(name: string) => setSelectedName((prev: string | null) => prev === name ? null : name)}
                />
              </div>
            );
          })}

          {/* Year View */}
          {viewMode === 'year' && geoMapYears.map((year: number) => {
            const entries = entriesByYear[year] || [];
            const key = String(year);
            return (
              <div id={`section-${key}`} key={year}>
                <div style={{ border: '1px solid var(--border)', borderRadius: 10, marginBottom: 10, overflow: 'hidden', background: 'var(--bg3)' }}>
                  <button onClick={() => toggleSection(key)} style={{ width: '100%', textAlign: 'left', padding: '14px 18px', background: openSections.has(key) ? 'rgba(67,97,238,0.06)' : 'var(--bg3)', border: 'none', borderBottom: openSections.has(key) ? `1px solid ${ACCENT}33` : 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text)', fontFamily: 'var(--font-ui)' }}>
                    <span>
                      <span style={{ color: ACCENT, fontWeight: 700, marginRight: 10 }}>{year}</span>
                      <span style={{ fontWeight: 600 }}>Paper II · Q1(a)</span>
                      <span style={{ color: 'var(--text3)', marginLeft: 10, fontSize: 13 }}>({entries.length} locations · 20 marks)</span>
                    </span>
                    <span style={{ color: ACCENT, fontSize: 18 }}>{openSections.has(key) ? '−' : '+'}</span>
                  </button>
                  {openSections.has(key) && (
                    <div style={{ padding: 18 }}>
                      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                        <div style={{ flex: '1 1 400px', minWidth: 300 }}>
                          <GeoMappingMap entries={entries} selectedName={selectedName} onEntryClick={(name: string) => setSelectedName((prev: string | null) => prev === name ? null : name)} />
                        </div>
                        <div style={{ flex: '1 1 320px', minWidth: 260, maxHeight: 420, overflowY: 'auto' }}>
                          {entries.map((entry: GeoMapEntry) => {
                            const isSelected = selectedName === entry.name;
                            return (
                              <div key={entry.number} onClick={() => setSelectedName((prev: string | null) => prev === entry.name ? null : entry.name)} style={{ padding: '10px 12px', borderRadius: 8, marginBottom: 6, cursor: 'pointer', background: isSelected ? 'rgba(67,97,238,0.1)' : 'var(--bg4)', border: isSelected ? `1px solid ${ACCENT}` : '1px solid var(--border)', transition: 'background 0.15s' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                  <strong style={{ color: 'var(--text)', fontFamily: 'var(--font-ui)', fontSize: 14 }}>{entry.name}</strong>
                                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                    <span style={{ fontSize: 10, color: ACCENT, fontFamily: 'var(--font-ui)' }}>{entry.category}</span>
                                    <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>#{entry.number}</span>
                                  </div>
                                </div>
                                {isSelected && <div style={{ color: 'var(--text2)', fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>{entry.significance}</div>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
