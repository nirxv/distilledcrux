/**
 * The chat page's guided start: a few taps that write the question for you.
 *
 * Each goal takes its own path. "Answer a PYQ" ends on a real past question
 * from the data; "compare" needs two topics and what to compare them on;
 * "understand" narrows a topic to its subtopics and the angles UPSC asks
 * about. The text is rebuilt from the selections after every tap, so the
 * input always shows exactly what will be sent and the reader can edit it
 * before sending.
 *
 * The topics are the subject's notes, so every optional gets its own list.
 * Pure functions only, so the composition is testable without a DOM
 * (tests/chatStart.test.mts).
 */
import { getNoteBySlug, notesForSubject, type SubjectNote } from './notes';
import { CHAT_TOPIC_PYQS_LIVE } from './features';
import type { SubjectKey } from './subjectConfig';

export type Goal = 'understand' | 'pyq' | 'compare' | 'scholars' | 'revise' | 'mentor';

export type StepId = 'goal' | 'topic' | 'focus' | 'angle' | 'question' | 'dimension' | 'revision';

/** A past question to answer. Papers before 2016 often print no marks. */
export type Picked = { id: number; year: number; marks: number | null; question: string };

/** What the chat is sent when a reader picks a past question to answer. */
export function pyqPrompt(q: Picked): string {
  return `Answer this PYQ (${q.year}${q.marks ? `, ${q.marks} marks` : ''}): ${q.question}`;
}

export type StartState = {
  goal: Goal | null;
  /** Note slugs. One for every goal except compare, which takes two. */
  topics: string[];
  /** Subtopics of the chosen note. */
  focus: string[];
  angles: string[];
  dimensions: string[];
  revision: string | null;
  pyq: Picked | null;
};

export const EMPTY_START: StartState = {
  goal: null, topics: [], focus: [], angles: [], dimensions: [], revision: null, pyq: null,
};

type Label = { en: string; hi: string };

/**
 * Who a subject's arguments belong to, for "See what thinkers argue". The
 * word has to fit the discipline: a geographer is not a "thinker" in the way
 * Durkheim is. The Hindi is the plural form that takes "के".
 */
export const SCHOLARS: Record<SubjectKey, Label> = {
  sociology:     { en: 'thinkers', hi: 'विचारकों' },
  anthropology:  { en: 'anthropologists', hi: 'नृविज्ञानियों' },
  polsci:        { en: 'thinkers', hi: 'विचारकों' },
  geography:     { en: 'geographers', hi: 'भूगोलवेत्ताओं' },
  'pub-admin':   { en: 'thinkers', hi: 'विचारकों' },
};

/** The goals the start screen offers. The past-question paths need topic PYQs. */
export function goalsFor(subject: SubjectKey): { id: Goal; label: Label; premium?: boolean }[] {
  const who = SCHOLARS[subject];
  const all: { id: Goal; label: Label; premium?: boolean; needsPyqs?: boolean }[] = [
    { id: 'understand', label: { en: 'Understand a topic', hi: 'कोई विषय समझना' } },
    { id: 'pyq',        label: { en: 'Answer a past question', hi: 'पिछले वर्ष का प्रश्न हल करना' }, needsPyqs: true },
    { id: 'compare',    label: { en: 'Compare two topics', hi: 'दो विषयों की तुलना' } },
    { id: 'scholars',   label: { en: `See what ${who.en} argue`, hi: `${who.hi} के मत जानना` } },
    { id: 'revise',     label: { en: 'Revise quickly', hi: 'जल्दी दोहराना' } },
    { id: 'mentor',     label: { en: 'Practise with a mentor', hi: 'मेंटर के साथ अभ्यास' }, premium: true, needsPyqs: true },
  ];
  return all.filter((g) => !g.needsPyqs || CHAT_TOPIC_PYQS_LIVE);
}

/** The angles a UPSC question on a topic is usually built on. */
export function anglesFor(subject: SubjectKey): { id: string; label: Label }[] {
  const who = SCHOLARS[subject];
  return [
    { id: 'key concepts',         label: { en: 'Key concepts', hi: 'मुख्य अवधारणाएँ' } },
    { id: `${who.en}' views`,     label: { en: `${who.en[0].toUpperCase()}${who.en.slice(1)}' views`, hi: `${who.hi} के मत` } },
    { id: 'the Indian context',   label: { en: 'Indian context', hi: 'भारतीय संदर्भ' } },
    { id: 'criticisms',           label: { en: 'Criticisms', hi: 'आलोचनाएँ' } },
    { id: 'examples',             label: { en: 'Examples', hi: 'उदाहरण' } },
  ];
}

