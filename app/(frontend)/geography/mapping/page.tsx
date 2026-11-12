'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from '@/components/Link';
import { geoMapData, geoMapYears, GEO_CATEGORIES, GeoCategory, GeoMapEntry } from '@/lib/geoMapData';
import type { MapBase, MapMark, MapPlace } from '@/components/GeoMap';
import OwlLoader from '@/components/OwlLoader';
import { useRefreshSafe } from '@/hooks/useRefreshSafe';

const GeoMap = dynamic(() => import('@/components/GeoMap'), {
  ssr: false,
  loading: () => <div className="mp-map-wait"><OwlLoader size="small" label="Loading the map" /></div>,
});

const idOf = (e: GeoMapEntry) => `${e.year}-${e.number}`;
const placeOf = (e: GeoMapEntry, num?: number): MapPlace => ({ id: idOf(e), name: e.name, lat: e.lat, lng: e.lng, num, sub: `${e.year} · ${e.category}` });

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
  const site = pickRandom(after && pool.length > 1 ? pool.filter(e => e.name !== after) : pool);
  const others: GeoMapEntry[] = [];
  const seen = new Set([site.name]);
  // Wrong options come from the whole list when the pool is small.
  for (const e of [...shuffle(pool), ...shuffle(geoMapData)]) {
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

// ─── Typed answers ───
const norm = (s: string) => s.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g, '');
/** Words that name the kind of place, which a typed answer may leave out ("Lohit" for "Lohit River"). */
const KIND = /\b(river|basin|island|islands|lake|national park|park|wildlife sanctuary|sanctuary|tiger reserve|biosphere reserve|reserve|dam|pass|hills?|plateau|port|valley|falls|canal|bay|gulf|peak|range|city|heritage city|creek|lagoon|airport|air force station|station|town|village|project)\b/gi;
/** Spellings within two letters of each other, for names of five letters or more. */
function close(a: string, b: string) {
  if (a.length < 5 || b.length < 5 || Math.abs(a.length - b.length) > 2) return false;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length] <= 2;
}
/** A typed answer is right if it is the name, with or without the kind of place, give or take two letters. */
function typedRight(typed: string, name: string) {
  const t = norm(typed);
  if (t.length < 3) return false;
  const forms = name.split(/[/(),]/).map((s) => s.trim()).filter(Boolean).flatMap((s) => [s, s.replace(KIND, ' ')]).map(norm).filter((s) => s.length >= 3);
  return forms.some((f) => f === t || close(f, t));
}

// ─── Marking a place on the map ───
type Tone = 'right' | 'close' | 'off';
type Graded = { km: number; tone: Tone } | 'shown';
/** A river, range or route is checked against one named point on it, so it gets more room. */
const LONG: ReadonlySet<GeoCategory> = new Set<GeoCategory>(['Rivers & Water Bodies', 'Mountains, Passes & Plateaus', 'Transport & Connectivity']);
const tolerance = (e: GeoMapEntry) => (LONG.has(e.category) ? 100 : 50);
function kmBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = Math.PI / 180;
  const s = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lng - a.lng) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(s));
}
function grade(e: GeoMapEntry, at: { lat: number; lng: number }): Graded {
  const km = kmBetween(at, e), t = tolerance(e);
  return { km: Math.round(km), tone: km <= t ? 'right' : km <= 3 * t ? 'close' : 'off' };
}
const verdict = (g: Graded) => (g === 'shown' ? 'Shown on the map' : g.tone === 'right' ? `Right, ${g.km} km away` : g.tone === 'close' ? `Close, ${g.km} km away` : `Off by ${g.km} km`);

// ─── Small controls ───
const Switch = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button type="button" role="switch" aria-checked={on} className={`mp-switch${on ? ' on' : ''}`} onClick={onClick}>
    <span className="mp-switch-track" aria-hidden="true"><span /></span>{children}
  </button>
);
const BASES: { key: MapBase; label: string }[] = [
  { key: 'political', label: 'Political' },
  { key: 'physical', label: 'Physical' },
  { key: 'outline', label: 'No boundaries' },
];
const BaseSeg = ({ value, onChange }: { value: MapBase; onChange: (b: MapBase) => void }) => (
  <div className="mp-seg" role="radiogroup" aria-label="Map type">
    {BASES.map((b) => (
      <button key={b.key} type="button" role="radio" aria-checked={value === b.key} className={value === b.key ? 'on' : ''} onClick={() => onChange(b.key)}>{b.label}</button>
    ))}
  </div>
);

// ─── Choosing topics ───
/** The topics a choice stands for: null for every topic or a past paper, else the topics ticked (by index). */
const topicKeys = (v: string) => (v === 'all' || v.startsWith('y-') ? null : v.split(',').filter(Boolean).map(Number));
/** The places a choice covers: one paper, every place, or the topics ticked, newest paper first. */
function placesFor(v: string): GeoMapEntry[] {
  const yr = /^y-(\d{4})$/.exec(v);
  if (yr) return geoMapData.filter((e) => e.year === Number(yr[1]));
  const keys = topicKeys(v);
  const cats = keys ? new Set(keys.map((k) => GEO_CATEGORIES[k])) : null;
  return geoMapData.filter((e) => !cats || cats.has(e.category)).sort((a, b) => b.year - a.year || a.number - b.number);
}
const countIn = (cat: GeoCategory) => geoMapData.filter((e) => e.category === cat).length;

