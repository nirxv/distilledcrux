'use client';
import { useState, useEffect, useCallback, useMemo, useSyncExternalStore } from 'react';
import Link from 'next/link';
import SubjectIcon from '@/components/SubjectIcon';
import OwlLoader from '@/components/OwlLoader';
import SessionComplete from '@/components/flashcards/SessionComplete';
import { useFlashcardDeck } from '@/hooks/useFlashcardDeck';
import { useRefreshSafe } from '@/hooks/useRefreshSafe';
import { FLASHCARD_SR_KEY, FLASHCARD_TYPES, type FlashcardSubject } from '@/lib/flashcardMeta';
import type { FlashCardFront } from '@/lib/flashcardStore';

export type NoteMeta = { slug: string; title: string; paper: 1 | 2; section: string };

type SRData = {
  interval: number;
  easeFactor: number;
  nextDue: string;
  reps: number;
  lastGrade?: 1 | 2 | 3 | 4;
};
type Grade = 1 | 2 | 3 | 4;

function loadSR(): Record<string, SRData> {
  try { return JSON.parse(localStorage.getItem(FLASHCARD_SR_KEY) ?? '{}'); } catch { return {}; }
}
function saveSR(data: Record<string, SRData>) {
  try { localStorage.setItem(FLASHCARD_SR_KEY, JSON.stringify(data)); } catch { /* storage full or blocked */ }
}

/** The ids reviewed in the last session, per deck, so its tile can list them after a reload. */
const sessionKey = (subject: string) => `dc_flashcards_last_session_${subject}_v1`;
function loadSession(subject: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(sessionKey(subject)) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch { return []; }
}
function saveSession(subject: string, ids: string[]) {
  try { localStorage.setItem(sessionKey(subject), JSON.stringify(ids)); } catch { /* storage full or blocked */ }
}

/** SM-2, with four grades: when to show the card again. */
function sm2(card: SRData | undefined, grade: Grade): SRData {
  const ef = card?.easeFactor ?? 2.5;
  const reps = card?.reps ?? 0;
  const newEF = Math.max(1.3, ef + (0.1 - (4 - grade) * (0.08 + (4 - grade) * 0.02)));
  let interval = 1;
  if (grade < 2) interval = 1;
  else if (reps === 0) interval = 1;
  else if (reps === 1) interval = 6;
  else interval = Math.round((card?.interval ?? 1) * newEF);
  const nextDue = new Date(Date.now() + interval * 86400000).toISOString();
  return { interval, easeFactor: newEF, nextDue, reps: grade >= 2 ? reps + 1 : 0, lastGrade: grade };
}

const TYPE: Record<string, { label: string; tone: string }> = {
  thinker: { label: 'Thinker', tone: 'accent' },
  concept: { label: 'Concept', tone: 'info' },
  comparison: { label: 'Comparison', tone: 'premium' },
  critique: { label: 'Critique', tone: 'warning' },
  study: { label: 'Study', tone: 'success' },
  fact: { label: 'Fact', tone: 'neutral' },
};
const GRADES: { grade: Grade; label: string; sub: string; tone: string }[] = [
  { grade: 1, label: 'Blank', sub: 'No recall', tone: 'danger' },
  { grade: 2, label: 'Hard', sub: 'With effort', tone: 'warning' },
  { grade: 3, label: 'Good', sub: 'Recalled', tone: 'accent' },
  { grade: 4, label: 'Easy', sub: 'Perfect', tone: 'success' },
];

/** "Asked 2024, 2021 and 2018", or with a count of the rest when there are more. */
function askedLine(years: number[]): string | null {
  if (!years?.length) return null;
  const shown = years.slice(0, 3);
  const rest = years.length - shown.length;
  if (rest > 0) return `Asked ${shown.join(', ')} and ${rest} more year${rest === 1 ? '' : 's'}`;
  if (shown.length === 1) return `Asked ${shown[0]}`;
  return `Asked ${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}`;
}

function parse(search: string) {
  const p = new URLSearchParams(search);
  return { paper: p.get('paper') ?? '', topic: p.get('topic') ?? '' };
}
const subscribeUrl = (cb: () => void) => { window.addEventListener('popstate', cb); return () => window.removeEventListener('popstate', cb); };

const BACK = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>;

/** A ring with the count beside it. */
function ProgressRing({ done, total, noun }: { done: number; total: number; noun: string }) {
  const pct = total ? done / total : 0;
  const R = 30, C = 2 * Math.PI * R;
  return (
    <div className="sr" role="img" aria-label={`${done} of ${total} ${noun}`}>
      <svg width="76" height="76" viewBox="0 0 76 76" aria-hidden="true">
        <circle cx="38" cy="38" r={R} fill="none" stroke="var(--sr-track)" strokeWidth="7" />
        <circle cx="38" cy="38" r={R} fill="none" stroke="var(--success-text)" strokeWidth="7" strokeLinecap="round"
          strokeDasharray={`${C * pct} ${C}`} transform="rotate(-90 38 38)" style={{ transition: 'stroke-dasharray 0.4s ease' }} />
        <text x="38" y="38" textAnchor="middle" dominantBaseline="central" className="sr-pct">{Math.round(pct * 100)}%</text>
      </svg>
      <div className="sr-text">
        <strong>{done.toLocaleString('en-IN')} of {total.toLocaleString('en-IN')}</strong>
        <span>{noun}</span>
      </div>
    </div>
  );
}

