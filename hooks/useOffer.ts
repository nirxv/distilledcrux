'use client';
import { useSyncExternalStore } from 'react';
import { liveOffer, type Offer } from '@/lib/plans';

const noop = () => () => {};

/**
 * The offer running now, read in render so the sale price shows on the first
 * paint, with no flash of the list price. liveOffer returns the same object
 * each time, which useSyncExternalStore needs.
 */
export function useOffer(): Offer | null {
  return useSyncExternalStore(noop, () => liveOffer(), () => liveOffer());
}
