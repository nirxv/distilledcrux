'use client';
import { useEffect, useState, Suspense, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import Mascot from '@/components/Mascot';
import OwlLoader from '@/components/OwlLoader';
import SubjectIcon from '@/components/SubjectIcon';
import { labelForOptional, routeSlugForOptional } from '@/lib/optionals';
import { readLastNote, type LastNote } from '@/lib/lastNote';

/** Kept in step with CHAT_FREE_LIMIT in app/api/chat/route.ts. */
const CHAT_FREE_LIMIT = 3;
/** Where the chat keeps its conversations on this device. */
const CHAT_HISTORY_KEY = 'pp_chat_history_v1';

interface TodayQuestion { id: number; question: string; year: string; paper: string; marks: number | null; topic: string }

interface Stats {
  optional: string | null;
  chatCount: number;
  evalCount: number;
  isPremium: boolean;
  plan: string | null;
  expiresAt: string | null;
  joinedAt: string | null;
  daysSinceJoin: number;
  lastActive: string | null;
  pyqCount: number | null;
  notesCount: number;
  todayQuestion: TodayQuestion | null;
}

type LastChat = { id: string; title: string; updatedAt: number };

/** The newest conversation held in this optional, from the chat's own store. */
function readLastChat(slug: string): LastChat | null {
  try {
    const list = JSON.parse(localStorage.getItem(CHAT_HISTORY_KEY) ?? '[]') as { id: string; title: string; updatedAt: number; subject?: string }[];
    if (!Array.isArray(list)) return null;
    const c = list.find((x) => x && x.id && (!x.subject || x.subject === slug));
    return c ? { id: c.id, title: c.title || 'Your last chat', updatedAt: c.updatedAt } : null;
  } catch {
    return null;
  }
}

function ago(ms: number) {
  const days = Math.floor((Date.now() - ms) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null;

const Arrow = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);

const ICON: Record<string, ReactNode> = {
  notes: <path d="M7 3h8l4 4v14H7zM15 3v4h4M10 12h6M10 16h6" />,
  pyq: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6M12 17h.01" /></>,
  chat: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  evaluate: <><path d="M9 11l3 3 8-8" /><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9" /></>,
  test: <><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5M9 2h6" /></>,
  map: <><path d="M9 4L3 6.5v13L9 17l6 3 6-2.5v-13L15 7z" /><path d="M9 4v13M15 7v13" /></>,
};
const Glyph = ({ name }: { name: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICON[name]}</svg>
);

function PaymentSuccess({ onShow }: { onShow: () => void }) {
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get('payment') === 'success') {
      onShow();
      window.history.replaceState({}, '', '/dashboard');
    }
  }, [searchParams, onShow]);
  return null;
}

