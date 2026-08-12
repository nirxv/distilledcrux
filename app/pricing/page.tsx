'use client';
import { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

const OPTIONALS = [
  { id: 'sociology',             label: 'Sociology',             emoji: '👥' },
  { id: 'anthropology',          label: 'Anthropology',          emoji: '🧬' },
  { id: 'geography',             label: 'Geography',             emoji: '🌍' },
  { id: 'political-science',     label: 'PSIR',                  emoji: '⚖️' },
  { id: 'public-administration', label: 'Public Administration', emoji: '🏛️' },
];

const plans = [
  {
    id: 'daily', label: 'Daily', price: 49, period: 'per day', tag: null,
    desc: 'Perfect for exam-day sprints and last-minute revision.',
    color: '#2dd4bf',
    features: [
      { label: 'Full platform access for 24 hours' },
      { label: 'AI Answer Evaluation (unlimited)' },
      { label: 'AI Chat — ask anything' },
      { label: 'PYQ Bank access' },
      { label: 'Syllabus-Mapped Notes' },
      { label: 'Topper Answer Copies', future: true },
    ],
  },
  {
    id: 'sixmonth', label: '6 Months', price: 1999, period: 'per 6 months', tag: 'Most Popular',
    desc: 'Best for focused preparation cycles leading up to Mains.',
    color: '#4361ee',
    features: [
      { label: 'Full platform access for 6 months' },
      { label: 'AI Answer Evaluation (unlimited)' },
      { label: 'AI Chat — ask anything' },
      { label: 'PYQ Bank 1500+ questions' },
      { label: 'Syllabus-Mapped Notes' },
      { label: 'Topper Answer Copies', future: true },
      { label: 'Performance analytics' },
    ],
  },
  {
    id: 'yearly', label: 'Yearly', price: 2999, period: 'per year', tag: 'Best Value',
    desc: 'Full-year coverage from Prelims to Mains interview prep.',
    color: '#e8b86d',
    features: [
      { label: 'Full platform access for 12 months' },
      { label: 'AI Answer Evaluation (unlimited)' },
      { label: 'AI Chat — ask anything' },
      { label: 'PYQ Bank 1500+ questions' },
      { label: 'Syllabus-Mapped Notes' },
      { label: 'Topper Answer Copies', future: true },
      { label: 'Performance analytics' },
      { label: 'Priority support' },
      { label: 'Early access to new features' },
    ],
  },
];

const faqs = [
  { q: 'Is there a free tier?', a: 'Yes — 3 free AI chats, no card required.' },
  { q: 'Can I switch plans?', a: 'After your current plan expires you can pick any plan. Plans are non-auto-renewing.' },
  { q: 'Which optionals are supported?', a: 'Sociology, Anthropology, PSIR, Geography, and Public Administration. History is at historyoptional.xyz.' },
  { q: 'Can I buy for multiple optionals?', a: 'Each optional requires a separate purchase. Your active subscription is tied to the optional you select at checkout.' },
  { q: 'What payment methods are accepted?', a: 'UPI, debit/credit cards, net banking via Razorpay.' },
  { q: 'Is there a refund policy?', a: 'All purchases are final and non-refundable. Exceptions only for duplicate charges or extended platform outages — contact us within 7 days.' },
];

const CSS = `
@keyframes fadeUp { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:translateY(0) } }
.pr-page { min-height: 100vh; }
.pr-header { max-width: 1200px; margin: 0 auto; padding: 120px 2rem 3.5rem; border-bottom: 1px solid var(--border); animation: fadeUp 0.3s ease; }
.pr-kicker { font-family: var(--font-ui); font-size: 0.65rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--text3); margin-bottom: 1.5rem; }
.pr-h1 { font-family: var(--font-body); font-size: clamp(2.4rem, 5.5vw, 4rem); font-weight: 700; letter-spacing: -0.035em; line-height: 1.02; color: var(--text); margin-bottom: 1rem; }
.pr-h1 em { font-style: italic; color: var(--accent); }
.pr-tagline { font-family: var(--font-ui); font-size: 0.92rem; color: var(--text3); max-width: 480px; line-height: 1.7; }
.pr-optional-wrap { max-width: 1200px; margin: 0 auto; padding: 2.5rem 2rem; border-bottom: 1px solid var(--border); }
.pr-section-label { font-family: var(--font-ui); font-size: 0.62rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--text3); margin-bottom: 1.25rem; display: flex; align-items: center; gap: 10px; }
.pr-section-label::before { content: ''; display: block; width: 16px; height: 1px; background: var(--border3); }
.pr-optional-grid { display: flex; flex-wrap: wrap; gap: 0.6rem; }
.pr-opt-btn { display: flex; align-items: center; gap: 7px; padding: 0.55rem 1rem; border-radius: 8px; border: 1px solid var(--border2); background: var(--bg2); cursor: pointer; font-family: var(--font-ui); font-size: 0.82rem; font-weight: 500; color: var(--text2); transition: all 0.12s; }
.pr-opt-btn:hover { border-color: var(--border3); color: var(--text); background: var(--bg3); }
.pr-opt-btn.selected { border-color: rgba(67,97,238,0.5); background: rgba(67,97,238,0.08); color: var(--accent); }
.pr-opt-emoji { font-size: 1rem; line-height: 1; }
.pr-opt-check { width: 14px; height: 14px; border-radius: 50%; background: var(--accent); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.pr-selected-badge { display: inline-flex; align-items: center; gap: 6px; margin-top: 1rem; padding: 4px 12px; border-radius: 20px; background: rgba(67,97,238,0.06); border: 1px solid rgba(67,97,238,0.15); font-family: var(--font-ui); font-size: 0.75rem; color: var(--text3); }
.pr-selected-badge strong { color: var(--accent); font-weight: 600; }
.pr-optional-hint { margin-top: 1.25rem; padding: 0.75rem 1rem; border-radius: 8px; background: rgba(232,184,109,0.06); border: 1px solid rgba(232,184,109,0.2); font-family: var(--font-ui); font-size: 0.8rem; color: var(--text3); display: flex; align-items: center; gap: 8px; }
.pr-grid-wrap { max-width: 1200px; margin: 0 auto; padding: 3.5rem 2rem; border-bottom: 1px solid var(--border); }
.pr-grid { display: grid; grid-template-columns: repeat(3, 1fr); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
.pr-card { background: var(--bg); border-right: 1px solid var(--border); display: flex; flex-direction: column; transition: background 0.15s; position: relative; }
.pr-card:last-child { border-right: none; }
.pr-card:hover { background: var(--bg2); }
.pr-card.featured { background: var(--bg2); }
.pr-card-accent { height: 2px; width: 100%; }
.pr-card-body { padding: 2rem; flex: 1; display: flex; flex-direction: column; }
.pr-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; }
.pr-card-label { font-family: var(--font-ui); font-size: 0.68rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--text3); }
.pr-card-badge { font-family: var(--font-ui); font-size: 0.62rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; padding: 2px 9px; border-radius: 3px; }
.pr-card-price { margin-bottom: 0.3rem; }
.pr-card-amount { font-family: var(--font-body); font-size: 3rem; font-weight: 700; letter-spacing: -0.05em; color: var(--text); line-height: 1; }
.pr-card-currency { font-family: var(--font-ui); font-size: 1.2rem; font-weight: 600; vertical-align: super; line-height: 0; margin-right: 1px; }
.pr-card-period { font-family: var(--font-ui); font-size: 0.72rem; color: var(--text3); margin-bottom: 1.25rem; }
.pr-card-desc { font-family: var(--font-ui); font-size: 0.82rem; color: var(--text2); line-height: 1.6; padding-bottom: 1.25rem; margin-bottom: 1.25rem; border-bottom: 1px solid var(--border); }
.pr-features { list-style: none; display: flex; flex-direction: column; gap: 0.55rem; flex: 1; margin-bottom: 1.75rem; }
.pr-feature { display: flex; align-items: flex-start; gap: 8px; font-family: var(--font-ui); font-size: 0.8rem; color: var(--text2); line-height: 1.4; }
.pr-feature svg { flex-shrink: 0; margin-top: 1px; }
.pr-btn { display: block; width: 100%; padding: 0.8rem 1rem; border-radius: 7px; font-family: var(--font-ui); font-size: 0.85rem; font-weight: 600; text-align: center; cursor: pointer; border: none; transition: opacity 0.15s, transform 0.12s; letter-spacing: 0.01em; }
.pr-btn:hover:not(:disabled) { opacity: 0.85; transform: translateY(-1px); }
.pr-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.pr-btn-outline { background: transparent; border: 1px solid var(--border3); color: var(--text2); }
.pr-btn-outline:hover:not(:disabled) { color: var(--text); background: var(--bg3); opacity: 1; transform: translateY(-1px); }
.pr-btn-need-optional { background: var(--bg3) !important; color: var(--text3) !important; border: 1px dashed var(--border2) !important; cursor: not-allowed !important; }
.pr-error { max-width: 1200px; margin: 0 auto; padding: 0 2rem 1.5rem; font-family: var(--font-ui); font-size: 0.83rem; }
.pr-error-inner { background: rgba(248,113,113,0.07); border: 1px solid rgba(248,113,113,0.22); border-radius: 6px; padding: 0.7rem 1.1rem; color: #f87171; }
.pr-faq { max-width: 1200px; margin: 0 auto; border-bottom: 1px solid var(--border); }
.pr-faq-header { padding: 1.75rem 2rem 1.25rem; display: flex; align-items: center; gap: 10px; font-family: var(--font-ui); font-size: 0.62rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--text3); border-bottom: 1px solid var(--border); }
.pr-faq-grid { display: grid; grid-template-columns: 1fr 1fr; }
.pr-faq-item { padding: 1.5rem 2rem; border-bottom: 1px solid var(--border); border-right: 1px solid var(--border); }
.pr-faq-item:nth-child(even) { border-right: none; }
.pr-faq-item:nth-last-child(-n+2) { border-bottom: none; }
.pr-faq-q { font-family: var(--font-body); font-size: 0.88rem; font-weight: 700; color: var(--text); margin-bottom: 0.4rem; letter-spacing: -0.01em; }
.pr-faq-a { font-family: var(--font-ui); font-size: 0.78rem; color: var(--text3); line-height: 1.65; }
.pr-cta { max-width: 1200px; margin: 0 auto; padding: 3rem 2rem; display: flex; align-items: center; justify-content: space-between; gap: 2rem; flex-wrap: wrap; }
.pr-cta-h2 { font-family: var(--font-body); font-size: clamp(1.5rem, 3vw, 2rem); font-weight: 700; letter-spacing: -0.03em; color: var(--text); line-height: 1.1; margin-bottom: 0.4rem; }
.pr-cta-h2 em { font-style: italic; color: var(--accent); }
.pr-cta-sub { font-family: var(--font-ui); font-size: 0.82rem; color: var(--text3); }
.pr-cta-actions { display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center; }
.pr-cta-link { font-family: var(--font-ui); font-size: 0.82rem; font-weight: 600; padding: 9px 20px; border-radius: 6px; text-decoration: none; background: var(--text); color: var(--bg); transition: opacity 0.15s; }
.pr-cta-link:hover { opacity: 0.88; }
.pr-cta-ghost { font-family: var(--font-ui); font-size: 0.82rem; color: var(--text3); text-decoration: none; transition: color 0.15s; }
.pr-cta-ghost:hover { color: var(--text); }
.pr-rzp-note { max-width: 1200px; margin: 0 auto; padding: 0 2rem 1.5rem; font-family: var(--font-ui); font-size: 0.75rem; color: var(--text3); display: flex; align-items: center; gap: 6px; }
@media(max-width:900px){
  .pr-grid { grid-template-columns: 1fr; }
  .pr-card { border-right: none; border-bottom: 1px solid var(--border); }
  .pr-card:last-child { border-bottom: none; }
  .pr-faq-grid { grid-template-columns: 1fr; }
  .pr-faq-item { border-right: none; }
  .pr-faq-item:nth-last-child(-n+2) { border-bottom: 1px solid var(--border); }
  .pr-faq-item:last-child { border-bottom: none; }
  .pr-cta { flex-direction: column; align-items: flex-start; }
}
@media(max-width:640px){
  .pr-header { padding:88px 1.25rem 2.5rem; }
  .pr-h1 { font-size:clamp(2rem,10vw,3rem); }
  .pr-tagline { font-size:0.85rem; }
  .pr-optional-wrap { padding: 2rem 1.25rem; }
  .pr-grid-wrap { padding:2rem 1.25rem; }
  .pr-card-body { padding:1.5rem 1.25rem; }
  .pr-card-amount { font-size:2.4rem; }
  .pr-btn { padding:0.85rem; font-size:0.88rem; }
  .pr-faq-item { padding:1.25rem; }
  .pr-cta { padding:2rem 1.25rem; }
  .pr-cta-actions { width:100%; flex-direction:column; }
  .pr-cta-link { text-align:center; padding:0.85rem; }
  .pr-error { padding:0 1.25rem 1rem; }
  .pr-rzp-note { padding: 0 1.25rem 1rem; }
}
`;

function CheckIcon({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="7" fill={color} fillOpacity="0.14" />
      <path d="M3.5 7l2.5 2.5 4-4.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open(): void };
  }
}

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rzpReady, setRzpReady] = useState(false);
  const [selectedOptional, setSelectedOptional] = useState<string | null>(null);
  const [userOptional, setUserOptional] = useState<string | null>(null);

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

  const handlePurchase = async (planId: string) => {
    setError(null);
    const user = auth.currentUser;
    if (!user) { window.location.href = '/login?next=/pricing'; return; }
    if (!selectedOptional) { setError('Please select your optional subject above before purchasing.'); return; }
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
      const planLabel = plans.find(p => p.id === planId)?.label ?? planId;

      const rzp = new window.Razorpay({
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'History Optional',
        description: `${optLabel} — ${planLabel} Plan`,
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

  const selectedOptionalData = OPTIONALS.find(o => o.id === selectedOptional);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="pr-page">

        <div className="pr-header">
          <div className="pr-kicker">Pricing</div>
          <h1 className="pr-h1">Simple, transparent <em>pricing.</em></h1>
          <p className="pr-tagline">One optional per subscription. No hidden fees. No auto-renewals.</p>
        </div>

        <div className="pr-optional-wrap">
          <div className="pr-section-label">Step 1 — Select your optional</div>
          <div className="pr-optional-grid">
            {OPTIONALS.map((opt) => {
              const isSelected = selectedOptional === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setSelectedOptional(opt.id)}
                  className={`pr-opt-btn${isSelected ? ' selected' : ''}`}
                >
                  <span className="pr-opt-emoji">{opt.emoji}</span>
                  <span>{opt.label}</span>
                  {isSelected && (
                    <span className="pr-opt-check">
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                        <path d="M1.5 4l2 2 3-3" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {selectedOptionalData ? (
            <div className="pr-selected-badge">
              <span>{selectedOptionalData.emoji}</span>
              Purchasing for <strong>{selectedOptionalData.label}</strong>
              {userOptional && userOptional !== selectedOptional && (
                <span style={{ marginLeft: 6, opacity: 0.6 }}>
                  (your current optional is {OPTIONALS.find(o => o.id === userOptional)?.label})
                </span>
              )}
            </div>
          ) : (
            <div className="pr-optional-hint">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="6.5" stroke="#e8b86d" strokeOpacity="0.6"/>
                <path d="M7 4v3.5" stroke="#e8b86d" strokeWidth="1.3" strokeLinecap="round"/>
                <circle cx="7" cy="10" r="0.7" fill="#e8b86d"/>
              </svg>
              Select your optional above — then pick a plan below.
            </div>
          )}
        </div>

        {error && (
          <div className="pr-error">
            <div className="pr-error-inner">{error}</div>
          </div>
        )}

        <div className="pr-grid-wrap">
          <div className="pr-section-label" style={{ marginBottom: '1.5rem' }}>Step 2 — Choose a plan</div>
          <div className="pr-grid">
            {plans.map((plan) => {
              const isFeatured = plan.id === 'sixmonth';
              const isYearly = plan.id === 'yearly';
              const isLoading = loading === plan.id;
              const needsOptional = !selectedOptional;
              const badgeBg = isFeatured ? 'rgba(67,97,238,0.15)' : 'rgba(232,184,109,0.12)';
              const badgeColor = isFeatured ? '#7b93f7' : '#e8b86d';
              return (
                <div key={plan.id} className={`pr-card${isFeatured ? ' featured' : ''}`}>
                  <div className="pr-card-accent" style={{ background: plan.color }} />
                  <div className="pr-card-body">
                    <div className="pr-card-top">
                      <span className="pr-card-label">{plan.label}</span>
                      {plan.tag && (
                        <span className="pr-card-badge" style={{ background: badgeBg, color: badgeColor }}>
                          {plan.tag}
                        </span>
                      )}
                    </div>
                    <div className="pr-card-price">
                      <div className="pr-card-amount">
                        <span className="pr-card-currency">₹</span>
                        {plan.price.toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div className="pr-card-period">{plan.period}</div>
                    <p className="pr-card-desc">{plan.desc}</p>
                    <ul className="pr-features">
                      {plan.features.map((f) => (
                        <li key={f.label} className="pr-feature" style={f.future ? { opacity: 0.45 } : undefined}>
                          <CheckIcon color={f.future ? 'var(--text3)' : plan.color} />{f.label}
                          {f.future && (
                            <span style={{ marginLeft: '6px', fontSize: '0.6rem', fontFamily: 'var(--font-ui)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)', border: '1px solid var(--border)', borderRadius: '4px', padding: '1px 6px', verticalAlign: 'middle' }}>Soon</span>
                          )}
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => needsOptional
                        ? setError('Please select your optional subject above first.')
                        : handlePurchase(plan.id)
                      }
                      disabled={!!loading || !rzpReady}
                      className={needsOptional ? 'pr-btn pr-btn-need-optional' : isFeatured ? 'pr-btn' : 'pr-btn pr-btn-outline'}
                      style={needsOptional ? undefined : isFeatured ? { background: plan.color, color: '#fff' } : isYearly ? { borderColor: 'rgba(232,184,109,0.3)', color: '#e8b86d' } : undefined}
                    >
                      {isLoading ? 'Opening checkout…' : !rzpReady ? 'Loading…' : needsOptional ? '↑ Select optional first' : 'Get started →'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="pr-rzp-note">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="6" cy="6" r="5.5" stroke="currentColor" strokeOpacity="0.4"/>
            <path d="M6 3.5v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            <circle cx="6" cy="8.5" r="0.6" fill="currentColor"/>
          </svg>
          Payment is processed by Razorpay. You will see “History Optional” on your payment screen — Distilled Crux is a product by the History Optional venture.
        </div>

        <div className="pr-faq">
          <div className="pr-faq-header">Common questions</div>
          <div className="pr-faq-grid">
            {faqs.map((item) => (
              <div key={item.q} className="pr-faq-item">
                <div className="pr-faq-q">{item.q}</div>
                <div className="pr-faq-a">{item.a}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="pr-cta">
          <div>
            <h2 className="pr-cta-h2">Still unsure? <em>Start free.</em></h2>
            <p className="pr-cta-sub">3 AI chats, no card. See the platform before committing.</p>
          </div>
          <div className="pr-cta-actions">
            <a href="/dashboard" className="pr-cta-link">Go to dashboard →</a>
            <a href="/" className="pr-cta-ghost">Back to home ↗</a>
          </div>
        </div>

      </div>
    </>
  );
}
