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
