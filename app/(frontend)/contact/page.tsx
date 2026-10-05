'use client';
import { useEffect, useState } from 'react';
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '@/lib/contact';
import { useAuth } from '@/components/AuthProvider';
import Mascot from '@/components/Mascot';

/** Kept in step with TOPICS in app/api/contact/route.ts, which rejects anything else. */
const topics = [
  'Technical Issue',
  'Subscription / Payment',
  'Refund Request',
  'Feature Request',
  'Content Feedback',
  'Other',
];

export default function ContactPage() {
  const { user } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', topic: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [errorText, setErrorText] = useState('');

  // A signed-in reader should not have to type who they are.
  useEffect(() => {
    if (!user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(f => ({ ...f, name: f.name || user.displayName || '', email: f.email || user.email || '' }));
  }, [user]);

  const ready = Boolean(form.name.trim() && form.email.trim() && form.topic && form.message.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setStatus('sending');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        // The route says what was wrong (a bad address, too many messages);
        // the page used to replace that with a generic failure.
        const data = await res.json().catch(() => null);
        setErrorText(data?.error ?? '');
        setStatus('error');
        return;
      }
      setStatus('success');
      setForm(f => ({ ...f, topic: '', message: '' }));
    } catch {
      setErrorText('');
      setStatus('error');
    }
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(f => ({ ...f, [k]: e.target.value }));
    if (status !== 'idle' && status !== 'sending') setStatus('idle');
  };

  return (
    <div className="ct ds">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <header className="ct-hero">
        <div className="ds-container">
          <h1 className="ds-h1 ct-h1">Get in touch</h1>
          <p className="ds-lede ct-lede">A bug, a payment, a refund, or a topic you want covered: write to us and a person reads it. We usually reply within one or two working days.</p>
        </div>
      </header>

      <div className="ds-container ct-grid">
        <section className="ct-card">
          {status === 'success' ? (
            <div className="ct-done">
              <Mascot pose="celebrate" width={110} />
              <h2>Thanks, your message is on its way</h2>
              <p>We’ll reply to {form.email || 'your email'} within one or two working days.</p>
              <button type="button" className="ds-btn ds-btn-line" onClick={() => setStatus('idle')}>Send another message</button>
            </div>
          ) : (
            <form className="ct-form" onSubmit={handleSubmit} noValidate>
              <h2 className="ct-form-title">Send us a message</h2>
              {status === 'error' && (
                <p className="ct-error" role="alert">
                  {errorText || 'Something went wrong.'} You can also email us at <a href={SUPPORT_MAILTO}>{SUPPORT_EMAIL}</a>.
                </p>
              )}
              <div className="ct-row">
                <label className="ct-field">
                  <span className="ct-label">Name</span>
                  <input className="ct-input" autoComplete="name" placeholder="Your name" value={form.name} onChange={set('name')} />
                </label>
                <label className="ct-field">
                  <span className="ct-label">Email</span>
                  <input className="ct-input" type="email" autoComplete="email" placeholder="you@email.com" value={form.email} onChange={set('email')} />
                </label>
              </div>
              <label className="ct-field">
                <span className="ct-label">What is it about?</span>
                <select className="ct-input ct-select" value={form.topic} onChange={set('topic')}>
                  <option value="">Pick a topic</option>
                  {topics.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label className="ct-field">
                <span className="ct-label">Message</span>
                <textarea className="ct-input ct-textarea" placeholder="Tell us what happened, or what you’d like" value={form.message} onChange={set('message')} />
              </label>
              <button type="submit" className="ds-btn ds-btn-solid ct-send" disabled={status === 'sending' || !ready}>
                {status === 'sending' ? 'Sending…' : 'Send message'}
              </button>
            </form>
          )}
        </section>

        <aside className="ct-aside">
          <div className="ct-way">
            <span className="ct-way-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="3" /><path d="m2 7 10 7 10-7" /></svg>
            </span>
            <div>
              <h3>Email</h3>
              <a href={SUPPORT_MAILTO}>{SUPPORT_EMAIL}</a>
              <p>For anything about your account, a payment or a refund.</p>
            </div>
          </div>
          <div className="ct-way">
            <span className="ct-way-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
            </span>
            <div>
              <h3>Telegram</h3>
              <a href="https://t.me/distilledcrux" target="_blank" rel="noopener noreferrer">t.me/distilledcrux</a>
              <p>Updates, discussion and quick questions.</p>
            </div>
          </div>
          <div className="ct-way">
            <span className="ct-way-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" /></svg>
            </span>
            <div>
              <h3>When we’re around</h3>
              <span className="ct-way-value">Monday to Saturday, 10 am to 7 pm IST</span>
              <p>We’re a small team, so thank you for your patience.</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

const CSS = `
.ct { background: var(--bg); min-height: var(--page-min-h); padding-bottom: clamp(48px, 9vh, 96px); }
.ct-hero { padding: clamp(28px, 5vh, 52px) 0 clamp(16px, 3vh, 28px); background: linear-gradient(180deg, color-mix(in srgb, var(--accent-dim) 60%, var(--bg)) 0%, var(--bg) 100%); }
.ct-h1 { font-size: clamp(2rem, 4.4vw, 3rem); margin: 0 0 var(--space-2); }
.ct-lede { max-width: 640px; }
.ct-grid { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: var(--space-6); align-items: start; }
.ct-card { padding: var(--space-6); background: var(--ds-card); border: 1px solid var(--border); border-radius: var(--radius-xl); box-shadow: var(--elev-1); min-width: 0; }
.ct-form { display: flex; flex-direction: column; gap: var(--space-4); }
.ct-form-title { margin: 0; font-size: 1.25rem; font-weight: 800; letter-spacing: -0.01em; }
.ct-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--space-3); }
.ct-field { display: flex; flex-direction: column; gap: 6px; }
.ct-label { font-size: 0.92rem; font-weight: 700; }
.ct-input { width: 100%; box-sizing: border-box; min-height: 46px; padding: 0 var(--space-4); background: var(--bg); border: 1.5px solid var(--border2); border-radius: var(--radius-lg); color: var(--text); font: inherit; font-size: 0.98rem; outline: none; transition: border-color 0.15s, box-shadow 0.15s; }
.ct-input:focus { border-color: color-mix(in srgb, var(--accent) 65%, transparent); box-shadow: 0 0 0 4px var(--accent-glow); }
.ct-input::placeholder { color: var(--text3); }
.ct-select { appearance: none; -webkit-appearance: none; padding-right: 38px; background: var(--bg) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E") no-repeat right 14px center; cursor: pointer; }
.ct-textarea { min-height: 150px; padding: var(--space-3) var(--space-4); resize: vertical; line-height: 1.6; }
.ct-send { align-self: flex-start; min-height: 48px; padding: 0 var(--space-6); }
.ct-send:disabled { opacity: 0.5; cursor: not-allowed; }
.ct-error { margin: 0; padding: var(--space-3) var(--space-4); border-radius: var(--radius-lg); background: var(--danger-wash); color: var(--danger-text); font-size: 0.92rem; line-height: 1.5; }
.ct-error a { color: inherit; font-weight: 700; }
.ct-done { display: flex; flex-direction: column; align-items: center; text-align: center; gap: var(--space-2); padding: var(--space-4) 0; }
.ct-done h2 { margin: var(--space-3) 0 0; font-size: 1.3rem; font-weight: 800; }
.ct-done p { margin: 0 0 var(--space-3); color: var(--text2); }
.ct-aside { display: flex; flex-direction: column; gap: var(--space-3); }
.ct-way { display: flex; gap: var(--space-3); padding: var(--space-4) var(--space-5); background: var(--ds-card); border: 1px solid var(--border); border-radius: var(--radius-xl); }
.ct-way-icon { width: 40px; height: 40px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 12px; background: var(--accent-dim); color: var(--accent-text); }
.ct-way h3 { margin: 0 0 2px; font-size: 0.98rem; font-weight: 800; }
.ct-way a, .ct-way-value { font-weight: 600; color: var(--accent-text); text-decoration: none; overflow-wrap: anywhere; }
.ct-way-value { color: var(--text); }
.ct-way a:hover { text-decoration: underline; text-underline-offset: 3px; }
.ct-way p { margin: 4px 0 0; font-size: 0.88rem; line-height: 1.5; color: var(--text3); }
@media (max-width: 900px) { .ct-grid { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 640px) {
  .ct-card { padding: var(--space-5) var(--space-4); }
  .ct-row { grid-template-columns: minmax(0, 1fr); }
  .ct-send { width: 100%; justify-content: center; }
}
`;
