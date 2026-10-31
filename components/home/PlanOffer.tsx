'use client';
import { PLANS, formatRupees, type PlanId } from '@/lib/plans';
import { useOffer } from '@/hooks/useOffer';

/**
 * The home page's plan prices, which follow a running offer: the sale price,
 * the list price struck through and the discount. The page itself is built
 * ahead of time, so the price is worked out here, in the browser.
 */
export function PlanPrice({ id }: { id: PlanId }) {
  const offer = useOffer();
  const plan = PLANS[id];
  const sale = offer?.amountPaise[id];
  if (!offer || !sale) return <span className="hm-plan-price">{formatRupees(plan)}</span>;
  return (
    <>
      <span className="hm-plan-price">₹{(sale / 100).toLocaleString('en-IN')}</span>
      <s className="hm-plan-was" aria-label={`was ${formatRupees(plan)}`}>{formatRupees(plan)}</s>
      <span className="hm-plan-off">{offer.percentOff}% off</span>
    </>
  );
}

/** The offer's notice, under the pricing section's heading, while it runs. */
export function OfferNote() {
  const offer = useOffer();
  return offer ? <p className="hm-offer">{offer.line}</p> : null;
}