/**
 * Flashcards for one optional, ported from the history site: thinkers and
 * their arguments, concepts, comparisons, critiques, landmark studies and the
 * facts UPSC asks for, each linked to the past questions it helps answer.
 * Spaced out by SM-2, so a card comes back just before it would be forgotten.
 * Questions are free to read, and a hundred answers are free before a
 * subscription to this optional is needed.
 */
export default function Flashcards({ subject, subjectName, notes }: { subject: FlashcardSubject; subjectName: string; notes: NoteMeta[] }) {
  const note = useMemo(() => new Map(notes.map((n) => [n.slug, n])), [notes]);
  const typeLabel = (type: string) => TYPE[type]?.label ?? type;
  const topicTitle = (slug: string) => note.get(slug)?.title ?? slug;

  const [sr, setSR] = useState<Record<string, SRData>>({});
  const [lastSessionIds, setLastSessionIds] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // localStorage, so only once in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSR(loadSR()); setLastSessionIds(loadSession(subject)); setMounted(true);
  }, [subject]);

  // Paper and topic come from the address: the chat's "Revise them" sends
  // ?topic=<notes slug>.
  const urlSearch = useSyncExternalStore(subscribeUrl, () => window.location.search, () => '');
  const fromUrl = useMemo(() => parse(urlSearch), [urlSearch]);
  const [own, setOwn] = useState<{ paper: string; topic: string } | null>(null);
  const filterPaper = (own ?? fromUrl).paper === '1' || (own ?? fromUrl).paper === '2' ? (own ?? fromUrl).paper : '';
  const topicRaw = (own ?? fromUrl).topic;
  const filterTopic = note.has(topicRaw) ? topicRaw : '';
  const setPlace = (next: { paper?: string; topic?: string }) => {
    const merged = { paper: filterPaper, topic: filterTopic, ...next };
    setOwn(merged);
    const url = new URL(window.location.href);
    if (merged.topic) url.searchParams.set('topic', merged.topic); else url.searchParams.delete('topic');
    if (merged.paper) url.searchParams.set('paper', merged.paper); else url.searchParams.delete('paper');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`);
  };

  /** The topic to name on a card: the one being filtered on, when the card serves it. */
  const cardTopic = (c: { topic: string; topics: string[] }) => topicTitle(filterTopic && c.topics.includes(filterTopic) ? filterTopic : c.topic);

  const [filterType, setFilterType] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [filterDue, setFilterDue] = useState(false);
  const [view, setView] = useState<'all' | 'studied' | 'due' | 'session'>('all');

  const { index, indexLoading, error: deckError, getCard, getBack, reveal, allowance, prefetch, keepAhead } = useFlashcardDeck(subject);
  const [revealState, setRevealState] = useState<'idle' | 'loading' | 'locked' | 'login' | 'error'>('idle');
  const [queueIds, setQueueIds] = useState<string[]>([]);
  const [browseLimit, setBrowseLimit] = useState(60);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [sessionDone, setSessionDone] = useState(0);
  const [sessionFinished, setSessionFinished] = useState(false);
  const [sessionRecalled, setSessionRecalled] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (!modalOpen) return;
    const was = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = was; };
  }, [modalOpen]);

  // Read again whenever a grade changes, which is when "due" can change.
  const today = useMemo(() => new Date().toISOString(), [sr]); // eslint-disable-line react-hooks/exhaustive-deps
  const isDue = useCallback((id: string) => { const s = sr[id]; return !s || s.nextDue <= today; }, [sr, today]);

  const inPlace = useCallback((c: { topic: string; topics: string[] }) => {
    if (filterTopic && !c.topics.includes(filterTopic)) return false;
    if (filterPaper && String(note.get(c.topic)?.paper ?? '') !== filterPaper) return false;
    return true;
  }, [filterTopic, filterPaper, note]);

  const filteredIndex = useMemo(() => index.filter((c) => {
    if (!inPlace(c)) return false;
    if (filterType && c.type !== filterType) return false;
    if (filterGrade && String(sr[c.id]?.lastGrade ?? '') !== filterGrade) return false;
    if (view === 'studied' && !sr[c.id]) return false;
    if (view === 'due' && !isDue(c.id)) return false;
    if (view === 'session' && !lastSessionIds.includes(c.id)) return false;
    return true;
  }), [index, inPlace, filterType, filterGrade, view, sr, isDue, lastSessionIds]);

  const startSession = useCallback((ids: string[], start = 0) => {
    keepAhead(ids, start);
    setQueueIds(ids); setIdx(start); setFlipped(false); setRevealState('idle');
    setSessionDone(0); setSessionFinished(false); setSessionRecalled(0);
    setLastSessionIds([]); saveSession(subject, []);
    setModalOpen(true);
  }, [keepAhead, subject]);

  /** The due cards first, the hardest of them first, within the filters. */
  const buildQueue = () => {
    const ordered = index
      .filter((c) => inPlace(c) && (!filterType || c.type === filterType)
        && (!filterGrade || String(sr[c.id]?.lastGrade ?? '') === filterGrade)
        && (!filterDue || isDue(c.id)))
      .sort((a, b) => {
        const aDue = isDue(a.id), bDue = isDue(b.id);
        if (aDue !== bDue) return aDue ? -1 : 1;
        return (sr[a.id]?.easeFactor ?? 2.5) - (sr[b.id]?.easeFactor ?? 2.5);
      })
      .map((c) => c.id);
    startSession(ordered);
  };
  const openFrom = (id: string) => {
    const ids = filteredIndex.map((c) => c.id);
    startSession(ids, Math.max(0, ids.indexOf(id)));
  };

  useEffect(() => {
    if (modalOpen && queueIds.length) keepAhead(queueIds, idx);
  }, [modalOpen, queueIds, idx, keepAhead]);

  const closeModal = () => { setModalOpen(false); setFlipped(false); setRevealState('idle'); };

  // A refresh mid-review reopens the session on the card it was on, front up.
  useRefreshSafe(
    `dc_flashcards_session_${subject}_v1`,
    { modalOpen, queueIds, idx, sessionDone, sessionRecalled, sessionFinished },
    (saved) => {
      if (!saved.modalOpen || saved.queueIds.length === 0) return;
      setQueueIds(saved.queueIds);
      setIdx(Math.min(saved.idx, saved.queueIds.length - 1));
      setSessionDone(saved.sessionDone);
      setSessionRecalled(saved.sessionRecalled);
      setSessionFinished(saved.sessionFinished);
      setModalOpen(true);
    },
  );

  /** Turning to the answer spends the allowance, so the server is asked first. */
  const flipCard = useCallback(async () => {
    const id = queueIds[idx];
    if (!id) return;
    if (flipped) { setFlipped(false); return; }
    if (getBack(id)) { setRevealState('idle'); setFlipped(true); return; }
    setRevealState('loading');
    setFlipped(true);
    const outcome = await reveal(id);
    setRevealState(outcome === 'granted' ? 'idle' : outcome);
  }, [queueIds, idx, flipped, getBack, reveal]);

  const rate = useCallback((grade: Grade) => {
    const card = getCard(queueIds[idx]);
    if (!card || animating) return;
    const updated = { ...sr, [card.id]: sm2(sr[card.id], grade) };
    setSR(updated); saveSR(updated);
    setAnimating(true);
    setTimeout(() => {
      setSessionDone((s) => s + 1);
      if (grade >= 3) setSessionRecalled((r) => r + 1);
      setLastSessionIds((prev) => {
        const next = prev.includes(card.id) ? prev : [...prev, card.id];
        saveSession(subject, next);
        return next;
      });
      if (idx + 1 >= queueIds.length) { setSessionFinished(true); closeModal(); }
      else { setIdx((i) => i + 1); setFlipped(false); setRevealState('idle'); }
      setAnimating(false);
    }, 200);
  }, [queueIds, idx, sr, animating, getCard, subject]);

  const currentCard = getCard(queueIds[idx]);
  // A locked card is turned over and shows the paywall, and must not be graded.
  const answerVisible = currentCard ? getBack(currentCard.id) !== undefined : false;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!modalOpen) return;
      if (e.key === 'Escape') closeModal();
      if (e.key === ' ') { e.preventDefault(); void flipCard(); }
      if (e.key === 'ArrowRight' && flipped && answerVisible) rate(3);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [modalOpen, flipped, answerVisible, flipCard, rate]);

  // The tiles count the slice chosen by paper and topic; kind, rating and
  // "due only" refine the list below.
  const scope = useMemo(() => index.filter(inPlace), [index, inPlace]);
  const scopeIds = useMemo(() => new Set(scope.map((c) => c.id)), [scope]);
  const dueCount = scope.filter((c) => isDue(c.id)).length;
  const studiedCount = scope.filter((c) => sr[c.id]).length;
  const lastSessionCount = lastSessionIds.filter((id) => scopeIds.has(id)).length;
  const filteredDue = filteredIndex.filter((c) => isDue(c.id));
  const startCount = filteredDue.length || filteredIndex.length;

  const visibleIds = useMemo(() => filteredIndex.slice(0, browseLimit).map((c) => c.id), [filteredIndex, browseLimit]);
  useEffect(() => { if (visibleIds.length) prefetch(visibleIds); }, [visibleIds, prefetch]);
  const resetList = () => setBrowseLimit(60);

  const papers = useMemo(() => {
    const has = new Set(index.map((c) => note.get(c.topic)?.paper).filter(Boolean));
    return ([1, 2] as const).filter((p) => has.has(p));
  }, [index, note]);

  // Topics that have cards, grouped by section in syllabus order.
  const topicGroups = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of index) for (const t of c.topics) counts.set(t, (counts.get(t) ?? 0) + 1);
    const groups: { label: string; topics: (NoteMeta & { count: number })[] }[] = [];
    for (const n of notes) {
      if (!counts.has(n.slug) || (filterPaper && String(n.paper) !== filterPaper)) continue;
      const label = `Paper ${n.paper === 1 ? 'I' : 'II'}: ${n.section}`;
      let g = groups.find((x) => x.label === label);
      if (!g) { g = { label, topics: [] }; groups.push(g); }
      g.topics.push({ ...n, count: counts.get(n.slug) ?? 0 });
    }
    return groups;
  }, [index, notes, filterPaper]);

  const scopeName = filterTopic ? topicTitle(filterTopic) : filterPaper ? `Paper ${filterPaper === '1' ? 'I' : 'II'}` : `all of ${subjectName}`;
  const tone = currentCard ? TYPE[currentCard.type]?.tone ?? 'accent' : 'accent';
  const out = allowance && !allowance.unlimited && allowance.used >= allowance.limit;

  return (
    <div className="fc ds" style={{ ['--t' as string]: `var(--tint-${subject})`, ['--w' as string]: `var(--wash-${subject})` }}>
      <style dangerouslySetInnerHTML={{ __html: FC_CSS }} />

      <section className="fc-hero">
        <div className="ds-container fc-hero-row">
          <div className="fc-hero-main">
            <Link href={`/${subject}`} className="ds-back">{BACK}{subjectName}</Link>
            <div className="fc-title">
              <span className="fc-icon" aria-hidden="true"><SubjectIcon id={subject} size={24} /></span>
              <h1 className="ds-h1">{subjectName} flashcards</h1>
            </div>
            <p className="ds-lede fc-lede">
              Short cards for what slips away: who argued what, the terms and the facts UPSC asks for, each tied to the past questions it helps you answer. Every card comes back just before you’d forget it.
            </p>
            {allowance && !allowance.unlimited && !allowance.requiresLogin && (
              <p className={`fc-allowance${out ? ' out' : ''}`}>
                {out
                  ? `Your ${allowance.limit} free answers are used.`
                  : `${allowance.limit - allowance.used} of ${allowance.limit} free answers left`}
                {out && <Link href="/pricing">See plans</Link>}
              </p>
            )}
          </div>
          <div className="fc-hero-side">
            <ProgressRing done={mounted ? studiedCount : 0} total={scope.length} noun="cards studied" />
          </div>
        </div>
      </section>

      <section className="fc-body">
        <div className="ds-container">
          <div className="fc-today">
            <div className="fc-today-text">
              <strong>
                {!mounted || indexLoading ? 'Getting your cards'
                  : filteredDue.length ? `${filteredDue.length.toLocaleString('en-IN')} ${filteredDue.length === 1 ? 'card is' : 'cards are'} due`
                  : 'Nothing due right now'}
              </strong>
              <span>From {scopeName}</span>
            </div>
            <button type="button" className="ds-btn ds-btn-solid fc-start" disabled={!startCount} onClick={buildQueue}>
              {filteredDue.length ? 'Start reviewing' : 'Review anyway'}
              {startCount > 0 && <span>{startCount.toLocaleString('en-IN')}</span>}
            </button>
          </div>

          {mounted && (
            <div className="fc-tiles">
              {([
                { key: 'all', label: 'All cards', value: scope.length },
                { key: 'studied', label: 'Studied', value: studiedCount },
                { key: 'due', label: 'Due today', value: dueCount },
                { key: 'session', label: 'Last session', value: lastSessionCount },
              ] as const).map((t) => {
                const active = view === t.key;
                const enabled = t.key === 'all' || t.value > 0;
                return (
                  <button key={t.key} type="button" className={`fc-tile ${t.key}${active ? ' on' : ''}`} disabled={!enabled} aria-pressed={active}
                    onClick={() => { setView(active ? 'all' : t.key); resetList(); }}>
                    <span className="fc-tile-n">{t.value.toLocaleString('en-IN')}</span>
                    <span className="fc-tile-l">{t.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="fc-bar">
            {papers.length > 1 && (
              <div className="fc-tabs" role="tablist" aria-label="Paper">
                <button type="button" role="tab" aria-selected={!filterPaper} className={`fc-tab${!filterPaper ? ' on' : ''}`} onClick={() => { setPlace({ paper: '', topic: '' }); resetList(); }}>Both papers</button>
                {papers.map((p) => (
                  <button key={p} type="button" role="tab" aria-selected={filterPaper === String(p)}
                    className={`fc-tab${filterPaper === String(p) ? ' on' : ''}`} onClick={() => { setPlace({ paper: String(p), topic: '' }); resetList(); }}>
                    Paper {p === 1 ? 'I' : 'II'}
                  </button>
                ))}
              </div>
            )}
            <div className="fc-selects">
              <select className={`fc-select fc-select-topic${filterTopic ? ' set' : ''}`} value={filterTopic} onChange={(e) => { setPlace({ topic: e.target.value }); resetList(); }} aria-label="Topic">
                <option value="">Every topic</option>
                {topicGroups.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.topics.map((t) => <option key={t.slug} value={t.slug}>{t.title} ({t.count})</option>)}
                  </optgroup>
                ))}
              </select>
              <select className={`fc-select${filterType ? ' set' : ''}`} value={filterType} onChange={(e) => { setFilterType(e.target.value); resetList(); }} aria-label="Kind of card">
                <option value="">Every kind</option>
                {FLASHCARD_TYPES.map((t) => <option key={t} value={t}>{typeLabel(t)}</option>)}
              </select>
              <select className={`fc-select${filterGrade ? ' set' : ''}`} value={filterGrade} onChange={(e) => { setFilterGrade(e.target.value); resetList(); }} aria-label="Last rating">
                <option value="">Any last rating</option>
                {GRADES.map((g) => <option key={g.grade} value={g.grade}>{g.label}</option>)}
              </select>
              <label className={`fc-due${filterDue ? ' on' : ''}`}>
                <input type="checkbox" checked={filterDue} onChange={(e) => setFilterDue(e.target.checked)} />
                Only due cards in a session
              </label>
            </div>
          </div>

          {sessionDone > 0 && sessionFinished && (
            <SessionComplete reviewed={sessionDone} recalled={sessionRecalled} dueLeft={filteredDue.length}
              onNext={() => buildQueue()} onDone={() => { setSessionDone(0); setSessionFinished(false); }} />
          )}
          {sessionDone > 0 && !sessionFinished && (
            <div className="fc-stopped">
              <span>Session stopped after <strong>{sessionDone} {sessionDone === 1 ? 'card' : 'cards'}</strong>.</span>
              <button type="button" onClick={() => setSessionDone(0)}>Dismiss</button>
            </div>
          )}

          <div className="fc-count">{filteredIndex.length.toLocaleString('en-IN')} {filteredIndex.length === 1 ? 'card' : 'cards'}</div>
          <div className="fc-list">
            {visibleIds.map((id) => getCard(id)).filter((c): c is FlashCardFront => !!c).map((card) => {
              const s = sr[card.id];
              const due = isDue(card.id);
              const t = TYPE[card.type]?.tone ?? 'accent';
              return (
                <button key={card.id} type="button" className={`fc-row${mounted && due && s ? ' due' : ''}`} onClick={() => openFrom(card.id)}>
                  <span className={`fc-type t-${t}`}>{typeLabel(card.type)}</span>
                  <span className="fc-row-text">
                    <span className="fc-row-front">{card.front}</span>
                    <span className="fc-row-topic">
                      {cardTopic(card)}
                      {card.asked?.length > 0 && <> · asked {card.asked.length === 1 ? 'once' : `${card.asked.length} times`}</>}
                    </span>
                  </span>
                  {mounted && (
                    <span className="fc-row-meta">
                      {s?.lastGrade && <span className={`fc-grade g-${GRADES[s.lastGrade - 1].tone}`}>{GRADES[s.lastGrade - 1].label}</span>}
                      <span className={`fc-when${due ? ' due' : ''}`}>{due ? (s ? 'Due' : 'New') : `In ${s.interval}d`}</span>
                    </span>
                  )}
                </button>
              );
            })}
            {deckError && <p className="fc-error">{deckError}</p>}
            {indexLoading && !deckError && <OwlLoader label="Loading flashcards" />}
            {!indexLoading && !deckError && filteredIndex.length > browseLimit && (
              <button type="button" className="ds-btn ds-btn-line ds-btn-sm fc-more" onClick={() => setBrowseLimit((n) => n + 60)}>
                Show more ({filteredIndex.length - browseLimit} left)
              </button>
            )}
          </div>
        </div>
      </section>

      {modalOpen && currentCard && (
        <div className="fc-review" role="dialog" aria-modal="true" aria-label="Flashcard session"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="fc-review-inner">
            <div className="fc-review-top">
              <span className="fc-review-count">{idx + 1} / {queueIds.length}</span>
              <span className="fc-review-bar"><span style={{ width: `${(idx / queueIds.length) * 100}%` }} /></span>
              <button type="button" className="fc-review-close" onClick={closeModal} aria-label="Close">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="fc-flip" onClick={() => flipCard()} role="button" tabIndex={0} aria-label={flipped ? 'Show the question' : 'Show the answer'}>
              <div className={`fc-flip-inner${flipped ? ' flipped' : ''}`}>
                <div className={`fc-face front t-${tone}`}>
                  <div className="fc-face-head">
                    <span className={`fc-type t-${tone}`}>{typeLabel(currentCard.type)}</span>
                    <span className="fc-face-topic">{cardTopic(currentCard)}</span>
                  </div>
                  <div className="fc-face-text">{currentCard.front}</div>
                  {askedLine(currentCard.asked) && <div className="fc-face-asked">{askedLine(currentCard.asked)}</div>}
                  <div className="fc-face-hint">Tap to see the answer</div>
                </div>
                <div className={`fc-face back t-${tone}`}>
                  <div className="fc-face-head"><span className="fc-answer-label">Answer</span></div>
                  <div className="fc-face-answer">
                    {(() => {
                      const answer = getBack(currentCard.id);
                      if (answer) return answer;
                      if (revealState === 'locked') return (
                        <span className="fc-locked">
                          {`You’ve used all ${allowance?.limit ?? 100} free answers. The questions stay free to read, and a ${subjectName} subscription keeps the answers opening.`}
                          <Link href="/pricing" className="ds-btn ds-btn-solid ds-btn-sm" onClick={(e) => e.stopPropagation()}>See plans</Link>
                        </span>
                      );
                      if (revealState === 'login') return (
                        <span className="fc-locked">
                          Sign in again to see the answer.
                          <Link href="/login" className="ds-btn ds-btn-solid ds-btn-sm" onClick={(e) => e.stopPropagation()}>Sign in</Link>
                        </span>
                      );
                      if (revealState === 'error') return <span className="fc-err">Could not load the answer. Turn the card again to retry.</span>;
                      return <span className="fc-muted">Opening the answer…</span>;
                    })()}
                  </div>
                </div>
              </div>
            </div>

            {/* Grading a card whose answer was never shown would schedule a
                review that did not happen. */}
            <div className={`fc-rate${flipped && answerVisible ? ' on' : ''}`}>
              {GRADES.map((g) => (
                <button key={g.grade} type="button" className={`fc-rate-btn g-${g.tone}`} onClick={(e) => { e.stopPropagation(); rate(g.grade); }} tabIndex={flipped && answerVisible ? 0 : -1}>
                  <strong>{g.label}</strong>
                  <span>{g.sub}</span>
                </button>
              ))}
            </div>
            <p className="fc-keys">Space turns the card · → marks it Good · Esc closes</p>
          </div>
        </div>
      )}
    </div>
  );
}

const FC_CSS = `
.fc { background: var(--bg); min-height: var(--page-min-h, 70vh); }
.fc-hero { padding: clamp(20px, 4vh, 44px) 0 clamp(20px, 3vh, 32px); background: linear-gradient(180deg, color-mix(in srgb, var(--w) 70%, var(--bg)) 0%, var(--bg) 100%); }
.fc-hero-row { display: flex; align-items: flex-end; justify-content: space-between; gap: var(--space-6); }
.fc-hero-main { min-width: 0; }
.fc-hero-side { flex-shrink: 0; padding-bottom: var(--space-1); }
.fc-title { display: flex; align-items: center; gap: var(--space-3); margin: var(--space-4) 0 var(--space-2); }
.fc-title .ds-h1 { font-size: clamp(1.9rem, 4vw, 2.8rem); }
.fc-icon { width: 48px; height: 48px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 14px; background: var(--ds-card); color: var(--t); border: 1px solid var(--border); box-shadow: var(--elev-1); }
.fc-lede { max-width: 700px; }
.fc-allowance { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); margin: var(--space-3) 0 0; font-size: 0.92rem; font-weight: 600; color: var(--text2); }
.fc-allowance.out { color: var(--danger-text); }
.fc-allowance a { color: var(--accent-text); }

