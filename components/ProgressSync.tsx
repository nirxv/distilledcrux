'use client';
import { useEffect, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { SYLLABUS_KEY } from '@/hooks/useSyllabusTracker';
import { PYQ_KEY } from '@/hooks/useAttemptedPyqs';

/**
 * Keeps a reader's syllabus ticks and PYQ attempts on the server as well as
 * in this browser, so they survive a new device or a cleared cache.
 *
 * Mounted once in the layout rather than on the dashboard: progress is made
 * on the note and PYQ pages, and syncing only where it is shown would leave a
 * reader who never opens the dashboard without a backup.
 *
 *   on sign-in     pull the server's copy, union it with this browser's, and
 *                  write the result to both; a second device then shows the
 *                  reader's real progress instead of an empty page
 *   on tab hidden  push whatever has changed since
 *
 * Not on every tick: each sync rewrites two rows. Work in a tab killed
 * outright syncs on the next load instead; localStorage still holds it.
 */

function readLocal(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Writes the merged document back and tells the rest of the app: storage
 * events only reach other tabs, so the hooks in this tab are told by hand.
 */
function writeLocal(key: string, value: unknown) {
  try {
    const next = JSON.stringify(value);
    if (localStorage.getItem(key) === next) return;
    localStorage.setItem(key, next);
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: next }));
  } catch {
    // Private mode or a full quota. The server copy is still correct.
  }
}

export default function ProgressSync() {
  // One sync at a time, so a hide during a sign-in sync cannot interleave.
  const busy = useRef(false);

  useEffect(() => {
    const sync = async (opts: { keepalive?: boolean } = {}) => {
      if (busy.current) return;
      const user = auth.currentUser;
      if (!user) return;
      busy.current = true;
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-token': token },
          body: JSON.stringify({ syllabus: readLocal(SYLLABUS_KEY), pyq: readLocal(PYQ_KEY) }),
          keepalive: opts.keepalive,
        });
        if (!res.ok) return;
        const merged = await res.json();
        if (!merged?.signedIn) return;
        if (merged.syllabus) writeLocal(SYLLABUS_KEY, merged.syllabus);
        if (merged.pyq) writeLocal(PYQ_KEY, merged.pyq);
      } catch {
        // Offline, or cut short on unload. The next sync carries it.
      } finally {
        busy.current = false;
      }
    };

    const unsub = onAuthStateChanged(auth, (user) => { if (user) void sync(); });
    // `hidden` rather than beforeunload: it fires on phones when the app is
    // backgrounded, and keepalive lets the request outlive the page.
    const onHide = () => { if (document.visibilityState === 'hidden') void sync({ keepalive: true }); };
    document.addEventListener('visibilitychange', onHide);
    return () => { unsub(); document.removeEventListener('visibilitychange', onHide); };
  }, []);

  return null;
}
