'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Keeps a page's working state across a refresh.
 *
 * Pages held what the reader was doing (an evaluation on screen, a test half
 * written, the question they were on) in component state alone, so a refresh
 * dropped them back on a blank page. This writes a snapshot of that state to
 * sessionStorage as it changes and hands it back on the next mount.
 *
 * sessionStorage, not localStorage: a refresh, or Back into the page, is the
 * same visit and should pick up where it was; a new tab is a fresh start. It
 * is also per tab, so two tabs on the same page do not overwrite each other.
 *
 * The restore runs in a layout effect, before the first paint, rather than in
 * a useState initialiser: the server renders without the snapshot, and an
 * initialiser that read it would render something different on the client and
 * fail hydration. Writes wait for the restore, or the first one would replace
 * the snapshot with the defaults before it was read, and are debounced so a
 * reader typing an answer does not serialise the page on every keystroke.
 *
 * Bump the version in `key` whenever the snapshot's shape changes, so an old
 * snapshot is ignored rather than restored into the wrong fields.
 */
export function useRefreshSafe<T>(
  key: string,
  snapshot: T,
  restore: (saved: T) => void,
  { debounceMs = 300 }: { debounceMs?: number } = {},
): boolean {
  const [restored, setRestored] = useState(false);
  const restoreRef = useRef(restore);
  useLayoutEffect(() => { restoreRef.current = restore; });

  useLayoutEffect(() => {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) restoreRef.current(JSON.parse(raw) as T);
    } catch { /* a bad snapshot is a fresh start */ }
    setRestored(true);
  }, [key]);

  const serialised = JSON.stringify(snapshot);
  useEffect(() => {
    if (!restored) return;
    const id = window.setTimeout(() => {
      try { sessionStorage.setItem(key, serialised); } catch { /* full or private mode */ }
    }, debounceMs);
    return () => window.clearTimeout(id);
  }, [restored, key, serialised, debounceMs]);

  return restored;
}

/** Forgets a page's snapshot, for when the reader deliberately starts over. */
export function clearRefreshSafe(key: string) {
  try { sessionStorage.removeItem(key); } catch { /* private mode */ }
}
