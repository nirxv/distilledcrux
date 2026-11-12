'use client';
import { useSyncExternalStore } from 'react';
import { readRef } from '@/lib/referralClient';
import { FRIEND_DISCOUNT_PAISE, formatPaise } from '@/lib/referral';

const noop = () => () => {};

/** Tells a visitor who came through an invite link what it gets them. */
export default function InvitedNote({ className }: { className?: string }) {
  const code = useSyncExternalStore(noop, readRef, () => null);
  if (!code) return null;
  return <p className={className}>A friend invited you: {formatPaise(FRIEND_DISCOUNT_PAISE)} off your first yearly plan.</p>;
}
