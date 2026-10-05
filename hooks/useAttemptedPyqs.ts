'use client';
import { useCallback } from 'react';
import { createProgressStore } from './progressStore';
import type { PyqDoc } from '@/lib/progressMerge';

/** localStorage key, also read and written by components/ProgressSync. */
export const PYQ_KEY = 'dc_pyq_attempted_v1';

/**
 * A question's key: the optional and its id. Ids, not text: question text
 * gets corrected and a reader's marks must survive that; the optional because
 * the five banks reuse ids.
 */
export const pyqKey = (subject: string, id: number) => `${subject}:${id}`;

const store = createProgressStore<PyqDoc>(
  PYQ_KEY,
  () => ({}),
  (v) => (v && typeof v === 'object' && !Array.isArray(v) ? (v as PyqDoc) : {}),
);

/** Which past questions the reader has marked as attempted, each dated. */
export function useAttemptedPyqs() {
  const { value, ready, update } = store.useStore();

  const toggle = useCallback((key: string) => {
    update((prev) => {
      const next = { ...prev };
      if (next[key] !== undefined) delete next[key];
      else next[key] = new Date().toISOString();
      return next;
    });
  }, [update]);

  const isAttempted = useCallback((key: string) => value[key] !== undefined, [value]);

  return { attempted: value, ready, toggle, isAttempted };
}