.fc .sr { --sr-track: color-mix(in srgb, var(--text) 9%, transparent); display: inline-flex; align-items: center; gap: var(--space-3); padding: var(--space-3) var(--space-5) var(--space-3) var(--space-3); border: 1px solid var(--border); border-radius: var(--radius-full); background: var(--ds-card); box-shadow: var(--elev-1); }
.fc .sr-pct { font-size: 15px; font-weight: 800; fill: var(--text); }
.fc .sr-text { display: flex; flex-direction: column; gap: 1px; white-space: nowrap; }
.fc .sr-text strong { font-size: 1.05rem; font-weight: 800; letter-spacing: -0.015em; }
.fc .sr-text span { font-size: 0.82rem; color: var(--text3); }

.fc-body { padding: var(--space-2) 0 clamp(48px, 9vh, 96px); }
.fc-body .ds-container > * { max-width: 920px; }

.fc-today { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); padding: var(--space-5) var(--space-6); border: 1px solid var(--border); border-radius: var(--radius-xl); background: var(--ds-card); box-shadow: var(--elev-1); }
.fc-today-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.fc-today-text strong { font-size: 1.2rem; font-weight: 800; letter-spacing: -0.01em; }
.fc-today-text span { font-size: 0.92rem; color: var(--text3); }
.fc-start { flex-shrink: 0; gap: var(--space-2); }
.fc-start span { padding: 1px 9px; border-radius: var(--radius-full); background: color-mix(in srgb, #fff 22%, transparent); font-size: 0.82rem; }

.fc-tiles { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-2); margin-top: var(--space-3); }
.fc-tile { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: var(--space-3) var(--space-4); border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--ds-card); font: inherit; text-align: left; cursor: pointer; transition: border-color 0.15s, background 0.15s; }
.fc-tile:hover:not(:disabled) { border-color: var(--border3); }
.fc-tile:disabled { opacity: 0.5; cursor: default; }
.fc-tile-n { font-size: 1.5rem; font-weight: 800; letter-spacing: -0.02em; line-height: 1.1; color: var(--text); }
.fc-tile-l { font-size: 0.84rem; color: var(--text3); }
.fc-tile.due .fc-tile-n { color: var(--warning-text); }
.fc-tile.session .fc-tile-n { color: var(--success-text); }
.fc-tile.on { border-color: color-mix(in srgb, var(--accent) 55%, transparent); background: var(--accent-dim); }

