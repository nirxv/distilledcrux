'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

const SUBJECT_LABEL: Record<string, string> = {
  sociology: 'Sociology', anthropology: 'Anthropology',
  geography: 'Geography', 'political-science': 'Political Science',
  'public-administration': 'Public Administration', history: 'History',
};

const FEATURES = [
  { icon: '✍️', label: 'Evaluate Answer', href: '/evaluate', desc: 'AI feedback on structure, content & marks.', color: 'var(--accent)', badge: null },
  { icon: '🤖', label: 'AI Chat', href: '/chat', desc: 'Syllabus-aware answers for your optional.', color: '#a78bfa', badge: null },
  { icon: '📖', label: 'Notes', href: '/notes', desc: 'Exhaustive syllabus notes by paper and section.', color: '#34d399', badge: 'Free' },
  { icon: '🗂️', label: 'PYQs', href: '/sociology/pyqs', desc: '1500+ previous year questions with filters.', color: '#f59e0b', badge: 'Free' },
  { icon: '🏆', label: 'Topper Copies', href: '/toppers', desc: 'Real topper answer sheets — see 300+ scores.', color: '#f87171', badge: 'Premium' },
];

interface Stats {
  optional: string | null;
  chatCount: number;
  isPremium: boolean;
  plan: string | null;
  expiresAt: string | null;
  joinedAt: string | null;
  daysSinceJoin: number;
  lastActive: string | null;
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{
      background: 'var(--bg2)', border: '1px solid var(--border)',
      borderRadius: 14, padding: '1.25rem 1.5rem',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ color: 'var(--text3)', fontSize: '0.7rem', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ color: color ?? 'var(--text)', fontSize: '1.9rem', fontWeight: 700, fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ color: 'var(--text3)', fontSize: '0.75rem', fontFamily: 'var(--font-ui)' }}>{sub}</div>}
    </div>
  );
}

function UsageBar({ used, max, isPremium }: { used: number; max: number; isPremium: boolean }) {
  const pct = isPremium ? 100 : Math.min((used / max) * 100, 100);
  const color = isPremium ? '#4ade80' : pct >= 100 ? '#f87171' : pct >= 66 ? '#f59e0b' : 'var(--accent)';
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ color: 'var(--text2)', fontSize: '0.82rem', fontFamily: 'var(--font-ui)', fontWeight: 600 }}>
          {isPremium ? 'Unlimited chats' : `${used} / ${max} free chats used`}
        </span>
        {!isPremium && (
          <Link href="/pricing" style={{
            fontSize: '0.72rem', fontFamily: 'var(--font-ui)', fontWeight: 600,
            color: 'var(--accent)', textDecoration: 'none',
            background: 'rgba(67,97,238,0.08)', padding: '3px 10px', borderRadius: 20,
            border: '1px solid rgba(67,97,238,0.2)'
          }}>Upgrade →</Link>
        )}
      </div>
      <div style={{ height: 6, borderRadius: 99, background: 'var(--bg3)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 99,
          width: `${pct}%`,
          background: color,
          transition: 'width 0.6s ease',
        }} />
      </div>
    </div>
  );
}

