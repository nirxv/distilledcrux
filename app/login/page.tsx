'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, googleProvider } from '@/lib/firebase';
import { onAuthStateChanged, signInWithPopup } from 'firebase/auth';

export default function LoginPage() {
  const router = useRouter();
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const token = await firebaseUser.getIdToken();
        const res = await fetch('/api/user-profile', {
          headers: { 'x-user-token': token },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.optional) {
            router.push('/dashboard');
          } else {
            router.push('/onboarding');
          }
        } else {
          router.push('/onboarding');
        }
        return;
      }
      setChecking(false);
    });
    return () => unsubscribe();
  }, [router]);

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const firebaseError = err as { code?: string };
      if (firebaseError.code !== 'auth/popup-closed-by-user') {
        setError('Sign in failed. Please try again.');
      }
      setSigningIn(false);
    }
  };

  if (checking) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          border: '2px solid var(--border2)',
          borderTopColor: 'var(--accent)',
          animation: 'spin 0.7s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '2rem 1.5rem',
    }}>
      <div style={{ maxWidth: 400, width: '100%' }}>

        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <a href="/" style={{ textDecoration: 'none', display: 'inline-block' }}>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.5rem', fontWeight: 700,
              color: 'var(--text)', letterSpacing: '-0.02em',
            }}>
              Prep<span style={{ color: 'var(--accent)' }}>Pandit</span>
            </span>
          </a>
        </div>

        <div style={{
          background: 'var(--bg2)',
          border: '1px solid var(--border2)',
          borderRadius: 16,
          padding: '2rem',
        }}>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.4rem', fontWeight: 700,
            color: 'var(--text)', letterSpacing: '-0.02em',
            marginBottom: '0.35rem',
            textAlign: 'center',
          }}>
            Welcome back
          </h1>
          <p style={{
            color: 'var(--text3)', fontSize: '0.875rem',
            textAlign: 'center', marginBottom: '1.75rem',
            lineHeight: 1.5,
          }}>
            Sign in to continue your UPSC preparation
          </p>

          <button
            onClick={handleGoogleSignIn}
            disabled={signingIn}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              width: '100%',
              background: 'var(--bg3)',
              border: '1px solid var(--border2)',
              color: signingIn ? 'var(--text3)' : 'var(--text)',
              cursor: signingIn ? 'not-allowed' : 'pointer',
              padding: '0.8rem 1.25rem',
              borderRadius: 10,
              fontSize: '0.9rem', fontWeight: 600,
              fontFamily: 'var(--font-ui)',
              transition: 'all 0.15s',
            }}
          >
            {signingIn ? (
              <>
                <span style={{
                  width: 16, height: 16, borderRadius: '50%',
                  border: '2px solid var(--border2)',
                  borderTopColor: 'var(--accent)',
                  display: 'inline-block',
                  animation: 'spin 0.7s linear infinite',
                }} />
                Signing in…
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </>
            )}
          </button>

          {error && (
            <p style={{
              marginTop: '1rem',
              color: 'var(--red)', fontSize: '0.8rem',
              textAlign: 'center', fontFamily: 'var(--font-ui)',
            }}>
              {error}
            </p>
          )}
        </div>

        <p style={{
          textAlign: 'center', marginTop: '1.5rem',
          fontSize: '0.75rem', color: 'var(--text3)',
          fontFamily: 'var(--font-ui)', lineHeight: 1.6,
        }}>
          By continuing, you agree to our{' '}
          <a href="/terms" style={{ color: 'var(--text2)', textDecoration: 'none' }}>Terms</a>
          {' '}and{' '}
          <a href="/privacy" style={{ color: 'var(--text2)', textDecoration: 'none' }}>Privacy Policy</a>
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
