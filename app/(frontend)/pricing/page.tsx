'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PLANS, PLAN_ORDER, rupees, type PlanId } from '@/lib/plans';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import SubjectIcon from '@/components/SubjectIcon';
import Mascot from '@/components/Mascot';
import { routeSlugForOptional } from '@/lib/optionals';

const OPTIONALS = [
  { id: 'sociology',             label: 'Sociology' },
  { id: 'anthropology',          label: 'Anthropology' },
  { id: 'geography',             label: 'Geography' },
  { id: 'political-science',     label: 'PSIR' },
  { id: 'public-administration', label: 'Public Administration' },
];

/**
 * The plans differ only in how long they last, so each card says what the
 * time is for, and the one list of what Premium opens sits below them. The
 * cards used to repeat that list three times, with lines that were not true:
 * "PYQ Bank access" (past questions are free with an account), "4500+
 * questions" (the bank across all five optionals, not the one bought) and
 * "Performance analytics" (there is none).
 */
const PLAN_COPY: Record<PlanId, { blurb: string; cta: string; perMonth?: string }> = {
  daily:    { blurb: 'For a test day, or one last push before the paper.', cta: 'Get a day' },
  sixmonth: { blurb: 'One focused run up to Mains.', cta: 'Get 6 months', perMonth: `about ₹${Math.round(rupees(PLANS.sixmonth) / 6)} a month` },
  yearly:   { blurb: 'A full year, enough for the whole run to Mains.', cta: 'Get a year', perMonth: `about ₹${Math.round(rupees(PLANS.yearly) / 12)} a month` },
};

const COMPARE: { what: string; free: string; premium: string }[] = [
  { what: 'Notes for every topic in the syllabus', free: 'Included', premium: 'Included' },
  { what: 'Past questions, with search and filters', free: 'Included', premium: 'Included' },
  { what: 'Timed tests', free: 'Included', premium: 'Included' },
  { what: 'AI chat', free: '3 questions', premium: 'Unlimited' },
  { what: 'Chat modes: books, mentor, brainstorm and your own PDF', free: '—', premium: 'Included' },
  { what: 'Answer evaluation', free: '1 answer', premium: 'Unlimited' },
  { what: 'Model answers to past questions', free: '—', premium: 'Included' },
  { what: 'Test answers corrected', free: '—', premium: 'Included' },
];

