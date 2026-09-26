'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { OPTIONAL_KEY, subscribeOptional } from '@/lib/optionals';

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

    let live = true;
    (async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/user-profile', { headers: { 'x-user-token': token } });
        if (!res.ok || !live) return;
        const data = await res.json();
        const next: string | null = data?.optional ?? null;
        setOptional(next);
        try {
          if (next) localStorage.setItem(OPTIONAL_KEY, next);
          else localStorage.removeItem(OPTIONAL_KEY);
        } catch {}
      } catch {
        // An offline or failed lookup leaves whatever the cache said. Every
        // caller falls back to the signed-out copy, which reaches everything.
      }
    })();
    return () => { live = false; };
  }, [user, loading]);

  useEffect(() => subscribeOptional(setOptional), []);

  return optional;
}