export default function Dashboard() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [celebrate, setCelebrate] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [lastNote, setLastNote] = useState<LastNote | null>(null);
  const [lastChat, setLastChat] = useState<LastChat | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login?next=/dashboard'); return; }
    (async () => {
      // A failure used to be swallowed and left stats null, and the render
      // below returned null for null stats, so a logged-in user whose stats
      // call failed got a blank white page with nothing to act on.
      setFailed(false);
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/dashboard-stats', { headers: { 'x-user-token': token } });
        if (!res.ok) {
          setFailed(true);
        } else {
          const data = await res.json();
          // Same completeness test as the login gate: an existing reader with
          // no number is sent to onboarding rather than shown the dashboard.
          if (!data.optional || !data.phone) { router.push('/onboarding'); return; }
          setStats(data);
          // What this device remembers: read once the optional is known, since
          // a note or chat from another optional is not where to pick up.
          const slug = routeSlugForOptional(data.optional);
          if (slug) {
            const note = readLastNote();
            setLastNote(note && note.subject === slug ? note : null);
            setLastChat(readLastChat(slug));
          }
        }
      } catch {
        setFailed(true);
      }
      setLoading(false);
    })();
  }, [user, authLoading, router, reloadKey]);

  if (loading) return <OwlLoader size="page" label="Loading your dashboard" />;

  if (!stats) return (
    <div className="ds" style={{ minHeight: '70vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-3)', padding: '2rem', textAlign: 'center' }}>
      <Mascot pose="peek" width={110} />
      <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>
        {failed ? 'Your dashboard didn’t load' : 'Nothing to show yet'}
      </div>
      <p style={{ margin: 0, maxWidth: '28rem', color: 'var(--text2)', lineHeight: 1.6 }}>
        {failed ? 'It’s usually the connection. Try again in a moment.' : 'Your study will show up here once you start.'}
      </p>
      {failed && (
        <button type="button" className="ds-btn ds-btn-solid" onClick={() => { setLoading(true); setReloadKey(k => k + 1); }}>
          Try again
        </button>
      )}
    </div>
  );

  const slug = routeSlugForOptional(stats.optional) ?? 'sociology';
  const optLabel = labelForOptional(stats.optional) ?? 'your optional';
  const firstName = user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const chatsLeft = Math.max(0, CHAT_FREE_LIMIT - stats.chatCount);
  const tq = stats.todayQuestion;
  const tint = { ['--t' as string]: `var(--tint-${slug})`, ['--w' as string]: `var(--wash-${slug})` };

  const tools = [
    { key: 'notes', title: 'Notes', count: stats.notesCount ? `${stats.notesCount} topics` : null, desc: 'Every topic in the syllabus, cut to what an answer uses.', href: `/notes/${slug}` },
    { key: 'pyq', title: 'Past questions', count: stats.pyqCount ? `${stats.pyqCount.toLocaleString('en-IN')} questions` : null, desc: 'By year, paper and topic, each one ready to answer.', href: `/${slug}/pyqs` },
    { key: 'chat', title: 'AI chat', count: null, desc: 'Ask anything. It answers from the standard books and shows you where.', href: `/chat?subject=${slug}` },
    { key: 'evaluate', title: 'Evaluate', count: null, desc: 'Upload a handwritten answer and get it marked, part by part.', href: '/evaluate' },
    { key: 'test', title: 'Tests', count: null, desc: 'Timed papers built from past questions, marked like the real thing.', href: `/test?optional=${stats.optional}` },
    ...(slug === 'geography' ? [{ key: 'map', title: 'Map practice', count: null, desc: 'Locate the places UPSC asks about, category by category.', href: '/geography/mapping' }] : []),
  ];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <Suspense fallback={null}>
        <PaymentSuccess onShow={() => setCelebrate(true)} />
      </Suspense>

      <div className="db ds" style={tint}>
        <header className="db-hero">
          <div className="ds-container">
            {celebrate && (
              <div className="db-celebrate" role="status">
                <Mascot pose="celebrate" width={96} />
                <div className="db-celebrate-text">
                  <strong>You’re on Premium</strong>
                  <span>Everything for {optLabel} is open now: unlimited chats and evaluations, model answers, and the chat’s book and mentor modes.</span>
                </div>
                <button type="button" className="db-celebrate-x" onClick={() => setCelebrate(false)} aria-label="Dismiss">✕</button>
              </div>
            )}
            <h1 className="ds-h1 db-h1">{greeting}, {firstName}</h1>
            <div className="db-chips">
              <span className="db-chip"><SubjectIcon id={slug} size={16} />{optLabel} optional</span>
              <span className={`db-chip${stats.isPremium ? ' gold' : ''}`}>{stats.isPremium ? 'Premium' : 'Free plan'}</span>
            </div>
          </div>
        </header>

        <div className="ds-container db-grid">
          <main className="db-main">
            {/* What to do, from what is actually here. Nothing pads it out. */}
            {(tq || lastNote || lastChat) && (
              <section className="db-section">
                <h2 className="db-h2">For today</h2>

                {tq && (
                  <article className="db-today">
                    <div className="db-today-head">
                      <span className="db-today-label">A question to try</span>
                      <span className="db-today-meta">{tq.year} · {tq.paper}{tq.marks ? ` · ${tq.marks} marks` : ''}</span>
                    </div>
                    <Link href={`/${slug}/pyqs/${tq.id}`} className="db-today-q">{tq.question}</Link>
                    <div className="db-today-actions">
                      <Link href={`/evaluate?question=${encodeURIComponent(tq.question)}${tq.marks ? `&marks=${tq.marks}` : ''}`} className="ds-btn ds-btn-solid ds-btn-sm">
                        Write an answer
                      </Link>
                      <Link href={`/chat?subject=${slug}&q=${encodeURIComponent(tq.question)}`} className="ds-btn ds-btn-line ds-btn-sm">
                        Ask the AI how to approach it
                      </Link>
                    </div>
                  </article>
                )}

                {(lastNote || lastChat) && (
                  <div className="db-resume">
                    {lastNote && (
                      <Link href={`/notes/${lastNote.subject}/${lastNote.slug}`} className="db-resume-item">
                        <span className="db-resume-icon"><Glyph name="notes" /></span>
                        <span className="db-resume-text">
                          <strong>Pick up {lastNote.title}</strong>
                          <span>{lastNote.section} · opened {ago(lastNote.at)}</span>
                        </span>
                        <Arrow />
                      </Link>
                    )}
                    {lastChat && (
                      <Link href={`/chat?c=${encodeURIComponent(lastChat.id)}`} className="db-resume-item">
                        <span className="db-resume-icon"><Glyph name="chat" /></span>
                        <span className="db-resume-text">
                          <strong>Carry on with “{lastChat.title}”</strong>
                          <span>Your last chat · {ago(lastChat.updatedAt)}</span>
                        </span>
                        <Arrow />
                      </Link>
                    )}
                  </div>
                )}
              </section>
            )}

            <section className="db-section">
              <h2 className="db-h2">Everything for {optLabel}</h2>
              <div className={`db-tools${tools.length === 5 ? ' five' : ''}`}>
                {tools.map((t) => (
                  <Link key={t.key} href={t.href} className="db-tool">
                    <span className="db-tool-top">
                      <span className="db-tool-icon"><Glyph name={t.key} /></span>
                      {t.count && <span className="db-tool-count">{t.count}</span>}
                    </span>
                    <span className="db-tool-title">{t.title}</span>
                    <span className="db-tool-desc">{t.desc}</span>
                  </Link>
                ))}
              </div>
            </section>
          </main>

          <aside className="db-aside">
            <div className="db-card">
              {stats.isPremium ? (
                <>
                  <div className="db-plan-row">
                    <h2 className="db-card-title">Premium</h2>
                    <span className="db-active">Active</span>
                  </div>
                  <p className="db-card-text">
                    {stats.plan ? `${stats.plan.charAt(0).toUpperCase()}${stats.plan.slice(1)} plan for ${optLabel}` : `For ${optLabel}`}
                    {fmtDate(stats.expiresAt) ? `, until ${fmtDate(stats.expiresAt)}.` : '.'}
                  </p>
                </>
              ) : (
                <>
                  <h2 className="db-card-title">Free plan</h2>
                  <div className="db-usage">
                    <div className="db-usage-row">
                      <span>AI chats</span>
                      <span>{stats.chatCount >= CHAT_FREE_LIMIT ? 'All used' : `${chatsLeft} of ${CHAT_FREE_LIMIT} left`}</span>
                    </div>
                    <div className="db-bar"><span style={{ width: `${Math.min(100, (stats.chatCount / CHAT_FREE_LIMIT) * 100)}%` }} className={stats.chatCount >= CHAT_FREE_LIMIT ? 'full' : ''} /></div>
                    <div className="db-usage-row">
                      <span>Evaluation</span>
                      <span>{stats.evalCount >= 1 ? 'Used' : '1 free, not used yet'}</span>
                    </div>
                  </div>
                  <p className="db-card-text">Premium gives you unlimited chats and evaluations for {optLabel}, with model answers and the chat’s book and mentor modes.</p>
                  <Link href="/pricing" className="ds-btn ds-btn-solid db-card-btn">See plans</Link>
                </>
              )}
            </div>

            <div className="db-card">
              <h2 className="db-card-title">Your account</h2>
              <div className="db-facts">
                <div><span>Optional</span><span>{optLabel}</span></div>
                {stats.joinedAt && <div><span>Joined</span><span>{fmtDate(stats.joinedAt)}</span></div>}
                <div><span>Email</span><span className="db-email">{user?.email}</span></div>
              </div>
              <Link href="/onboarding?change=1" className="db-change">Change optional <Arrow /></Link>
              {stats.isPremium && (
                <p className="db-card-note">Your plan stays with {optLabel}. A different optional would be on the free plan.</p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}

const CSS = `
.db { background: var(--bg); min-height: var(--page-min-h); padding-bottom: clamp(48px, 9vh, 96px); }
.db-hero { padding: clamp(28px, 5vh, 52px) 0 clamp(20px, 3vh, 28px); background: linear-gradient(180deg, color-mix(in srgb, var(--w) 70%, var(--bg)) 0%, var(--bg) 100%); }
.db-h1 { font-size: clamp(2rem, 4.4vw, 3rem); margin: 0 0 var(--space-3); }
.db-chips { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.db-chip { display: inline-flex; align-items: center; gap: 8px; padding: 5px 14px 5px 12px; border-radius: var(--radius-full); background: var(--ds-card); border: 1px solid var(--border); font-size: 0.88rem; font-weight: 600; color: var(--text2); }
.db-chip svg { color: var(--t); }
.db-chip.gold { color: var(--premium-text); background: var(--premium-wash); border-color: color-mix(in srgb, var(--premium-text) 30%, transparent); }

.db-celebrate { display: flex; align-items: center; gap: var(--space-4); margin-bottom: var(--space-5); padding: var(--space-4) var(--space-5); border-radius: var(--radius-xl); background: var(--ds-card); border: 1px solid color-mix(in srgb, var(--premium-text) 35%, transparent); box-shadow: var(--elev-2); animation: dbIn 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
.db-celebrate-text { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0; }
.db-celebrate-text strong { font-size: 1.15rem; font-weight: 800; }
.db-celebrate-text span { color: var(--text2); line-height: 1.55; }
.db-celebrate-x { align-self: flex-start; width: 30px; height: 30px; flex-shrink: 0; border: none; border-radius: 50%; background: var(--ds-soft); color: var(--text3); cursor: pointer; }
@keyframes dbIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }

.db-grid { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: var(--space-6); align-items: start; }
.db-main { display: flex; flex-direction: column; gap: var(--space-8); min-width: 0; }
.db-h2 { margin: 0 0 var(--space-4); font-size: 1.3rem; font-weight: 800; letter-spacing: -0.02em; }

.db-today { padding: var(--space-6); background: var(--ds-card); border: 1px solid var(--border); border-radius: var(--radius-xl); box-shadow: var(--elev-1); }
.db-today-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 4px var(--space-3); margin-bottom: var(--space-3); }
.db-today-label { font-size: 0.92rem; font-weight: 700; color: var(--t); }
.db-today-meta { font-size: 0.86rem; color: var(--text3); }
.db-today-q { display: block; margin-bottom: var(--space-5); font-size: clamp(1.1rem, 2vw, 1.28rem); font-weight: 600; line-height: 1.5; color: var(--text); text-decoration: none; }
.db-today-q:hover { color: var(--accent-text); }
.db-today-actions { display: flex; flex-wrap: wrap; gap: var(--space-2); }

.db-resume { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: var(--space-3); margin-top: var(--space-3); }
.db-resume-item { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-4); background: var(--ds-card); border: 1px solid var(--border); border-radius: var(--radius-xl); color: var(--text3); text-decoration: none; transition: border-color 0.15s, box-shadow 0.15s; min-width: 0; }
.db-resume-item:hover { border-color: color-mix(in srgb, var(--t) 45%, transparent); box-shadow: var(--elev-1); color: var(--t); }
.db-resume-icon { width: 40px; height: 40px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 12px; background: var(--w); color: var(--t); }
.db-resume-text { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.db-resume-text strong { color: var(--text); font-size: 0.98rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.db-resume-text span { font-size: 0.84rem; color: var(--text3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.db-tools { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: var(--space-3); }
.db-tools > * { grid-column: span 2; }
/* Five tools: notes and past questions take the wider top row. */
.db-tools.five > :nth-child(-n+2) { grid-column: span 3; }
.db-tool { display: flex; flex-direction: column; gap: var(--space-2); padding: var(--space-5); background: var(--ds-card); border: 1px solid var(--border); border-radius: var(--radius-xl); text-decoration: none; transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s; }
.db-tool:hover { border-color: color-mix(in srgb, var(--t) 45%, transparent); box-shadow: var(--elev-2); transform: translateY(-1px); }
.db-tool-top { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); margin-bottom: var(--space-1); }
.db-tool-icon { width: 42px; height: 42px; display: inline-flex; align-items: center; justify-content: center; border-radius: 12px; background: var(--w); color: var(--t); }
.db-tool-count { padding: 2px 10px; border-radius: var(--radius-full); background: var(--ds-soft); font-size: 0.8rem; font-weight: 600; color: var(--text2); }
.db-tool-title { font-size: 1.05rem; font-weight: 700; color: var(--text); }
.db-tool-desc { font-size: 0.9rem; line-height: 1.55; color: var(--text2); }

.db-aside { display: flex; flex-direction: column; gap: var(--space-4); position: sticky; top: 84px; }
.db-card { padding: var(--space-5); background: var(--ds-card); border: 1px solid var(--border); border-radius: var(--radius-xl); }
.db-card-title { margin: 0 0 var(--space-3); font-size: 1.05rem; font-weight: 800; }
.db-plan-row { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); }
.db-plan-row .db-card-title { margin: 0; color: var(--premium-text); }
.db-active { padding: 2px 10px; border-radius: var(--radius-full); background: var(--success-wash); color: var(--success-text); font-size: 0.8rem; font-weight: 700; }
.db-card-text { margin: var(--space-3) 0 0; font-size: 0.92rem; line-height: 1.6; color: var(--text2); }
.db-card-btn { width: 100%; justify-content: center; margin-top: var(--space-4); }
.db-usage { display: flex; flex-direction: column; gap: var(--space-2); }
.db-usage-row { display: flex; justify-content: space-between; gap: var(--space-3); font-size: 0.92rem; }
.db-usage-row span:first-child { color: var(--text2); }
.db-usage-row span:last-child { font-weight: 600; }
.db-bar { height: 6px; margin-bottom: var(--space-2); border-radius: var(--radius-full); background: var(--ds-soft); overflow: hidden; }
.db-bar span { display: block; height: 100%; border-radius: inherit; background: var(--accent); transition: width 0.6s ease; }
.db-bar span.full { background: var(--danger-text); }
.db-facts { display: flex; flex-direction: column; }
.db-facts div { display: flex; justify-content: space-between; gap: var(--space-3); padding: var(--space-2) 0; border-top: 1px solid var(--border); font-size: 0.92rem; }
.db-facts div:first-child { border-top: none; padding-top: 0; }
.db-facts span:first-child { color: var(--text2); flex-shrink: 0; }
.db-facts span:last-child { font-weight: 600; text-align: right; min-width: 0; }
.db-email { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.db-change { display: inline-flex; align-items: center; gap: 6px; margin-top: var(--space-3); font-size: 0.92rem; font-weight: 600; color: var(--accent-text); text-decoration: none; }
.db-change:hover { text-decoration: underline; text-underline-offset: 3px; }
.db-card-note { margin: var(--space-2) 0 0; font-size: 0.84rem; line-height: 1.5; color: var(--text3); }

@media (max-width: 1100px) {
  .db-tools { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .db-tools > *, .db-tools.five > :nth-child(-n+2) { grid-column: span 1; }
  .db-tools.five > :last-child { grid-column: span 2; }
}
@media (max-width: 960px) {
  .db-grid { grid-template-columns: minmax(0, 1fr); }
  .db-aside { position: static; }
}
@media (max-width: 640px) {
  .db-today { padding: var(--space-5) var(--space-4); }
  .db-today-actions .ds-btn { width: 100%; justify-content: center; }
  .db-resume { grid-template-columns: minmax(0, 1fr); }
  .db-tool { padding: var(--space-4); gap: 4px; }
  .db-tool-top { flex-direction: column; align-items: flex-start; gap: var(--space-2); }
  .db-tool-desc { display: none; }
  .db-tool-icon { width: 38px; height: 38px; }
  .db-celebrate { flex-direction: column; align-items: flex-start; }
  .db-celebrate-x { position: absolute; right: var(--space-4); }
  .db-celebrate { position: relative; }
}
@media (prefers-reduced-motion: reduce) { .db-tool, .db-celebrate { transition: none; animation: none; } .db-tool:hover { transform: none; } }
`;
