'use client';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';

// ---------------------------------------------------------------------------
// Who counts as a visitor
// ---------------------------------------------------------------------------
/**
 * Local dev writes to the production database, and an automated browser
 * (puppeteer, Playwright: navigator.webdriver is set) gets a fresh
 * fingerprint on every launch, so each test run left a new visitor row.
 * Neither is a reader.
 */
function shouldTrack(): boolean {
  if (navigator.webdriver) return false;
  return !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
}

// ---------------------------------------------------------------------------
// Visitor ID — triple persistence: localStorage + cookie + FingerprintJS
// FingerprintJS is loaded lazily, only when no cached ID exists
// ---------------------------------------------------------------------------
async function getVisitorId(): Promise<string> {
  try {
    const fromLS = localStorage.getItem('_dc_fp');
    const fromCookie = document.cookie.match(/_dc_fp=([^;]+)/)?.[1] ?? null;
    const cached = fromLS || fromCookie;

    if (cached) {
      // Sync whichever store was missing
      localStorage.setItem('_dc_fp', cached);
      document.cookie = `_dc_fp=${cached};max-age=315360000;path=/`;
      return cached;
    }

    // No cache — generate via FingerprintJS (open source, no API key needed)
    const FP = await (await import('@fingerprintjs/fingerprintjs')).default.load();
    const { visitorId } = await FP.get();
    localStorage.setItem('_dc_fp', visitorId);
    document.cookie = `_dc_fp=${visitorId};max-age=315360000;path=/`;
    return visitorId;
  } catch {
    // Hard fallback — random UUID stored in localStorage only
    const id = localStorage.getItem('_dc_fp') ?? crypto.randomUUID();
    localStorage.setItem('_dc_fp', id);
    return id;
  }
}

