'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { OPTIONAL_KEY, subscribeOptional } from '@/lib/optionals';

/**
 * The optional this reader picked, for anything that has to be built around it.
 *
 * localStorage is read first so a signed-in reader does not watch the page
 * rearrange itself on every navigation, then the profile confirms it, which is
 * what changes when they sign in as someone else. Changing optional does not
 * change the Firebase user and returns here by client navigation, so the save
 * announces itself and the subscription picks it up.
 *
 * It was the navbar's, and the hero CTA needed the same three steps.
 */
export function useOptional(): string | null {
  const { user } = useAuth();
  const [optional, setOptional] = useState<string | null>(null);

  useEffect(() => {
    // localStorage cannot be read while rendering without breaking hydration,
    // so the cached value has to be adopted here. The cascading render this
    // costs is one, on mount, and it is what buys a stable bar.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!user) {
      setOptional(null);
      try { localStorage.removeItem(OPTIONAL_KEY); } catch {}
      return;
    }
    try {
      const cached = localStorage.getItem(OPTIONAL_KEY);
      if (cached) setOptional(cached);
    } catch {}
    /* eslint-enable react-hooks/set-state-in-effect */

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
  }, [user]);

  useEffect(() => subscribeOptional(setOptional), []);

  return optional;
}