.fc-bar { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); padding: var(--space-5) 0 var(--space-3); }
.fc-tabs { display: inline-flex; gap: 4px; padding: 4px; border-radius: var(--radius-full); background: var(--ds-soft); border: 1px solid var(--border); }
.fc-tab { padding: 9px 16px; border: none; border-radius: var(--radius-full); background: none; color: var(--text2); font: inherit; font-size: 0.92rem; font-weight: 700; cursor: pointer; white-space: nowrap; }
.fc-tab.on { background: var(--ds-card); color: var(--t, var(--text)); box-shadow: var(--elev-1); }
.fc-selects { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); width: 100%; }
.fc-select {
  appearance: none; -webkit-appearance: none; min-width: 0; height: 40px; padding: 0 34px 0 14px;
  background: var(--ds-card) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E") no-repeat right 13px center;
  border: 1px solid var(--border2); border-radius: var(--radius-full); color: var(--text); font: inherit; font-size: 0.9rem; font-weight: 500; cursor: pointer; text-overflow: ellipsis;
}
.fc-select.set { border-color: color-mix(in srgb, var(--t) 50%, transparent); background-color: var(--w); color: var(--t); font-weight: 600; }
.fc-select-topic { flex: 1 1 240px; max-width: 360px; }
.fc-due { display: inline-flex; align-items: center; gap: var(--space-2); height: 40px; padding: 0 14px; border: 1px solid var(--border2); border-radius: var(--radius-full); background: var(--ds-card); font-size: 0.88rem; color: var(--text2); cursor: pointer; }
.fc-due input { accent-color: var(--accent); }
.fc-due.on { border-color: color-mix(in srgb, var(--accent) 50%, transparent); color: var(--accent-text); }

