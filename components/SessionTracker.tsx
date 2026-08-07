'use client';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { auth } from '@/lib/firebase';

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
    let id = localStorage.getItem('_dc_fp') ?? crypto.randomUUID();
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
  if ((navigator as any).brave?.isBrave) browser = 'Brave';
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
        const { onAuthStateChanged } = require('firebase/auth');
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
// API calls
// ---------------------------------------------------------------------------
async function pingTrack(visitor_id: string, page: string, isFirstVisit: boolean) {
  const firebase_uid = await getFirebaseUid();
  const { device, os, browser } = getDeviceInfo();
  const referrer = isFirstVisit ? (document.referrer || 'direct') : undefined;

  await fetch('/api/track-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitor_id, firebase_uid, page, referrer, device, os, browser, is_first_visit: isFirstVisit }),
  }).catch(() => {});
}

async function pingHeartbeat(visitor_id: string) {
  await fetch('/api/track-session', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitor_id }),
  }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function SessionTracker() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);
  const visitorIdRef = useRef<string | null>(null);

  // Resolve visitor ID once on mount
  useEffect(() => {
    getVisitorId().then(id => { visitorIdRef.current = id; });
  }, []);

  // Fire on every page navigation
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;

    (async () => {
      const visitor_id = visitorIdRef.current ?? await getVisitorId();
      visitorIdRef.current = visitor_id;
      const isFirstVisit = !localStorage.getItem('_dc_visited');
      if (isFirstVisit) localStorage.setItem('_dc_visited', '1');
      await pingTrack(visitor_id, pathname, isFirstVisit);
    })();
  }, [pathname]);

  // Heartbeat — interval + tab-switch + page-close
  useEffect(() => {
    const interval = setInterval(async () => {
      const id = visitorIdRef.current ?? await getVisitorId();
      pingHeartbeat(id);
    }, 5 * 60 * 1000);

    const onVisibility = async () => {
      const id = visitorIdRef.current ?? await getVisitorId();
      pingHeartbeat(id);
    };
    const onUnload = async () => {
      const id = visitorIdRef.current ?? await getVisitorId();
      pingHeartbeat(id);
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeunload', onUnload);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, []);

  return null;
}