const faqs = [
  { q: 'Is there a free tier?', a: 'Yes. A free account opens every note and past question, three AI chats and one answer evaluation. No card needed.' },
  { q: 'Do plans renew on their own?', a: 'No. Each plan is a single payment for a fixed time. When it runs out you can pick any plan, and buying while one is active adds the time on top.' },
  { q: 'Which optionals are supported?', a: 'Sociology, Anthropology, PSIR, Geography and Public Administration. History is at historyoptional.xyz.' },
  { q: 'Can I buy for more than one optional?', a: 'Each optional is a separate purchase, and a plan covers the optional you pick at checkout. If you change your optional later, the plan stays with the one you paid for.' },
  { q: 'What payment methods are accepted?', a: 'UPI, debit and credit cards, and net banking, through Razorpay.' },
  { q: 'Is there a refund policy?', a: 'All purchases are final and non-refundable. Exceptions only for duplicate charges or extended platform outages. Contact us within 7 days.' },
];

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open(): void };
  }
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rzpReady, setRzpReady] = useState(false);
  const [selectedOptional, setSelectedOptional] = useState<string | null>(null);
  const [userOptional, setUserOptional] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [activeUntil, setActiveUntil] = useState<string | null>(null);

  useEffect(() => {
    if (window.Razorpay) { setRzpReady(true); return; }
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => setRzpReady(true);
    s.onerror = () => setError('Payment gateway failed to load. Try disabling your adblocker.');
    document.body.appendChild(s);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
      setSignedIn(Boolean(firebaseUser));
      if (!firebaseUser) return;
      try {
        const token = await firebaseUser.getIdToken();
        const res = await fetch('/api/user-profile', { headers: { 'x-user-token': token } });
        if (res.ok) {
          const data = await res.json();
          if (data.optional) { setUserOptional(data.optional); setSelectedOptional(data.optional); }
        }
      } catch { /* ignore */ }
    });
    return () => unsubscribe();
  }, []);

  // Whether the reader already holds a plan for the optional picked, so the
  // page can say that buying again adds time rather than starting over.
  useEffect(() => {
    const user = auth.currentUser;
    if (!user || !selectedOptional) return;
    let live = true;
    (async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch(`/api/sub-status?subject=${encodeURIComponent(selectedOptional)}`, { headers: { 'x-user-token': token } });
        const d = await res.json();
        if (live) setActiveUntil(d.active && d.expiresAt ? d.expiresAt : null);
      } catch { if (live) setActiveUntil(null); }
    })();
    return () => { live = false; };
  }, [selectedOptional, signedIn]);

  const handlePurchase = async (planId: string) => {
    setError(null);
    const user = auth.currentUser;
    if (!user) { window.location.href = '/login?next=/pricing'; return; }
    if (!selectedOptional) { setError('Pick your optional above before choosing a plan.'); return; }
    setLoading(planId);
    try {
      const token = await user.getIdToken();
      const orderRes = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-token': token },
        body: JSON.stringify({ plan: planId, optional: selectedOptional }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error ?? 'Order creation failed');

      const optLabel = OPTIONALS.find(o => o.id === selectedOptional)?.label ?? selectedOptional;
      const planLabel = PLANS[planId as PlanId]?.label ?? planId;

      const rzp = new window.Razorpay({
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        // The brand the reader is buying from on this site. Checkout is the
        // only surface this reaches: Razorpay's own emails, the card statement
        // and the UPI merchant name all keep the account's registered name,
        // which is why the note under the plans says so.
        name: 'Distilled Crux',
        image: 'https://www.distilledcrux.com/apple-icon.png',
        description: `${optLabel} ${planLabel} Plan`,
        order_id: orderData.orderId,
        prefill: { email: user.email ?? '', name: user.displayName ?? '' },
        theme: { color: '#4361ee' },
        handler: async (response: Record<string, string>) => {
          try {
            const verifyRes = await fetch('/api/payment/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-user-token': token },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                plan: planId,
                optional: selectedOptional,
              }),
            });
            const verifyData = await verifyRes.json();
            if (verifyData.success) {
              window.location.href = '/dashboard?payment=success';
            } else {
              setError('Payment verification failed. Contact support.');
            }
          } catch { setError('Verification error. Contact support.'); }
          finally { setLoading(null); }
        },
        modal: { ondismiss: () => setLoading(null) },
      });
      rzp.open();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setLoading(null);
    }
  };

  const selected = OPTIONALS.find(o => o.id === selectedOptional);
  const profileLabel = OPTIONALS.find(o => o.id === userOptional)?.label;
  const slug = routeSlugForOptional(selectedOptional);
  const tint = slug ? { ['--t' as string]: `var(--tint-${slug})`, ['--w' as string]: `var(--wash-${slug})` } : undefined;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="pr ds" style={tint}>
        <header className="pr-hero">
          <div className="ds-container">
            <h1 className="ds-h1 pr-h1">Plans and pricing</h1>
            <p className="ds-lede pr-lede">
              Notes and past questions are free with your account. Premium opens everything else for one optional, for as long as you buy. Nothing renews on its own.
            </p>
          </div>
        </header>

        <div className="ds-container">
          <section className="pr-step">
            <h2 className="pr-h2">Which optional is this for?</h2>
            <div className="pr-opts" role="radiogroup" aria-label="Optional">
              {OPTIONALS.map((opt) => {
                const on = selectedOptional === opt.id;
                const s = routeSlugForOptional(opt.id);
                return (
                  <button key={opt.id} type="button" role="radio" aria-checked={on}
                    onClick={() => { setSelectedOptional(opt.id); setError(null); }}
                    className={`pr-opt${on ? ' on' : ''}`}
                    style={s ? { ['--t' as string]: `var(--tint-${s})`, ['--w' as string]: `var(--wash-${s})` } : undefined}>
                    <SubjectIcon id={opt.id} size={18} />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
            {selected && activeUntil && (
              <p className="pr-note good">You’re on Premium for {selected.label} until {fmtDate(activeUntil)}. Buying again adds the time on top.</p>
            )}
            {selected && profileLabel && userOptional !== selectedOptional && (
              <p className="pr-note">Your profile is set to {profileLabel}. A plan works for the optional on your profile, so switch to {selected.label} from your dashboard once you’ve bought it.</p>
            )}
          </section>

          {error && <div className="pr-error" role="alert">{error}</div>}

          <section className="pr-plans">
            {PLAN_ORDER.map((id) => {
              const plan = PLANS[id];
              const copy = PLAN_COPY[id];
              const featured = id === 'yearly';
              const busy = loading === id;
              return (
                <article key={id} className={`pr-plan${featured ? ' featured' : ''}`}>
                  <div className="pr-plan-top">
                    <h3 className="pr-plan-name">{plan.label}</h3>
                    {featured && <span className="pr-tag">Most chosen</span>}
                  </div>
                  <div className="pr-price"><span>₹</span>{rupees(plan).toLocaleString('en-IN')}</div>
                  <div className="pr-period">{plan.period}{copy.perMonth ? ` · ${copy.perMonth}` : ''}</div>
                  <p className="pr-blurb">{copy.blurb}</p>
                  <button type="button"
                    className={`ds-btn ${featured ? 'ds-btn-solid' : 'ds-btn-line'} pr-buy`}
                    onClick={() => handlePurchase(id)}
                    disabled={!!loading || !rzpReady || !selectedOptional}>
                    {busy ? 'Opening checkout…' : !rzpReady ? 'Loading…' : !selectedOptional ? 'Pick your optional first' : `${copy.cta}${selected ? ` of ${selected.label}` : ''}`}
                  </button>
                </article>
              );
            })}
          </section>

          <p className="pr-rzp">
            Payment is processed by Razorpay. Your card statement and Razorpay’s receipt will show “History Optional”, the venture Distilled Crux is a product of.
          </p>

          <section className="pr-compare-wrap">
            <h2 className="pr-h2">What Premium opens</h2>
            <div className="pr-compare" role="table" aria-label="Free account and Premium compared">
              <div className="pr-row pr-row-head" role="row">
                <span role="columnheader" />
                <span role="columnheader">Free account</span>
                <span role="columnheader" className="pr-col-premium">Premium</span>
              </div>
              {COMPARE.map((r) => (
                <div key={r.what} className="pr-row" role="row">
                  <span role="cell" className="pr-what">{r.what}</span>
                  <span role="cell" className={r.free === '—' ? 'pr-none' : ''}>{r.free}</span>
                  <span role="cell" className="pr-col-premium">{r.premium}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="pr-faq">
            <h2 className="pr-h2">Common questions</h2>
            <div className="pr-faq-list">
              {faqs.map((f) => (
                <details key={f.q} className="pr-faq-item">
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </section>

          <section className="pr-close">
            <Mascot pose="peek" width={92} />
            <div className="pr-close-text">
              <h2>Not sure yet?</h2>
              <p>Start with the free account: every note, every past question, three chats and one evaluation.</p>
            </div>
            <Link href={signedIn ? '/dashboard' : '/login?next=/dashboard'} className="ds-btn ds-btn-line">
              {signedIn ? 'Go to your dashboard' : 'Sign in free'}
            </Link>
          </section>
        </div>
      </div>
    </>
  );
}

const CSS = `
.pr { background: var(--bg); min-height: var(--page-min-h); padding-bottom: clamp(48px, 9vh, 96px); }
.pr-hero { padding: clamp(32px, 6vh, 64px) 0 clamp(16px, 3vh, 28px); background: linear-gradient(180deg, color-mix(in srgb, var(--accent-dim) 60%, var(--bg)) 0%, var(--bg) 100%); }
.pr-h1 { font-size: clamp(2.1rem, 4.6vw, 3.2rem); margin: 0 0 var(--space-3); }
.pr-lede { max-width: 640px; }
.pr-h2 { margin: 0 0 var(--space-4); font-size: 1.3rem; font-weight: 800; letter-spacing: -0.02em; }

.pr-step { padding: var(--space-4) 0 var(--space-6); }
.pr-opts { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.pr-opt { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 var(--space-4); border-radius: var(--radius-full); border: 1.5px solid var(--border2); background: var(--ds-card); color: var(--text); font: inherit; font-size: 0.95rem; font-weight: 600; cursor: pointer; transition: border-color 0.15s, background 0.15s, color 0.15s; }
.pr-opt svg { color: var(--t); }
.pr-opt:hover { border-color: color-mix(in srgb, var(--t) 50%, transparent); }
.pr-opt.on { border-color: var(--t); background: var(--w); color: var(--t); }
.pr-opt:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.pr-note { margin: var(--space-4) 0 0; max-width: 720px; padding: var(--space-3) var(--space-4); border-radius: var(--radius-lg); background: var(--warning-wash); color: var(--text); font-size: 0.92rem; line-height: 1.55; }
.pr-note.good { background: var(--success-wash); }
.pr-error { margin: 0 0 var(--space-4); padding: var(--space-3) var(--space-4); border-radius: var(--radius-lg); background: var(--danger-wash); border: 1px solid color-mix(in srgb, var(--danger-text) 30%, transparent); color: var(--danger-text); font-size: 0.92rem; }

.pr-plans { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-4); align-items: stretch; }
.pr-plan { display: flex; flex-direction: column; padding: var(--space-6); background: var(--ds-card); border: 1px solid var(--border); border-radius: var(--radius-xl); }
.pr-plan.featured { border: 2px solid var(--accent); box-shadow: var(--elev-2); }
.pr-plan-top { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); margin-bottom: var(--space-4); }
.pr-plan-name { margin: 0; font-size: 1.1rem; font-weight: 800; }
.pr-tag { padding: 3px 12px; border-radius: var(--radius-full); background: var(--accent); color: var(--accent-on); font-size: 0.8rem; font-weight: 700; }
.pr-price { font-size: 3rem; font-weight: 800; letter-spacing: -0.04em; line-height: 1; color: var(--text); }
.pr-price span { margin-right: 2px; font-size: 1.5rem; font-weight: 700; vertical-align: 0.6em; }
.pr-period { margin-top: var(--space-2); font-size: 0.9rem; color: var(--text3); }
.pr-blurb { flex: 1; margin: var(--space-4) 0 var(--space-5); font-size: 0.98rem; line-height: 1.6; color: var(--text2); }
.pr-buy { width: 100%; justify-content: center; min-height: 48px; }
.pr-buy:disabled { opacity: 0.55; cursor: not-allowed; }
.pr-rzp { margin: var(--space-4) 0 0; font-size: 0.86rem; line-height: 1.55; color: var(--text3); }

.pr-compare-wrap { padding-top: var(--space-10); }
.pr-compare { max-width: 860px; border: 1px solid var(--border); border-radius: var(--radius-xl); background: var(--ds-card); overflow: hidden; }
.pr-row { display: grid; grid-template-columns: minmax(0, 1.8fr) minmax(0, 1fr) minmax(0, 1fr); gap: var(--space-3); padding: var(--space-3) var(--space-5); border-top: 1px solid var(--border); align-items: center; font-size: 0.95rem; }
.pr-row:first-child { border-top: none; }
.pr-row-head { background: var(--ds-soft); font-size: 0.88rem; font-weight: 700; color: var(--text2); }
.pr-what { color: var(--text); }
.pr-none { color: var(--text3); }
.pr-col-premium { font-weight: 700; color: var(--accent-text); }
.pr-row-head .pr-col-premium { color: var(--accent-text); }

.pr-faq { padding-top: var(--space-10); max-width: 860px; }
.pr-faq-list { border: 1px solid var(--border); border-radius: var(--radius-xl); background: var(--ds-card); overflow: hidden; }
.pr-faq-item { border-top: 1px solid var(--border); }
.pr-faq-item:first-child { border-top: none; }
.pr-faq-item summary { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); padding: var(--space-4) var(--space-5); font-weight: 700; cursor: pointer; list-style: none; }
.pr-faq-item summary::-webkit-details-marker { display: none; }
.pr-faq-item summary::after { content: '+'; font-size: 1.3rem; font-weight: 500; color: var(--text3); transition: transform 0.2s; }
.pr-faq-item[open] summary::after { transform: rotate(45deg); }
.pr-faq-item p { margin: 0; padding: 0 var(--space-5) var(--space-4); line-height: 1.65; color: var(--text2); }

.pr-close { display: flex; align-items: center; gap: var(--space-5); margin-top: var(--space-10); padding: var(--space-6); border-radius: var(--radius-xl); background: var(--ds-card); border: 1px solid var(--border); max-width: 860px; }
.pr-close-text { flex: 1; min-width: 0; }
.pr-close-text h2 { margin: 0 0 4px; font-size: 1.2rem; font-weight: 800; }
.pr-close-text p { margin: 0; color: var(--text2); line-height: 1.55; }

@media (max-width: 900px) {
  .pr-plans { grid-template-columns: minmax(0, 1fr); }
  .pr-plan.featured { order: -1; }
}
@media (max-width: 640px) {
  .pr-opts { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .pr-opt { justify-content: center; padding: 0 var(--space-2); font-size: 0.9rem; }
  .pr-opt:last-child { grid-column: 1 / -1; }
  .pr-plan { padding: var(--space-5) var(--space-4); }
  .pr-row { grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr); padding: var(--space-3) var(--space-4); font-size: 0.88rem; }
  .pr-close { flex-direction: column; text-align: center; }
  .pr-close .ds-btn { width: 100%; justify-content: center; }
}
@media (prefers-reduced-motion: reduce) { .pr-faq-item summary::after { transition: none; } }
`;