.fc-stopped { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); margin: var(--space-3) 0; padding: var(--space-3) var(--space-4); border-radius: var(--radius-lg); background: var(--accent-dim); font-size: 0.92rem; color: var(--text2); }
.fc-stopped button { background: none; border: none; font: inherit; font-size: 0.86rem; color: var(--text3); cursor: pointer; }
.fc-count { margin: var(--space-2) 0; font-size: 0.92rem; color: var(--text3); }
.fc-list { display: flex; flex-direction: column; gap: var(--space-2); }
.fc-row { position: relative; display: flex; align-items: flex-start; gap: var(--space-3); width: 100%; padding: var(--space-3) var(--space-4); border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--ds-card); color: var(--text); font: inherit; text-align: left; cursor: pointer; transition: border-color 0.15s, box-shadow 0.15s; }
.fc-row:hover { border-color: color-mix(in srgb, var(--t) 45%, transparent); box-shadow: var(--elev-1); }
.fc-row.due::before { content: ''; position: absolute; left: -1px; top: 10px; bottom: 10px; width: 3px; border-radius: 3px; background: var(--warning-text); }
.fc-type { flex-shrink: 0; padding: 2px 9px; border-radius: var(--radius-full); font-size: 0.74rem; font-weight: 700; white-space: nowrap; }
.t-accent { color: var(--accent-text); background: var(--accent-dim); }
.t-premium { color: var(--premium-text); background: var(--premium-wash); }
.t-warning { color: var(--warning-text); background: var(--warning-wash); }
.t-success { color: var(--success-text); background: var(--success-wash); }
.t-info { color: var(--info-text); background: var(--info-wash); }
.t-neutral { color: var(--text2); background: var(--ds-soft); }
.fc-row-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.fc-row-front { font-size: 0.95rem; line-height: 1.5; color: var(--text); }
.fc-row-topic { font-size: 0.8rem; color: var(--text3); }
.fc-row-meta { flex-shrink: 0; display: flex; align-items: center; gap: var(--space-2); }
.fc-grade { padding: 1px 8px; border-radius: var(--radius-full); font-size: 0.74rem; font-weight: 700; }
.g-danger { color: var(--danger-text); background: var(--danger-wash); }
.g-warning { color: var(--warning-text); background: var(--warning-wash); }
.g-accent { color: var(--accent-text); background: var(--accent-dim); }
.g-success { color: var(--success-text); background: var(--success-wash); }
.fc-when { font-size: 0.8rem; color: var(--text3); white-space: nowrap; }
.fc-when.due { color: var(--warning-text); font-weight: 600; }
.fc-error { color: var(--danger-text); }
.fc-more { align-self: center; margin-top: var(--space-3); }

