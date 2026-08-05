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

const TOOLS = [
  { num: '01', label: 'AI Answer Evaluation', desc: 'Upload handwritten answers — marks, section feedback, and a model answer.', href: '/evaluate', badge: null, icon: 'evaluate' },
  { num: '02', label: 'AI Chat', desc: 'Ask anything from your syllabus — thinker-backed, exam-ready answers.', href: '/chat', badge: null, icon: 'chat' },
  { num: '03', label: 'Syllabus Notes', desc: 'Every topic, every thinker, every debate — structured for Mains.', href: '/notes', badge: 'Free', icon: 'notes' },
  { num: '04', label: 'PYQ Bank', desc: '1500+ previous year questions, topic-wise, with model answers.', href: '/sociology/pyqs', badge: 'Free', icon: 'pyq' },
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

const CSS = `
  @keyframes spin { to { transform: rotate(360deg) } }
  @keyframes fadeUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }

  .db-page {
    min-height: 100vh;
  }

  /* ── Header strip ── */
  .db-header {
    max-width: 1200px; margin: 0 auto;
    padding: 100px 2rem 0;
    border-bottom: 1px solid var(--border);
    padding-bottom: 3rem;
    animation: fadeUp 0.3s ease;
  }
  .db-kicker {
    font-family: var(--font-ui); font-size: 0.65rem;
    letter-spacing: 0.18em; text-transform: uppercase; color: var(--text3);
    margin-bottom: 1.25rem; display: flex; align-items: center; gap: 10px;
  }  .db-h1 {
    font-family: var(--font-body);
    font-size: clamp(2.2rem, 5vw, 3.8rem);
    font-weight: 700; letter-spacing: -0.035em; line-height: 1.05; color: var(--text);
    margin-bottom: 0.5rem;
  }
  .db-h1 em { font-style: italic; }
  .db-sub {
    font-family: var(--font-ui); font-size: 0.85rem;
    color: var(--text3); margin-top: 0.5rem;
  }

  /* ── Two-col layout ── */
  .db-body {
    max-width: 1200px; margin: 0 auto;
    display: grid; grid-template-columns: 1fr 340px;
    gap: 0; 
    border-bottom: 1px solid var(--border);
  }

  /* ── Tools list (left col) ── */
  .db-tools {
    border-right: 1px solid var(--border);
    animation: fadeUp 0.35s ease;
  }
  .db-tools-label {
    padding: 2rem 2rem 1rem;
    font-family: var(--font-ui); font-size: 0.62rem;
    letter-spacing: 0.18em; text-transform: uppercase; color: var(--text3);
    display: flex; align-items: center; gap: 10px;
    border-bottom: 1px solid var(--border);
  }
  /* Card grid */
  .db-tool-grid {
    display: grid; grid-template-columns: 1fr 1fr;
  }
  .db-tool-card {
    padding: 1.5rem;
    border-bottom: 1px solid var(--border);
    border-right: 1px solid var(--border);
    text-decoration: none;
    background: var(--bg);
    transition: background 0.15s;
    position: relative;
    display: flex; flex-direction: column; gap: 0.9rem;
  }
  .db-tool-card:nth-child(even) { border-right: none; }
  .db-tool-card:nth-last-child(-n+2) { border-bottom: none; }
  .db-tool-card:hover { background: var(--bg2); }
  .db-tool-icon {
    width: 36px; height: 36px; border-radius: 8px;
    background: var(--bg3); border: 1px solid var(--border2);
    display: flex; align-items: center; justify-content: center;
    color: var(--text3); flex-shrink: 0;
  }
  .db-tool-card:hover .db-tool-icon { color: var(--text2); border-color: var(--border3); }
  .db-tool-label {
    font-family: var(--font-body); font-size: 0.9rem;
    font-weight: 700; color: var(--text); margin-bottom: 0.2rem; letter-spacing: -0.01em;
  }
  .db-tool-desc {
    font-family: var(--font-ui); font-size: 0.76rem;
    color: var(--text3); line-height: 1.6;
  }
  .db-tool-badge {
    position: absolute; top: 1.25rem; right: 1.25rem;
    font-family: var(--font-ui); font-size: 0.58rem; font-weight: 700;
    letter-spacing: 0.08em; text-transform: uppercase;
    padding: 2px 8px; border-radius: 4px;
  }
  .db-tool-badge.free { background: rgba(74,222,128,0.1); color: #4ade80; border: 1px solid rgba(74,222,128,0.22); }
  .db-tool-badge.premium { background: rgba(232,184,109,0.1); color: #e8b86d; border: 1px solid rgba(232,184,109,0.22); }
  .db-tool-arrow {
    margin-top: auto; font-family: var(--font-ui); font-size: 0.72rem;
    color: var(--text3); transition: color 0.15s, gap 0.15s;
    display: flex; align-items: center; gap: 4px;
  }
  .db-tool-card:hover .db-tool-arrow { color: var(--text2); gap: 7px; }

  /* ── Sidebar (right col) ── */
  .db-sidebar { animation: fadeUp 0.4s ease; }

  .db-sidebar-section {
    padding: 1.75rem 1.75rem;
    border-bottom: 1px solid var(--border);
  }
  .db-sidebar-label {
    font-family: var(--font-ui); font-size: 0.6rem;
    letter-spacing: 0.16em; text-transform: uppercase; color: var(--text3);
    margin-bottom: 1.25rem; display: flex; align-items: center; gap: 8px;
  }
  /* Stat rows */
  .db-stat-list { display: flex; flex-direction: column; gap: 0; }
  .db-stat-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 0.65rem 0;
    border-bottom: 1px solid var(--border);
  }
  .db-stat-row:last-child { border-bottom: none; }
  .db-stat-key { font-family: var(--font-ui); font-size: 0.78rem; color: var(--text3); }
  .db-stat-val { font-family: var(--font-body); font-size: 0.88rem; font-weight: 700; color: var(--text); letter-spacing: -0.01em; }

  /* Plan badge */
  .db-plan-free {
    display: flex; align-items: center; justify-content: space-between;
    gap: 1rem; flex-wrap: wrap;
  }
  .db-plan-name { font-family: var(--font-body); font-size: 1rem; font-weight: 700; letter-spacing: -0.02em; color: var(--text); }
  .db-plan-desc { font-family: var(--font-ui); font-size: 0.75rem; color: var(--text3); margin-top: 2px; }
  .db-upgrade-btn {
    font-family: var(--font-ui); font-size: 0.8rem; font-weight: 600;
    background: var(--text); color: var(--bg);
    padding: 8px 18px; border-radius: 6px;
    text-decoration: none; transition: opacity 0.15s; flex-shrink: 0;
  }
  .db-upgrade-btn:hover { opacity: 0.82; }
  .db-pro-badge {
    display: flex; align-items: center; gap: 10px;
  }
  .db-pro-name { font-family: var(--font-body); font-size: 1rem; font-weight: 700; letter-spacing: -0.02em; color: #e8b86d; }
  .db-pro-exp { font-family: var(--font-ui); font-size: 0.75rem; color: var(--text3); margin-top: 2px; }
  .db-active-pill {
    font-family: var(--font-ui); font-size: 0.58rem; font-weight: 700;
    letter-spacing: 0.08em; text-transform: uppercase;
    background: rgba(74,222,128,0.1); color: #4ade80;
    border: 1px solid rgba(74,222,128,0.22);
    padding: 3px 9px; border-radius: 4px;
  }

  /* Usage bar */
  .db-usage-label {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 10px;
  }
  .db-usage-text { font-family: var(--font-ui); font-size: 0.78rem; color: var(--text2); }
  .db-usage-link {
    font-family: var(--font-ui); font-size: 0.72rem; font-weight: 600;
    color: var(--text); text-decoration: none; 
    display: flex; align-items: center; gap: 4px;
  }
  .db-usage-link:hover { opacity: 0.75; }
  .db-bar-track { height: 4px; border-radius: 99px; background: var(--border); overflow: hidden; }
  .db-bar-fill { height: 100%; border-radius: 99px; transition: width 0.6s ease; }

  /* Quick actions */
  .db-actions { display: flex; flex-direction: column; gap: 6px; }
  .db-action-link {
    font-family: var(--font-ui); font-size: 0.82rem; color: var(--text2);
    text-decoration: none; padding: 8px 0;
    display: flex; align-items: center; justify-content: space-between;
    border-bottom: 1px solid var(--border);
    transition: color 0.15s;
  }
  .db-action-link:last-child { border-bottom: none; }
  .db-action-link:hover { color: var(--text); }
  .db-action-arrow { color: var(--text3); font-size: 0.78rem; }

  /* ── Footer CTA ── */
  .db-footer-cta {
    max-width: 1200px; margin: 0 auto;
    padding: 3.5rem 2rem 5rem;
    display: flex; align-items: center; justify-content: space-between; gap: 2rem;
    flex-wrap: wrap;
    animation: fadeUp 0.5s ease;
  }
  .db-footer-h2 {
    font-family: var(--font-body); font-size: clamp(1.4rem, 2.5vw, 2rem);
    font-weight: 700; letter-spacing: -0.03em; color: var(--text); line-height: 1.1;
  }
  .db-footer-h2 em { font-style: italic; }
  .db-footer-sub { font-family: var(--font-ui); font-size: 0.82rem; color: var(--text3); margin-top: 0.4rem; }

  @media (max-width: 900px) {
    .db-body { grid-template-columns: 1fr; }
    .db-tools { border-right: none; }
    .db-sidebar-section { padding: 1.5rem; }
  }
  @media (max-width: 640px) {
    .db-header { padding:88px 1.25rem 2rem; padding-bottom:2rem; }
    .db-h1 { font-size:clamp(1.9rem,9vw,2.6rem); }
    .db-kicker { font-size:0.6rem; }
    .db-sub { font-size:0.8rem; }

    .db-tools-label { padding:1.25rem 1.25rem 0.85rem; }

    .db-tool-grid { grid-template-columns: 1fr; }
    .db-tool-card { border-right: none !important; padding:1.25rem; }
    .db-tool-card:nth-last-child(-n+2) { border-bottom: 1px solid var(--border); }
    .db-tool-card:last-child { border-bottom: none; }
    .db-tool-label { font-size:0.88rem; }
    .db-tool-desc { font-size:0.74rem; }
    .db-tool-badge { top:1rem; right:1rem; }

    .db-sidebar-section { padding:1.25rem; }

    .db-footer-cta { padding:2.5rem 1.25rem 4rem; }
    .db-footer-h2 { font-size:clamp(1.5rem,7vw,2rem); }
    .db-footer-sub { font-size:0.82rem; }
    .db-footer-actions { flex-direction:column; gap:0.65rem; }
    .db-footer-btn { text-align:center; }
  }
`;

function ToolIcon({ icon }: { icon: string }) {
  switch (icon) {
    case 'evaluate': return (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="2" y="2" width="14" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M5.5 9l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
    case 'chat': return (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M15 3H3a1 1 0 00-1 1v8a1 1 0 001 1h2.5l2.5 3 2.5-3H15a1 1 0 001-1V4a1 1 0 00-1-1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
        <path d="M6 7.5h6M6 10.5h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    )
    case 'notes': return (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="3" y="2" width="12" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M6 6h6M6 9h6M6 12h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    )
    case 'pyq': return (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M9 5.5v.01M9 8c0-1 1.5-1.5 1.5-3a1.5 1.5 0 10-3 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        <circle cx="9" cy="12.5" r="0.75" fill="currentColor"/>
      </svg>
    )
    case 'topper': return (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M9 2l1.8 3.6L15 6.3l-3 2.9.7 4.1L9 11.4l-3.7 1.9.7-4.1-3-2.9 4.2-.7L9 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
      </svg>
    )
    case 'prelims': return (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="2" y="3" width="14" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
        <circle cx="5.5" cy="7" r="1" fill="currentColor"/>
        <circle cx="5.5" cy="11" r="1" fill="currentColor"/>
        <path d="M8 7h5M8 11h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    )
    default: return (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.3"/>
      </svg>
    )
  }
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
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--text)', animation: 'spin 0.7s linear infinite' }} />
    </div>
  );

  if (!stats) return null;

  const firstName = user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
  const optLabel = SUBJECT_LABEL[stats.optional ?? ''] ?? stats.optional ?? '';
  const joinDate = stats.joinedAt
    ? new Date(stats.joinedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';
  const expDate = stats.expiresAt
    ? new Date(stats.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  const usedPct = stats.isPremium ? 100 : Math.min((stats.chatCount / 3) * 100, 100);
  const barColor = stats.isPremium ? '#4ade80' : usedPct >= 100 ? '#f87171' : usedPct >= 66 ? '#f59e0b' : 'var(--text)';

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="db-page">

        {/* ── Header ── */}
        <div className="db-header">
          <div className="db-kicker">{optLabel} Optional · Dashboard</div>
          <h1 className="db-h1">
            {greeting},<br />
            <em>{firstName}.</em>
          </h1>
          <p className="db-sub">Member since {joinDate} · {user?.email}</p>
        </div>

        {/* ── Body: tools left, sidebar right ── */}
        <div className="db-body">

          {/* Tools */}
          <div className="db-tools">
            <div className="db-tools-label">Your Tools</div>
            <div className="db-tool-grid">
              {TOOLS.map((tool) => (
                <Link key={tool.label} href={tool.href} className="db-tool-card">
                  {tool.badge && (
                    <span className={`db-tool-badge ${tool.badge === 'Free' ? 'free' : 'premium'}`}>
                      {tool.badge}
                    </span>
                  )}
                  <div className="db-tool-icon">
                    <ToolIcon icon={tool.icon} />
                  </div>
                  <div>
                    <div className="db-tool-label">{tool.label}</div>
                    <div className="db-tool-desc">{tool.desc}</div>
                  </div>
                  <div className="db-tool-arrow">Open →</div>
                </Link>
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <div className="db-sidebar">

            {/* Plan */}
            <div className="db-sidebar-section">
              <div className="db-sidebar-label">Plan</div>
              {stats.isPremium ? (
                <div className="db-pro-badge">
                  <div>
                    <div className="db-pro-name">Distilled Crux Pro{stats.plan ? ` · ${stats.plan}` : ''}</div>
                    {expDate && <div className="db-pro-exp">Active until {expDate}</div>}
                  </div>
                  <span className="db-active-pill">Active</span>
                </div>
              ) : (
                <div className="db-plan-free">
                  <div>
                    <div className="db-plan-name">Free Plan</div>
                    <div className="db-plan-desc">3 AI chats · Limited access</div>
                  </div>
                  <Link href="/pricing" className="db-upgrade-btn">Upgrade →</Link>
                </div>
              )}
            </div>

            {/* Usage */}
            {!stats.isPremium && (
              <div className="db-sidebar-section">
                <div className="db-sidebar-label">AI Chat Usage</div>
                <div className="db-usage-label">
                  <span className="db-usage-text">{stats.chatCount} of 3 used</span>
                  <Link href="/pricing" className="db-usage-link">Get unlimited →</Link>
                </div>
                <div className="db-bar-track">
                  <div className="db-bar-fill" style={{ width: `${usedPct}%`, background: barColor }} />
                </div>
              </div>
            )}

            {/* Stats */}
            <div className="db-sidebar-section">
              <div className="db-sidebar-label">Account</div>
              <div className="db-stat-list">
                <div className="db-stat-row">
                  <span className="db-stat-key">Optional</span>
                  <span className="db-stat-val">{optLabel}</span>
                </div>
                <div className="db-stat-row">
                  <span className="db-stat-key">Days active</span>
                  <span className="db-stat-val">{stats.daysSinceJoin}</span>
                </div>
                <div className="db-stat-row">
                  <span className="db-stat-key">AI chats</span>
                  <span className="db-stat-val">{stats.isPremium ? '∞' : stats.chatCount}</span>
                </div>
                <div className="db-stat-row">
                  <span className="db-stat-key">Status</span>
                  <span className="db-stat-val" style={{ color: stats.isPremium ? '#4ade80' : 'var(--text3)' }}>
                    {stats.isPremium ? 'Pro' : 'Free'}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick actions */}
            <div className="db-sidebar-section">
              <div className="db-sidebar-label">Quick Actions</div>
              <div className="db-actions">
                {[
                  { label: 'Ask AI', href: '/chat' },
                  { label: 'Evaluate an answer', href: '/evaluate' },
                  { label: 'Browse PYQs', href: '/sociology/pyqs' },
                  { label: 'Read notes', href: '/notes' },
                  { label: 'Change optional', href: '/onboarding?change=1' },
                ].map((a) => (
                  <Link key={a.href} href={a.href} className="db-action-link">
                    {a.label}
                    <span className="db-action-arrow">→</span>
                  </Link>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* ── Footer CTA ── */}
        {!stats.isPremium && (
          <div className="db-footer-cta">
            <div>
              <h2 className="db-footer-h2">Ready to go<br /><em>unlimited?</em></h2>
              <p className="db-footer-sub">Unlock all tools, unlimited AI chats, topper copies and more.</p>
            </div>
            <Link href="/pricing" className="db-upgrade-btn" style={{ fontSize: '0.88rem', padding: '11px 24px' }}>
              See Plans →
            </Link>
          </div>
        )}

      </div>
    </>
  );
}
