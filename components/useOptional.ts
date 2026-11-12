'use client';
import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { useAuth } from '@/components/AuthProvider';
import { OPTIONAL_KEY, subscribeOptional } from '@/lib/optionals';

/**
 * One profile lookup for every caller. The navbar, the bottom bar and the
 * home page's sections each use this hook, and each fetched the profile on its
 * own: six server calls for one home page load. Now the callers share a
 * lookup, and a reader whose optional was confirmed in the last CHECK_EVERY_MS
 * is not looked up again on the next page load either. A change of optional
 * in this browser still arrives at once, through subscribeOptional. One made
 * on another device shows here within the hour. Access is not decided by this
 * value: the server checks the subscription against the profile's optional.
 */
const CHECKED_KEY = 'dc_optional_checked';
const CHECK_EVERY_MS = 60 * 60 * 1000;
let lookup: { uid: string; optional: Promise<string | null | undefined> } | null = null;

function checkedRecently(uid: string): boolean {
  try {
    const c = JSON.parse(localStorage.getItem(CHECKED_KEY) ?? 'null');
    return c?.uid === uid && Date.now() - c.at < CHECK_EVERY_MS && localStorage.getItem(OPTIONAL_KEY) !== null;
  } catch {
    return false;
  }
}

/**
 * The reader's optional from their profile, null for none, undefined if the
 * lookup failed. Pages that need it (pricing, evaluate) ask here too, so a
 * session looks the profile up once rather than once per page.
 */
export function lookupOptional(user: User): Promise<string | null | undefined> {
  if (lookup?.uid === user.uid) return lookup.optional;
  const optional = (async () => {
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/user-profile', { headers: { 'x-user-token': token } });
      if (!res.ok) return undefined;
      const data = await res.json();
      const next: string | null = data?.optional ?? null;
      try {
        if (next) localStorage.setItem(OPTIONAL_KEY, next);
        else localStorage.removeItem(OPTIONAL_KEY);
        localStorage.setItem(CHECKED_KEY, JSON.stringify({ uid: user.uid, at: Date.now() }));
      } catch {}
      return next;
    } catch {
      return undefined;
    }
  })();
  lookup = { uid: user.uid, optional };
  // A failed lookup is not kept, so the next caller tries again.
  void optional.then((next) => { if (next === undefined && lookup?.optional === optional) lookup = null; });
  return optional;
}

/**
 * The optional this reader picked, for anything that has to be built around it.
 *
 * The cached value is adopted on mount, before Firebase has said who is
 * signed in. It used to wait for that, and worse: while onAuthStateChanged was
 * still deciding, `user` is null, so the signed-out branch ran on every load
 * and deleted the cache before anything could read it. A returning reader
 * therefore watched the marketing bar sit there for the length of an auth
 * round trip and a profile fetch, every single time.
 *
 * Nothing writes the cache unless a reader is signed in, and signing out
 * clears it, so a value being there is good enough to build on immediately.
 * The profile still confirms it, which is what catches a reader who signed in
 * as someone else, and the announcement catches a change of optional.
 */
export function useOptional(): string | null {
  const { user, loading } = useAuth();
  const [optional, setOptional] = useState<string | null>(null);

  // localStorage cannot be read while rendering without breaking hydration, so
  // the cache is adopted in an effect — but on mount, not on auth.
  useEffect(() => {
    try {
      const cached = localStorage.getItem(OPTIONAL_KEY);
      /* eslint-disable-next-line react-hooks/set-state-in-effect */
      if (cached) setOptional(cached);
    } catch {
      // Private browsing, or site data blocked. The profile fetch still runs.
    }
  }, []);

  useEffect(() => {
    // Firebase reports null for both "signed out" and "still looking", and
    // acting on the second would throw away the cache we just adopted.
    if (loading) return;

    if (!user) {
      /* eslint-disable-next-line react-hooks/set-state-in-effect */
      setOptional(null);
      try { localStorage.removeItem(OPTIONAL_KEY); } catch {}
      return;
    }

    // The cache adopted on mount already holds what the profile said.
    if (checkedRecently(user.uid)) return;

    let live = true;
    // An offline or failed lookup leaves whatever the cache said. Every
    // caller falls back to the signed-out copy, which reaches everything.
    void lookupOptional(user).then((next) => { if (live && next !== undefined) setOptional(next); });
    return () => { live = false; };
  }, [user, loading]);

  // A change of optional makes any lookup already made out of date.
  useEffect(() => subscribeOptional((next) => { lookup = null; setOptional(next); }), []);

  return optional;
}
