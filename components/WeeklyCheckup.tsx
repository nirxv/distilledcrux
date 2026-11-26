'use client';
import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { SHOWN_KEY as REVIEW_SHOWN } from '@/components/ReviewPrompt';
import { useLang } from '@/lib/i18n/LangContext';

/**
 * Once a week, fifteen minutes into a visit, asks whether everything works,
 * and lets a reader say which part does not. Ported from History Optional's
 * check-up; answers land in contact_submissions with the topic
 * "Weekly check-up" (app/api/contact/route.ts).
 *
 * It stays away from a session where the review pop-up has already opened,
 * and from pages where a reader is in the middle of something. ?checkup=1
 * on any page opens it straight away.
 */
const FEATURES = [
  { en: 'Answer checking', enHi: 'उत्तर जाँचना' },
  { en: 'Reading my handwriting', enHi: 'मेरी लिखावट पढ़ना' },
  { en: 'AI chat', enHi: 'AI चैट' },
  { en: 'Notes', enHi: 'नोट्स' },
  { en: 'PYQs', enHi: 'PYQs' },
  { en: 'Topper copies', enHi: 'टॉपर की कॉपियाँ' },
  { en: 'Flashcards', enHi: 'फ्लैशकार्ड' },
  { en: 'Test series', enHi: 'टेस्ट सीरीज़' },
  { en: 'Prelims practice', enHi: 'प्रारंभिक परीक्षा का अभ्यास' },
  { en: 'Geography map practice', enHi: 'भूगोल के नक्शे का अभ्यास' },
];
const MIN_WORDS = 10;
const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;
const AFTER_MS = 15 * 60 * 1000;
const LAST_KEY = 'dc_weekly_checkup_last';
const DISMISSED_KEY = 'dc_weekly_checkup_dismissed';
/** Same list as the review pop-up: a test, an evaluation, signing in or paying. */
const BUSY = ['/test', '/evaluate', '/prelims', '/geography/mapping', '/pricing', '/subscribe', '/login', '/signup', '/signout', '/onboarding'];

const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} },
};

function send(message: string, keepalive = false) {
  return fetch('/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'weekly_checkup', message }),
    keepalive,
  });
}

