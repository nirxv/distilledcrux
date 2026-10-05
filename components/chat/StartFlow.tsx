'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getNoteBySlug } from '@/lib/notes';
import {
  DIMENSIONS, REVISION,
  anglesFor, goalsFor, notesIn, sectionsFor, stepComplete, stepsFor,
  type Picked, type StartState, type StepId,
} from '@/lib/chatStart';
import { CHAT_TOPIC_PYQS_LIVE, FLASHCARDS_LIVE } from '@/lib/features';
import type { SubjectKey } from '@/lib/subjectConfig';

export type RelatedPyq = Picked;

export type Related = {
  topic: { slug: string; title: string; section: string; paper: 1 | 2 };
  pyqs: RelatedPyq[];
  flashcards: number | null;
};

// One fetch per topic per page load. The route is cached at the edge as well,
// so this only saves the round trip when the reader moves back and forth.
const relatedCache = new Map<string, Promise<Related | null>>();

export function loadRelated(slug: string): Promise<Related | null> {
  // Everything the route serves is switched off for now (lib/features.ts), so
  // there is nothing to ask it for.
  if (!CHAT_TOPIC_PYQS_LIVE && !FLASHCARDS_LIVE) return Promise.resolve(null);
  let p = relatedCache.get(slug);
  if (!p) {
    p = fetch(`/api/chat/related?slug=${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? (r.json() as Promise<Related>) : null))
      .catch(() => null);
    relatedCache.set(slug, p);
    // A failure should not stick for the rest of the visit.
    p.then((v) => { if (!v) relatedCache.delete(slug); });
  }
  return p;
}

type Props = {
  langHi: boolean;
  subject: SubjectKey;
  state: StartState;
  onChange: (next: StartState) => void;
  subscribed: boolean;
  onPremium: () => void;
  onDone: () => void;
};

const TITLES: Record<StepId, { en: string; hi: string }> = {
  goal:      { en: 'I want to:', hi: 'मुझे करना है:' },
  topic:     { en: 'Topic:', hi: 'विषय:' },
  focus:     { en: 'Narrow it down (optional):', hi: 'और सटीक करें (वैकल्पिक):' },
  angle:     { en: 'Cover (optional):', hi: 'किन पहलुओं पर (वैकल्पिक):' },
  question:  { en: 'Pick a past question:', hi: 'पिछले वर्ष का प्रश्न चुनें:' },
  dimension: { en: 'Compare them on:', hi: 'किन आधारों पर तुलना करें:' },
  revision:  { en: 'Give me:', hi: 'मुझे चाहिए:' },
};

const Check = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);

function toggle(list: string[], v: string, max = Infinity): string[] {
  if (list.includes(v)) return list.filter((x) => x !== v);
  if (list.length >= max) return [...list.slice(1), v];
  return [...list, v];
}

export default function StartFlow({ langHi, subject, state, onChange, subscribed, onPremium, onDone }: Props) {
  const steps = stepsFor(state.goal);
  const [stepIdx, setStepIdx] = useState(0);
  const step = steps[Math.min(stepIdx, steps.length - 1)];
  const last = stepIdx >= steps.length - 1 && state.goal !== null;

  const sections = sectionsFor(subject);
  const firstTopic = state.topics[0] ? getNoteBySlug(state.topics[0]) : undefined;
  const [section, setSection] = useState<string>(firstTopic?.section ?? sections[0]);

  const cardRef = useRef<HTMLDivElement>(null);
  const [related, setRelated] = useState<Related | null>(null);
  const [relatedFor, setRelatedFor] = useState<string | null>(null);
  const [shown, setShown] = useState(6);
  const topicSlug = state.topics[0] ?? null;
  const needsQuestions = step === 'question' && topicSlug !== null;

  useEffect(() => {
    if (!needsQuestions || !topicSlug) return;
    let live = true;
    loadRelated(topicSlug).then((r) => {
      if (!live) return;
      setRelated(r);
      setRelatedFor(topicSlug);
      setShown(6);
    });
    return () => { live = false; };
  }, [needsQuestions, topicSlug]);

  // The card gives way on a short screen by scrolling its list, but a flex
  // column counts a scrolling list at its full height when working out how
  // small the card may get, so without a floor the card either refuses to
  // shrink or shrinks until Next slides under the input. The floor is the
  // card's fixed parts plus enough list to choose from.
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const fit = () => {
      const list = card.querySelector<HTMLElement>('.ch-chips.long, .ch-pyq-list');
      if (!list) { card.style.minHeight = ''; return; }
      const cs = getComputedStyle(card);
      let fixed = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom)
        + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
      for (const el of Array.from(card.children) as HTMLElement[]) {
        if (el === list) continue;
        const m = getComputedStyle(el);
        fixed += el.offsetHeight + parseFloat(m.marginTop) + parseFloat(m.marginBottom);
      }
      const floor = window.innerHeight < 760 ? 96 : 120;
      card.style.minHeight = `${Math.round(fixed + Math.min(floor, list.scrollHeight))}px`;
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [step, relatedFor, section, shown]);

  // On a screen too short for the whole card, a new step can leave Previous
  // and Next under the pinned input; bring them back up. Nothing moves when
  // everything fits, which is every laptop size the page was checked at.
  // The input grows when a step writes a long question into it, so this is
  // checked again whenever it changes size, not only when the step changes.
  useEffect(() => {
    const card = cardRef.current;
    const scroller = card?.closest('.ch-scroll');
    const composer = scroller?.querySelector('.ch-start > .ch-composer');
    const nav = card?.querySelector('.ch-flow-nav');
    if (!scroller || !composer || !nav) return;
    const reveal = () => {
      const hidden = nav.getBoundingClientRect().bottom - composer.getBoundingClientRect().top;
      if (hidden > 0) scroller.scrollBy({ top: hidden + 8, behavior: 'smooth' });
    };
    reveal();
    const ro = new ResizeObserver(reveal);
    ro.observe(composer);
    return () => ro.disconnect();
  }, [stepIdx, relatedFor]);

  const t = (l: { en: string; hi: string }) => (langHi ? l.hi : l.en);
  const multiTopic = state.goal === 'compare';
  const note = firstTopic;

  const next = () => {
    if (!stepComplete(step, state)) return;
    if (last) { onDone(); return; }
    setStepIdx((i) => i + 1);
  };
  const prev = () => setStepIdx((i) => Math.max(0, i - 1));

  const chip = (opts: {
    key: string; label: string; selected: boolean; multi: boolean; onClick: () => void; premium?: boolean;
  }) => (
    <button
      key={opts.key}
      type="button"
      className={`ch-chip${opts.multi ? ' multi' : ''}${opts.selected ? ' on' : ''}`}
      aria-pressed={opts.selected}
      onClick={opts.onClick}
    >
      {opts.multi && <span className="ch-chip-box">{opts.selected && <Check />}</span>}
      {opts.label}
      {opts.premium && !subscribed && <span className="ch-chip-premium">✦</span>}
    </button>
  );

  let body: React.ReactNode = null;

  if (step === 'goal') {
    body = (
      <div className="ch-chips">
        {goalsFor(subject).map((g) => chip({
          key: g.id, label: t(g.label), selected: state.goal === g.id, multi: false, premium: g.premium,
          onClick: () => {
            // A second tap on the chosen goal clears it, and everything that
            // hung off it, so the reader can start the path again.
            if (state.goal === g.id) {
              onChange({ ...state, goal: null, pyq: null, dimensions: [], revision: null });
              return;
            }
            if (g.premium && !subscribed) { onPremium(); return; }
            // A new goal keeps the topic where it still fits, and drops the
            // choices that belonged to the old path.
            onChange({
              ...state,
              goal: g.id,
              topics: g.id === 'compare' ? state.topics : state.topics.slice(0, 1),
              pyq: null, dimensions: [], revision: null,
            });
          },
        }))}
      </div>
    );
  } else if (step === 'topic') {
    body = (
      <>
        <div className="ch-tabs" role="tablist">
          {sections.map((s) => {
            const count = state.topics.filter((slug) => getNoteBySlug(slug)?.section === s).length;
            return (
              <button
                key={s}
                role="tab"
                aria-selected={section === s}
                className={`ch-tab${section === s ? ' on' : ''}`}
                data-section={s}
                onClick={() => setSection(s)}
              >
                {s}
                {count > 0 && <span className="ch-tab-dot" />}
              </button>
            );
          })}
        </div>
        <div className="ch-chips long">
          {notesIn(subject, section).map((n) => chip({
            key: n.slug,
            label: n.title,
            selected: state.topics.includes(n.slug),
            multi: multiTopic,
            onClick: () => {
              const topics = multiTopic
                ? toggle(state.topics, n.slug, 2)
                : state.topics[0] === n.slug ? [] : [n.slug];
              onChange({ ...state, topics, focus: [], pyq: null });
            },
          }))}
        </div>
      </>
    );
  } else if (step === 'focus' && note) {
    body = (
      <div className="ch-chips">
        {(note.subtopics ?? []).map((s) => chip({
          key: s, label: s, selected: state.focus.includes(s), multi: true,
          onClick: () => onChange({ ...state, focus: toggle(state.focus, s) }),
        }))}
      </div>
    );
  } else if (step === 'angle') {
    body = (
      <div className="ch-chips">
        {anglesFor(subject).map((a) => chip({
          key: a.id, label: t(a.label), selected: state.angles.includes(a.id), multi: true,
          onClick: () => onChange({ ...state, angles: toggle(state.angles, a.id) }),
        }))}
      </div>
    );
  } else if (step === 'dimension') {
    body = (
      <div className="ch-chips">
        {DIMENSIONS.map((d) => chip({
          key: d.id, label: t(d.label), selected: state.dimensions.includes(d.id), multi: true,
          onClick: () => onChange({ ...state, dimensions: toggle(state.dimensions, d.id) }),
        }))}
      </div>
    );
  } else if (step === 'revision') {
    body = (
      <div className="ch-chips">
        {REVISION.map((r) => chip({
          key: r.id, label: t(r.label), selected: state.revision === r.id, multi: false,
          onClick: () => onChange({ ...state, revision: state.revision === r.id ? null : r.id }),
        }))}
      </div>
    );
  } else if (step === 'question') {
    const ready = related && relatedFor === topicSlug;
    body = !ready ? (
      <div className="ch-pyq-list" aria-busy="true">
        {[0, 1, 2].map((i) => <div key={i} className="ch-pyq-skel" />)}
      </div>
    ) : related.pyqs.length === 0 ? (
      <div className="ch-flow-empty">
        {langHi
          ? 'इस विषय से अभी कोई पिछला प्रश्न नहीं जुड़ा है। दूसरा विषय चुनें।'
          : 'No past questions are filed under this topic yet. Try another topic.'}
      </div>
    ) : (
      <div className="ch-pyq-list">
        {related.pyqs.slice(0, shown).map((q) => (
          <button
            key={q.id}
            type="button"
            className={`ch-pyq${state.pyq?.id === q.id ? ' on' : ''}`}
            aria-pressed={state.pyq?.id === q.id}
            onClick={() => onChange({ ...state, pyq: state.pyq?.id === q.id ? null : q })}
          >
            <span className="ch-pyq-meta">{q.year} · {q.marks} {langHi ? 'अंक' : 'marks'}</span>
            <span className="ch-pyq-text">{q.question}</span>
          </button>
        ))}
        {related.pyqs.length > shown && (
          <button type="button" className="ch-link-btn" onClick={() => setShown((n) => n + 6)}>
            {langHi
              ? `और दिखाएँ (${related.pyqs.length - shown} बाकी)`
              : `Show more (${related.pyqs.length - shown} more)`}
          </button>
        )}
      </div>
    );
  }

  const stepTitle = step === 'topic' && multiTopic
    ? (langHi ? 'दो विषय चुनें:' : 'Pick two topics:')
    : t(TITLES[step]);

  return (
    <div className="ch-flow" ref={cardRef}>
      <div className="ch-flow-head">
        <span className="ch-flow-q">{stepTitle}</span>
        {state.goal && (
          <span className="ch-flow-count">{stepIdx + 1} / {steps.length}</span>
        )}
      </div>
      {body}
      <div className="ch-flow-nav">
        {stepIdx > 0 ? (
          <button type="button" className="ch-prev" onClick={prev}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
            {langHi ? 'पिछला' : 'Previous'}
          </button>
        ) : <span />}
        <button type="button" className="ch-next" onClick={next} disabled={!stepComplete(step, state)}>
          {last ? (langHi ? 'हो गया' : 'Done') : (
            <>
              {langHi ? 'आगे' : 'Next'}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
