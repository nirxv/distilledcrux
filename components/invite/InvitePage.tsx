'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from '@/components/Link';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { toast } from '@/components/ui/Toast';
import { FRIEND_DISCOUNT_PAISE, REFERRAL_REWARD_PAISE, formatPaise, inviteLink, isUpiId, normalisePhone } from '@/lib/referral';
import type { ReferralSummary } from '@/lib/referralServer';
import { cacheBalance } from '@/lib/referralClient';
import { useLang } from '@/lib/i18n/LangContext';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const HISTORY_LABEL: Record<string, { en: string; enHi: string }> = {
  earn: { en: 'A friend bought a yearly plan', enHi: 'एक दोस्त ने वार्षिक प्लान खरीदा' },
  spend: { en: 'Used on your yearly plan', enHi: 'आपके वार्षिक प्लान पर इस्तेमाल हुआ' },
  payout: { en: 'Cashed out to UPI', enHi: 'UPI पर निकाला गया' },
  payout_reversed: { en: 'Cash-out cancelled, back in your balance', enHi: 'कैश-आउट रद्द हुआ, राशि आपके बैलेंस में वापस आ गई' },
};

/**
 * The reader's invite link, balance and cash-out. Signed out, it goes to the
 * login page and back, as the dashboard does. The link is made on the first
 * visit here, by /api/referral. The rules are in lib/referral and migration 012.
 */