export default function WeeklyCheckup() {
  const { L } = useLang();
  const pathname = usePathname() ?? '';
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<'ask' | 'issues' | 'done'>('ask');
  const [selected, setSelected] = useState<string[]>([]);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  /**
   * Re-entry guard. State cannot do this job on its own: two clicks landing in
   * the same React batch both read the old value and both pass the check, so
   * the flag has to be one a second call sees immediately. On History
   * Optional a quarter of the "all good" rows were duplicates before this.
   */
  const sent = useRef(false);
  const path = useRef(pathname);
  path.current = pathname;

  useEffect(() => {
    // ?checkup=1 opens it at once, for checking how it looks.
    if (new URLSearchParams(window.location.search).get('checkup') === '1') { setVisible(true); return; }
    const now = Date.now();
    const last = Number(store.get(LAST_KEY) || 0);
    const dismissed = Number(store.get(DISMISSED_KEY) || 0);
    if (now - last < ONE_WEEK || now - dismissed < ONE_WEEK) return;
    const timer = setTimeout(() => {
      let reviewOpen = false;
      try { reviewOpen = Boolean(sessionStorage.getItem(REVIEW_SHOWN)); } catch {}
      // One pop-up a visit, and never on top of a test or a checkout.
      if (reviewOpen || BUSY.some((p) => path.current.startsWith(p))) return;
      setVisible(true);
    }, AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    store.set(DISMISSED_KEY, Date.now().toString());
    setVisible(false);
  };

  const finish = () => {
    store.set(LAST_KEY, Date.now().toString());
    setStep('done');
    setTimeout(() => setVisible(false), 2000);
  };

  /**
   * Acknowledged at once and sent in the background: it is one bit of
   * telemetry, not worth a spinner, and losing one costs less than putting an
   * error in the reader's way.
   */
  const allGood = () => {
    if (sent.current) return;
    sent.current = true;
    finish();
    void send(`All features working fine.\nPage: ${pathname}`, true).catch(() => {});
  };

  const submitIssues = async () => {
    if (sent.current || submitting) return;
    sent.current = true;
    setSubmitting(true);
    await send(`Issues reported:\nFeatures: ${selected.join(', ')}\nDetails: ${details.trim()}\nPage: ${pathname}`).catch(() => {});
    setSubmitting(false);
    finish();
  };

  const toggle = (f: string) => setSelected((p) => (p.includes(f) ? p.filter((x) => x !== f) : [...p, f]));

  if (!visible) return null;
  const words = details.trim().split(/\s+/).filter(Boolean).length;
  const canSend = selected.length > 0 && words >= MIN_WORDS && !submitting;
  const left = MIN_WORDS - words;

  return (
    <div className="ds ds-overlay wc-overlay">
      <style dangerouslySetInnerHTML={{ __html: WC_CSS }} />
      <div className="ds-modal wc" role="dialog" aria-modal="true" aria-labelledby="wc-title">
        {step === 'ask' && (<>
          <div className="ds-modal-head">
            <div>
              <h2 id="wc-title">{L('Is everything working for you?', 'क्या आपके लिए सब कुछ ठीक से काम कर रहा है?')}</h2>
              <p>{L('We ask once a week. It helps us catch problems before they spread.', 'हम हफ़्ते में एक बार पूछते हैं। इससे समस्याएँ बढ़ने से पहले हमें उनका पता चल जाता है।')}</p>
            </div>
            <button type="button" className="ds-x" onClick={dismiss} aria-label={L('Ask me later', 'मुझसे बाद में पूछें')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </div>
          <div className="wc-actions">
            <button type="button" className="ds-btn ds-btn-solid" onClick={allGood}>{L('Yes, all good', 'हाँ, सब ठीक है')}</button>
            <button type="button" className="ds-btn ds-btn-line" onClick={() => setStep('issues')}>{L('Something’s not right', 'कुछ ठीक नहीं है')}</button>
          </div>
          <button type="button" className="wc-later" onClick={dismiss}>{L('Ask me later', 'मुझसे बाद में पूछें')}</button>
        </>)}

        {step === 'issues' && (<>
          <div className="ds-modal-head">
            <div>
              <h2 id="wc-title">{L('What’s not working?', 'क्या ठीक से काम नहीं कर रहा है?')}</h2>
              <p>{L('Pick the parts that gave you trouble, then tell us what happened.', 'जिन चीज़ों में आपको परेशानी हुई, उन्हें चुनें और फिर बताएँ कि क्या हुआ।')}</p>
            </div>
          </div>
          <div className="wc-features" role="group" aria-label={L('Parts of the site', 'साइट के हिस्से')}>
            {FEATURES.map((f) => (
              <button key={f.en} type="button" aria-pressed={selected.includes(f.en)} className={`wc-feature${selected.includes(f.en) ? ' on' : ''}`} onClick={() => toggle(f.en)}>{L(f.en, f.enHi)}</button>
            ))}
          </div>
          <label className="wc-label" htmlFor="wc-details">{L('What happened?', 'क्या हुआ?')}</label>
          <textarea id="wc-details" className="wc-text" placeholder={L('A few lines on what you saw and where.', 'आपने क्या और कहाँ देखा, इसके बारे में कुछ पंक्तियाँ लिखें।')} value={details} onChange={(e) => setDetails(e.target.value)} rows={4} />
          <div className={`wc-count${words >= MIN_WORDS ? ' ok' : ''}`}>{words >= MIN_WORDS ? L('That’s enough to go on', 'आगे बढ़ने के लिए इतना काफ़ी है') : L(`${left} more ${left === 1 ? 'word' : 'words'} at least`, `कम-से-कम ${left} और शब्द लिखें`)}</div>
          <div className="wc-actions">
            <button type="button" className="ds-btn ds-btn-ghost" onClick={() => { setStep('ask'); setSelected([]); setDetails(''); }}>{L('Back', 'वापस')}</button>
            <button type="button" className="ds-btn ds-btn-solid" onClick={submitIssues} disabled={!canSend}>{submitting ? L('Sending…', 'भेजा जा रहा है…') : L('Send', 'भेजें')}</button>
          </div>
        </>)}

        {step === 'done' && (
          <div className="wc-done">
            <span className="wc-mark" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            </span>
            <h2 id="wc-title">{L('Thanks, that helps', 'धन्यवाद, इससे मदद मिलेगी')}</h2>
          </div>
        )}
      </div>
    </div>
  );
}

const WC_CSS = `
.wc-overlay { z-index: 9999; }
.wc { max-width: 460px; }
.wc-actions { display: flex; gap: var(--space-2); }
.wc-actions .ds-btn { flex: 1; justify-content: center; }
.wc-actions .ds-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.wc-later { display: block; margin: var(--space-3) auto 0; padding: 6px 4px; background: none; border: none; color: var(--text2); font: inherit; font-size: 0.88rem; cursor: pointer; }
.wc-later:hover { color: var(--accent-text); }
.wc-features { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-bottom: var(--space-4); }
.wc-feature { padding: 7px 14px; border: 1.5px solid var(--border2); border-radius: var(--radius-full); background: var(--ds-card); color: var(--text2); font: inherit; font-size: 0.88rem; font-weight: 600; cursor: pointer; }
.wc-feature:hover { border-color: color-mix(in srgb, var(--accent) 45%, transparent); }
.wc-feature.on { border-color: var(--accent); background: var(--accent-dim); color: var(--accent-text); }
.wc-label { display: block; margin-bottom: 6px; font-size: 0.9rem; font-weight: 700; }
.wc-text { width: 100%; box-sizing: border-box; padding: var(--space-3); border: 1.5px solid var(--border2); border-radius: var(--radius-lg); background: var(--ds-card); color: var(--text); font: inherit; font-size: 16px; line-height: 1.55; resize: vertical; outline: none; }
.wc-text:focus { border-color: color-mix(in srgb, var(--accent) 60%, transparent); box-shadow: 0 0 0 3px var(--accent-glow); }
.wc-count { margin: 6px 0 var(--space-4); font-size: 0.82rem; color: var(--text3); text-align: right; }
.wc-count.ok { color: var(--success-text); }
.wc-done { display: flex; flex-direction: column; align-items: center; gap: var(--space-3); padding: var(--space-4) 0; text-align: center; }
.wc-done h2 { margin: 0; font-size: 1.2rem; font-weight: 800; }
.wc-mark { width: 52px; height: 52px; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; background: var(--success-wash); color: var(--success-text); }
@media (max-width: 480px) {
  .wc-actions { flex-direction: column; }
}
`;
