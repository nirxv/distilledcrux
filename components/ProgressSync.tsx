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
 *                  reader's real progress instead of an empty page. Restoring
 *                  the session on a page load counts as signing in, so it
 *                  pulls at most once every PULL_EVERY_MS per browser.
 *   on tab hidden  push whatever has changed since, and nothing when nothing
 *                  has. Phones hide the tab at every app switch, and each sync
 *                  is a server call against a small CPU allowance.
 *
 * Not on every tick: each sync rewrites two rows. Work in a tab killed
 * outright syncs on the next load instead; localStorage still holds it.
 */

/** The last sync this browser made: whose, when, and a hash of what both sides then held. */
const SYNCED_KEY = 'dc_progress_synced';
const PULL_EVERY_MS = 10 * 60 * 1000;

type Synced = { uid: string; at: number; hash: number };

function readSynced(): Synced | null {
  try {
    const s = JSON.parse(localStorage.getItem(SYNCED_KEY) ?? 'null');
    return s && typeof s.uid === 'string' && typeof s.at === 'number' && typeof s.hash === 'number' ? s : null;
  } catch {
    return null;
  }
}

/** FNV-1a: enough to tell whether the document changed, without keeping a second copy of it. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

const localDoc = () => JSON.stringify({ syllabus: readLocal(SYLLABUS_KEY), pyq: readLocal(PYQ_KEY) });

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
    const sync = async (opts: { keepalive?: boolean; reason: 'sign-in' | 'hide' }) => {
      if (busy.current) return;
      const user = auth.currentUser;
      if (!user) return;

      const doc = localDoc();
      const last = readSynced();
      if (last?.uid === user.uid) {
        if (opts.reason === 'hide' && last.hash === hash(doc)) return;
        if (opts.reason === 'sign-in' && Date.now() - last.at < PULL_EVERY_MS) return;
      }

      busy.current = true;
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-token': token },
          body: doc,
          keepalive: opts.keepalive,
        });
        if (!res.ok) return;
        const merged = await res.json();
        if (!merged?.signedIn) return;
        if (merged.syllabus) writeLocal(SYLLABUS_KEY, merged.syllabus);
        if (merged.pyq) writeLocal(PYQ_KEY, merged.pyq);
        // Both sides now hold the merge, so a hide with nothing new since has nothing to send.
        localStorage.setItem(SYNCED_KEY, JSON.stringify({ uid: user.uid, at: Date.now(), hash: hash(localDoc()) }));
      } catch {
        // Offline, or cut short on unload. The next sync carries it.
      } finally {
        busy.current = false;
      }
    };

    const unsub = onAuthStateChanged(auth, (user) => { if (user) void sync({ reason: 'sign-in' }); });
    // `hidden` rather than beforeunload: it fires on phones when the app is
    // backgrounded, and keepalive lets the request outlive the page.
    const onHide = () => { if (document.visibilityState === 'hidden') void sync({ keepalive: true, reason: 'hide' }); };
    document.addEventListener('visibilitychange', onHide);
    return () => { unsub(); document.removeEventListener('visibilitychange', onHide); };
  }, []);

  return null;
}
