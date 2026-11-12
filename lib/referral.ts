import { PLANS, type PlanId } from '@/lib/plans';

/**
 * Invite rewards: what counts and what it earns. Shared by the server, which
 * credits and charges, and the pages, which say what the reward is. The
 * database side, and the full rules, are in migration 012.
 *
 * A friend who arrives through a reader's link and buys their first yearly
 * plan pays FRIEND_DISCOUNT_PAISE less, and the reader earns
 * REFERRAL_REWARD_PAISE in balance. No other plan counts.
 */
export const REFERRAL_PLAN: PlanId = 'yearly';
export const FRIEND_DISCOUNT_PAISE = 10_000;
export const REFERRAL_REWARD_PAISE = 10_000;

/** Before their first yearly plan, a reader's balance stops growing at the yearly list price. */
export const FREE_BALANCE_CAP_PAISE = PLANS.yearly.amountPaise;

/** Cash-out opens at these lifetime earnings in a window, each only if below the window's cap, and at the cap. */
export const CASHOUT_MILESTONES_PAISE = [100_000, 200_000, 300_000] as const;

/**
 * Razorpay's platform fee and the GST on it, for a payment that does not
 * report them. A captured payment carries the real figures, which are used
 * whenever they are there.
 */
export const FALLBACK_FEE_RATE = 0.02;
export const FALLBACK_GST_RATE = 0.18;

/** What a yearly payment brought in after fee and GST, rounded down to the rupee: its window's cap. */
export function windowCapPaise(amountPaise: number, feePaise: number, taxPaise: number): number {
  return Math.max(0, Math.floor((amountPaise - feePaise - taxPaise) / 100) * 100);
}

/** A window's cash-out milestones, in order, ending at its cap. Must match migration 012. */
export function cashoutMilestones(capPaise: number): number[] {
  if (capPaise <= 0) return [];
  return [...CASHOUT_MILESTONES_PAISE.filter((m) => m < capPaise), capPaise];
}

/** "₹1,000" from paise. Every amount here is whole rupees. */
export const formatPaise = (paise: number): string => `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;

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

/** A UPI id as people type it: name@handle. Checked again by the user before paying. */
const UPI_RE = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,64}$/;
export const isUpiId = (value: unknown): value is string => typeof value === 'string' && UPI_RE.test(value.trim());

/** An Indian mobile number as 10 digits, from what people type (+91, a leading 0, spaces, dashes), or null. */
export function normalisePhone(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const digits = value.replace(/[\s-]/g, '').replace(/^(\+91|0091|91(?=\d{10}$)|0(?=\d{10}$))/, '');
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

export const SITE = 'https://www.distilledcrux.com';

/** A link that carries the code. Any page takes ?ref; see components/RefCapture. */
export const inviteLink = (code: string, path = '/') => `${SITE}${path}?ref=${code}`;
