/**
 * Topper copy names and limits with no copy data attached, so client
 * components can use them without pulling in the list (lib/toppers/index.ts).
 */

/** Optionals whose copies are live. One at a time, as each gets enough copies. */
export const TOPPER_SUBJECTS = ['sociology'] as const;
export type TopperSubject = (typeof TOPPER_SUBJECTS)[number];

export function isTopperSubject(value: unknown): value is TopperSubject {
  return typeof value === 'string' && (TOPPER_SUBJECTS as readonly string[]).includes(value);
}

/** Copies anyone signed in may open before a subscription is needed, across all optionals. */
export const FREE_TOPPER_LIMIT = 5;

/** What the pages and the browser may see of a copy. The R2 key never leaves the server. */
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
  /** Where the booklet came from, e.g. "LevelUp IAS Sociology Test Series 2024, Test 01". */
  source: string;
  pages: number;
};

/** "AIR 22 · CSE 2024", or as much of it as is known. */
export function rankLine(c: Pick<TopperCopy, 'rank' | 'year'>): string {
  return [c.rank ? `AIR ${c.rank}` : '', c.year ? `CSE ${c.year}` : ''].filter(Boolean).join(' · ');
}
