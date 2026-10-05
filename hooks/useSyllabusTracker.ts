'use client';
import { useCallback } from 'react';
import { createProgressStore } from './progressStore';
import type { SyllabusDoc } from '@/lib/progressMerge';

/** localStorage key, also read and written by components/ProgressSync. */
export const SYLLABUS_KEY = 'dc_syllabus_v1';

/** A topic's key: the optional's route slug and the note's slug. */
export const topicKey = (subject: string, slug: string) => `${subject}/${slug}`;

const store = createProgressStore<SyllabusDoc>(
  SYLLABUS_KEY,
  () => ({ completed: {}, completionDates: {} }),
  (v) => {
    const o = v && typeof v === 'object' ? (v as SyllabusDoc) : { completed: {} };
    return { completed: o.completed ?? {}, completionDates: o.completionDates ?? {} };
  },
);

/**
 * Which syllabus topics the reader has marked done, and when each was first
 * finished. Kept on the device and synced to the account by ProgressSync.
 */
export function useSyllabusTracker() {
  const { value, ready, update } = store.useStore();

  const toggle = useCallback((key: string) => {
    update((prev) => {
      const completed = { ...prev.completed };
      const completionDates = { ...(prev.completionDates ?? {}) };
      if (completed[key]) { delete completed[key]; delete completionDates[key]; }
      else { completed[key] = true; completionDates[key] = new Date().toISOString(); }
      return { completed, completionDates };
    });
  }, [update]);

  const isCompleted = useCallback((key: string) => !!value.completed[key], [value]);
  const countCompleted = useCallback((keys: string[]) => keys.filter((k) => value.completed[k]).length, [value]);

  return { progress: value, ready, toggle, isCompleted, countCompleted };
}
