/**
 * Topper copy names and limits with no copy data attached, so client
 * components can use them without pulling in the list (lib/toppers/index.ts).
 */

import COUNTS from './counts.json';

/** Optionals whose copies are live. One at a time, as each gets enough copies. */
export const TOPPER_SUBJECTS = ['sociology'] as const;
export type TopperSubject = (typeof TOPPER_SUBJECTS)[number];

/** How many copies and toppers each live optional has, for pages that must not load the list. */
export const TOPPER_COUNTS = COUNTS as Record<TopperSubject, { copies: number; toppers: number }>;

/** Display names, kept here so client code needs nothing from lib/pyqs. */
export const TOPPER_SUBJECT_NAME: Record<TopperSubject, string> = { sociology: 'Sociology' };

export function isTopperSubject(value: unknown): value is TopperSubject {
  return typeof value === 'string' && (TOPPER_SUBJECTS as readonly string[]).includes(value);
}

/** Copies anyone signed in may open before a subscription is needed, across all optionals. */
export const FREE_TOPPER_LIMIT = 5;

/**
 * The topper copy pass: every copy in one optional for a year, paid once, for
 * readers who want the copies without a subscription. A subscription to the
 * optional includes them anyway. The server bills and checks exactly this.
 */
export const TOPPER_PASS = { amountPaise: 79900, days: 365 } as const;
export const TOPPER_PASS_RUPEES = TOPPER_PASS.amountPaise / 100;

/** What the pages and the browser may see of a copy. The R2 key and the booklet's source never leave the server. */
export type TopperCopy = {
  id: string;
  paper: 'Paper I' | 'Paper II';
  question: string;
  marks: number;
  topic: string;
  /** Past questions this answer would substantially answer, ids in public/data/<subject>-pyqs.json. */
  pyqs: number[];
  /** The printed test question it answers; copies sharing one can be compared. */
  group: string;
  topper: string;
  rank: number | null;
  /** The Civil Services exam the rank was earned in. */
  year: number | null;
  pages: number;
};

/** "AIR 22 · CSE 2024", or as much of it as is known. */
export function rankLine(c: Pick<TopperCopy, 'rank' | 'year'>): string {
  return [c.rank ? `AIR ${c.rank}` : '', c.year ? `CSE ${c.year}` : ''].filter(Boolean).join(' · ');
}