export const DIMENSIONS: { id: string; label: Label }[] = [
  { id: 'core ideas',      label: { en: 'Core ideas', hi: 'मूल विचार' } },
  { id: 'method',          label: { en: 'Method', hi: 'पद्धति' } },
  { id: 'context',         label: { en: 'Context', hi: 'संदर्भ' } },
  { id: 'criticisms',      label: { en: 'Criticisms', hi: 'आलोचनाएँ' } },
  { id: 'relevance today', label: { en: 'Relevance today', hi: 'आज की प्रासंगिकता' } },
];

export const REVISION: { id: string; label: Label }[] = [
  { id: 'facts',     label: { en: 'Key concepts and terms', hi: 'मुख्य अवधारणाएँ और शब्द' } },
  { id: 'summary',   label: { en: 'A one-page summary', hi: 'एक पेज का सार' } },
  { id: 'practice',  label: { en: 'Practice questions', hi: 'अभ्यास प्रश्न' } },
];

/** The subject's sections, in the order its notes run. */
export function sectionsFor(subject: SubjectKey): string[] {
  return [...new Set(notesForSubject(subject).map((n) => n.section))];
}

export function notesIn(subject: SubjectKey, section: string): SubjectNote[] {
  return notesForSubject(subject).filter((n) => n.section === section);
}

/** The steps a goal walks through, in order. */
export function stepsFor(goal: Goal | null): StepId[] {
  switch (goal) {
    case 'understand': return ['goal', 'topic', 'focus', 'angle'];
    case 'pyq':
    case 'mentor':     return ['goal', 'topic', 'question'];
    case 'compare':    return ['goal', 'topic', 'dimension'];
    case 'scholars':   return ['goal', 'topic', 'focus'];
    case 'revise':     return ['goal', 'topic', 'revision'];
    default:           return ['goal'];
  }
}

/** Whether Next is allowed. Narrowing steps are optional; choices are not. */
export function stepComplete(step: StepId, s: StartState): boolean {
  switch (step) {
    case 'goal':      return s.goal !== null;
    case 'topic':     return s.goal === 'compare' ? s.topics.length === 2 : s.topics.length === 1;
    case 'question':  return s.pyq !== null;
    case 'revision':  return s.revision !== null;
    default:          return true;
  }
}

/** "a", "a and b", "a, b and c". */
export function list(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function title(slug: string): string {
  return getNoteBySlug(slug)?.title ?? slug;
}

/**
 * The question as it stands. Empty until there is enough to say something,
 * so the input keeps its placeholder rather than showing half a sentence.
 */
export function compose(s: StartState, subject: SubjectKey): string {
  if (!s.goal) return '';
  const topics = s.topics.map(title);
  const topic = topics[0];

  switch (s.goal) {
    case 'understand': {
      if (!topic) return '';
      let q = s.focus.length ? `Explain ${list(s.focus)} (${topic})` : `Explain ${topic}`;
      if (s.angles.length) q += `: ${list(s.angles)}`;
      return q;
    }
    case 'pyq':
    case 'mentor':
      if (s.pyq) return pyqPrompt(s.pyq);
      return '';
    case 'compare': {
      if (topics.length < 2) return topic ? `Compare ${topic} and …` : '';
      const q = `Compare ${topics[0]} and ${topics[1]}`;
      return s.dimensions.length ? `${q} on ${list(s.dimensions)}` : q;
    }
    case 'scholars': {
      if (!topic) return '';
      const about = s.focus.length ? `${list(s.focus)} (${topic})` : topic;
      return `What do ${SCHOLARS[subject].en} argue about ${about}? Set out the main debates and who holds each view.`;
    }
    case 'revise': {
      if (!topic) return '';
      switch (s.revision) {
        case 'facts':    return `Key concepts and terms for ${topic}, with the ${SCHOLARS[subject].en} behind each`;
        case 'summary':  return `A one-page revision summary of ${topic}`;
        case 'practice': return `Practice Mains questions on ${topic}, with a line on how to approach each`;
        default:         return `Revise ${topic}`;
      }
    }
  }
}

/**
 * Past questions ask for a Mains answer, so they go out in that format; the
 * other goals keep whatever style the reader has chosen.
 */
export function formatFor(s: StartState): 'mains' | undefined {
  return s.goal === 'pyq' || s.goal === 'mentor' ? 'mains' : undefined;
}
