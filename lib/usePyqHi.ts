'use client';

import { useEffect, useState } from 'react';
import { useLang } from '@/lib/i18n/LangContext';

/**
 * The Hindi bank, fetched the first time a PYQ screen is shown in Hindi and
 * kept for the rest of the visit. A subject's bank is a few hundred kilobytes,
 * so it is loaded once, not per question page.
 */

export type PyqHiBank = {
  q: Record<string, string>;
  topics: Record<string, string>;
};

const cache = new Map<string, Promise<PyqHiBank | null>>();

function load(subject: string): Promise<PyqHiBank | null> {
  let p = cache.get(subject);
  if (!p) {
    p = fetch(`/api/pyq-hi/${encodeURIComponent(subject)}`, { cache: 'force-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    cache.set(subject, p);
  }
  return p;
}

export function usePyqHi(subject: string): PyqHiBank | null {
  const { langHi } = useLang();
  const [bank, setBank] = useState<PyqHiBank | null>(null);

  useEffect(() => {
    if (!langHi) {
      setBank(null);
      return;
    }
    let alive = true;
    load(subject).then((b) => { if (alive) setBank(b); });
    return () => { alive = false; };
  }, [langHi, subject]);

  return bank;
}

/** One question's Hindi text, or the English it falls back to. */
export function hiQuestion(bank: PyqHiBank | null, id: number | string, en: string): string {
  return bank?.q[String(id)] ?? en;
}

export function hiTopic(bank: PyqHiBank | null, en: string): string {
  return bank?.topics[en] ?? en;
}