/* The review: a calm full screen, the card in the middle, the grades where a thumb is. */
.fc-review { position: fixed; inset: 0; z-index: 2000; display: flex; align-items: center; justify-content: center; padding: var(--space-4); background: color-mix(in srgb, var(--bg) 94%, transparent); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
.fc-review-inner { width: 100%; max-width: 640px; display: flex; flex-direction: column; gap: var(--space-4); }
.fc-review-top { display: flex; align-items: center; gap: var(--space-3); }
.fc-review-count { font-size: 0.88rem; font-weight: 700; color: var(--text2); white-space: nowrap; }
.fc-review-bar { flex: 1; height: 4px; border-radius: var(--radius-full); background: var(--ds-soft); overflow: hidden; }
.fc-review-bar span { display: block; height: 100%; border-radius: inherit; background: var(--t); transition: width 0.4s ease; }
.fc-review-close { width: 38px; height: 38px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--border2); border-radius: 50%; background: var(--ds-card); color: var(--text2); cursor: pointer; }
.fc-flip { perspective: 1400px; cursor: pointer; outline: none; }
.fc-flip:focus-visible .fc-face { outline: 2px solid var(--accent); outline-offset: 3px; }
.fc-flip-inner { position: relative; min-height: 380px; transform-style: preserve-3d; transition: transform 0.55s cubic-bezier(0.23,1,0.32,1); }
.fc-flip-inner.flipped { transform: rotateY(180deg); }
.fc-face { position: absolute; inset: 0; display: flex; flex-direction: column; padding: var(--space-6); border: 1px solid var(--border2); border-top-width: 4px; border-radius: var(--radius-xl); background: var(--ds-card); color: var(--text); box-shadow: var(--elev-3); backface-visibility: hidden; -webkit-backface-visibility: hidden; overflow-y: auto; }
.fc-face.t-accent { border-top-color: var(--accent); }
.fc-face.t-premium { border-top-color: var(--premium-text); }
.fc-face.t-warning { border-top-color: var(--warning-text); }
.fc-face.t-success { border-top-color: var(--success-text); }
.fc-face.t-info { border-top-color: var(--info-text); }
.fc-face.t-neutral { border-top-color: var(--text3); }
.fc-face.back { transform: rotateY(180deg); }
.fc-face-head { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-2); margin-bottom: var(--space-4); }
.fc-face-topic { font-size: 0.84rem; color: var(--text3); }
.fc-face-text { flex: 1; display: flex; align-items: center; font-size: clamp(1.1rem, 2.6vw, 1.3rem); font-weight: 600; line-height: 1.55; letter-spacing: -0.01em; }
.fc-face-asked { margin-top: var(--space-3); font-size: 0.84rem; font-weight: 600; color: var(--t); }
.fc-face-hint { margin-top: var(--space-3); font-size: 0.86rem; color: var(--text3); text-align: center; }
.fc-answer-label { font-size: 0.86rem; font-weight: 700; color: var(--text3); }
.fc-face-answer { font-size: 1rem; line-height: 1.75; white-space: pre-line; }
.fc-locked { display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-3); white-space: normal; }
.fc-muted { color: var(--text3); }
.fc-err { color: var(--danger-text); }
.fc-rate { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-2); opacity: 0; transform: translateY(8px); pointer-events: none; transition: opacity 0.25s ease 0.1s, transform 0.25s ease 0.1s; }
.fc-rate.on { opacity: 1; transform: none; pointer-events: auto; }
.fc-rate-btn { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: var(--space-3) var(--space-2); border: 1px solid transparent; border-radius: var(--radius-lg); font: inherit; cursor: pointer; transition: transform 0.12s, border-color 0.15s; }
.fc-rate-btn strong { font-size: 0.95rem; }
.fc-rate-btn span { font-size: 0.78rem; opacity: 0.85; }
.fc-rate-btn:hover { border-color: currentColor; }
.fc-rate-btn:active { transform: scale(0.97); }
.fc-keys { margin: 0; font-size: 0.82rem; color: var(--text3); text-align: center; }

