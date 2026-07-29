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
  { num: '01', label: 'AI Answer Evaluation', desc: 'Upload handwritten answers — get marks, section-wise feedback and a model answer.', href: '/evaluate', badge: null },
  { num: '02', label: 'AI Chat', desc: 'Ask anything from your syllabus — structured answers with thinkers and exam-ready language.', href: '/chat', badge: null },
  { num: '03', label: 'Syllabus Notes', desc: 'Every topic, every thinker, every debate — structured for Mains.', href: '/notes', badge: 'Free' },
  { num: '04', label: 'PYQ Bank', desc: '1500+ previous year questions, topic-wise, with model answers.', href: '/sociology/pyqs', badge: 'Free' },
  { num: '05', label: 'Topper Copies', desc: 'Real answer sheets from students who scored 140+. See what actually works.', href: '/toppers', badge: 'Premium' },
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
    padding: 100px 2rem 3rem;
    border-bottom: 1px solid var(--border);
    animation: fadeUp 0.3s ease;
  }
  .db-kicker {
    font-family: var(--font-ui); font-size: 0.65rem;
    letter-spacing: 0.18em; text-transform: uppercase; color: var(--text3);
    margin-bottom: 1.25rem; display: flex; align-items: center; gap: 10px;
  }
  .db-kicker::before { content: \'\'; display: inline-block; width: 20px; height: 1px; background: var(--text3); }
  .db-h1 {
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
  .db-tools-label::before { content: \'\'; display: inline-block; width: 16px; height: 1px; background: var(--text3); }
  .db-tool-row {
    display: flex; align-items: flex-start; gap: 1.5rem;
    padding: 1.5rem 2rem;
    border-bottom: 1px solid var(--border);
    text-decoration: none;
    background: var(--bg);
    transition: background 0.15s;
    position: relative;
  }
  .db-tool-row:last-child { border-bottom: none; }
  .db-tool-row:hover { background: var(--bg2); }
  .db-tool-num {
    font-family: var(--font-mono); font-size: 0.62rem;
    color: var(--text3); letter-spacing: 0.06em;
    padding-top: 3px; flex-shrink: 0; width: 20px;
  }
  .db-tool-label {
    font-family: var(--font-body); font-size: 0.92rem;
    font-weight: 700; color: var(--text); margin-bottom: 0.3rem; letter-spacing: -0.01em;
  }
  .db-tool-desc {
    font-family: var(--font-ui); font-size: 0.78rem;
    color: var(--text3); line-height: 1.6;
  }
  .db-tool-badge {
    position: absolute; top: 1.5rem; right: 2rem;
    font-family: var(--font-ui); font-size: 0.58rem; font-weight: 700;
    letter-spacing: 0.08em; text-transform: uppercase;
    padding: 2px 8px; border-radius: 4px;
  }
  .db-tool-badge.free { background: rgba(74,222,128,0.1); color: #4ade80; border: 1px solid rgba(74,222,128,0.22); }
  .db-tool-badge.premium { background: rgba(232,184,109,0.1); color: #e8b86d; border: 1px solid rgba(232,184,109,0.22); }

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
  .db-sidebar-label::before { content: \'\'; display: inline-block; width: 14px; height: 1px; background: var(--text3); }

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
    display: flex; align-items: center; gap: 10px; justify-content: space-between;
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
  .db-actions { display: flex; flex-direction: column; gap: 0; }
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
  @media (max-width: 580px) {
    .db-header { padding-top: 80px; }
    .db-tool-row { padding: 1.25rem; }
    .db-tool-badge { top: 1.25rem; right: 1.25rem; }
    .db-footer-cta { padding: 2.5rem 1.25rem 4rem; }
  }
`;

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
      <style>{\`@keyframes spin{to{transform:rotate(360deg)}}\`}</style>
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

        {/* Header */}
        <div className="db-header">
          <div className="db-kicker">{optLabel} Optional · Dashboard</div>
          <h1 className="db-h1">
            {greeting},<br />
            <em>{firstName}.</em>
          </h1>
          <p className="db-sub">Member since {joinDate} · {user?.email}</p>
        </div>

        {/* Body: tools left, sidebar right */}
        <div className="db-body">

          {/* Tools */}
          <div className="db-tools">
            <div className="db-tools-label">Your Tools</div>
            {TOOLS.map((tool) => (
              <Link key={tool.label} href={tool.href} className="db-tool-row">
                <span className="db-tool-num">{tool.num}</span>
                <div>
                  <div className="db-tool-label">{tool.label}</div>
                  <div className="db-tool-desc">{tool.desc}</div>
                </div>
                {tool.badge && (
                  <span className={`db-tool-badge ${tool.badge === 'Free' ? 'free' : 'premium'}`}>
                    {tool.badge}
                  </span>
                )}
              </Link>
            ))}
          </div>

          {/* Sidebar */}
          <div className="db-sidebar">

            {/* Plan */}
            <div className="db-sidebar-section">
              <div className="db-sidebar-label">Plan</div>
              {stats.isPremium ? (
                <div className="db-pro-badge">
                  <div>
                    <div className="db-pro-name">PrepPandit Pro{stats.plan ? ` · ${stats.plan}` : ''}</div>
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

        {/* Footer CTA */}
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
