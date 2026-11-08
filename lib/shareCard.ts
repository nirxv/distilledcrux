import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { labelForOptional } from '@/lib/optionals';

/**
 * A shareable summary of an answer check, and the signature that proves the
 * site produced it.
 *
 * Answer checks are not stored, so the card travels: /api/evaluate signs it
 * and hands it to the page, the page keeps it with the result, and /api/share
 * checks the signature before publishing. A card that was not signed here, or
 * was edited, is refused, so nobody can publish a score the site did not give.
 * The card holds the question, the marks, the marks per part and a few lines
 * of feedback, never the answer.
 */
export type ShareCard = {
  question: string;
  marks: number;
  outOf: number;
  optional: string;
  subject: string;
  lang: 'en' | 'hi';
  sections: { key: 'introduction' | 'body' | 'conclusion' | 'presentation'; awarded: number; outOf: number }[];
  worked: string[];
  improve: string[];
};

const SECTION_KEYS = ['introduction', 'body', 'conclusion', 'presentation'] as const;
type Part = { strengths?: unknown; weaknesses?: unknown; suggestions?: unknown };

const lines = (v: unknown): string[] =>
  (Array.isArray(v) ? v : typeof v === 'string' ? [v] : [])
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    .map((x) => (x.length > 240 ? x.slice(0, 237).trimEnd() + '…' : x.trim()));

/** The first lines across the parts, body first since it carries most marks. */
const firstLines = (parts: (Part | undefined)[], key: keyof Part, n: number) =>
  parts.flatMap((p) => lines(p?.[key])).slice(0, n);

export function cardFromEvaluation(question: string, optional: string, lang: string, ev: {
  marks?: number; marks_out_of?: number;
  section_marks?: Record<string, { awarded?: number; out_of?: number }>;
  introduction?: Part; body?: Part; conclusion?: Part;
}): ShareCard {
  const parts = [ev.body, ev.introduction, ev.conclusion];
  const improve = firstLines(parts, 'suggestions', 2);
  return {
    question: question.slice(0, 600),
    marks: Number(ev.marks ?? 0),
    outOf: Number(ev.marks_out_of ?? 0),
    optional,
    subject: labelForOptional(optional) ?? optional,
    lang: lang === 'hi' ? 'hi' : 'en',
    sections: SECTION_KEYS.flatMap((key) => {
      const s = ev.section_marks?.[key];
      return s && typeof s.awarded === 'number' && typeof s.out_of === 'number'
        ? [{ key, awarded: s.awarded, outOf: s.out_of }] : [];
    }),
    worked: firstLines(parts, 'strengths', 2),
    improve: improve.length ? improve : firstLines(parts, 'weaknesses', 2),
  };
}

// A key of its own, derived from a server secret the deployment already has.
const key = () => createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').update('dc-share-card-v1').digest();
const sign = (body: string) => createHmac('sha256', key()).update(body).digest('base64url');

/** "<payload>.<signature>", both base64url. The payload names the reader it was made for. */
export function signCard(uid: string, card: ShareCard): string {
  const body = Buffer.from(JSON.stringify({ uid, card })).toString('base64url');
  return `${body}.${sign(body)}`;
}

export function verifyCardToken(token: unknown): { uid: string; card: ShareCard } | null {
  if (typeof token !== 'string' || token.length > 12000) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return typeof parsed?.uid === 'string' && parsed.card ? parsed : null;
  } catch { return null; }
}

export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
