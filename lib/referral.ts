import type { PlanId } from '@/lib/plans';

/**
 * Referrals: what counts and what it earns. Shared by the server, which
 * grants, and the pages, which say what the reward is.
 *
 * A referral pays out on a friend's first purchase of a long plan. The day
 * plan does not count: at ₹49 a second account could buy it to collect the
 * inviter's 30 days.
 */
export const REFERRER_DAYS = 30;
export const REFERRED_DAYS = 15;
export const REFERRAL_PLANS: readonly PlanId[] = ['sixmonth', 'yearly'];

export const isReferralPlan = (plan: PlanId) => REFERRAL_PLANS.includes(plan);

/** No I, L, O, 0 or 1, so a code read aloud or copied by hand comes out right. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}$/;

export function isRefCode(value: unknown): value is string {
  return typeof value === 'string' && CODE_RE.test(value.toUpperCase());
}

export function newRefCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

export const SITE = 'https://www.distilledcrux.com';

/** A link that carries the code. Any page takes ?ref; see components/RefCapture. */
export const inviteLink = (code: string, path = '/') => `${SITE}${path}?ref=${code}`;
