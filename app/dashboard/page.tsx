'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

const FEATURES = [
  { icon: '✍️', label: 'Evaluate Answer', href: '/evaluate', desc: 'Upload your answer sheet — get AI feedback on structure, content & marks.', color: 'var(--accent)', badge: null },
  { icon: '🤖', label: 'AI Chat', href: '/chat', desc: 'Ask anything about your optional. Syllabus-aware, exam-ready answers.', color: '#a78bfa', badge: null },
  { icon: '📖', label: 'Notes', href: '/notes', desc: 'Exhaustive syllabus notes structured by paper and section.', color: '#34d399', badge: 'Free' },
  { icon: '🗂️', label: 'PYQs', href: '/pyqs', desc: '1500+ previous year questions with year, marks and paper filters.', color: '#f59e0b', badge: 'Free' },
  { icon: '🏆', label: 'Topper Copies', href: '/toppers', desc: 'Real topper answer sheets — see what a 300+ score looks like.', color: '#f87171', badge: 'Premium' },
  { icon: '⚡', label: 'Prelims', href: '/prelims', desc: 'MCQ practice for GS Paper I topics that overlap with your optional.', color: '#38bdf8', badge: null },
];

const TIPS = [
  'Evaluate at least one answer per week to track your writing progress.',
  'Use AI Chat to understand historiography debates before writing answers.',
  'Check Topper Copies to understand what examiners actually reward.',
  'PYQs repeat — knowing patterns is half the battle.',
  'Focus on structure: Introduction → Body (3 paras) → Conclusion.',
];

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [optional, setOptional] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) { router.push('/login'); return; }
      setUser(firebaseUser);
      try {
        const token = await firebaseUser.getIdToken();
        const res = await fetch('/api/user-profile', { headers: { 'x-user-token': token } });
        if (res.ok) {
          const data = await res.json();
          if (!data.optional) { router.push('/onboarding'); return; }
          setOptional(data.optional);
        }
      } catch {}
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  if (loading) return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid var(--border2)', borderTopColor: 'var(--accent)', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const firstName = user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'there';
  const optLabel = optional ? optional.charAt(0).toUpperCase() + optional.slice(1).replace('-', ' ') : '';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '2.5rem 1.5rem 5rem' }}>

      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        .feat-card{transition:border-color 0.15s,transform 0.15s,background 0.15s;}
        .feat-card:hover{border-color:var(--border3)!important;transform:translateY(-2px);background:var(--bg3)!important;}
        @media(max-width:640px){.feat-grid{grid-template-columns:1fr!important;}}
      `}</style>

      {/* ── Hero greeting ── */}
      <div style={{ marginBottom: '2.5rem', animation: 'fadeUp 0.4s ease' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'rgba(67,97,238,0.08)', border: '1px solid rgba(67,97,238,0.18)',
          color: 'var(--accent)', fontSize: '0.7rem', fontFamily: 'var(--font-ui)',
          padding: '3px 12px', borderRadius: 20, marginBottom: '1rem',
          letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
          {optLabel} Optional
        </div>

        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(1.8rem, 4vw, 2.6rem)',
          fontWeight: 700, color: 'var(--text)',
          letterSpacing: '-0.025em', lineHeight: 1.15,
          marginBottom: '0.5rem',
        }}>
          {greeting}, {firstName}.
        </h1>
        <p style={{ color: 'var(--text3)', fontSize: '0.95rem', fontFamily: 'var(--font-ui)' }}>
          {user?.email}
        </p>
      </div>

      {/* ── Tip banner ── */}
      <div style={{
        background: 'rgba(67,97,238,0.05)',
        border: '1px solid rgba(67,97,238,0.15)',
        borderRadius: 12, padding: '0.9rem 1.25rem',
        marginBottom: '2rem',
        display: 'flex', alignItems: 'flex-start', gap: 12,
        animation: 'fadeUp 0.45s ease',
      }}>
        <span style={{ fontSize: '1.1rem', flexShrink: 0, marginTop: 1 }}>💡</span>
        <p style={{ color: 'var(--text2)', fontSize: '0.875rem', fontFamily: 'var(--font-ui)', lineHeight: 1.55, margin: 0 }}>
          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Tip: </span>{tip}
        </p>
      </div>

      {/* ── Feature grid ── */}
      <div style={{ marginBottom: '0.75rem' }}>
        <h2 style={{
          fontFamily: 'var(--font-ui)', fontSize: '0.7rem',
          textTransform: 'uppercase', letterSpacing: '0.1em',
          color: 'var(--text3)', marginBottom: '1rem',
        }}>Your Tools</h2>
      </div>

      <div className="feat-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '1rem',
        marginBottom: '2.5rem',
        animation: 'fadeUp 0.5s ease',
      }}>
        {FEATURES.map((f) => (
          <Link key={f.href} href={f.href} style={{ textDecoration: 'none' }}>
            <div className="feat-card" style={{
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
              borderRadius: 14,
              padding: '1.5rem',
              height: '100%',
              display: 'flex', flexDirection: 'column', gap: '0.75rem',
              cursor: 'pointer',
              position: 'relative',
            }}>
              {f.badge && (
                <span style={{
                  position: 'absolute', top: 12, right: 12,
                  fontSize: '0.6rem', fontFamily: 'var(--font-ui)',
                  fontWeight: 700, letterSpacing: '0.06em',
                  padding: '2px 7px', borderRadius: 10,
                  background: f.badge === 'Premium' ? 'rgba(232,184,109,0.12)' : 'rgba(74,222,128,0.1)',
                  color: f.badge === 'Premium' ? 'var(--gold)' : '#4ade80',
                  border: `1px solid ${f.badge === 'Premium' ? 'rgba(232,184,109,0.25)' : 'rgba(74,222,128,0.2)'}`,
                }}>
                  {f.badge}
                </span>
              )}
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: `color-mix(in srgb, ${f.color} 12%, transparent)`,
                border: `1px solid color-mix(in srgb, ${f.color} 25%, transparent)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.3rem', flexShrink: 0,
              }}>
                {f.icon}
              </div>
              <div>
                <div style={{
                  color: 'var(--text)', fontWeight: 600,
                  fontSize: '0.95rem', fontFamily: 'var(--font-ui)',
                  marginBottom: '0.3rem',
                }}>{f.label}</div>
                <div style={{
                  color: 'var(--text3)', fontSize: '0.8rem',
                  fontFamily: 'var(--font-ui)', lineHeight: 1.5,
                }}>{f.desc}</div>
              </div>
              <div style={{ marginTop: 'auto', color: f.color, fontSize: '0.78rem', fontFamily: 'var(--font-ui)', fontWeight: 500 }}>
                Open →
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Quick actions ── */}
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: 14, padding: '1.5rem',
        animation: 'fadeUp 0.55s ease',
      }}>
        <h2 style={{
          fontFamily: 'var(--font-ui)', fontSize: '0.7rem',
          textTransform: 'uppercase', letterSpacing: '0.1em',
          color: 'var(--text3)', marginBottom: '1.25rem',
        }}>Quick Actions</h2>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {[
            { label: '📝 Evaluate an answer', href: '/evaluate', primary: true },
            { label: '💬 Ask AI a question', href: '/chat', primary: false },
            { label: '🗂️ Browse PYQs', href: '/pyqs', primary: false },
            { label: '📖 Read notes', href: '/notes', primary: false },
          ].map((a) => (
            <Link key={a.href} href={a.href} style={{
              textDecoration: 'none',
              background: a.primary ? 'var(--accent)' : 'var(--bg3)',
              color: a.primary ? '#fff' : 'var(--text2)',
              border: `1px solid ${a.primary ? 'transparent' : 'var(--border2)'}`,
              padding: '0.55rem 1.1rem',
              borderRadius: 8,
              fontSize: '0.85rem',
              fontFamily: 'var(--font-ui)',
              fontWeight: 500,
              transition: 'opacity 0.15s',
            }}>
              {a.label}
            </Link>
          ))}
        </div>
      </div>

    </div>
  );
}