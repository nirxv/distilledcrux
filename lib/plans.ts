/**
 * What each plan costs and how long it lasts.
 *
 * One definition, because there were three. The payment route charged from
 * its own table, the pricing page displayed its own numbers, and the refund
 * policy stated a third set. They had drifted: the refund page told readers
 * that six months cost 3,999 and a year 5,999, both exactly 2,000 more than
 * the amounts Razorpay was actually asked for.
 *
 * `amountPaise` is authoritative. Razorpay works in paise, so the rupee figure
 * is derived from it rather than kept beside it, which is what let the two
 * disagree in the first place.
 */
export type PlanId = 'daily' | 'sixmonth' | 'yearly';

export type Plan = {
  id: PlanId;
  /** Charged amount, in paise. */
  amountPaise: number;
  /** How long access lasts once paid. */
  days: number;
  /** Shown on the pricing card. */
  label: string;
  /** Sent to Razorpay as the order description. */
  orderLabel: string;
  /**
   * Reads after the price, e.g. "2,999 one-time · 1 year". Every plan is a
   * single charge that buys a fixed window; nothing here renews, so the copy
   * must not say "per year" and invite a reader to expect a recurring bill.
   */
  period: string;
};

export const PLANS: Record<PlanId, Plan> = {
  daily:    { id: 'daily',    amountPaise: 4900,   days: 1,   label: 'Daily',    orderLabel: 'Daily Plan',    period: 'one-time · 24 hours' },
  sixmonth: { id: 'sixmonth', amountPaise: 199900, days: 180, label: '6 Months', orderLabel: '6 Month Plan',  period: 'one-time · 6 months' },
  yearly:   { id: 'yearly',   amountPaise: 299900, days: 365, label: 'Yearly',   orderLabel: 'Yearly Plan',   period: 'one-time · 1 year' },
};

export const PLAN_ORDER: PlanId[] = ['daily', 'sixmonth', 'yearly'];

/** Whole rupees. Every amount here is a round number of rupees. */
export const rupees = (plan: Plan): number => plan.amountPaise / 100;

/** "₹1,999" in Indian digit grouping. */
export const formatRupees = (plan: Plan): string =>
  `₹${rupees(plan).toLocaleString('en-IN')}`;

/**
 * A sale: some plans at a lower price for a set window.
 *
 * PLANS keeps the list price, which the terms and refund pages quote. The
 * order route charges the sale price while an offer runs and writes the
 * offer's id into the Razorpay order's notes. Verify then accepts that sale
 * price for that order only, so an order made late on the last evening still
 * grants when it is paid after midnight, and nobody can claim a sale price
 * for an order made without one.
 */
export type Offer = {
  id: string;
  name: string;
  nameHi: string;
  percentOff: number;
  /** ISO times with the IST offset. The offer runs from startsAt up to, not including, endsAt. */
  startsAt: string;
  endsAt: string;
  /** The last day it runs, as said on the page. */
  lastDay: string;
  /** The notice shown above the plans while it runs. */
  line: string;
  /** Sale prices in paise. A plan not listed here sells at its list price. */
  amountPaise: Partial<Record<PlanId, number>>;
};

export const OFFERS: Offer[] = [
  {
    id: 'diwali-2026',
    name: 'Diwali offer',
    nameHi: 'दिवाली ऑफ़र',
    percentOff: 33,
    startsAt: '2026-10-31T00:00:00+05:30',
    endsAt: '2026-11-11T00:00:00+05:30',
    lastDay: '10 November',
    line: 'Diwali offer: 33% off the 6-month and yearly plans, till 10 November.',
    // 33% off, rounded down to the rupee: 1,999 to 1,339 and 2,999 to 2,009.
    amountPaise: { sixmonth: 133900, yearly: 200900 },
  },
];

/** The offer running now, or null. The same object each time, so React can compare it. */
export function liveOffer(now: number = Date.now()): Offer | null {
  return OFFERS.find((o) => now >= Date.parse(o.startsAt) && now < Date.parse(o.endsAt)) ?? null;
}

/** What a plan costs now, and the offer behind that price if there is one. */
export function priceNow(id: PlanId, now: number = Date.now()): { amountPaise: number; offer: Offer | null } {
  const offer = liveOffer(now);
  const sale = offer?.amountPaise[id];
  return sale ? { amountPaise: sale, offer } : { amountPaise: PLANS[id].amountPaise, offer: null };
}

/**
 * Whether an order's amount is a right price for its plan: the list price, or
 * the sale price of the offer named in the order's notes. The notes are
 * written by our order route under our key, never by the browser.
 */
export function amountAllowed(id: PlanId, amountPaise: number, offerId?: string | null): boolean {
  if (amountPaise === PLANS[id].amountPaise) return true;
  const offer = offerId ? OFFERS.find((o) => o.id === offerId) : undefined;
  return !!offer && offer.amountPaise[id] === amountPaise;
}

export const isPlanId = (value: unknown): value is PlanId =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(PLANS, value);
