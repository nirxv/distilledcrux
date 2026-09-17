/**
 * Indian mobile validation, shared by the onboarding form and the route that
 * stores the number.
 *
 * It lives here rather than in either of them so the two cannot drift: the
 * form must not accept a number the route will reject, and the route must
 * never trust that the form checked anything.
 *
 * This used to fall back to a generic international check of 8 to 15 digits
 * whenever the input did not look Indian. That is how +90800888 reached the
 * table: eight digits behind a Turkish country code, on a field labelled +91.
 * The fallback protected a case that does not exist here, since the field
 * shows a fixed +91, so it is gone. Only an Indian mobile is accepted now.
 */

/** An allocated Indian mobile is ten digits opening with 6, 7, 8 or 9. */
const INDIAN_MOBILE = /^[6-9]\d{9}$/;

export type PhoneResult =
  | { ok: true; phone: string }
  | { ok: false; error: string };

const NOT_A_NUMBER = 'Enter a 10-digit Indian mobile number.';
const NOT_REAL = 'That number is not a real mobile number.';

/**
 * Numbers that are the right shape and obviously invented. A mandatory field
 * is only worth having if someone can be reached on the answer, and these are
 * what people type when a form will not let them past.
 *
 * Deliberately narrow. This field blocks access, so wrongly rejecting a real
 * number costs a reader their account, which is worse than letting one fake
 * through. Only patterns no allocated number realistically carries are here.
 */
function isInvented(digits: string): boolean {
  // 9999999999, and anything else with barely any variety: 9898989898,
  // 9090909090, 8888899999.
  if (new Set(digits).size <= 2) return true;

  // A straight run in either direction: 9876543210, 6789012345. Counted
  // modulo 10, because a run crosses the 9-to-0 wrap and a plain subtraction
  // reads that step as -9 and lets the number through.
  const d = [...digits].map(Number);
  const steps = d.slice(1).map((n, i) => (n - d[i] + 10) % 10);
  if (steps.every(s => s === 1) || steps.every(s => s === 9)) return true;

  return false;
}

/**
 * Accepts what people actually type into a field already labelled +91:
 *
 *   9876543210      the ten digits, as the label invites
 *   09876543210     with the trunk prefix, as written on forms in India
 *   +919876543210   the whole thing again, ignoring the label
 *   91 98765 43210  spaced, hyphenated or bracketed, in any of the above
 *
 * Always returns E.164, so the stored value is dialable as written.
 */
export function normalizeIndianMobile(raw: unknown): PhoneResult {
  if (typeof raw !== 'string') return { ok: false, error: NOT_A_NUMBER };

  // Strip the separators people type. Anything else surviving this is a real
  // character in the wrong place and should fail rather than be dropped.
  const cleaned = raw.replace(/[\s\-().]/g, '');
  if (!/^\+?\d+$/.test(cleaned)) return { ok: false, error: NOT_A_NUMBER };

  // Peel one country code or one trunk prefix, not both and not repeatedly:
  // +9191... is not a number anyone has.
  const national = cleaned
    .replace(/^\+?91(?=[6-9]\d{9}$)/, '')
    .replace(/^0(?=[6-9]\d{9}$)/, '');

  if (!INDIAN_MOBILE.test(national)) return { ok: false, error: NOT_A_NUMBER };
  if (isInvented(national)) return { ok: false, error: NOT_REAL };

  return { ok: true, phone: `+91${national}` };
}

/**
 * Kept so callers reading a stored value do not need to know the format.
 * Everything in the column is E.164 with an Indian country code.
 */
export function formatIndianMobile(stored: string | null | undefined): string {
  if (!stored) return '—';
  const m = /^\+91(\d{5})(\d{5})$/.exec(stored);
  return m ? `+91 ${m[1]} ${m[2]}` : stored;
}
