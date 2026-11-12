'use client';
import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { captureRef, claimedFor, markClaimed, readRef } from '@/lib/referralClient';

/**
 * Keeps the invite code from a ?ref= link, then takes it out of the address
 * bar so it is not copied on to anyone else.
 *
 * Once the visitor is signed in, the code is also saved to their account
 * (/api/referral/claim), so the friend's discount follows them to whatever
 * device they buy on. That call is made once per account and code, and only
 * by visitors who came through a link; everyone else causes no request.
 */
export default function RefCapture() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const ref = url.searchParams.get('ref');
    if (!ref) return;
    captureRef(ref);
    url.searchParams.delete('ref');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  }, []);

  useEffect(() => onAuthStateChanged(auth, async (user) => {
    const code = readRef();
    if (!user || !code || claimedFor(user.uid) === code) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/referral/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-token': token },
        body: JSON.stringify({ ref: code }),
      });
      // Saved, or refused for good (their own code, or one saved before): either way, done.
      if (res.ok) markClaimed(user.uid, code);
    } catch { /* tried again on the next visit */ }
  }), []);

  return null;
}
