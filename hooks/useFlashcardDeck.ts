'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import type { FlashCardFront, FlashCardIndexEntry } from '@/lib/flashcardStore';
import type { FlashcardSubject } from '@/lib/flashcardMeta';

/**
 * One optional's flashcard deck, fetched rather than bundled. Ported from the
 * history site.
 *
 * Three payloads instead of one:
 *
 *   index    id, topics and type for every card in the deck. Enough to
 *            filter, count what is due against localStorage and order a queue.
 *   cards    question text, fetched only for cards being shown.
 *   answers  fetched one at a time, when the reader turns a card.
 *
 * Answers are separate because they are metered: a reader gets a hundred free
 * and then needs a subscription. That cannot ride along with the cards, whose
 * responses are cached at the edge, and the prefetch pulls forty cards ahead
 * of the reader, which must not spend anything.
 *
 * The prefetch is deliberately eager. Reviewing is a rhythm, turn, grade,
 * next, and a spinner between cards breaks it.
 */

const WINDOW = 40;
const REFILL_AT = 20;
const BATCH = 40;

/** What the reader has left. `unlimited` covers a subscriber to this optional. */
export type Allowance = {
  used: number;
  limit: number;
  unlimited: boolean;
  requiresLogin?: boolean;
};

type Deck = {
  index: FlashCardIndexEntry[];
  indexLoading: boolean;
  error: string | null;
  getCard: (id: string) => FlashCardFront | undefined;
  /** The answer, if this reader has it. Undefined means not yet revealed. */
  getBack: (id: string) => string | undefined;
  /** Open a card's answer, spending one unit if it is not already unlocked. */
  reveal: (id: string) => Promise<'granted' | 'locked' | 'login' | 'error'>;
  allowance: Allowance | null;
  prefetch: (ids: string[]) => void;
  keepAhead: (orderedIds: string[], position: number) => void;
};

async function authHeaders(): Promise<Record<string, string>> {
  try {
    const token = await auth.currentUser?.getIdToken();
    if (token) return { 'x-user-token': token };
  } catch {
    // Signed out, or the token refresh failed.
  }
  return {};
}

export function useFlashcardDeck(subject: FlashcardSubject): Deck {
  const [index, setIndex] = useState<FlashCardIndexEntry[]>([]);
  const [indexLoading, setIndexLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // A ref for reads and a counter for renders: the cache is read inside
  // callbacks that must not be re-created on every fetch.
  const cache = useRef(new Map<string, FlashCardFront>());
  const backs = useRef(new Map<string, string>());
  const inFlight = useRef(new Set<string>());
  const [allowance, setAllowance] = useState<Allowance | null>(null);
  const [, bump] = useState(0);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const res = await fetch(`/api/flashcards?subject=${subject}&index=1`, { signal: ac.signal });
        if (!res.ok) throw new Error(`index ${res.status}`);
        const data = await res.json();
        setIndex(data.cards ?? []);
        setError(null);
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
        setError('Could not load the flashcards. Try again in a moment.');
      } finally {
        setIndexLoading(false);
      }
    })();
    return () => ac.abort();
  }, [subject]);

  const loadAllowance = useCallback(async () => {
    try {
      const res = await fetch(`/api/flashcards/reveal?subject=${subject}`, { headers: await authHeaders() });
      if (!res.ok) return;
      setAllowance(await res.json());
    } catch {
      // Null means "not known yet", and shows no count rather than a wrong one.
    }
  }, [subject]);

  /** Answers already unlocked, for cards just fetched. Spends nothing. */
  const loadOwnedBacks = useCallback(async (ids: string[]) => {
    const wanted = ids.filter((id) => !backs.current.has(id));
    // Before Firebase has restored the session there is nobody to ask about.
    // The auth listener below asks again for every cached card once there is.
    if (!wanted.length || !auth.currentUser) return;
    try {
      const res = await fetch('/api/flashcards/reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ subject, ids: wanted, spend: false }),
      });
      if (!res.ok) return;
      const data = await res.json();
      for (const c of (data.cards ?? []) as { id: string; back: string }[]) backs.current.set(c.id, c.back);
      if (data.cards?.length) bump((n) => n + 1);
    } catch {
      // The answer arrives later, when the reader turns the card.
    }
  }, [subject]);

  // onAuthStateChanged fires once on subscribing, which is the first load.
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, () => {
      // A different account means answers fetched under the old one must not
      // be trusted, and a subscriber may have signed in.
      backs.current.clear();
      void loadAllowance();
      const cached = [...cache.current.keys()];
      for (let i = 0; i < cached.length; i += BATCH) void loadOwnedBacks(cached.slice(i, i + BATCH));
      bump((n) => n + 1);
    });
    return () => unsub();
  }, [loadAllowance, loadOwnedBacks]);

  const prefetch = useCallback((ids: string[]) => {
    const missing = ids.filter((id) => !cache.current.has(id) && !inFlight.current.has(id));
    if (!missing.length) return;
    for (const id of missing) inFlight.current.add(id);
    (async () => {
      for (let i = 0; i < missing.length; i += BATCH) {
        const slice = missing.slice(i, i + BATCH);
        try {
          const res = await fetch(`/api/flashcards?subject=${subject}&ids=${encodeURIComponent(slice.join(','))}&limit=${slice.length}`);
          if (!res.ok) throw new Error(`cards ${res.status}`);
          const data = await res.json();
          for (const card of (data.cards ?? []) as FlashCardFront[]) cache.current.set(card.id, card);
          bump((n) => n + 1);
          void loadOwnedBacks(slice);
        } catch {
          // Out of inFlight so a later pass retries them.
          for (const id of slice) inFlight.current.delete(id);
        }
      }
    })();
  }, [subject, loadOwnedBacks]);

  /** Open one answer. The only call that can cost the reader a unit. */
  const reveal = useCallback(async (id: string): Promise<'granted' | 'locked' | 'login' | 'error'> => {
    if (backs.current.has(id)) return 'granted';
    try {
      const res = await fetch('/api/flashcards/reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ subject, ids: [id], spend: true }),
      });
      if (res.status === 401) return 'login';
      if (!res.ok) return 'error';
      const data = await res.json();
      setAllowance({ used: data.used ?? 0, limit: data.limit ?? 0, unlimited: data.unlimited === true });
      const card = (data.cards ?? [])[0] as { back: string } | undefined;
      if (!card) return 'locked';
      backs.current.set(id, card.back);
      bump((n) => n + 1);
      return 'granted';
    } catch {
      return 'error';
    }
  }, [subject]);

  const keepAhead = useCallback((orderedIds: string[], position: number) => {
    const ahead = orderedIds.slice(position, position + WINDOW);
    const cached = ahead.filter((id) => cache.current.has(id)).length;
    if (cached < REFILL_AT || cached < ahead.length) prefetch(ahead);
  }, [prefetch]);

  const getCard = useCallback((id: string) => cache.current.get(id), []);
  const getBack = useCallback((id: string) => backs.current.get(id), []);

  return { index, indexLoading, error, getCard, getBack, reveal, allowance, prefetch, keepAhead };
}