/**
 * What to practise: any mix of topics, all of them, or (for the quiz) one
 * past paper. Choices are a draft until Start, so nothing restarts on every tick.
 */
function TopicPicker({ value, onChange, papers, action }: { value: string; onChange: (v: string) => void; papers?: boolean; action: (n: number) => string }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const startRef = useRef<HTMLButtonElement>(null);
  const all = GEO_CATEGORIES.map((_, i) => i);
  const picked = draft === 'all' ? all : (topicKeys(draft) ?? []);
  const setKeys = (keys: number[]) => setDraft(keys.length === all.length ? 'all' : all.filter((k) => keys.includes(k)).join(','));
  const toggle = (k: number) => setKeys(picked.includes(k) ? picked.filter((x) => x !== k) : [...picked, k]);
  const allOn = draft === 'all', someOn = picked.length > 0;
  const count = open && draft ? placesFor(draft).length : 0;

  const label = (() => {
    if (!value) return '';
    if (value === 'all') return 'All';
    const yr = /^y-(\d{4})$/.exec(value);
    if (yr) return `${yr[1]} paper`;
    const keys = topicKeys(value) ?? [];
    return keys.length === 1 ? GEO_CATEGORIES[keys[0]] : `${keys.length} topics`;
  })();

  useEffect(() => {
    if (!open) return;
    startRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button type="button" className={`mp-select mp-pick${value && value !== 'all' ? ' set' : ''}`} onClick={() => { setDraft(value); setOpen(true); }} aria-haspopup="dialog" aria-label={label ? `Choose topics: ${label}` : 'Choose topics'}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6l2 2 3-3M3 13l2 2 3-3M3 20l2 2 3-3M12 6h9M12 13h9M12 20h9" /></svg>
        <span className="mp-pick-t">Choose topics</span>
        {label && <span className="mp-pick-sum">{label}</span>}
      </button>
      {open && (
        <div className="ds-overlay" onClick={() => setOpen(false)}>
          <div className="ds-modal mp-cp" role="dialog" aria-modal="true" aria-labelledby="mp-cp-title" onClick={(e) => e.stopPropagation()}>
            <div className="mp-cp-head">
              <h2 id="mp-cp-title" className="ds-modal-title">Choose what to practise</h2>
              <p className="ds-modal-text">Tick as many topics as you like, or all of them, and their places go into one {papers ? 'quiz' : 'test'}.</p>
            </div>
            <div className="mp-cp-body">
              {papers && (
                <div className="mp-cp-quick">
                  <span className="mp-cp-or">Or take a past paper</span>
                  <select className={`mp-select${draft.startsWith('y-') ? ' set' : ''}`} value={draft.startsWith('y-') ? draft : ''} onChange={(e) => setDraft(e.target.value || 'all')} aria-label="A past paper">
                    <option value="">Choose a year</option>
                    {geoMapYears.map((y) => <option key={y} value={`y-${y}`}>{y} paper</option>)}
                  </select>
                </div>
              )}
              <label className="mp-cp-row part mp-cp-all">
                <input type="checkbox" checked={allOn} ref={(el) => { if (el) el.indeterminate = someOn && !allOn; }} onChange={() => setDraft(allOn ? '' : 'all')} />
                <span>All topics</span>
                <span className="mp-cp-n">{geoMapData.length} places</span>
              </label>
              {GEO_CATEGORIES.map((cat, k) => (
                <label key={cat} className="mp-cp-row">
                  <input type="checkbox" checked={picked.includes(k)} onChange={() => toggle(k)} />
                  <span>{cat}</span>
                  <span className="mp-cp-n">{countIn(cat)}</span>
                </label>
              ))}
            </div>
            <div className="mp-cp-foot">
              <button type="button" className="ds-btn ds-btn-line" onClick={() => setOpen(false)}>Cancel</button>
              <button type="button" ref={startRef} className="ds-btn ds-btn-solid" disabled={count < 1} onClick={() => { onChange(draft); setOpen(false); }}>
                {!draft ? 'Tick a topic' : action(count)}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── The quiz ───
function QuizPanel({ pool, format, base, grid }: { pool: GeoMapEntry[]; format: 'pick' | 'type'; base: MapBase; grid: boolean }) {
  const [round, setRound] = useState(() => newRound(pool));
  const [answer, setAnswer] = useState<{ right: boolean; said: string } | null>(null);
  const [typed, setTyped] = useState('');
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [streak, setStreak] = useState(0);
  const [hideClue, setHideClue] = useState(false);
  const { site, options } = round;

  const nextQuestion = () => { setRound(newRound(pool, site.name)); setAnswer(null); setTyped(''); setHideClue(false); };
  const settle = (right: boolean, said: string) => {
    if (answer) return;
    setAnswer({ right, said });
    setScore((prev) => ({ correct: prev.correct + (right ? 1 : 0), total: prev.total + 1 }));
    setStreak((prev) => (right ? prev + 1 : 0));
  };
  const accuracy = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0;

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

      <GeoMap places={[placeOf(site)]} selected={answer ? idOf(site) : null} base={base} grid={grid} fixed quiet />

      <div className="mp-clue">
        <div className="mp-clue-head">
          <span>A clue</span>
          <button type="button" className="mp-link" onClick={() => setHideClue((h) => !h)}>{hideClue ? 'Show' : 'Hide'}</button>
        </div>
        {!hideClue && <p>{clueFor(site)}</p>}
      </div>

      {format === 'pick' ? (
        <div className="mp-options">
          {options.map((opt) => {
            const isCorrect = opt.name === site.name, isChosen = answer?.said === opt.name;
            const state = answer ? (isCorrect ? ' right' : isChosen ? ' wrong' : ' faded') : '';
            return (
              <button key={opt.name} type="button" className={`mp-option${state}`} onClick={() => settle(isCorrect, opt.name)} disabled={Boolean(answer)}>
                {opt.name}
              </button>
            );
          })}
        </div>
      ) : !answer && (
        <form className="pp-try mp-type" onSubmit={(e) => { e.preventDefault(); if (typed.trim()) settle(typedRight(typed, site.name), typed.trim()); }}>
          <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Type the name" aria-label="Your answer" autoComplete="off" autoFocus />
          <button type="submit" className="ds-btn ds-btn-solid ds-btn-sm" disabled={!typed.trim()}>Check</button>
          <button type="button" className="mp-link" onClick={() => settle(false, '')}>Show</button>
        </form>
      )}

      {answer && (
        <div className={`mp-answer${answer.right ? ' right' : ''}`}>
          <div className="mp-answer-top">
            <strong>{answer.right ? 'Right' : format === 'type' && !answer.said ? 'Answer' : 'Not quite'}: {site.name}</strong>
            <span>{site.year} · {site.category}</span>
          </div>
          {format === 'type' && !answer.right && answer.said && <small className="mp-said">You wrote “{answer.said}”</small>}
          <p>{site.significance}</p>
          <button type="button" className="ds-btn ds-btn-solid ds-btn-sm" onClick={nextQuestion}>Next place</button>
        </div>
      )}
    </div>
  );
}

// ─── A paper, or any set of places: study it, or mark each one yourself ───
function PaperSheet({ entries, summary, view, base, grid, years }: {
  entries: GeoMapEntry[]; summary: React.ReactNode; view: 'study' | 'test'; base: MapBase; grid: boolean;
  /** Show each place's year, when the places come from more than one paper. */
  years?: boolean;
}) {
  const items = useMemo(() => entries.map((e, i) => ({ n: i + 1, e })), [entries]);
  const [selected, setSelected] = useState<string | null>(null);
  const [active, setActive] = useState<number | null>(view === 'test' && items.length ? 1 : null);
  const [guess, setGuess] = useState<Record<number, { lat: number; lng: number }>>({});
  const [result, setResult] = useState<Record<number, Graded>>({});
  // The place just checked, said above the map, where a phone's eyes are.
  const [last, setLast] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const total = items.length;
  const rightN = Object.values(result).filter((g) => g !== 'shown' && g.tone === 'right').length;
  const doneN = Object.keys(result).length;

  // The next place still to mark, after the one just done.
  const nextOpen = (from: number, res: Record<number, Graded>) => items.find((it) => it.n > from && !res[it.n])?.n ?? items.find((it) => !res[it.n])?.n ?? null;
  const settle = (n: number, g: Graded) => { const next = { ...result, [n]: g }; setResult(next); setLast(n); setActive(nextOpen(n, next)); };
  const check = (n: number) => { if (guess[n]) settle(n, grade(items[n - 1].e, guess[n])); };

  // Keep the place being marked, or the one picked, in view in the list.
  const focus = view === 'test' ? (active != null ? String(active) : null) : selected;
  useEffect(() => {
    const list = listRef.current;
    const item = focus ? list?.querySelector<HTMLElement>(`[data-key="${focus}"]`) : null;
    if (!list || !item || list.scrollHeight <= list.clientHeight) return;
    const top = item.offsetTop - list.offsetTop, bottom = top + item.offsetHeight;
    if (top < list.scrollTop || bottom > list.scrollTop + list.clientHeight) list.scrollTo({ top: Math.max(0, top - 8), behavior: 'smooth' });
  }, [focus]);

  const places: MapPlace[] = view === 'study'
    ? items.map((it) => placeOf(it.e, it.n))
    : items.filter((it) => result[it.n]).map((it) => placeOf(it.e, it.n));
  const marks: MapMark[] = view === 'test'
    ? items.filter((it) => guess[it.n]).map((it) => {
        const g = result[it.n];
        return { id: String(it.n), num: it.n, ...guess[it.n], ...(g && g !== 'shown' ? { truth: { lat: it.e.lat, lng: it.e.lng }, tone: g.tone } : {}) };
      })
    : [];
  const marking = view === 'test' && active != null && !result[active] ? active : null;
  const onMark = marking != null ? (lat: number, lng: number) => setGuess((g) => ({ ...g, [marking]: { lat, lng } })) : undefined;
  const pickPlace = (id: string) => {
    if (view === 'study') { setSelected((s) => (s === id ? null : id)); return; }
    const it = items.find((x) => idOf(x.e) === id);
    if (it) setActive(it.n);
  };

  return (
    <div className="pp">
      <div className="pp-summary">
        {summary}
        {view === 'test' && (
          <span className="pp-score">
            {rightN} of {total} right{doneN > 0 && doneN < total ? ` · ${doneN} tried` : ''}
            {doneN < total && <button type="button" className="mp-link" onClick={() => { setResult((r) => Object.fromEntries(items.map((it) => [it.n, r[it.n] ?? 'shown']))); setActive(null); }}>Show all answers</button>}
            {doneN > 0 && <button type="button" className="mp-link" onClick={() => { setResult({}); setGuess({}); setLast(null); setActive(items.length ? 1 : null); }}>Start over</button>}
          </span>
        )}
      </div>
      {view === 'test' && (
        // The marking controls sit here, above the map, so a phone never has
        // to scroll between tapping the map and checking.
        <div className="pp-prompt" aria-live="polite">
          <p>
            {last != null && result[last] && (() => { const g = result[last]; return <span className={`pp-last ${g === 'shown' ? 'shown' : g.tone}`}>{last}. {items[last - 1].e.name}: {verdict(g)}. </span>; })()}
            {marking != null
              ? <>Tap the map where <strong>{marking}. {items[marking - 1].e.name}</strong> is{guess[marking] ? ', then Check' : ''}.</>
              : doneN === total ? `Done: ${rightN} of ${total} right.` : 'Pick a place in the list to mark it.'}
          </p>
          {marking != null && (
            <span className="pp-prompt-actions">
              <button type="button" className="ds-btn ds-btn-solid ds-btn-sm" disabled={!guess[marking]} onClick={() => check(marking)}>Check</button>
              <button type="button" className="mp-link" onClick={() => settle(marking, 'shown')}>Show</button>
            </span>
          )}
        </div>
      )}
      <div className="mp-split">
        <GeoMap places={places} selected={view === 'study' ? selected : marking != null ? null : (active != null ? idOf(items[active - 1].e) : null)} onPick={pickPlace}
          base={base} grid={grid} fixed={view === 'test'} quiet={view === 'test'} onMark={onMark} marks={marks} />
        <div className="mp-list pp-list" ref={listRef}>
          {items.map((it) => {
            const id = idOf(it.e);
            if (view === 'study') {
              const on = selected === id;
              return (
                <button key={id} data-key={id} type="button" className={`mp-place pp-item${on ? ' on' : ''}`} onClick={() => pickPlace(id)} aria-expanded={on}>
                  <span className="mp-place-top">
                    <strong><span className="pp-n">{it.n}</span>{it.e.name}</strong>
                    <span>{years ? `${it.e.year} · ` : ''}{it.e.category}</span>
                  </span>
                  {on && <span className="mp-place-sig">{it.e.significance}</span>}
                </button>
              );
            }
            const g = result[it.n], on = active === it.n;
            return (
              <div key={id} data-key={String(it.n)} className={`mp-place pp-item pp-test${on ? ' on' : ''}${g ? (g === 'shown' ? ' shown' : ` ${g.tone}`) : ''}`}>
                <button type="button" className="pp-hint-btn" onClick={() => setActive(it.n)} aria-label={`Mark ${it.e.name}`}>
                  <span className="mp-place-top">
                    <strong><span className="pp-n">{it.n}</span>{it.e.name}</strong>
                    {years && <span>{it.e.year}</span>}
                  </span>
                </button>
                {g ? (
                  <div className="pp-result">
                    <strong>{verdict(g)}</strong>
                    <small>{it.e.category}</small>
                    {on && <span className="mp-place-sig">{it.e.significance}</span>}
                  </div>
                ) : on ? (
                  <span className="pp-tap">{guess[it.n] ? 'Marked. Tap the map again to move it, or Check above the map.' : 'Marking now: tap the map where it is.'}</span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
      {view === 'test' && <p className="pp-note pp-rule">Within 50 km counts as right, or 100 km for a river, range or route, which is checked against one point on it.</p>}
    </div>
  );
}

// ─── The places asked twice ───
function TwiceView({ base, grid }: { base: MapBase; grid: boolean }) {
  const groups = useMemo(() => {
    const by = new Map<string, GeoMapEntry[]>();
    for (const e of geoMapData) { const k = norm(e.name); by.set(k, [...(by.get(k) ?? []), e]); }
    return [...by.values()].filter((g) => new Set(g.map((e) => e.year)).size > 1).map((g) => [...g].sort((a, b) => b.year - a.year)).sort((a, b) => b[0].year - a[0].year);
  }, []);
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <div className="pp">
      <div className="pp-summary"><span>Places UPSC has asked twice since {Math.min(...geoMapYears)}, latest first</span></div>
      <div className="mp-split">
        <GeoMap places={groups.map((g) => placeOf(g[0]))} selected={selected} onPick={(id) => setSelected((s) => (s === id ? null : id))} base={base} grid={grid} />
        <div className="mp-list pp-list">
          {groups.map((g) => {
            const id = idOf(g[0]), on = selected === id;
            return (
              <button key={id} type="button" className={`mp-place pp-item${on ? ' on' : ''}`} onClick={() => setSelected((s) => (s === id ? null : id))} aria-expanded={on}>
                <span className="mp-place-top"><strong>{g[0].name}</strong><span className="pp-twice">{g.map((e) => e.year).join(', ')}</span></span>
                <span className="mp-place-where">{g[0].category}</span>
                {on && <span className="mp-place-sig">{g[0].significance}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PlaceList({ entries, selectedId, onPick }: { entries: GeoMapEntry[]; selectedId: string | null; onPick: (id: string) => void }) {
  return (
    <div className="mp-list">
      {entries.map((entry) => {
        const id = idOf(entry), on = selectedId === id;
        return (
          <button key={id} type="button" className={`mp-place${on ? ' on' : ''}`} onClick={() => onPick(id)} aria-expanded={on}>
            <span className="mp-place-top">
              <strong>{entry.name}</strong>
              <span>{entry.year}</span>
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

type Mode = 'topic' | 'papers' | 'quiz';
type PaperTab = number | 'twice' | 'topics';

export default function GeoMappingPage() {
  const [mode, setMode] = useState<Mode>('topic');
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [base, setBase] = useState<MapBase>('political');
  const [grid, setGrid] = useState(false);
  const [paperTab, setPaperTab] = useState<PaperTab>(geoMapYears[0]);
  const [paperView, setPaperView] = useState<'study' | 'test'>('study');
  const [paperTopics, setPaperTopics] = useState('');
  const [quizSource, setQuizSource] = useState('all');
  const [quizFormat, setQuizFormat] = useState<'pick' | 'type'>('pick');
  const [quizBase, setQuizBase] = useState<MapBase>('outline');

  // The view is kept for the tab, so a refresh comes back to the same place.
  useRefreshSafe(
    'dc_mapping_v2',
    { mode, openSections: [...openSections], selectedId, base, grid, paperTab, paperView, paperTopics, quizSource, quizFormat, quizBase },
    (v) => {
      if (['topic', 'papers', 'quiz'].includes(v.mode)) setMode(v.mode);
      setOpenSections(new Set(v.openSections)); setSelectedId(v.selectedId);
      setBase(v.base); setGrid(v.grid);
      if (v.paperTab === 'twice' || v.paperTab === 'topics' || geoMapYears.includes(v.paperTab as number)) setPaperTab(v.paperTab);
      setPaperView(v.paperView); setPaperTopics(v.paperTopics ?? ''); setQuizSource(v.quizSource ?? 'all'); setQuizFormat(v.quizFormat ?? 'pick'); setQuizBase(v.quizBase ?? 'outline');
    },
  );

  const entriesByCategory = useMemo(() => {
    const map: Record<string, GeoMapEntry[]> = {};
    for (const e of geoMapData) { if (!map[e.category]) map[e.category] = []; map[e.category].push(e); }
    for (const k of Object.keys(map)) map[k].sort((a, b) => b.year - a.year || a.number - b.number);
    return map;
  }, []);

  const searchResults = useMemo(() => {
    if (search.trim().length < 2) return [];
    const q = search.trim().toLowerCase();
    return geoMapData.filter(e => e.name.toLowerCase().includes(q) || e.significance.toLowerCase().includes(q) || e.category.toLowerCase().includes(q)).slice(0, 15);
  }, [search]);

  const quizPool = useMemo(() => placesFor(quizSource), [quizSource]);
  const topicPaper = useMemo(() => (paperTopics ? placesFor(paperTopics) : []), [paperTopics]);
  const yearPaper = useMemo(() => (typeof paperTab === 'number' ? geoMapData.filter((e) => e.year === paperTab).sort((a, b) => a.number - b.number) : []), [paperTab]);

  const toggleSection = (key: string) => {
    setOpenSections(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  };
  const pick = (id: string) => setSelectedId(prev => prev === id ? null : id);
  const jumpToEntry = (entry: GeoMapEntry) => {
    setOpenSections(prev => new Set(prev).add(entry.category));
    setSelectedId(idOf(entry)); setSearch('');
    setTimeout(() => { document.getElementById(`section-${entry.category}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 150);
  };

  // On a phone the year tabs scroll sideways; keep the one picked in view.
  const tabsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = tabsRef.current, tab = row?.querySelector<HTMLElement>('.mp-part.on');
    if (!row || !tab || row.scrollWidth <= row.clientWidth) return;
    const left = tab.offsetLeft - row.offsetLeft, right = left + tab.offsetWidth;
    if (left < row.scrollLeft || right > row.scrollLeft + row.clientWidth) row.scrollTo({ left: Math.max(0, left - 16), behavior: 'smooth' });
  }, [paperTab, mode]);

  const first = Math.min(...geoMapYears), last = Math.max(...geoMapYears);
  const MODES: [Mode, string][] = [['topic', 'By topic'], ['papers', 'Past papers'], ['quiz', 'Quiz']];

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
            Every place UPSC has asked you to mark on the map of India in Paper II, {geoMapData.length} of them from {first} to {last}. Browse them by topic, study or test yourself on each year&rsquo;s paper, or take a quiz.
          </p>
          <div className="mp-modes" role="tablist" aria-label="View">
            {MODES.map(([m, label]) => (
              <button key={m} type="button" role="tab" aria-selected={mode === m}
                className={`mp-mode${mode === m ? ' on' : ''}`} onClick={() => setMode(m)}>{label}</button>
            ))}
          </div>
        </div>
      </header>

      <div className="ds-container mp-body">
        {mode === 'quiz' ? (
          <>
            <div className="mp-filters">
              <div className="mp-seg" role="radiogroup" aria-label="Answer by">
                <button type="button" role="radio" aria-checked={quizFormat === 'pick'} className={quizFormat === 'pick' ? 'on' : ''} onClick={() => setQuizFormat('pick')}>Four options</button>
                <button type="button" role="radio" aria-checked={quizFormat === 'type'} className={quizFormat === 'type' ? 'on' : ''} onClick={() => setQuizFormat('type')}>Type the name</button>
              </div>
              <TopicPicker value={quizSource} onChange={setQuizSource} papers action={(n) => `Start quiz, ${n} place${n === 1 ? '' : 's'}`} />
              <BaseSeg value={quizBase} onChange={setQuizBase} />
              <Switch on={grid} onClick={() => setGrid((v) => !v)}>Grid</Switch>
            </div>
            {quizPool.length >= 1
              // A new pool or format is a new quiz.
              ? <QuizPanel key={`${quizSource}-${quizFormat}`} pool={quizPool} format={quizFormat} base={quizBase} grid={grid} />
              : <p className="mp-few">Choose some topics to start.</p>}
          </>
        ) : mode === 'papers' ? (
          <>
            <div className="mp-parts" ref={tabsRef} role="tablist" aria-label="Paper">
              <button type="button" role="tab" aria-selected={paperTab === 'twice'} className={`mp-part pp-special${paperTab === 'twice' ? ' on' : ''}`} onClick={() => setPaperTab('twice')}>Asked twice</button>
              <button type="button" role="tab" aria-selected={paperTab === 'topics'} className={`mp-part pp-special${paperTab === 'topics' ? ' on' : ''}`} onClick={() => setPaperTab('topics')}>By topic</button>
              {geoMapYears.map((y) => (
                <button key={y} type="button" role="tab" aria-selected={paperTab === y} className={`mp-part${paperTab === y ? ' on' : ''}`} onClick={() => setPaperTab(y)}>{y}</button>
              ))}
            </div>
            <div className="mp-bar">
              <div className="mp-switches">
                {paperTab === 'topics' && <TopicPicker value={paperTopics} onChange={setPaperTopics} action={(n) => `Start, ${n} place${n === 1 ? '' : 's'}`} />}
                {paperTab !== 'twice' && (
                  <div className="mp-seg" role="radiogroup" aria-label="Study or test">
                    <button type="button" role="radio" aria-checked={paperView === 'study'} className={paperView === 'study' ? 'on' : ''} onClick={() => setPaperView('study')}>Study</button>
                    <button type="button" role="radio" aria-checked={paperView === 'test'} className={paperView === 'test' ? 'on' : ''} onClick={() => setPaperView('test')}>Test yourself</button>
                  </div>
                )}
                <BaseSeg value={base} onChange={setBase} />
                <Switch on={grid} onClick={() => setGrid((v) => !v)}>Grid</Switch>
              </div>
            </div>
            {paperTab === 'twice'
              ? <TwiceView base={base} grid={grid} />
              : paperTab === 'topics'
                ? (topicPaper.length === 0
                  ? <p className="mp-few">Choose topics, say Rivers &amp; Water Bodies and Wildlife &amp; Biosphere, to study every place UPSC has asked from them, or to mark each one on the map yourself.</p>
                  // New topics or a new view start afresh.
                  : <PaperSheet key={`${paperTopics}-${paperView}`} entries={topicPaper} view={paperView} base={base} grid={grid} years
                      summary={<span>{topicPaper.length} place{topicPaper.length === 1 ? '' : 's'} UPSC has asked from them, newest first</span>} />)
                // A new year or view starts the paper afresh.
                : <PaperSheet key={`${paperTab}-${paperView}`} entries={yearPaper} view={paperView} base={base} grid={grid}
                    summary={<span>{paperTab}, Paper II, Q1(a): {yearPaper.length} places to mark, 20 marks</span>} />}
          </>
        ) : (
          <>
            <div className="mp-search-wrap">
              <label className="mp-search">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
                <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Find a place, say “Pulicat” or “pass”" aria-label="Find a place" />
              </label>
              {searchResults.length > 0 && (
                <div className="mp-results">
                  {searchResults.map(entry => (
                    <button key={idOf(entry)} type="button" className="mp-result" onClick={() => jumpToEntry(entry)}>
                      <strong>{entry.name}</strong>
                      <span>{entry.category} · {entry.year}</span>
                    </button>
                  ))}
                </div>
              )}
              {search.trim().length >= 2 && searchResults.length === 0 && <p className="mp-few">No place matches “{search.trim()}”.</p>}
            </div>
            <div className="mp-bar">
              <div className="mp-switches">
                <BaseSeg value={base} onChange={setBase} />
                <Switch on={grid} onClick={() => setGrid((v) => !v)}>Grid</Switch>
              </div>
            </div>

            {GEO_CATEGORIES.map(cat => {
              const entries = entriesByCategory[cat] || [];
              if (!entries.length) return null;
              const years = [...new Set(entries.map(e => e.year))].sort((a, b) => b - a);
              return (
                <Section key={cat} id={cat} title={cat} meta={`${entries.length} places`} chips={years}
                  open={openSections.has(cat)} onToggle={() => toggleSection(cat)}>
                  <div className="mp-split">
                    <GeoMap places={entries.map((e) => placeOf(e))} selected={selectedId} onPick={pick} base={base} grid={grid} />
                    <PlaceList entries={entries} selectedId={selectedId} onPick={pick} />
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

.mp-bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-2) var(--space-4); margin-bottom: var(--space-4); }
.mp-switches { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2) var(--space-4); }
.mp-switch { display: inline-flex; align-items: center; gap: 8px; min-height: 36px; padding: 0; border: none; background: none; color: var(--text2); font: inherit; font-size: 0.9rem; font-weight: 600; cursor: pointer; }
.mp-switch-track { position: relative; width: 36px; height: 20px; flex-shrink: 0; border-radius: var(--radius-full); background: var(--border2); transition: background 0.2s; }
.mp-switch-track span { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3); transition: transform 0.2s; }
.mp-switch.on { color: var(--text); }
.mp-switch.on .mp-switch-track { background: var(--t); }
.mp-switch.on .mp-switch-track span { transform: translateX(16px); }
.mp-switch:focus-visible, .mp-part:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.mp-seg { display: inline-flex; gap: 4px; padding: 4px; border-radius: var(--radius-full); background: var(--ds-soft); border: 1px solid var(--border); }
.mp-seg button { padding: 7px 14px; border: none; border-radius: var(--radius-full); background: none; color: var(--text2); font: inherit; font-size: 0.9rem; font-weight: 700; cursor: pointer; white-space: nowrap; }
.mp-seg button.on { background: var(--ds-card); color: var(--text); box-shadow: var(--elev-1); }
.mp-parts { display: flex; gap: var(--space-2); margin-bottom: var(--space-3); overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
.mp-parts::-webkit-scrollbar { display: none; }
.mp-part { flex-shrink: 0; min-height: 40px; padding: 0 var(--space-4); border: 1.5px solid var(--border2); border-radius: var(--radius-full); background: var(--ds-card); color: var(--text2); font: inherit; font-size: 0.92rem; font-weight: 700; white-space: nowrap; cursor: pointer; transition: border-color 0.15s, background 0.15s, color 0.15s; }
.mp-part:hover { color: var(--text); border-color: color-mix(in srgb, var(--t) 40%, transparent); }
.mp-part.on { border-color: var(--t); background: var(--w); color: var(--t); }
.mp-part.pp-special { border-color: color-mix(in srgb, var(--warning-text) 45%, transparent); color: var(--warning-text); }
.mp-part.pp-special.on { border-color: var(--warning-text); background: var(--warning-wash); color: var(--warning-text); }
.mp-filters .mp-seg, .mp-filters .mp-switch { flex-shrink: 0; }
.mp-pick { display: inline-flex; align-items: center; gap: 8px; min-width: 0; max-width: 360px; white-space: nowrap; text-align: left; }
.mp-pick svg { flex-shrink: 0; }
.mp-pick-t { flex-shrink: 0; font-weight: 600; }
.mp-pick-sum { min-width: 0; overflow: hidden; text-overflow: ellipsis; color: var(--text3); font-weight: 500; }
.mp-pick.set .mp-pick-sum { color: inherit; font-weight: 700; }
.mp-pick-sum::before { content: '·'; margin-right: 8px; color: var(--text3); font-weight: 500; }
.mp-cp { max-width: 520px; padding: 0; display: flex; flex-direction: column; overflow: hidden; }
.mp-cp-head { padding: var(--space-6) var(--space-6) var(--space-4); }
.mp-cp-body { flex: 1; min-height: 0; overflow-y: auto; padding: 0 var(--space-6) var(--space-4); }
.mp-cp-quick { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); margin-bottom: var(--space-4); }
.mp-cp-or { font-size: 0.86rem; color: var(--text2); }
.mp-cp-quick .mp-select { height: 36px; }
.mp-cp-row { display: flex; align-items: center; gap: var(--space-3); min-height: 40px; padding: 2px 0; font-size: 0.92rem; color: var(--text); cursor: pointer; }
.mp-cp-row.part { font-weight: 700; border-bottom: 1px solid var(--border); margin-bottom: 2px; }
.mp-cp-row input { width: 18px; height: 18px; margin: 0; flex-shrink: 0; accent-color: var(--t); cursor: pointer; }
.mp-cp-n { margin-left: auto; padding-left: var(--space-2); flex-shrink: 0; color: var(--text3); font-size: 0.8rem; font-weight: 500; font-variant-numeric: tabular-nums; }
.mp-cp-foot { display: flex; gap: var(--space-3); padding: var(--space-4) var(--space-6); border-top: 1px solid var(--border); background: var(--ds-card); }
.mp-cp-foot .ds-btn { flex: 1; min-height: 44px; border-radius: var(--radius-md); }
.mp-cp-foot .ds-btn-solid { flex: 2; }

.pp-summary { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2) var(--space-4); margin-bottom: var(--space-3); font-weight: 700; }
.pp-score { display: inline-flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); margin-left: auto; font-weight: 600; color: var(--text2); font-variant-numeric: tabular-nums; }
.pp-prompt { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2) var(--space-4); margin: 0 0 var(--space-3); padding: var(--space-3) var(--space-4); border-radius: var(--radius-lg); background: var(--w); font-size: 0.95rem; line-height: 1.5; }
.pp-prompt p { flex: 1 1 260px; margin: 0; }
.pp-prompt-actions { display: inline-flex; align-items: center; gap: var(--space-3); flex-shrink: 0; }
.pp-last { font-weight: 700; }
.pp-last.right { color: var(--success-text); }
.pp-last.close { color: var(--warning-text); }
.pp-last.off { color: var(--danger-text); }
.pp-last.shown { color: var(--text2); }
.pp-note { margin: var(--space-3) 0 0; font-size: 0.84rem; color: var(--text3); }
.pp-list { gap: 8px; }
.pp-item { gap: 4px; }
.pp-n { flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; min-width: 22px; height: 22px; margin-right: 8px; padding: 0 5px; border-radius: var(--radius-full); border: 1.5px solid var(--text2); background: var(--ds-card); color: var(--text); font-size: 0.74rem; font-weight: 800; font-variant-numeric: tabular-nums; vertical-align: 1px; }
.pp-hint-btn { width: 100%; padding: 0; border: none; background: none; font: inherit; text-align: left; color: var(--text); cursor: pointer; }
.pp-test { cursor: default; }
.pp-test.on { border-color: var(--t); background: var(--w); }
.pp-test.right { border-color: color-mix(in srgb, var(--success-text) 50%, transparent); background: var(--success-wash); }
.pp-test.close { border-color: color-mix(in srgb, var(--warning-text) 45%, transparent); background: var(--warning-wash); }
.pp-test.off { border-color: color-mix(in srgb, var(--danger-text) 45%, transparent); background: var(--danger-wash); }
.pp-test.shown { border-color: var(--border2); background: var(--ds-soft); }
.pp-try { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2) var(--space-3); margin-top: 4px; }
.pp-tap { font-size: 0.86rem; color: var(--text2); }
.pp-result { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px var(--space-3); margin-top: 2px; font-size: 0.92rem; }
.pp-result small { color: var(--text3); }
.pp-result .mp-place-sig { flex-basis: 100%; }
.pp-twice { color: var(--warning-text) !important; font-weight: 700; }
.mp-place-where { font-size: 0.82rem; color: var(--text3); }
.mp-type input { flex: 1 1 200px; min-width: 0; height: 44px; padding: 0 var(--space-3); border: 1.5px solid var(--border2); border-radius: var(--radius-md); background: var(--ds-card); color: var(--text); font: inherit; font-size: 1rem; outline: none; }
.mp-type input:focus { border-color: color-mix(in srgb, var(--t) 60%, transparent); box-shadow: 0 0 0 3px var(--w); }
.mp-said { display: block; margin-top: 4px; color: var(--text3); }

@media (max-width: 900px) {
  .mp-split { grid-template-columns: minmax(0, 1fr); }
  .mp-list { max-height: none; }
}
@media (max-width: 640px) {
  .mp { --geo-map-h: 320px; }
  .mp-bar .mp-switches, .mp-filters { gap: var(--space-2); }
  .mp-seg button { padding: 7px 10px; font-size: 0.86rem; }
  .mp-modes { display: flex; }
  .mp-mode { flex: 1; padding: 8px 6px; }
  .mp-section-head { padding: var(--space-4); }
  .mp-section-body { padding: 0 var(--space-4) var(--space-4); }
  .mp-options { grid-template-columns: minmax(0, 1fr); }
}
@media (prefers-reduced-motion: reduce) { .mp-chev { transition: none; } }
`;
