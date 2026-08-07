'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { auth } from '@/lib/firebase';

// Generates or retrieves a persistent visitor ID
function getVisitorId(): string {
  try {
    let id = localStorage.getItem('_dc_vid');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('_dc_vid', id);
    }
    return id;
  } catch {
    return 'anon-' + Math.random().toString(36).slice(2);
  }
}

// Simple UA parsing — no library needed
function parseUA() {
  const ua = navigator.userAgent;
  let device = 'desktop';
  let os = 'unknown';
  let browser = 'unknown';

  // Device
  if (/Mobi|Android/i.test(ua)) device = 'mobile';
  else if (/Tablet|iPad/i.test(ua)) device = 'tablet';

  // OS
  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad/i.test(ua)) os = 'iOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  // Browser
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/OPR\//i.test(ua)) browser = 'Opera';
  else if (/Chrome\//i.test(ua)) browser = 'Chrome';
  else if (/Safari\//i.test(ua)) browser = 'Safari';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';

  return { device, os, browser };
}

// Session considered new if no activity in last 30 minutes
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const SESSION_KEY = '_dc_last_active';

function isNewSession(): boolean {
  try {
    const last = localStorage.getItem(SESSION_KEY);
    if (!last) return true;
    return Date.now() - parseInt(last, 10) > SESSION_TIMEOUT_MS;
  } catch {
    return true;
  }
}

function touchSession() {
  try {
    localStorage.setItem(SESSION_KEY, Date.now().toString());
  } catch {}
}

export default function SessionTracker() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    // Don't fire twice for same path
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;

    const track = async () => {
      const visitor_id = getVisitorId();
      const firebase_uid = auth.currentUser?.uid ?? null;
      const { device, os, browser } = parseUA();
      const new_session = isNewSession();
      touchSession();

      try {
        await fetch('/api/track-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            visitor_id,
            firebase_uid,
            page: pathname,
            referrer: document.referrer || null,
            device,
            os,
            browser,
            is_new_session: new_session,
          }),
        });
      } catch {
        // silent — never break the UI
      }
    };

    track();
  }, [pathname]);

  return null;
}