export default function InvitePage() {
  const { L } = useLang();
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
      cacheBalance(u.uid, Math.max(0, d.balancePaise));
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
  const text = L(
    `For UPSC optionals, try Distilled Crux: notes, PYQs and answer checking. Buy your first yearly plan through my link and pay ${formatPaise(FRIEND_DISCOUNT_PAISE)} less:`,
    `UPSC वैकल्पिक विषयों के लिए Distilled Crux आज़माएँ: नोट्स, PYQs और उत्तर-जाँच। मेरे लिंक से अपना पहला वार्षिक प्लान खरीदें और ${formatPaise(FRIEND_DISCOUNT_PAISE)} कम भुगतान करें:`,
  );

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); toast(L('Link copied', 'लिंक कॉपी हो गया')); }
    catch { toast(link); }
  };
  const share = async () => {
    try { await navigator.share({ title: 'Distilled Crux', text, url: link }); }
    catch (e) { if ((e as Error).name !== 'AbortError') await copy(); }
  };

  const cashOut = async () => {
    if (!user || !data) return;
    setCashErr(null);
    if (!isUpiId(upi)) { setCashErr(L('Enter a UPI id like name@bank.', 'name@bank जैसा UPI ID दर्ज करें।')); return; }
    if (!normalisePhone(phone)) { setCashErr(L('Enter your 10-digit mobile number.', 'अपना 10 अंकों का मोबाइल नंबर दर्ज करें।')); return; }
    setSending(true);
    try {
      const token = await user.getIdToken();
      const r = await fetch('/api/referral/payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-token': token },
        body: JSON.stringify({ upi: upi.trim(), phone }),
      });
      const d = await r.json();
      if (!r.ok) { setCashErr(d.error ?? L('Could not send the request. Try again.', 'अनुरोध भेजा नहीं जा सका। फिर से कोशिश करें।')); return; }
      toast(L(`${formatPaise(d.amountPaise)} requested`, `${formatPaise(d.amountPaise)} का अनुरोध किया गया`));
      await load(user);
    } catch {
      setCashErr(L('Could not send the request. Try again.', 'अनुरोध भेजा नहीं जा सका। फिर से कोशिश करें।'));
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
        <h1 className="ds-h1 iv-h1">{L(`Invite friends, earn ${formatPaise(REFERRAL_REWARD_PAISE)} each`, `दोस्तों को आमंत्रित करें और हर आमंत्रण पर ${formatPaise(REFERRAL_REWARD_PAISE)} कमाएँ`)}</h1>
        <p className="ds-lede iv-lede">
          {L(`When a friend buys their first yearly plan through your link, they pay ${formatPaise(FRIEND_DISCOUNT_PAISE)} less and you get ${formatPaise(REFERRAL_REWARD_PAISE)} in your balance.`, `जब कोई दोस्त आपके लिंक से अपना पहला वार्षिक प्लान खरीदता है, तो वह ${formatPaise(FRIEND_DISCOUNT_PAISE)} कम भुगतान करता है और आपको अपने बैलेंस में ${formatPaise(REFERRAL_REWARD_PAISE)} मिलते हैं।`)}
        </p>

        <section className="iv-card ds-card" aria-live="polite">
          {!user ? null : failed ? (
            <p className="iv-muted">{L('Your link could not be loaded. Refresh the page to try again.', 'आपका लिंक लोड नहीं हो सका। फिर से कोशिश करने के लिए पेज रीफ़्रेश करें।')}</p>
          ) : !data ? (
            <p className="iv-muted">{L('Making your link…', 'आपका लिंक बनाया जा रहा है…')}</p>
          ) : (
            <>
              <label className="iv-label" htmlFor="iv-link">{L('Your invite link', 'आपका आमंत्रण लिंक')}</label>
              <div className="iv-linkrow">
                <input id="iv-link" className="iv-link" value={link} readOnly onFocus={(e) => e.currentTarget.select()} />
                <button type="button" className="ds-btn ds-btn-solid" onClick={copy}>{L('Copy', 'कॉपी करें')}</button>
              </div>
              <div className="iv-share">
                <a className="ds-btn ds-btn-line" href={`https://wa.me/?text=${encodeURIComponent(`${text} ${link}`)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
                <a className="ds-btn ds-btn-line" href={`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">Telegram</a>
                {'share' in navigator && <button type="button" className="ds-btn ds-btn-line" onClick={share}>{L('More', 'और')}</button>}
              </div>
              <p className="iv-stats">
                {data.friends === 0
                  ? L('No friends have joined through your link yet.', 'अभी तक आपके लिंक से कोई दोस्त नहीं जुड़ा है।')
                  : data.friends === 1
                    ? L(`${data.friends} friend has joined through your link.`, `आपके लिंक से ${data.friends} दोस्त जुड़ा है।`)
                    : L(`${data.friends} friends have joined through your link.`, `आपके लिंक से ${data.friends} दोस्त जुड़ चुके हैं।`)}
              </p>
            </>
          )}
        </section>

        {data && (
          <section className="iv-card ds-card iv-bal" aria-labelledby="iv-bal-title">
            <div className="iv-bal-top">
              <h2 id="iv-bal-title" className="iv-label">{L('Your balance', 'आपका बैलेंस')}</h2>
              <p className="iv-amount">{formatPaise(Math.max(0, data.balancePaise))}</p>
            </div>

            {!win ? (
              <p className="iv-text">
                {L('It comes off your own yearly plan at checkout, up to the full price. Once you have a yearly plan, you can cash it out to UPI as well.', 'चेकआउट के समय यह राशि आपके अपने वार्षिक प्लान की कीमत से घटेगी, पूरी कीमत तक। वार्षिक प्लान लेने के बाद आप इसे UPI पर भी निकाल सकते हैं।')}
                {data.balancePaise > 0 && <> <Link href="/pricing" className="iv-a">{L('Use it on a yearly plan', 'इसे वार्षिक प्लान पर इस्तेमाल करें')}</Link></>}
              </p>
            ) : win.capPaise === 0 ? (
              <p className="iv-text">{L('Your current yearly plan was paid from your balance, so invites start earning again with your next yearly plan. Your balance still comes off it at checkout.', 'आपके मौजूदा वार्षिक प्लान का भुगतान आपके बैलेंस से हुआ था, इसलिए अगले वार्षिक प्लान के साथ आमंत्रणों से कमाई फिर शुरू होगी। चेकआउट के समय आपका बैलेंस उसकी कीमत से घटेगा।')}</p>
            ) : (
              <>
                <div className="iv-meter">
                  <div className="iv-meter-head">
                    <span>{L('Earned on this yearly plan', 'इस वार्षिक प्लान पर कमाई')}</span>
                    <strong>{formatPaise(win.earnedPaise)} of {formatPaise(win.capPaise)}</strong>
                  </div>
                  <div className="iv-bar" role="progressbar" aria-valuemin={0} aria-valuemax={win.capPaise} aria-valuenow={win.earnedPaise} aria-label={L('Earned towards your limit', 'आपकी सीमा तक की कमाई')}>
                    <span className="iv-bar-fill" style={{ width: `${Math.min(100, (win.earnedPaise / win.capPaise) * 100)}%` }} />
                    {win.milestones.slice(0, -1).map((m) => (
                      <span key={m.atPaise} className={`iv-tick${m.reached ? ' on' : ''}`} style={{ left: `${(m.atPaise / win.capPaise) * 100}%` }} />
                    ))}
                  </div>
                  <p className="iv-muted">
                    {L(`Cash-out opens at ${win.milestones.map((m) => formatPaise(m.atPaise)).join(', ').replace(/, ([^,]*)$/, ' and $1')} earned. Your limit is what this plan brought in after payment fees.`, `${win.milestones.map((m) => formatPaise(m.atPaise)).join(', ').replace(/, ([^,]*)$/, ' और $1')} की कमाई पर कैश-आउट शुरू होगा। आपकी सीमा वह राशि है जो इस प्लान से भुगतान शुल्क के बाद मिली।`)}
                  </p>
                </div>

                {data.pending ? (
                  <p className="iv-pending">{L(`${formatPaise(data.pending.amountPaise)} is on its way to ${data.pending.upi}, asked for on ${fmtDate(data.pending.requestedAt)}.`, `${formatPaise(data.pending.amountPaise)} ${data.pending.upi} पर भेजे जा रहे हैं; अनुरोध ${fmtDate(data.pending.requestedAt)} को किया गया था।`)}</p>
                ) : data.canCashOut ? (
                  <div className="iv-cash">
                    <h3 className="iv-label">{L(`Cash out ${formatPaise(data.balancePaise)} to UPI`, `UPI पर ${formatPaise(data.balancePaise)} निकालें`)}</h3>
                    <div className="iv-fields">
                      <label className="iv-field">
                         <span>{L('UPI id', 'UPI ID')}</span>
                        <input id="iv-upi" className="iv-link" value={upi} onChange={(e) => { setUpi(e.target.value); setCashErr(null); }}
                          placeholder={L('name@bank', 'name@bank')} autoComplete="off" autoCapitalize="none" spellCheck={false} inputMode="email" />
                      </label>
                      <label className="iv-field">
                         <span>{L('Mobile number', 'मोबाइल नंबर')}</span>
                        <input id="iv-phone" className="iv-link" value={phone} onChange={(e) => { setPhone(e.target.value); setCashErr(null); }}
                          placeholder="98765 43210" autoComplete="tel-national" inputMode="tel" />
                      </label>
                    </div>
                    <button type="button" className={`ds-btn ds-btn-solid iv-cash-btn${sending ? ' is-loading' : ''}`} onClick={cashOut} disabled={sending}>
                       {sending ? L('Sending…', 'भेजा जा रहा है…') : L(`Cash out ${formatPaise(data.balancePaise)}`, `${formatPaise(data.balancePaise)} निकालें`)}
                    </button>
                    {cashErr && <p className="iv-err" role="alert">{cashErr}</p>}
                    <p className="iv-muted">{L('Or keep it for your next yearly plan. Check the UPI id: the money goes to whoever it belongs to.', 'या इसे अपने अगले वार्षिक प्लान के लिए रखें। UPI ID जाँच लें: पैसा उसी व्यक्ति को जाएगा जिसका यह खाता है।')}</p>
                  </div>
                ) : next ? (
                  <p className="iv-muted">{L(`Your next cash-out opens at ${formatPaise(next.atPaise)} earned.`, `${formatPaise(next.atPaise)} की कमाई पर आपका अगला कैश-आउट शुरू होगा।`)}</p>
                ) : null}
              </>
            )}

            {data.history.length > 0 && (
              <div className="iv-hist">
                <h3 className="iv-label">History</h3>
                <ul>
                  {data.history.map((h, i) => (
                    <li key={i}>
                       <span>{L(HISTORY_LABEL[h.kind]?.en ?? h.kind, HISTORY_LABEL[h.kind]?.enHi ?? h.kind)}<small>{fmtDate(h.at)}</small></span>
                      <strong className={h.amountPaise > 0 ? 'plus' : ''}>{h.amountPaise > 0 ? '+' : '−'}{formatPaise(Math.abs(h.amountPaise))}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        <section className="iv-how">
          <h2>{L('How it works', 'यह कैसे काम करता है')}</h2>
          <ol>
            <li>{L('Send your link to friends preparing for their optional.', 'अपने वैकल्पिक विषय की तैयारी कर रहे दोस्तों को अपना लिंक भेजें।')}</li>
            <li>{L(`A friend buys their first yearly plan through it and pays ${formatPaise(FRIEND_DISCOUNT_PAISE)} less. You get ${formatPaise(REFERRAL_REWARD_PAISE)} in your balance.`, `कोई दोस्त इसके ज़रिए अपना पहला वार्षिक प्लान खरीदता है और ${formatPaise(FRIEND_DISCOUNT_PAISE)} कम भुगतान करता है। आपको अपने बैलेंस में ${formatPaise(REFERRAL_REWARD_PAISE)} मिलते हैं।`)}</li>
            <li>{L('Before you have a yearly plan, your balance comes off yours at checkout, up to the full price.', 'वार्षिक प्लान लेने से पहले, चेकआउट पर आपका बैलेंस आपके प्लान की कीमत से घटेगा, पूरी कीमत तक।')}</li>
            <li>{L('With a yearly plan, you can earn up to what it brought in after payment fees, about ₹2,830 on a ₹2,899 plan. Each new yearly plan starts this again.', 'वार्षिक प्लान के साथ, आप भुगतान शुल्क के बाद उससे मिली राशि तक कमा सकते हैं—₹2,899 के प्लान पर लगभग ₹2,830। हर नया वार्षिक प्लान इस कमाई को फिर से शुरू करता है।')}</li>
            <li>{L('Cash out to UPI when your earnings reach ₹1,000, ₹2,000 and your limit, or keep the balance for your next yearly plan.', 'कमाई ₹1,000, ₹2,000 और अपनी सीमा तक पहुँचने पर UPI में निकालें, या बैलेंस अगले वार्षिक प्लान के लिए रखें।')}</li>
          </ol>
          <p className="iv-muted">{L('Only yearly plans count. Your balance stays for as long as invites run.', 'सिर्फ़ वार्षिक प्लान गिने जाते हैं। आमंत्रण कार्यक्रम जारी रहने तक आपका बैलेंस बना रहेगा।')}</p>
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
