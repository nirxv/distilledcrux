'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { toast } from '@/components/ui/Toast';
import { inviteLink, REFERRED_DAYS, REFERRER_DAYS } from '@/lib/referral';

type Stats = { code: string; joined: number; daysEarned: number };

/**
 * The reader's invite link and what it has earned. Signed out, it goes to the
 * login page and back, as the dashboard does. The link is made on the first
 * visit here, by /api/referral.
 */
export default function InvitePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [stats, setStats] = useState<Stats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => onAuthStateChanged(auth, (u) => {
    setUser(u);
    if (!u) router.push('/login?next=/invite');
  }), [router]);

  useEffect(() => {
    if (!user) return;
    let live = true;
    user.getIdToken()
      .then((token) => fetch('/api/referral', { headers: { 'x-user-token': token } }))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: Stats) => { if (live) setStats(d); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [user]);

  const link = stats ? inviteLink(stats.code) : '';
  const text = `For UPSC optionals, try Distilled Crux: notes, PYQs and answer checking. Buy your first 6-month or yearly plan through my link and get ${REFERRED_DAYS} extra days:`;

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); toast('Link copied'); }
    catch { toast(link); }
  };
  const share = async () => {
    try { await navigator.share({ title: 'Distilled Crux', text, url: link }); }
    catch (e) { if ((e as Error).name !== 'AbortError') await copy(); }
  };

  return (
    <div className="iv ds">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="ds-container iv-wrap">
        <h1 className="ds-h1 iv-h1">Invite a friend</h1>
        <p className="ds-lede iv-lede">
          When a friend buys their first 6-month or yearly plan through your link, they get {REFERRED_DAYS} extra days and you get {REFERRER_DAYS}.
        </p>

        <section className="iv-card ds-card" aria-live="polite">
          {!user ? null : failed ? (
            <p className="iv-muted">Your link could not be loaded. Refresh the page to try again.</p>
          ) : !stats ? (
            <p className="iv-muted">Making your link…</p>
          ) : (
            <>
              <label className="iv-label" htmlFor="iv-link">Your invite link</label>
              <div className="iv-linkrow">
                <input id="iv-link" className="iv-link" value={link} readOnly onFocus={(e) => e.currentTarget.select()} />
                <button type="button" className="ds-btn ds-btn-solid" onClick={copy}>Copy</button>
              </div>
              <div className="iv-share">
                <a className="ds-btn ds-btn-line" href={`https://wa.me/?text=${encodeURIComponent(`${text} ${link}`)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
                <a className="ds-btn ds-btn-line" href={`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">Telegram</a>
                {'share' in navigator && <button type="button" className="ds-btn ds-btn-line" onClick={share}>More</button>}
              </div>
              <p className="iv-stats">
                {stats.joined === 0
                  ? 'No friends have joined through your link yet.'
                  : `${stats.joined} ${stats.joined === 1 ? 'friend has' : 'friends have'} joined. You have earned ${stats.daysEarned} days.`}
              </p>
            </>
          )}
        </section>

        <section className="iv-how">
          <h2>How it works</h2>
          <ol>
            <li>Send your link to friends preparing for their optional.</li>
            <li>A friend buys the 6-month or yearly plan through it. Only their first purchase counts.</li>
            <li>They get {REFERRED_DAYS} extra days and you get {REFERRER_DAYS}, added as soon as they pay. If you are not on a plan, your days start then, on the optional in your profile.</li>
          </ol>
          <p className="iv-muted">The day plan does not count, and nor does a purchase on your own account.</p>
        </section>
      </div>
    </div>
  );
}

const CSS = `
.iv-wrap { max-width: 720px; padding-top: var(--space-10); padding-bottom: var(--space-12); }
.iv-h1 { margin: 0; }
.iv-lede { margin: var(--space-4) 0 0; }
.iv-card { margin-top: var(--space-8); padding: var(--space-6); display: flex; flex-direction: column; gap: var(--space-4); align-items: flex-start; }
.iv-label { font-family: var(--font-ui); font-size: 0.84rem; font-weight: 600; color: var(--text2); }
.iv-linkrow { display: flex; gap: var(--space-2); width: 100%; margin-top: calc(-1 * var(--space-2)); }
.iv-link { flex: 1; min-width: 0; padding: 0 var(--space-3); min-height: 46px; border: 1px solid var(--border2, var(--border)); border-radius: var(--radius-sm); background: var(--bg2); font-family: var(--font-ui); font-size: 0.92rem; color: var(--text); }
.iv-share { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.iv-stats, .iv-muted { margin: 0; font-family: var(--font-ui); font-size: 0.9rem; line-height: 1.55; color: var(--text3); }
.iv-stats { color: var(--text2); }
.iv-how { margin-top: var(--space-10); }
.iv-how h2 { margin: 0 0 var(--space-3); font-size: 1.2rem; color: var(--text); }
.iv-how ol { margin: 0 0 var(--space-4); padding-left: 1.2em; display: flex; flex-direction: column; gap: var(--space-2); }
.iv-how li { line-height: 1.6; color: var(--text2); }
@media (max-width: 720px) {
  .iv-wrap { padding-top: var(--space-6); }
  .iv-card { padding: var(--space-5); }
  .iv-share .ds-btn { flex: 1 1 0; justify-content: center; }
}
`;
