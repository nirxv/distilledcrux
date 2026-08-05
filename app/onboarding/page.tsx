'use client';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

const optionals = [
  { id: 'sociology',          label: 'Sociology',           emoji: '👥', available: true },
  { id: 'anthropology',       label: 'Anthropology',        emoji: '🧬', available: true },
  { id: 'geography',          label: 'Geography',           emoji: '🌍', available: true },
  { id: 'political-science',  label: 'PSIR',   emoji: '⚖️', available: true },
  { id: 'public-administration', label: 'Public Administration', emoji: '🏛️', available: true },
];

function OnboardingInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.push('/');
        return;
      }
      setUser(firebaseUser);

      // Check if already onboarded (skip if coming from "Change Optional")
      const token = await firebaseUser.getIdToken();
      const res = await fetch('/api/user-profile', {
        headers: { 'x-user-token': token },
      });
      if (res.ok) {
        const data = await res.json();
        const isChanging = new URLSearchParams(window.location.search).get('change') === '1';
        if (data.optional && !isChanging) {
          router.push('/dashboard');
          return;
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const handleContinue = async () => {
    if (!selected || !user) return;
    setSaving(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/user-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-token': token,
        },
        body: JSON.stringify({ optional: selected }),
      });
      if (res.ok) {
        router.push('/dashboard');
      } else {
        setSaving(false);
      }
    } catch {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
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
      <div style={{ maxWidth: 560, width: '100%' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'var(--accent-dim)', border: '1px solid rgba(67,97,238,0.2)',
            color: 'var(--accent)', fontSize: '0.72rem', fontFamily: 'var(--font-ui)',
            padding: '4px 14px', borderRadius: 20, marginBottom: '1.25rem',
            letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
            One-time setup
          </div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1.8rem, 4vw, 2.4rem)',
            fontWeight: 700, color: 'var(--text)',
            letterSpacing: '-0.02em', marginBottom: '0.6rem',
          }}>
            Choose your Optional
          </h1>
          <p style={{ color: 'var(--text3)', fontSize: '0.9rem', lineHeight: 1.6 }}>
            All content, PYQs, and AI will be tailored to your optional subject.
          </p>
        </div>

        {/* Optional grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: '0.75rem',
          marginBottom: '2rem',
        }}>
          {optionals.map((opt) => {
            const isSelected = selected === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => opt.available && setSelected(opt.id)}
                disabled={!opt.available}
                style={{
                  background: isSelected ? 'rgba(67,97,238,0.1)' : 'var(--bg2)',
                  border: `1px solid ${isSelected ? 'rgba(67,97,238,0.5)' : 'var(--border)'}`,
                  borderRadius: 12,
                  padding: '1.25rem 1rem',
                  cursor: opt.available ? 'pointer' : 'not-allowed',
                  opacity: opt.available ? 1 : 0.4,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', gap: '0.5rem',
                  transition: 'all 0.15s',
                  position: 'relative',
                }}
              >
                <span style={{ fontSize: '1.75rem' }}>{opt.emoji}</span>
                <span style={{
                  color: isSelected ? 'var(--accent)' : 'var(--text)',
                  fontFamily: 'var(--font-ui)',
                  fontWeight: 600, fontSize: '0.85rem',
                  lineHeight: 1.3, textAlign: 'center',
                }}>
                  {opt.label}
                </span>

                {isSelected && (
                  <div style={{
                    position: 'absolute', top: 8, right: 8,
                    width: 18, height: 18, borderRadius: '50%',
                    background: 'var(--accent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5l2.5 2.5L8 3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Continue button */}
        <button
          onClick={handleContinue}
          disabled={!selected || saving}
          style={{
            width: '100%',
            background: selected ? 'var(--accent)' : 'var(--bg3)',
            color: selected ? '#fff' : 'var(--text3)',
            border: 'none',
            borderRadius: 10,
            padding: '0.875rem',
            fontSize: '0.95rem', fontWeight: 600,
            fontFamily: 'var(--font-ui)',
            cursor: selected ? 'pointer' : 'not-allowed',
            transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {saving ? (
            <>
              <span style={{
                width: 16, height: 16, borderRadius: '50%',
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: '#fff',
                display: 'inline-block',
                animation: 'spin 0.7s linear infinite',
              }} />
              Saving…
            </>
          ) : (
            'Continue →'
          )}
        </button>

        <p style={{
          textAlign: 'center', marginTop: '1rem',
          color: 'var(--text3)', fontSize: '0.78rem',
          fontFamily: 'var(--font-ui)',
        }}>
          
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function Onboarding() {
  return (
    <Suspense>
      <OnboardingInner />
    </Suspense>
  );
}
