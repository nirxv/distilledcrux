'use client';
import { useCallback, useEffect, useState } from 'react';

/**
 * A small document kept in localStorage that every component on the page
 * reads live: a tick on the note reader and the same topic's card agree
 * without a reload. `storage` events only reach other tabs, so changes in
 * this tab go through the listener set; components/ProgressSync dispatches a
 * storage event after a sign-in merge, which both paths pick up.
 */
export function createProgressStore<T>(key: string, empty: () => T, accept: (v: unknown) => T) {
  const listeners = new Set<(v: T) => void>();

  const load = (): T => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? accept(JSON.parse(raw)) : empty();
    } catch {
      return empty();
    }
  };
  const save = (v: T) => {
    try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode or full: not worth an error */ }
    for (const fn of listeners) fn(v);
  };

  function useStore() {
    const [value, setValue] = useState<T>(empty);
    const [ready, setReady] = useState(false);
    // Read after mount: localStorage does not exist during prerender, and
    // reading it in useState would make server and client markup disagree.
    useEffect(() => {
      setValue(load()); setReady(true);
      const fn = (v: T) => setValue(v);
      listeners.add(fn);
      const onStorage = (e: StorageEvent) => { if (e.key === key) setValue(load()); };
      window.addEventListener('storage', onStorage);
      return () => { listeners.delete(fn); window.removeEventListener('storage', onStorage); };
    }, []);
    const update = useCallback((fn: (prev: T) => T) => { save(fn(load())); }, []);
    return { value, ready, update };
  }

  return { key, useStore };
}
