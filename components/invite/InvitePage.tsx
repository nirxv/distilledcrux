'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { toast } from '@/components/ui/Toast';
import { FRIEND_DISCOUNT_PAISE, REFERRAL_REWARD_PAISE, formatPaise, inviteLink, isUpiId, normalisePhone } from '@/lib/referral';
import type { ReferralSummary } from '@/lib/referralServer';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const HISTORY_LABEL: Record<string, string> = {
  earn: 'A friend bought a yearly plan',
  spend: 'Used on your yearly plan',
  payout: 'Cashed out to UPI',
  payout_reversed: 'Cash-out cancelled, back in your balance',
};

/**
 * The reader's invite link, balance and cash-out. Signed out, it goes to the
 * login page and back, as the dashboard does. The link is made on the first
 * visit here, by /api/referral. The rules are in lib/referral and migration 012.
 */
export default function InvitePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [data, setData] = useState<ReferralSummary | null>(null);
  const [failed, setFailed] = useState(false);
  const [upi, setUpi] = useState('');
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [cashErr, setCashErr] = useState<string | null>(null);

  useEffect(() => onAuthStateChanged(auth, (u) => {
    setUser(u);
    if (!u) router.push('/login?next=/invite');
  }), [router]);

  const load = useCallback(async (u: User) => {
    try {
      const token = await u.getIdToken();
      const r = await fetch('/api/referral', { headers: { 'x-user-token': token } });
      if (!r.ok) throw new Error(String(r.status));
      const d = (await r.json()) as ReferralSummary;
      setData(d);
      setUpi((v) => v || d.lastUpi || '');
      setPhone((v) => v || d.defaultPhone || '');
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    let live = true;
    (async () => { if (live) await load(user); })();
    return () => { live = false; };
  }, [user, load]);

  const link = data ? inviteLink(data.code) : '';
  const text = `For UPSC optionals, try Distilled Crux: notes, PYQs and answer checking. Buy your first yearly plan through my link and pay ${formatPaise(FRIEND_DISCOUNT_PAISE)} less:`;

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); toast('Link copied'); }
    catch { toast(link); }
  };
  const share = async () => {
    try { await navigator.share({ title: 'Distilled Crux', text, url: link }); }
    catch (e) { if ((e as Error).name !== 'AbortError') await copy(); }
  };

  const cashOut = async () => {
    if (!user || !data) return;
    setCashErr(null);
    if (!isUpiId(upi)) { setCashErr('Enter a UPI id like name@bank.'); return; }
    if (!normalisePhone(phone)) { setCashErr('Enter your 10-digit mobile number.'); return; }
    setSending(true);
    try {
      const token = await user.getIdToken();
      const r = await fetch('/api/referral/payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-token': token },
        body: JSON.stringify({ upi: upi.trim(), phone }),
      });
      const d = await r.json();
      if (!r.ok) { setCashErr(d.error ?? 'Could not send the request. Try again.'); return; }
      toast(`${formatPaise(d.amountPaise)} requested`);
      await load(user);
    } catch {
      setCashErr('Could not send the request. Try again.');
    } finally {
      setSending(false);
    }
  };

  const win = data?.window ?? null;
  const next = win?.milestones.find((m) => !m.reached);

  return (
    <div className="iv ds">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="ds-container iv-wrap">
        <h1 className="ds-h1 iv-h1">Invite friends, earn {formatPaise(REFERRAL_REWARD_PAISE)} each</h1>
        <p className="ds-lede iv-lede">
          When a friend buys their first yearly plan through your link, they pay {formatPaise(FRIEND_DISCOUNT_PAISE)} less and you get {formatPaise(REFERRAL_REWARD_PAISE)} in your balance.
        </p>

        <section className="iv-card ds-card" aria-live="polite">
          {!user ? null : failed ? (
            <p className="iv-muted">Your link could not be loaded. Refresh the page to try again.</p>
          ) : !data ? (
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
                {data.friends === 0
                  ? 'No friends have joined through your link yet.'
                  : `${data.friends} ${data.friends === 1 ? 'friend has' : 'friends have'} joined through your link.`}
              </p>
            </>
          )}
        </section>

        {data && (
          <section className="iv-card ds-card iv-bal" aria-labelledby="iv-bal-title">
            <div className="iv-bal-top">
              <h2 id="iv-bal-title" className="iv-label">Your balance</h2>
              <p className="iv-amount">{formatPaise(Math.max(0, data.balancePaise))}</p>
            </div>

            {!win ? (
              <p className="iv-text">
                It comes off your own yearly plan at checkout, up to the full price. Once you have a yearly plan, you can cash it out to UPI as well.
                {data.balancePaise > 0 && <> <Link href="/pricing" className="iv-a">Use it on a yearly plan</Link></>}
              </p>
            ) : win.capPaise === 0 ? (
              <p className="iv-text">Your current yearly plan was paid from your balance, so invites start earning again with your next yearly plan. Your balance still comes off it at checkout.</p>
            ) : (
              <>
                <div className="iv-meter">
                  <div className="iv-meter-head">
                    <span>Earned on this yearly plan</span>
                    <strong>{formatPaise(win.earnedPaise)} of {formatPaise(win.capPaise)}</strong>
                  </div>
                  <div className="iv-bar" role="progressbar" aria-valuemin={0} aria-valuemax={win.capPaise} aria-valuenow={win.earnedPaise} aria-label="Earned towards your limit">
                    <span className="iv-bar-fill" style={{ width: `${Math.min(100, (win.earnedPaise / win.capPaise) * 100)}%` }} />
                    {win.milestones.slice(0, -1).map((m) => (
                      <span key={m.atPaise} className={`iv-tick${m.reached ? ' on' : ''}`} style={{ left: `${(m.atPaise / win.capPaise) * 100}%` }} />
                    ))}
                  </div>
                  <p className="iv-muted">
                    Cash-out opens at {win.milestones.map((m) => formatPaise(m.atPaise)).join(', ').replace(/, ([^,]*)$/, ' and $1')} earned. Your limit is what this plan brought in after payment fees.
                  </p>
                </div>

                {data.pending ? (
                  <p className="iv-pending">{formatPaise(data.pending.amountPaise)} is on its way to {data.pending.upi}, asked for on {fmtDate(data.pending.requestedAt)}.</p>
                ) : data.canCashOut ? (
                  <div className="iv-cash">
                    <h3 className="iv-label">Cash out {formatPaise(data.balancePaise)} to UPI</h3>
                    <div className="iv-fields">
                      <label className="iv-field">
                        <span>UPI id</span>
                        <input id="iv-upi" className="iv-link" value={upi} onChange={(e) => { setUpi(e.target.value); setCashErr(null); }}
                          placeholder="name@bank" autoComplete="off" autoCapitalize="none" spellCheck={false} inputMode="email" />
                      </label>
                      <label className="iv-field">
                        <span>Mobile number</span>
                        <input id="iv-phone" className="iv-link" value={phone} onChange={(e) => { setPhone(e.target.value); setCashErr(null); }}
                          placeholder="98765 43210" autoComplete="tel-national" inputMode="tel" />
                      </label>
                    </div>
                    <button type="button" className={`ds-btn ds-btn-solid iv-cash-btn${sending ? ' is-loading' : ''}`} onClick={cashOut} disabled={sending}>
                      {sending ? 'Sending…' : `Cash out ${formatPaise(data.balancePaise)}`}
                    </button>
                    {cashErr && <p className="iv-err" role="alert">{cashErr}</p>}
                    <p className="iv-muted">Or keep it for your next yearly plan. Check the UPI id: the money goes to whoever it belongs to.</p>
                  </div>
                ) : next ? (
                  <p className="iv-muted">Your next cash-out opens at {formatPaise(next.atPaise)} earned.</p>
                ) : null}
              </>
            )}

            {data.history.length > 0 && (
              <div className="iv-hist">
                <h3 className="iv-label">History</h3>
                <ul>
                  {data.history.map((h, i) => (
                    <li key={i}>
                      <span>{HISTORY_LABEL[h.kind] ?? h.kind}<small>{fmtDate(h.at)}</small></span>
                      <strong className={h.amountPaise > 0 ? 'plus' : ''}>{h.amountPaise > 0 ? '+' : '−'}{formatPaise(Math.abs(h.amountPaise))}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        <section className="iv-how">
          <h2>How it works</h2>
          <ol>
            <li>Send your link to friends preparing for their optional.</li>
            <li>A friend buys their first yearly plan through it and pays {formatPaise(FRIEND_DISCOUNT_PAISE)} less. You get {formatPaise(REFERRAL_REWARD_PAISE)} in your balance.</li>
            <li>Before you have a yearly plan, your balance comes off yours at checkout, up to the full price.</li>
            <li>With a yearly plan, you can earn up to what it brought in after payment fees, about ₹2,830 on a ₹2,899 plan. Each new yearly plan starts this again.</li>
            <li>Cash out to UPI when your earnings reach ₹1,000, ₹2,000 and your limit, or keep the balance for your next yearly plan.</li>
          </ol>
          <p className="iv-muted">Only yearly plans count. Your balance stays for as long as invites run.</p>
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
.iv-card + .iv-card { margin-top: var(--space-4); }
.iv-label { margin: 0; font-family: var(--font-ui); font-size: 0.84rem; font-weight: 600; color: var(--text2); }
.iv-linkrow { display: flex; gap: var(--space-2); width: 100%; margin-top: calc(-1 * var(--space-2)); }
.iv-link { flex: 1; min-width: 0; padding: 0 var(--space-3); min-height: 46px; border: 1px solid var(--border2, var(--border)); border-radius: var(--radius-sm); background: var(--bg2); font-family: var(--font-ui); font-size: 0.92rem; color: var(--text); }
.iv-share { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.iv-stats, .iv-muted, .iv-text { margin: 0; font-family: var(--font-ui); font-size: 0.9rem; line-height: 1.55; color: var(--text3); }
.iv-stats, .iv-text { color: var(--text2); }
.iv-a { color: var(--accent-text); font-weight: 600; }
.iv-bal { align-items: stretch; }
.iv-bal-top { display: flex; flex-direction: column; gap: 2px; }
.iv-amount { margin: 0; font-size: 2.2rem; font-weight: 800; letter-spacing: -0.02em; color: var(--text); }
.iv-meter { display: flex; flex-direction: column; gap: var(--space-2); }
.iv-meter-head { display: flex; justify-content: space-between; gap: var(--space-3); font-family: var(--font-ui); font-size: 0.88rem; color: var(--text2); }
.iv-meter-head strong { color: var(--text); white-space: nowrap; }
.iv-bar { position: relative; height: 10px; border-radius: var(--radius-full); background: var(--ds-soft); overflow: visible; }
.iv-bar-fill { position: absolute; inset: 0 auto 0 0; border-radius: inherit; background: var(--accent); }
.iv-tick { position: absolute; top: -3px; width: 2px; height: 16px; margin-left: -1px; border-radius: 1px; background: var(--border2, var(--border)); }
.iv-tick.on { background: var(--accent-on); }
.iv-pending { margin: 0; padding: 10px 14px; border-radius: var(--radius-lg); background: var(--success-wash); color: var(--success-text); font-family: var(--font-ui); font-size: 0.9rem; font-weight: 600; }
.iv-cash { display: flex; flex-direction: column; gap: var(--space-3); padding-top: var(--space-4); border-top: 1px solid var(--border); }
.iv-fields { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--space-3); }
.iv-field { display: flex; flex-direction: column; gap: 4px; font-family: var(--font-ui); font-size: 0.8rem; color: var(--text3); }
.iv-cash-btn { align-self: flex-start; }
.iv-err { margin: 0; font-family: var(--font-ui); font-size: 0.86rem; color: var(--danger-text); }
.iv-hist { padding-top: var(--space-4); border-top: 1px solid var(--border); }
.iv-hist ul { list-style: none; margin: var(--space-2) 0 0; padding: 0; display: flex; flex-direction: column; }
.iv-hist li { display: flex; justify-content: space-between; align-items: baseline; gap: var(--space-3); padding: var(--space-2) 0; border-bottom: 1px solid var(--border); font-family: var(--font-ui); font-size: 0.9rem; color: var(--text2); }
.iv-hist li:last-child { border-bottom: none; }
.iv-hist li span { display: flex; flex-direction: column; }
.iv-hist small { font-size: 0.78rem; color: var(--text3); }
.iv-hist strong { color: var(--text); white-space: nowrap; }
.iv-hist strong.plus { color: var(--success-text); }
.iv-how { margin-top: var(--space-10); }
.iv-how h2 { margin: 0 0 var(--space-3); font-size: 1.2rem; color: var(--text); }
.iv-how ol { margin: 0 0 var(--space-4); padding-left: 1.2em; display: flex; flex-direction: column; gap: var(--space-2); }
.iv-how li { line-height: 1.6; color: var(--text2); }
@media (max-width: 720px) {
  .iv-wrap { padding-top: var(--space-6); }
  .iv-card { padding: var(--space-5); }
  .iv-share .ds-btn { flex: 1 1 0; justify-content: center; }
  .iv-meter-head { flex-direction: column; gap: 2px; }
  .iv-fields { grid-template-columns: minmax(0, 1fr); }
  .iv-cash-btn { align-self: stretch; justify-content: center; }
}
`;
