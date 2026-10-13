import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Always show the account chooser — avoids a silent no-op popup when the
// browser already has a Google session it can't hand back to us.
googleProvider.setCustomParameters({ prompt: 'select_account' });

// In-app webviews either no-op on window.open or hand the link to the system
// browser, so the popup result never reaches the page that asked for it.
// Some announce themselves in the UA; Telegram does not — on Android it is a
// bare WebView (caught by the `; wv)` token) and on iOS its UA is identical to
// Safari's. So UA matching alone is not enough; see isMobile below.
const IN_APP_BROWSER = /FBAN|FBAV|FB_IAB|Instagram|LinkedInApp|Line\/|MicroMessenger|WhatsApp|Snapchat|Twitter|GSA\/|; wv\)/i;

function isMobile(): boolean {
  const ua = navigator.userAgent || '';
  if (/Android|iPhone|iPod/i.test(ua)) return true;
  // iPadOS 13+ reports a desktop Safari UA.
  return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
}

/**
 * Popups are unreliable across the whole mobile surface — blocked, silently
 * dropped, or opened in a different browser entirely. Redirect is a plain
 * top-level navigation and works everywhere, so it is the mobile default;
 * desktop keeps the popup, which is the nicer flow when it works.
 */
export function prefersRedirectSignIn(): boolean {
  if (typeof window === 'undefined') return false;
  return IN_APP_BROWSER.test(navigator.userAgent || '') || isMobile();
}

/**
 * Browsers built into other apps where Google refuses to sign anyone in
 * ("Error 403: disallowed_useragent"): Android WebViews, which is what
 * Telegram, WhatsApp and most apps open links in, the Facebook family's
 * browsers, and iOS WKWebViews, whose user agent lacks the Safari token that
 * Safari, Chrome and Firefox on iOS all send. Sending these readers to Google
 * only shows them Google's error page, so /login tells them to open the site
 * in their own browser instead.
 */
const GOOGLE_BLOCKED = /; wv\)|FBAN|FBAV|FB_IAB|Instagram|LinkedInApp|Line\/|MicroMessenger|Snapchat|Telegram/i;

export function googleBlocksThisBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (GOOGLE_BLOCKED.test(ua)) return true;
  return /iPhone|iPad|iPod/.test(ua) && !/Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua);
}

export const isAndroid = () => typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent || '');

// Popup failures that mean "this browser can't do popups", not "the user said no".
const POPUP_UNSUPPORTED = new Set([
  'auth/popup-blocked',
  'auth/operation-not-supported-in-this-environment',
  'auth/web-storage-unsupported',
]);

export async function signInWithGoogleRedirect(): Promise<void> {
  await signInWithRedirect(auth, googleProvider);
}

/**
 * Signs in with Google, falling back to a full-page redirect when the browser
 * can't complete a popup. Resolves to the mechanism that ran — 'redirect' means
 * the page is navigating away and the caller should not touch state afterwards.
 */
export async function signInWithGoogle(): Promise<'popup' | 'redirect'> {
  // In an app's built-in browser Google would only show its own error page,
  // so the reader is taken to /login, which explains how to open the site in
  // a real browser, and comes back here once signed in.
  if (googleBlocksThisBrowser() && window.location.pathname !== '/login') {
    const here = window.location.pathname + window.location.search;
    window.location.assign(`/login?next=${encodeURIComponent(here)}`);
    return 'redirect';
  }
  if (prefersRedirectSignIn()) {
    await signInWithGoogleRedirect();
    return 'redirect';
  }
  try {
    await signInWithPopup(auth, googleProvider);
    return 'popup';
  } catch (err) {
    const code = (err as { code?: string }).code ?? '';
    if (POPUP_UNSUPPORTED.has(code)) {
      await signInWithGoogleRedirect();
      return 'redirect';
    }
    throw err;
  }
}
