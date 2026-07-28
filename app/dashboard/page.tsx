'use client';
import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import Link from 'next/link';

const features = [
  { icon: '📝', label: 'Evaluate Answer', href: '/evaluate', desc: 'AI-powered answer evaluation' },
  { icon: '💬', label: 'AI Chat', href: '/chat', desc: 'Ask anything about your optional' },
  { icon: '📖', label: 'Notes', href: '/notes', desc: 'Curated syllabus notes' },
  { icon: '🗂️', label: 'PYQs', href: '/pyqs', desc: 'Previous year questions' },
  { icon: '🏆', label: 'Topper Copies', href: '/toppers', desc: 'Real topper answer sheets' },
  { icon: '⚡', label: 'Prelims', href: '/prelims', desc: 'MCQ practice' },
];

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [optional, setOptional] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const token = await firebaseUser.getIdToken();
        const res = await fetch('/api/user-profile', {
          headers: { 'x-user-token': token },
        });
        if (res.ok) {
          const data = await res.json();
          setOptional(data.optional || null);
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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

  if (!user) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
        <p style={{ color: 'var(--text2)' }}>Please sign in to access your dashboard.</p>
        <Link href="/" style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: '0.875rem' }}>← Back to home</Link>
      </div>
    );
  }

  if (!optional) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
        <p style={{ color: 'var(--text2)' }}>Please complete onboarding first.</p>
        <Link href="/onboarding" style={{
          background: 'var(--accent)', color: '#fff',
          padding: '0.6rem 1.5rem', borderRadius: 8,
          textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600,
        }}>
          Choose your Optional →
        </Link>
      </div>
    );
  }

  const displayName = user.displayName?.split(' ')[0] || 'there';
  const optionalLabel = optional.charAt(0).toUpperCase() + optional.slice(1);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '2.5rem 1.5rem 4rem' }}>

      {/* Header */}
      <div style={{ marginBottom: '2.5rem' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'var(--accent-dim)', border: '1px solid rgba(67,97,238,0.2)',
          color: 'var(--accent)', fontSize: '0.72rem', fontFamily: 'var(--font-ui)',
          padding: '4px 12px', borderRadius: 20, marginBottom: '1rem',
          letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
          {optionalLabel} Optional
        </div>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: 'clamp(1.6rem, 4vw, 2.2rem)',
          fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em',
          marginBottom: '0.35rem',
        }}>
          Welcome back, {displayName}
        </h1>
        <p style={{ color: 'var(--text3)', fontSize: '0.9rem' }}>
          {user.email}
        </p>
      </div>

      {/* Feature grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: '1rem',
      }}>
        {features.map((f) => (
          <Link key={f.href} href={f.href} style={{ textDecoration: 'none' }}>
            <div style={{
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '1.25rem 1.5rem',
              display: 'flex', flexDirection: 'column', gap: '0.5rem',
              cursor: 'pointer',
              transition: 'border-color 0.15s, background 0.15s',
            }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(67,97,238,0.35)';
                (e.currentTarget as HTMLElement).style.background = 'var(--bg3)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                (e.currentTarget as HTMLElement).style.background = 'var(--bg2)';
              }}
            >
              <span style={{ fontSize: '1.5rem' }}>{f.icon}</span>
              <div>
                <div style={{
                  color: 'var(--text)', fontWeight: 600, fontSize: '0.95rem',
                  fontFamily: 'var(--font-ui)', marginBottom: '0.2rem',
                }}>{f.label}</div>
                <div style={{ color: 'var(--text3)', fontSize: '0.8rem' }}>{f.desc}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
