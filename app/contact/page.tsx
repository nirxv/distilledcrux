'use client';
import { useState } from 'react';
import type { Metadata } from 'next';

const CSS = `
.ct-wrap{min-height:100vh;padding:100px 2rem 5rem;position:relative;overflow:hidden;}
.ct-orb1{position:absolute;border-radius:50%;width:600px;height:600px;background:radial-gradient(circle,rgba(67,97,238,0.11) 0%,transparent 65%);top:-200px;right:-150px;filter:blur(80px);pointer-events:none;z-index:0;}
.ct-orb2{position:absolute;border-radius:50%;width:500px;height:500px;background:radial-gradient(circle,rgba(45,212,191,0.07) 0%,transparent 65%);bottom:100px;left:-100px;filter:blur(80px);pointer-events:none;z-index:0;}
.ct-inner{max-width:900px;margin:0 auto;position:relative;z-index:1;}
.ct-head{text-align:center;margin-bottom:3.5rem;}
.ct-tag{display:inline-block;font-family:var(--font-ui);font-size:0.68rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--accent);margin-bottom:1rem;}
.ct-title{font-family:var(--font-body);font-size:clamp(2rem,4.5vw,3.2rem);font-weight:700;letter-spacing:-0.03em;color:var(--text);line-height:1.1;margin-bottom:1rem;}
.ct-title em{font-style:normal;color:var(--accent);}
.ct-sub{font-family:var(--font-ui);font-size:1rem;color:var(--text2);max-width:480px;margin:0 auto;line-height:1.7;}
.ct-grid{display:grid;grid-template-columns:1fr 1.4fr;gap:2rem;align-items:start;}
.ct-info{display:flex;flex-direction:column;gap:1.25rem;}
.ct-info-card{background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:16px;padding:1.4rem 1.6rem;display:flex;align-items:flex-start;gap:1rem;}
.ct-info-icon{width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.ct-info-label{font-family:var(--font-ui);font-size:0.7rem;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:var(--text3);margin-bottom:0.3rem;}
.ct-info-value{font-family:var(--font-ui);font-size:0.92rem;color:var(--text);font-weight:500;}
.ct-info-value a{color:var(--accent);text-decoration:none;}
.ct-info-value a:hover{text-decoration:underline;}
.ct-info-note{font-family:var(--font-ui);font-size:0.78rem;color:var(--text3);margin-top:0.2rem;line-height:1.5;}
.ct-form-card{background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:20px;padding:2rem;}
.ct-form-title{font-family:var(--font-body);font-size:1.2rem;font-weight:700;color:var(--text);margin-bottom:1.5rem;}
.ct-form{display:flex;flex-direction:column;gap:1.1rem;}
.ct-field{display:flex;flex-direction:column;gap:0.4rem;}
.ct-label{font-family:var(--font-ui);font-size:0.75rem;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:var(--text3);}
.ct-input,.ct-textarea,.ct-select{width:100%;background:var(--bg3);border:1px solid var(--border2);border-radius:10px;padding:0.75rem 1rem;font-family:var(--font-ui);font-size:0.9rem;color:var(--text);outline:none;transition:border-color 0.15s,box-shadow 0.15s;appearance:none;}
.ct-input:focus,.ct-textarea:focus,.ct-select:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(67,97,238,0.15);}
.ct-input::placeholder,.ct-textarea::placeholder{color:var(--text3);}
.ct-textarea{resize:vertical;min-height:130px;line-height:1.6;}
.ct-select option{background:var(--bg3);color:var(--text);}
.ct-btn{padding:0.85rem 2rem;border-radius:10px;font-family:var(--font-ui);font-size:0.9rem;font-weight:600;background:var(--accent);color:#fff;border:none;cursor:pointer;transition:opacity 0.15s,transform 0.15s;align-self:flex-start;}
.ct-btn:hover:not(:disabled){opacity:0.88;transform:translateY(-1px);}
.ct-btn:disabled{opacity:0.5;cursor:not-allowed;}
.ct-success{background:rgba(74,222,128,0.08);border:1px solid rgba(74,222,128,0.25);border-radius:10px;padding:1rem 1.25rem;font-family:var(--font-ui);font-size:0.88rem;color:var(--green);line-height:1.5;}
.ct-error{background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.25);border-radius:10px;padding:1rem 1.25rem;font-family:var(--font-ui);font-size:0.88rem;color:var(--red);line-height:1.5;}
@media(max-width:760px){.ct-grid{grid-template-columns:1fr;}.ct-btn{width:100%;text-align:center;}}
`;