function SubscriptionBadge({ isPremium, plan, expiresAt }: { isPremium: boolean; plan: string | null; expiresAt: string | null }) {
  if (isPremium) {
    const exp = expiresAt ? new Date(expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
    return (
      <div style={{
        background: 'rgba(232,184,109,0.08)', border: '1px solid rgba(232,184,109,0.25)',
        borderRadius: 12, padding: '1rem 1.25rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.3rem' }}>👑</span>
          <div>
            <div style={{ color: 'var(--gold, #e8b86d)', fontWeight: 700, fontSize: '0.9rem', fontFamily: 'var(--font-ui)' }}>
              PrepPandit Pro {plan ? `· ${plan}` : ''}
            </div>
            {exp && <div style={{ color: 'var(--text3)', fontSize: '0.75rem', fontFamily: 'var(--font-ui)' }}>Active until {exp}</div>}
          </div>
        </div>
        <div style={{
          background: 'rgba(74,222,128,0.1)', color: '#4ade80',
          border: '1px solid rgba(74,222,128,0.25)',
          fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em',
          padding: '3px 10px', borderRadius: 20, fontFamily: 'var(--font-ui)',
          textTransform: 'uppercase'
        }}>Active</div>
      </div>
    );
  }
  return (
    <div style={{
      background: 'var(--bg2)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '1.25rem',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      flexWrap: 'wrap',
    }}>
      <div>
        <div style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.9rem', fontFamily: 'var(--font-ui)', marginBottom: 4 }}>
          Free Plan
        </div>
        <div style={{ color: 'var(--text3)', fontSize: '0.78rem', fontFamily: 'var(--font-ui)' }}>
          3 AI chats · Limited features
        </div>
      </div>
      <Link href="/pricing" style={{
        background: 'var(--accent)', color: '#fff', textDecoration: 'none',
        padding: '0.5rem 1.25rem', borderRadius: 8,
        fontSize: '0.85rem', fontFamily: 'var(--font-ui)', fontWeight: 600,
        flexShrink: 0,
      }}>Upgrade to Pro →</Link>
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) { router.push('/login'); return; }
      setUser(firebaseUser);
      try {
        const token = await firebaseUser.getIdToken();
        const res = await fetch('/api/dashboard-stats', { headers: { 'x-user-token': token } });
        if (res.ok) {
          const data = await res.json();
          if (!data.optional) { router.push('/onboarding'); return; }
          setStats(data);
        }
      } catch {}
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  if (loading) return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid var(--border2)', borderTopColor: 'var(--accent)', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!stats) return null;

  const firstName = user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const optLabel = SUBJECT_LABEL[stats.optional ?? ''] ?? stats.optional ?? '';
  const joinDate = stats.joinedAt ? new Date(stats.joinedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '2.5rem 1.5rem 5rem' }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        .feat-card{transition:border-color 0.15s,transform 0.15s,background 0.15s;}
        .feat-card:hover{border-color:var(--border3)!important;transform:translateY(-2px);background:var(--bg3)!important;}
        @media(max-width:640px){.feat-grid{grid-template-columns:1fr!important;}.stats-grid{grid-template-columns:1fr 1fr!important;}}
      `}</style>

      {/* Hero */}
      <div style={{ marginBottom: '2rem', animation: 'fadeUp 0.35s ease' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'rgba(67,97,238,0.08)', border: '1px solid rgba(67,97,238,0.18)',
          color: 'var(--accent)', fontSize: '0.68rem', fontFamily: 'var(--font-ui)',
          padding: '3px 12px', borderRadius: 20, marginBottom: '0.9rem',
          letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
          {optLabel} Optional
        </div>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(1.8rem, 4vw, 2.6rem)',
          fontWeight: 700, color: 'var(--text)',
          letterSpacing: '-0.025em', lineHeight: 1.15, marginBottom: '0.4rem',
        }}>
          {greeting}, {firstName}.
        </h1>
        <p style={{ color: 'var(--text3)', fontSize: '0.88rem', fontFamily: 'var(--font-ui)' }}>
          Member since {joinDate} · {user?.email}
        </p>
      </div>

      {/* Subscription status */}
      <div style={{ marginBottom: '1.5rem', animation: 'fadeUp 0.4s ease' }}>
        <SubscriptionBadge isPremium={stats.isPremium} plan={stats.plan} expiresAt={stats.expiresAt} />
      </div>

      {/* Stats grid */}
      <div className="stats-grid" style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '1rem', marginBottom: '1.5rem',
        animation: 'fadeUp 0.42s ease',
      }}>
        <StatCard
          label="AI Chats"
          value={stats.isPremium ? '∞' : stats.chatCount}
          sub={stats.isPremium ? 'Unlimited' : `of 3 free used`}
          color={stats.chatCount >= 3 && !stats.isPremium ? '#f87171' : 'var(--accent)'}
        />
        <StatCard label="Days Active" value={stats.daysSinceJoin} sub="since joining" />
        <StatCard label="Optional" value={optLabel.split(' ')[0]} sub={optLabel} />
        <StatCard
          label="Status"
          value={stats.isPremium ? 'Pro' : 'Free'}
          sub={stats.isPremium ? 'Premium access' : '3 chat limit'}
          color={stats.isPremium ? '#4ade80' : 'var(--text3)'}
        />
      </div>

      {/* Usage bar */}
      {!stats.isPremium && (
        <div style={{
          background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: 14, padding: '1.25rem 1.5rem',
          marginBottom: '1.5rem', animation: 'fadeUp 0.44s ease',
        }}>
          <UsageBar used={stats.chatCount} max={3} isPremium={stats.isPremium} />
        </div>
      )}

      {/* Quick actions */}
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: 14, padding: '1.25rem 1.5rem',
        marginBottom: '1.5rem', animation: 'fadeUp 0.46s ease',
      }}>
        <h2 style={{ fontFamily: 'var(--font-ui)', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text3)', marginBottom: '1rem' }}>Quick Actions</h2>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {[
            { label: '💬 Ask AI', href: '/chat', primary: true },
            { label: '📝 Evaluate Answer', href: '/evaluate', primary: false },
            { label: '🗂️ Browse PYQs', href: '/sociology/pyqs', primary: false },
            { label: '📖 Notes', href: '/notes', primary: false },
            { label: '⚙️ Change Optional', href: '/onboarding?change=1', primary: false },
          ].map((a) => (
            <Link key={a.href} href={a.href} style={{
              textDecoration: 'none',
              background: a.primary ? 'var(--accent)' : 'var(--bg3)',
              color: a.primary ? '#fff' : 'var(--text2)',
              border: `1px solid ${a.primary ? 'transparent' : 'var(--border2)'}`,
              padding: '0.5rem 1.1rem', borderRadius: 8,
              fontSize: '0.83rem', fontFamily: 'var(--font-ui)', fontWeight: 500,
            }}>{a.label}</Link>
          ))}
        </div>
      </div>

      {/* Tools grid */}
      <div style={{ marginBottom: '0.75rem', animation: 'fadeUp 0.48s ease' }}>
        <h2 style={{ fontFamily: 'var(--font-ui)', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text3)', marginBottom: '1rem' }}>Your Tools</h2>
      </div>
      <div className="feat-grid" style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '1rem', animation: 'fadeUp 0.5s ease',
      }}>
        {FEATURES.map((f) => (
          <Link key={f.href} href={f.href} style={{ textDecoration: 'none' }}>
            <div className="feat-card" style={{
              background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: 14, padding: '1.5rem', height: '100%',
              display: 'flex', flexDirection: 'column', gap: '0.75rem',
              cursor: 'pointer', position: 'relative',
            }}>
              {f.badge && (
                <span style={{
                  position: 'absolute', top: 12, right: 12,
                  fontSize: '0.6rem', fontFamily: 'var(--font-ui)', fontWeight: 700,
                  letterSpacing: '0.06em', padding: '2px 7px', borderRadius: 10,
                  background: f.badge === 'Premium' ? 'rgba(232,184,109,0.12)' : 'rgba(74,222,128,0.1)',
                  color: f.badge === 'Premium' ? 'var(--gold, #e8b86d)' : '#4ade80',
                  border: `1px solid ${f.badge === 'Premium' ? 'rgba(232,184,109,0.25)' : 'rgba(74,222,128,0.2)'}`,
                }}>{f.badge}</span>
              )}
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: `color-mix(in srgb, ${f.color} 12%, transparent)`,
                border: `1px solid color-mix(in srgb, ${f.color} 25%, transparent)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.3rem', flexShrink: 0,
              }}>{f.icon}</div>
              <div>
                <div style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.95rem', fontFamily: 'var(--font-ui)', marginBottom: '0.3rem' }}>{f.label}</div>
                <div style={{ color: 'var(--text3)', fontSize: '0.8rem', fontFamily: 'var(--font-ui)', lineHeight: 1.5 }}>{f.desc}</div>
              </div>
              <div style={{ marginTop: 'auto', color: f.color, fontSize: '0.78rem', fontFamily: 'var(--font-ui)', fontWeight: 500 }}>Open →</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