@media (max-width: 760px) {
  .fc-hero-row { flex-direction: column; align-items: stretch; gap: var(--space-4); }
  .fc-hero-side { padding-bottom: 0; }
}
@media (max-width: 640px) {
  .fc-lede { font-size: 1rem; }
  .fc .sr { padding: var(--space-2) var(--space-4) var(--space-2) var(--space-2); }
  .fc .sr svg { width: 54px; height: 54px; }
  .fc-today { flex-direction: column; align-items: stretch; padding: var(--space-4); }
  .fc-start { justify-content: center; }
  .fc-tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .fc-tabs { display: flex; width: 100%; }
  .fc-tab { flex: 1; padding: 8px 4px; font-size: 0.84rem; }
  .fc-selects { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .fc-select-topic, .fc-due { grid-column: 1 / -1; max-width: none; }
  .fc-row { flex-wrap: wrap; }
  .fc-row-text { order: 3; flex-basis: 100%; }
  .fc-row-meta { margin-left: auto; }
  .fc-review { padding: 0; align-items: stretch; background: var(--bg); }
  .fc-review-inner { max-width: none; height: 100dvh; padding: var(--space-3) var(--space-4) calc(var(--space-4) + env(safe-area-inset-bottom, 0px)); }
  .fc-flip { flex: 1; display: flex; }
  .fc-flip-inner { flex: 1; min-height: 0; }
  .fc-face { padding: var(--space-5); }
  .fc-rate { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .fc-rate-btn { padding: var(--space-3); }
  .fc-keys { display: none; }
}
@media (hover: none) { .fc-keys { display: none; } }
@media (prefers-reduced-motion: reduce) { .fc-flip-inner { transition: none; } .fc-rate { transition: none; } }
`;