const topics = [
  'Technical Issue',
  'Subscription / Payment',
  'Refund Request',
  'Feature Request',
  'Content Feedback',
  'Other',
];

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', topic: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  const handleSubmit = async () => {
    if (!form.name || !form.email || !form.topic || !form.message) return;
    setStatus('sending');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      setStatus('success');
      setForm({ name: '', email: '', topic: '', message: '' });
    } catch {
      setStatus('error');
    }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="ct-wrap">
        <div className="ct-orb1" />
        <div className="ct-orb2" />
        <div className="ct-inner">

          <div className="ct-head">
            <span className="ct-tag">Contact</span>
            <h1 className="ct-title">Get in <em>Touch</em></h1>
            <p className="ct-sub">Have a question or issue? We typically respond within 1–2 business days.</p>
          </div>

          <div className="ct-grid">
            {/* Left — info cards */}
            <div className="ct-info">
              <div className="ct-info-card">
                <div className="ct-info-icon" style={{ background: 'rgba(67,97,238,0.12)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4361ee" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="3"/><path d="m2 7 10 7 10-7"/>
                  </svg>
                </div>
                <div>
                  <div className="ct-info-label">Email</div>
                  <div className="ct-info-value"><a href="mailto:"></a></div>
                  <div className="ct-info-note">Response within 1–2 business days</div>
                </div>
              </div>

              <div className="ct-info-card">
                <div className="ct-info-icon" style={{ background: 'rgba(45,212,191,0.12)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                  </svg>
                </div>
                <div>
                  <div className="ct-info-label">Telegram Community</div>
                  <div className="ct-info-value"><a href="https://t.me/distilledcrux" target="_blank" rel="noopener noreferrer">t.me/distilledcrux</a></div>
                  <div className="ct-info-note">Join for updates, discussions & quick help</div>
                </div>
              </div>

              <div className="ct-info-card">
                <div className="ct-info-icon" style={{ background: 'rgba(232,184,109,0.12)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e8b86d" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
                  </svg>
                </div>
                <div>
                  <div className="ct-info-label">Support Hours</div>
                  <div className="ct-info-value">Mon – Sat, 10 AM – 7 PM IST</div>
                  <div className="ct-info-note">We're a small team — thanks for your patience</div>
                </div>
              </div>
            </div>

            {/* Right — form */}
            <div className="ct-form-card">
              <div className="ct-form-title">Send us a message</div>

              {status === 'success' && (
                <div className="ct-success" style={{ marginBottom: '1.25rem' }}>
                  ✓ Message sent! We'll get back to you within 1–2 business days.
                </div>
              )}
              {status === 'error' && (
                <div className="ct-error" style={{ marginBottom: '1.25rem' }}>
                  Something went wrong. Please email us directly instead.
                </div>
              )}

              <div className="ct-form">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="ct-field">
                    <label className="ct-label">Name</label>
                    <input className="ct-input" placeholder="Your name" value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="ct-field">
                    <label className="ct-label">Email</label>
                    <input className="ct-input" type="email" placeholder="you@email.com" value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                  </div>
                </div>

                <div className="ct-field">
                  <label className="ct-label">Topic</label>
                  <select className="ct-select" value={form.topic}
                    onChange={e => setForm(f => ({ ...f, topic: e.target.value }))}>
                    <option value="">Select a topic…</option>
                    {topics.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div className="ct-field">
                  <label className="ct-label">Message</label>
                  <textarea className="ct-textarea" placeholder="Describe your issue or question…" value={form.message}
                    onChange={e => setForm(f => ({ ...f, message: e.target.value }))} />
                </div>

                <button className="ct-btn" onClick={handleSubmit}
                  disabled={status === 'sending' || !form.name || !form.email || !form.topic || !form.message}>
                  {status === 'sending' ? 'Sending…' : 'Send Message →'}
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
