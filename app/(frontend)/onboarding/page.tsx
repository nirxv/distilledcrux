'use client';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { normalizeIndianMobile } from '@/lib/phone';
import SubjectIcon from '@/components/SubjectIcon';

const optionals = [
  { id: 'sociology',          label: 'Sociology', available: true },
  { id: 'anthropology',       label: 'Anthropology', available: true },
  { id: 'geography',          label: 'Geography', available: true },
  { id: 'political-science',  label: 'PSIR', available: true },
  { id: 'public-administration', label: 'Public Administration', available: true },
];

function OnboardingInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  // True when the reader already has an optional and is here only because
  // their profile predates the number being asked for. The card says so
  // rather than telling someone who chose months ago to choose again.
  const [phoneOnly, setPhoneOnly] = useState(false);
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.push('/login');
        return;
      }
      setUser(firebaseUser);

      // Check if already onboarded (skip if coming from "Change Optional")
      try {
        const token = await firebaseUser.getIdToken();
        const res = await fetch('/api/user-profile', {
          headers: { 'x-user-token': token },
        });
        if (res.ok) {
          const data = await res.json();
          const isChanging = new URLSearchParams(window.location.search).get('change') === '1';
          // A profile only counts as done when it has both. Readers who
          // onboarded before the number was asked for have an optional and no
          // phone, and they are sent through here again rather than waved past,
          // which is what makes the field mandatory rather than merely new.
          if (data.optional && data.phone && !isChanging) {
            router.push('/dashboard');
            return;
          }
          if (data.optional) setSelected(data.optional);
          if (data.phone) setPhone(data.phone);
          if (data.optional && !data.phone && !isChanging) setPhoneOnly(true);
        }
      } catch (err) {
        // Fall through to the picker rather than hanging on the spinner.
        console.error('Profile lookup failed:', err);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const handleContinue = async () => {
    if (!selected || !user) return;

    // Same rules the route applies, so nobody is told their number is fine and
    // then refused by the server.
    const number = normalizeIndianMobile(phone);
    if (!number.ok) {
      setPhoneError(number.error);
      return;
    }
    setPhoneError(null);

    setSaving(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/user-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-token': token,
        },
        body: JSON.stringify({ optional: selected, phone: number.phone }),
      });
      if (res.ok) {
        router.push('/dashboard');
      } else {
        const data = await res.json().catch(() => null);
        setPhoneError(data?.error ?? 'Could not save. Please try again.');
        setSaving(false);
      }
    } catch {
      setPhoneError('Could not save. Please check your connection.');
      setSaving(false);
    }
  };

  // Both are required, so the button reflects both rather than just the picker.
  const ready = Boolean(selected) && normalizeIndianMobile(phone).ok;

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
            color: 'var(--accent)', fontSize: '0.72rem', fontWeight: 500, fontFamily: 'var(--font-ui)',
            padding: '4px 14px', borderRadius: 20, marginBottom: '1.25rem',
            letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
            {phoneOnly ? 'One more thing' : 'One-time setup'}
          </div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1.8rem, 4vw, 2.4rem)',
            fontWeight: 700, color: 'var(--text)',
            letterSpacing: '-0.02em', marginBottom: '0.6rem',
          }}>
            {phoneOnly ? 'Add your mobile number' : 'Choose your Optional'}
          </h1>
          <p style={{ color: 'var(--text3)', fontSize: '0.9rem', fontWeight: 500, lineHeight: 1.6 }}>
            {phoneOnly
              ? 'We ask everyone for one now, so we can reach you about new features, materials, offers and discounts. Your optional is unchanged.'
              : 'All content, PYQs, and AI will be tailored to your optional subject.'}
          </p>
        </div>

        {/* Optional grid */}
        {phoneOnly && (
          <p style={{
            fontFamily: 'var(--font-ui)', fontSize: '0.78rem', fontWeight: 500,
            color: 'var(--text3)', marginBottom: '0.6rem',
          }}>
            Your optional, if you want to change it while you are here:
          </p>
        )}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: '0.75rem',
          marginBottom: '2rem',
          opacity: phoneOnly ? 0.75 : 1,
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
                <SubjectIcon id={opt.id} size={28} />
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

        {/* Mobile number */}
        <div style={{ marginBottom: '2rem' }}>
          <label
            htmlFor="phone"
            style={{
              display: 'block',
              fontFamily: 'var(--font-ui)', fontSize: '0.78rem', fontWeight: 600,
              color: 'var(--text2)', marginBottom: '0.5rem',
              letterSpacing: '0.02em',
            }}
          >
            Mobile number
          </label>
          <div style={{
            display: 'flex', alignItems: 'stretch',
            background: 'var(--bg2)',
            border: `1px solid ${phoneError ? 'rgba(248,113,113,0.5)' : 'var(--border)'}`,
            borderRadius: 10,
            overflow: 'hidden',
            transition: 'border-color 0.15s',
          }}>
            <span style={{
              display: 'flex', alignItems: 'center',
              padding: '0 0.75rem',
              background: 'var(--bg3)',
              borderRight: '1px solid var(--border)',
              fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 500,
              color: 'var(--text3)',
            }}>
              +91
            </span>
            <input
              id="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="Your mobile number here"
              value={phone}
              // Ten digits is the whole alphabet of this field, so anything
              // else is dropped as it is typed rather than rejected afterwards.
              maxLength={10}
              onChange={(e) => {
                setPhone(e.target.value.replace(/\D/g, '').slice(0, 10));
                if (phoneError) setPhoneError(null);
              }}
              aria-invalid={phoneError ? true : undefined}
              aria-describedby={phoneError ? 'phone-error' : 'phone-hint'}
              style={{
                flex: 1, minWidth: 0,
                background: 'transparent', border: 'none', outline: 'none',
                padding: '0.875rem 1rem',
                color: 'var(--text)',
                fontFamily: 'var(--font-ui)', fontSize: '0.95rem',
              }}
            />
          </div>
          {phoneError ? (
            <p id="phone-error" role="alert" style={{
              margin: '0.5rem 0 0', color: '#f87171',
              fontFamily: 'var(--font-ui)', fontSize: '0.78rem', fontWeight: 500,
            }}>
              {phoneError}
            </p>
          ) : (
            <p id="phone-hint" style={{
              margin: '0.5rem 0 0', color: 'var(--text3)',
              fontFamily: 'var(--font-ui)', fontSize: '0.78rem', fontWeight: 500, lineHeight: 1.5,
            }}>
              So we can reach you about new features, materials, offers and discounts.
            </p>
          )}
        </div>

        {/* Continue button */}
        <button
          onClick={handleContinue}
          disabled={!ready || saving}
          style={{
            width: '100%',
            background: ready ? 'var(--accent)' : 'var(--bg3)',
            color: ready ? '#fff' : 'var(--text3)',
            border: 'none',
            borderRadius: 10,
            padding: '0.875rem',
            fontSize: '0.95rem', fontWeight: 600,
            fontFamily: 'var(--font-ui)',
            cursor: ready ? 'pointer' : 'not-allowed',
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
          color: 'var(--text3)', fontSize: '0.78rem', fontWeight: 500,
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
