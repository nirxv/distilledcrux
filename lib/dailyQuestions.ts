import { loadPyqs, type Pyq, type PyqSubject } from '@/lib/pyqs';
import { istDay } from '@/lib/istDay';

/**
 * Daily answer writing: five past questions a day for each optional, the same
 * for every reader of it that day, as on historyoptional.xyz.
 *
 * The day is Asia/Kolkata's, the exam's timezone, so two readers practising at
 * the same moment get the same five. The questions come from the last ten
 * years' papers and carry 10, 15 or 20 marks, so each can go straight to the
 * evaluator with a time to write it in. The papers alternate: I, II, I, II,
 * then either. The dashboard's question for today is the first of the five.
 *
 * Server-only: it reads the question bank, and only the five are sent.
 */
export type DailyQuestion = Pick<Pyq, 'id' | 'question' | 'paper' | 'marks' | 'year' | 'topic'>;

/** In the order the optionals are listed across the site. */
export const DAILY_SUBJECTS: PyqSubject[] = ['sociology', 'anthropology', 'geography', 'polsci', 'pub-admin'];

export async function dailyQuestions(subject: PyqSubject, day: string = istDay()): Promise<DailyQuestion[]> {
  const { questions } = await loadPyqs(subject);
  const newest = Math.max(0, ...questions.map((q) => Number(q.year) || 0));
  const pool = questions.filter((q) => q.marks && [10, 15, 20].includes(q.marks) && Number(q.year) >= newest - 10);

  const rand = seeded(`${day}:${subject}`);

  const p1 = pool.filter((q) => q.paper === 'Paper I');
  const p2 = pool.filter((q) => q.paper === 'Paper II');
  const picked: DailyQuestion[] = [];
  const used = new Set<number>();
  for (const from of [p1, p2, p1, p2, pool]) {
    const left = from.filter((q) => !used.has(q.id));
    if (!left.length) continue;
    const q = left[Math.floor(rand() * left.length)];
    used.add(q.id);
    picked.push({ id: q.id, question: q.question, paper: q.paper, marks: q.marks, year: q.year, topic: q.topic });
  }
  return picked;
}

/**
 * A random sequence fixed by a string: FNV-1a to hash it, mulberry32 to draw.
 * Hashing matters. historyoptional.xyz seeded a plain LCG with the date as a
 * number, and since consecutive dates are consecutive numbers its first draw
 * barely moved: the same first question came back two or three days running.
 */
function seeded(key: string): () => number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The set for a YYYY-MM-DD day in Asia/Kolkata, or null for a malformed day. */
export async function dailyQuestionsFor(subject: PyqSubject, day: string): Promise<DailyQuestion[] | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const noon = new Date(`${day}T12:00:00+05:30`);
  return Number.isNaN(noon.getTime()) || istDay(noon) !== day ? null : dailyQuestions(subject, day);
}
