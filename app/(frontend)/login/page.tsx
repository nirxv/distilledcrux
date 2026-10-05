'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { auth, signInWithGoogle, signInWithGoogleRedirect } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import Mascot from '@/components/Mascot';
import OwlLoader from '@/components/OwlLoader';

/** Only ever send the user to a path on this origin. */
function safeNext(): string | null {
  const raw = new URLSearchParams(window.location.search).get('next');
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : null;
}

/** Where the reader was headed, in words, so the page can say they'll get there. */
function destination(next: string | null): string | null {
  if (!next) return null;
  const path = next.split('?')[0];
  if (path.startsWith('/chat')) return 'You’ll go straight back to the AI chat.';
  if (path.startsWith('/evaluate')) return 'You’ll go straight back to getting your answer checked.';
  if (path.startsWith('/pricing')) return 'You’ll go straight back to the plans.';
  if (path.startsWith('/notes')) return 'You’ll go straight back to your notes.';
  if (path.startsWith('/test')) return 'You’ll go straight back to your test.';
  return null;
}

export default function LoginPage() {
  const router = useRouter();
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [popupFailed, setPopupFailed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [headed, setHeaded] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setHeaded(destination(safeNext()));
        setChecking(false);
        return;
      }
      const next = safeNext();
      // A new reader goes through onboarding first; it used to drop where
      // they were headed and land them on the dashboard instead.
      const onboarding = `/onboarding${next ? `?next=${encodeURIComponent(next)}` : ''}`;
      try {
        const token = await firebaseUser.getIdToken();
        const res = await fetch('/api/user-profile', {
          headers: { 'x-user-token': token },
        });
        if (res.ok) {
          const data = await res.json();
          // Both, not just the optional. Readers who signed up before the
          // number was asked for are sent to fill it in on their next visit,
          // which is what makes it mandatory for them too.
          if (!data.optional || !data.phone) { router.push(onboarding); return; }
          router.push(next ?? '/dashboard');
        } else {
          router.push(onboarding);
        }
      } catch (err) {
        // Never strand the user on the spinner if the profile lookup fails.
        console.error('Profile lookup failed:', err);
        router.push(next ?? '/dashboard');
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    setError(null);
    setPopupFailed(false);
    try {
      const mode = await signInWithGoogle();
      // 'redirect' means the page is navigating away; leave the spinner up.
      if (mode === 'redirect') return;
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        // On mobile the popup often closes itself without completing, so offer
        // the redirect flow rather than silently doing nothing.
        setPopupFailed(true);
      } else if (code === 'auth/unauthorized-domain') {
        setError('This domain is not authorised for sign in. Please contact support.');
      } else {
        setError('Sign in failed. Please try again.');
      }
      setSigningIn(false);
    }
  };

  const handleRedirectSignIn = async () => {
    setSigningIn(true);
    setError(null);
    setPopupFailed(false);
    try {
      await signInWithGoogleRedirect();
    } catch (err) {
      console.error('Redirect sign-in failed:', err);
      setError('Sign in failed. Please try again.');
      setSigningIn(false);
    }
  };

  if (checking) return <OwlLoader size="page" label="Checking your sign-in" />;

  return (
    <div className="lg ds">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="lg-card">
        <Mascot pose="peek" width={104} preload />
        <h1 className="lg-title">Sign in to Distilled Crux</h1>
        <p className="lg-lede">
          {headed ? `${headed} ` : ''}
          New here? Signing in with Google makes your free account.
        </p>

        <button type="button" className="lg-google" onClick={handleGoogleSignIn} disabled={signingIn}>
          {signingIn ? (
            <><span className="lg-spin" aria-hidden="true" />Signing in…</>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </>
          )}
        </button>

        {popupFailed && (
          <div className="lg-fallback">
            <p>The Google window closed before it finished. Some phone browsers block it.</p>
            <button type="button" onClick={handleRedirectSignIn}>Sign in without the pop-up</button>
          </div>
        )}

        {error && <p className="lg-error" role="alert">{error}</p>}

        <div className="lg-free">
          <strong>A free account opens</strong>
          <span>every note and past question for your optional, three AI chats and one answer evaluation.</span>
        </div>

        <p className="lg-legal">
          By continuing, you agree to our <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}

const CSS = `
.lg { min-height: var(--page-min-h); display: flex; align-items: center; justify-content: center; padding: clamp(24px, 6vh, 64px) var(--space-4); background: radial-gradient(ellipse at 50% 0%, color-mix(in srgb, var(--accent-dim) 80%, transparent) 0%, transparent 60%), var(--bg); }
.lg-card { width: 100%; max-width: 440px; display: flex; flex-direction: column; align-items: center; text-align: center; padding: var(--space-8) var(--space-6) var(--space-6); background: var(--ds-card); border: 1px solid var(--border); border-radius: var(--radius-xl); box-shadow: var(--elev-2); }
.lg-title { margin: var(--space-4) 0 var(--space-2); font-size: 1.6rem; font-weight: 800; letter-spacing: -0.02em; }
.lg-lede { margin: 0 0 var(--space-6); color: var(--text2); line-height: 1.6; }
.lg-google { width: 100%; min-height: 52px; display: inline-flex; align-items: center; justify-content: center; gap: 12px; padding: 0 var(--space-5); border: 1.5px solid var(--border2); border-radius: var(--radius-full); background: var(--bg); color: var(--text); font: inherit; font-size: 1rem; font-weight: 600; cursor: pointer; transition: border-color 0.15s, box-shadow 0.15s; }
.lg-google:hover:not(:disabled) { border-color: var(--border3); box-shadow: var(--elev-1); }
.lg-google:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.lg-google:disabled { color: var(--text3); cursor: progress; }
.lg-spin { width: 16px; height: 16px; border-radius: 50%; border: 2px solid var(--border2); border-top-color: var(--accent); animation: lgSpin 0.7s linear infinite; }
@keyframes lgSpin { to { transform: rotate(360deg); } }
.lg-fallback { margin-top: var(--space-4); font-size: 0.9rem; color: var(--text2); }
.lg-fallback p { margin: 0 0 var(--space-2); }
.lg-fallback button { background: none; border: none; padding: 0; font: inherit; font-weight: 700; color: var(--accent-text); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
.lg-error { margin: var(--space-4) 0 0; color: var(--danger-text); font-size: 0.92rem; }
.lg-free { display: flex; flex-direction: column; gap: 2px; width: 100%; margin-top: var(--space-6); padding: var(--space-4); border-radius: var(--radius-lg); background: var(--ds-soft); font-size: 0.92rem; line-height: 1.55; color: var(--text2); }
.lg-free strong { color: var(--text); }
.lg-legal { margin: var(--space-5) 0 0; font-size: 0.82rem; color: var(--text3); line-height: 1.5; }
.lg-legal a { color: var(--text2); }
@media (max-width: 640px) {
  .lg-card { padding: var(--space-6) var(--space-4) var(--space-5); }
  .lg-title { font-size: 1.4rem; }
}
@media (prefers-reduced-motion: reduce) { .lg-spin { animation-duration: 2s; } }
`;