// ---------------------------------------------------------------------------
// Device info
// ---------------------------------------------------------------------------
function getDeviceInfo() {
  const ua = navigator.userAgent;

  let device = 'desktop';
  if (/tablet|ipad|playbook|silk/i.test(ua)) device = 'tablet';
  else if (/mobile|iphone|ipod|android|blackberry|mini|windows\sce|palm/i.test(ua)) device = 'mobile';

  let os = 'unknown';
  if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/windows/i.test(ua)) os = 'Windows';
  else if (/mac/i.test(ua)) os = 'macOS';
  else if (/linux/i.test(ua)) os = 'Linux';

  let browser = 'unknown';
  if ((navigator as { brave?: { isBrave?: unknown } }).brave?.isBrave) browser = 'Brave';
  else if (/edg\//i.test(ua)) browser = 'Edge';
  else if (/opr\//i.test(ua)) browser = 'Opera';
  else if (/chrome\//i.test(ua)) browser = 'Chrome';
  else if (/safari\//i.test(ua)) browser = 'Safari';
  else if (/firefox\//i.test(ua)) browser = 'Firefox';

  return { device, os, browser };
}

// ---------------------------------------------------------------------------
// Firebase UID (waits up to 2s for auth to initialise)
// ---------------------------------------------------------------------------
async function getFirebaseUid(): Promise<string | null> {
  try {
    if (!auth.currentUser) {
      await new Promise<void>(resolve => {
        const unsub = onAuthStateChanged(auth, () => { unsub(); resolve(); });
        setTimeout(resolve, 2000);
      });
    }
    return auth.currentUser?.uid ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// First visits
// ---------------------------------------------------------------------------
/**
 * A first visit is recorded only once the visitor has stayed: after
 * FIRST_VISIT_AFTER_MS, on moving to another page, or on leaving after at
 * least MIN_DWELL_SECS. It used to be written the moment the page loaded,
 * so everyone who bounced straight off left a row with a 0-second session.
 * The time already spent travels with the ping, so the row starts with it.
 */
const FIRST_VISIT_AFTER_MS = 10 * 1000;
const MIN_DWELL_SECS = 1;
// A new key, so visitors counted under the old rule go through the new one once.
const COUNTED_KEY = '_dc_visit_counted';
const pageLoadedAt = typeof performance !== 'undefined' ? Date.now() - performance.now() : Date.now();

// ---------------------------------------------------------------------------
// How often to call
// ---------------------------------------------------------------------------
/**
 * As few calls as the session data allows, since each one is server time
 * against a small free allowance (2026-11-04). A session costs one call as it
 * starts and a beat now and then:
 *
 *  - The first page of a session is sent at once (a first visit ever, once
 *    the visitor has stayed; see above). Later pages wait in PAGES_KEY and go
 *    with the next beat.
 *  - Hiding the tab beats, which marks where the session ended, but at most
 *    every HIDE_BEAT_GAP_MS, since phones hide it at every app switch. The
 *    first hide after a session starts always beats, so a short visit still
 *    gets its length.
 *  - While the reader is active (scrolled, tapped or typed lately) and the
 *    tab is visible, it beats every HEARTBEAT_MS. A tab left open in the
 *    background used to beat every 5 minutes for as long as it stayed open,
 *    and every tab switch beat twice, on hiding and on showing.
 *
 * SENT_KEY, shared by the reader's tabs, holds when the last call went.
 */
const HEARTBEAT_MS = 15 * 60 * 1000;
const HIDE_BEAT_GAP_MS = 5 * 60 * 1000;
const SESSION_GAP_MS = 30 * 60 * 1000;
const MAX_QUEUED_PAGES = 20;
const SENT_KEY = '_dc_track_sent';
const PAGES_KEY = '_dc_track_pages';
const INPUT_EVENTS = ['pointerdown', 'keydown', 'scroll', 'touchstart', 'wheel'] as const;
let lastInput = Date.now();
// The session's first call has gone and no beat has followed it yet.
let startUnbeaten = false;
// Device and account, for the pages a beat carries.
let pageInfo: Record<string, unknown> = {};

const lastSent = () => Number(localStorage.getItem(SENT_KEY)) || 0;
const markSent = () => localStorage.setItem(SENT_KEY, String(Date.now()));

function queuedPages(): string[] {
  try {
    const q = JSON.parse(sessionStorage.getItem(PAGES_KEY) ?? '[]');
    return Array.isArray(q) ? q.filter((p) => typeof p === 'string') : [];
  } catch {
    return [];
  }
}

function queuePage(page: string) {
  const q = queuedPages();
  if (q.at(-1) === page || q.length >= MAX_QUEUED_PAGES) return;
  try { sessionStorage.setItem(PAGES_KEY, JSON.stringify([...q, page])); } catch { /* storage full or blocked */ }
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------
async function trackBody(visitor_id: string, page: string) {
  const firebase_uid = await getFirebaseUid();
  const { device, os, browser } = getDeviceInfo();
  return { visitor_id, firebase_uid, page, device, os, browser };
}

function postTrack(body: Record<string, unknown>, keepalive: boolean) {
  markSent();
  // The next hide beats whatever the gap, so this visit gets its length. Not
  // when it is sent as the reader leaves: it carries its length already.
  startUnbeaten = !keepalive;
  void fetch('/api/track-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    keepalive,
  }).catch(() => {});
}

/** keepalive, so a beat sent as the tab closes still arrives. */
function pingHeartbeat(visitor_id: string) {
  startUnbeaten = false;
  markSent();
  const pages = queuedPages();
  try { sessionStorage.removeItem(PAGES_KEY); } catch { /* as above */ }
  void fetch('/api/track-session', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitor_id, ...(pages.length ? { pages, ...pageInfo } : {}) }),
    keepalive: true,
  }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function SessionTracker() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);
  const visitorIdRef = useRef<string | null>(null);
  // The first visit, held back until the visitor has stayed. Calling it sends
  // it if they have been here long enough.
  const pendingFirst = useRef<((keepalive: boolean) => void) | null>(null);

  // Resolve visitor ID once on mount
  useEffect(() => {
    if (!shouldTrack()) return;
    getVisitorId().then(id => { visitorIdRef.current = id; });
  }, []);

  // Fire on every page navigation
  useEffect(() => {
    if (!shouldTrack()) return;
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;

    (async () => {
      const visitor_id = visitorIdRef.current ?? await getVisitorId();
      visitorIdRef.current = visitor_id;
      const body = await trackBody(visitor_id, pathname);
      pageInfo = { firebase_uid: body.firebase_uid, device: body.device, os: body.os, browser: body.browser };

      // Moving to another page means the visitor stayed, so a first visit
      // still held back for the page they came from is recorded now.
      pendingFirst.current?.(false);

      if (!localStorage.getItem(COUNTED_KEY)) {
        pendingFirst.current = (keepalive: boolean) => {
          const dwell = Math.floor((Date.now() - pageLoadedAt) / 1000);
          if (dwell < MIN_DWELL_SECS) return;
          pendingFirst.current = null;
          localStorage.setItem(COUNTED_KEY, '1');
          postTrack({ ...body, referrer: document.referrer || 'direct', is_first_visit: true, dwell }, keepalive);
        };
        // Resolving the visitor id can take a while on a first visit; if the
        // wait has already passed, there is no reason to hold on.
        if (Date.now() - pageLoadedAt >= FIRST_VISIT_AFTER_MS) pendingFirst.current(false);
        return;
      }

      // A session's first page goes now, the rest with the next beat.
      if (Date.now() - lastSent() < SESSION_GAP_MS) {
        queuePage(pathname);
        return;
      }
      postTrack({ ...body, is_first_visit: false }, false);
    })();
  }, [pathname]);

  // What releases a held-back first visit: staying FIRST_VISIT_AFTER_MS, or
  // leaving the page (the tab is hidden, or the page is unloaded).
  useEffect(() => {
    if (!shouldTrack()) return;
    const timer = setTimeout(() => pendingFirst.current?.(false), Math.max(0, FIRST_VISIT_AFTER_MS - (Date.now() - pageLoadedAt)));
    const onHide = () => { if (document.visibilityState === 'hidden') pendingFirst.current?.(true); };
    const onPageHide = () => pendingFirst.current?.(true);
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, []);

  // Heartbeat: see "How often to call" above. None on beforeunload: closing
  // a tab hides it first. The timer checks every minute, which costs nothing,
  // and beats only once HEARTBEAT_MS has passed since any tab's last call.
  useEffect(() => {
    if (!shouldTrack()) return;
    const beat = async () => {
      const id = visitorIdRef.current ?? await getVisitorId();
      pingHeartbeat(id);
    };
    const interval = setInterval(() => {
      const now = Date.now();
      if (document.visibilityState === 'visible' && now - lastInput < HEARTBEAT_MS && now - lastSent() >= HEARTBEAT_MS) void beat();
    }, 60 * 1000);
    const onVisibility = () => {
      if (document.visibilityState !== 'hidden') return;
      if (startUnbeaten || Date.now() - lastSent() >= HIDE_BEAT_GAP_MS) void beat();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // Notes when the reader last did something, for the heartbeat above.
  useEffect(() => {
    if (!shouldTrack()) return;
    const onInput = () => { lastInput = Date.now(); };
    for (const e of INPUT_EVENTS) window.addEventListener(e, onInput, { passive: true });
    return () => { for (const e of INPUT_EVENTS) window.removeEventListener(e, onInput); };
  }, []);

  return null;
}
