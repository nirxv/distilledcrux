'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { auth, signInWithGoogle } from '@/lib/firebase';
import { OPTIONAL_KEY } from '@/lib/optionals';
import { useLang } from '@/lib/i18n/LangContext';

/**
 * Asks a signed-in reader for a review and suggestions, with their name,
 * attempt and designation (app/api/review, supabase/migrations/015_reviews.sql).
 * The optional they are on goes with it. A line under the form tells them
 * the review may be shown on the site.
 *
 * When it opens by itself: a signed-in reader whose account is ACCOUNT_DAYS
 * old and who keeps coming back (the server's `ready`: page views across
 * their browsers, and a latest visit days after the first), AFTER_MS into a
 * visit, never on a page where they are mid-task, and never on top of another
 * dialog. "Not now" waits LATER_DAYS; a sent review stops it for good, on
 * every device (the server is asked before it opens). Once a session.
 *
 * Any link with ?review=1 opens it straight away, so a review can be asked
 * for from Telegram or WhatsApp, and so does OPEN_EVENT (the footer's "Write a
 * review"). A signed-out reader is asked to sign in first, and the form opens
 * after, also when sign-in goes through a full-page redirect.
 */

/** Fired by the footer's "Write a review" link (and anything else) to open the form. */
export const OPEN_EVENT = 'open-review';
/** Set for the session once the review pop-up opens; the weekly check-up stays away then. */
export const SHOWN_KEY = 'dc_review_shown';
/** Set while a reader who asked for the form signs in, in case sign-in reloads the page. */
const AFTER_LOGIN_KEY = 'dc_review_after_login';
const SENT_KEY = 'dc_review_sent';
const LATER_KEY = 'dc_review_later';
const ACCOUNT_DAYS = 7;
const AFTER_MS = 3 * 60 * 1000;
const RETRY_MS = 60 * 1000;
const LATER_DAYS = 21;
const MIN_WORDS = 5;
/** Pages where a reader is in the middle of something, signing in, or being sold to. */
const BUSY = ['/test', '/evaluate', '/prelims', '/geography/mapping', '/pricing', '/subscribe', '/login', '/signup', '/signout', '/onboarding'];

const ATTEMPTS: { id: string; label: string; labelHi: string }[] = [
  { id: '1', label: '1st', labelHi: 'पहला' },
  { id: '2', label: '2nd', labelHi: 'दूसरा' },
  { id: '3', label: '3rd', labelHi: 'तीसरा' },
  { id: '4', label: '4th', labelHi: 'चौथा' },
  { id: '5+', label: '5th or more', labelHi: 'पाँचवाँ या उससे अधिक' },
  { id: 'none', label: 'Not a candidate', labelHi: 'अभ्यर्थी नहीं' },
];

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} },
};
const session = {
  get: (k: string) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { sessionStorage.setItem(k, v); } catch {} },
  drop: (k: string) => { try { sessionStorage.removeItem(k); } catch {} },
};

/** The form's heading icon: a speech bubble with a heart. */
const Icon = () => (
  <span className="rv-icon" aria-hidden="true">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12Z" /><path d="M12 15.5s-3.2-1.9-3.2-4a1.8 1.8 0 0 1 3.2-1.1 1.8 1.8 0 0 1 3.2 1.1c0 2.1-3.2 4-3.2 4Z" /></svg>
  </span>
);
/** The dialog's close button. */
const Close = ({ onClick, label }: { onClick: () => void; label: string }) => (
  <button type="button" className="ds-x rv-x" onClick={onClick} aria-label={label}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
  </button>
);

export default function ReviewPrompt() {
  const { L } = useLang();
  const { user, loading } = useAuth();
  const path = usePathname();
  const pathRef = useRef(path);
  useEffect(() => { pathRef.current = path; }, [path]);

  const [open, setOpen] = useState(false);
  const [askLogin, setAskLogin] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [forced, setForced] = useState(false);
  const [step, setStep] = useState<'form' | 'done'>('form');
  const [review, setReview] = useState('');
  const [suggestions, setSuggestions] = useState('');
  const [name, setName] = useState('');
  const [attempt, setAttempt] = useState('');
  const [about, setAbout] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const sent = useRef(false);

  const show = useCallback(() => {
    session.set(SHOWN_KEY, '1');
    session.drop(AFTER_LOGIN_KEY);
    setAskLogin(false);
    setOpen(true);
  }, []);

  // ?review=1, or a sign-in that reloaded the page, opens it now.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('review');
    const again = session.get(AFTER_LOGIN_KEY) === '1';
    session.drop(AFTER_LOGIN_KEY);
    // Reads the URL and sessionStorage, which only exist in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (q === '1' || again) setForced(true);
    // Local only, to look at the form without signing in. Dropped from builds.
    else if (process.env.NODE_ENV === 'development' && q === 'preview') show();
  }, [show]);
  useEffect(() => {
    if (!forced || loading) return;
    // Follows the auth state: opens the form once a reader is signed in.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (user) show(); else setAskLogin(true);
  }, [forced, loading, user, show]);

  // Asked for by the reader, from the footer: a fresh form, whatever happened before.
  useEffect(() => {
    const onOpen = () => {
      sent.current = false;
      setStep('form');
      setError('');
      if (auth.currentUser) { show(); return; }
      setForced(true);
      setAskLogin(true);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, [show]);

  // The automatic ask.
  useEffect(() => {
    if (forced || loading || !user) return;
    if (store.get(SENT_KEY) || session.get(SHOWN_KEY)) return;
    const created = Date.parse(user.metadata.creationTime ?? '');
    if (!created || Date.now() - created < ACCOUNT_DAYS * 864e5) return;
    const later = Number(store.get(LATER_KEY) || 0);
    if (later && Date.now() - later < LATER_DAYS * 864e5) return;

    let timer = 0;
    let stopped = false;
    const tryShow = async () => {
      if (stopped) return;
      const busy = BUSY.some((p) => pathRef.current?.startsWith(p)) || document.querySelector('[role="dialog"], [aria-modal="true"]') || document.hidden;
      if (busy) { timer = window.setTimeout(tryShow, RETRY_MS); return; }
      try {
        const res = await fetch('/api/review', { headers: { 'x-user-token': await user.getIdToken() } });
        if (!res.ok) return;
        const { done, ready } = await res.json();
        if (done) { store.set(SENT_KEY, '1'); return; }
        // Not coming back enough yet: asked again in a later visit.
        if (!ready) return;
      } catch { return; }
      if (!stopped) show();
    };
    timer = window.setTimeout(tryShow, AFTER_MS);
    return () => { stopped = true; window.clearTimeout(timer); };
  }, [forced, loading, user, show]);

  // A signed-in reader's name is filled in for them.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open && user?.displayName) setName((n) => n || user.displayName || '');
  }, [open, user]);

  const later = useCallback(() => {
    if (step === 'form' && !forced) store.set(LATER_KEY, String(Date.now()));
    setOpen(false);
    setForced(false);
  }, [step, forced]);

  const closeLogin = useCallback(() => {
    setAskLogin(false);
    setForced(false);
    session.drop(AFTER_LOGIN_KEY);
  }, []);

  useEffect(() => {
    if (!open && !askLogin) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') (open ? later : closeLogin)(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, askLogin, later, closeLogin]);

  const signIn = async () => {
    setSigningIn(true);
    session.set(AFTER_LOGIN_KEY, '1');
    try {
      // A popup sign-in brings the user to useAuth, and the effect above opens
      // the form; a redirect reloads the page, and AFTER_LOGIN_KEY does.
      await signInWithGoogle();
    } catch {
      session.drop(AFTER_LOGIN_KEY);
    } finally {
      setSigningIn(false);
    }
  };

  const enough = words(review) >= MIN_WORDS || words(suggestions) >= MIN_WORDS;
  const ready = enough && name.trim().length > 0 && !sending;

  const submit = async () => {
    if (!user || !ready || sent.current) return;
    sent.current = true;
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-token': await user.getIdToken() },
        body: JSON.stringify({ review, suggestions, name, attempt: attempt || null, about, optional: store.get(OPTIONAL_KEY), page: window.location.pathname }),
      });
      if (!res.ok) throw new Error(String(res.status));
      store.set(SENT_KEY, '1');
      setStep('done');
      window.setTimeout(() => { setOpen(false); setForced(false); }, 3500);
    } catch (e) {
      sent.current = false;
      setError((e as Error).message === '429' ? L('Too many submissions. Please wait a moment.', 'बहुत ज़्यादा सबमिशन हो गए हैं। कृपया थोड़ी देर बाद कोशिश करें।') : L('That didn’t send. Please try again.', 'यह भेजा नहीं जा सका। कृपया फिर से कोशिश करें।'));
    } finally {
      setSending(false);
    }
  };

  if (askLogin && !user) {
    return (
      <div className="ds ds-overlay rv-overlay">
        <style dangerouslySetInnerHTML={{ __html: RV_CSS }} />
        <div className="ds-modal rv rv-sm" role="dialog" aria-modal="true" aria-labelledby="rv-title">
          <div className="rv-top">
            <Icon />
            <div className="rv-head">
              <span className="rv-eyebrow">{L('Your review', 'आपकी समीक्षा')}</span>
              <h2 id="rv-title">{L('Sign in to write a review', 'समीक्षा लिखने के लिए साइन इन करें')}</h2>
              <p>{L('It takes one tap, and your review is saved to your account.', 'बस एक टैप में आपकी समीक्षा आपके खाते में सेव हो जाएगी।')}</p>
            </div>
            <Close onClick={closeLogin} label={L('Close', 'बंद करें')} />
          </div>
          <div className="rv-actions">
            <button type="button" className="ds-btn ds-btn-ghost" onClick={closeLogin}>{L('Not now', 'अभी नहीं')}</button>
            <button type="button" className="ds-btn rv-send" onClick={signIn} disabled={signingIn}>{signingIn ? L('Signing in…', 'साइन इन हो रहा है…') : L('Continue with Google', 'Google के साथ जारी रखें')}</button>
          </div>
        </div>
      </div>
    );
  }
  if (!open) return null;

  return (
    <div className="ds ds-overlay rv-overlay">
      <style dangerouslySetInnerHTML={{ __html: RV_CSS }} />
      <div className="ds-modal rv" role="dialog" aria-modal="true" aria-labelledby="rv-title">
        {step === 'form' ? (<>
          <div className="rv-top">
            <Icon />
            <div className="rv-head">
              <span className="rv-eyebrow">{L('Your review', 'आपकी समीक्षा')}</span>
              <h2 id="rv-title">{L('How is Distilled Crux working for you?', 'Distilled Crux आपके लिए कैसा काम कर रहा है?')}</h2>
              <p>{L('A few lines from you help other aspirants decide, and tell us what to build next.', 'आपकी कुछ पंक्तियाँ दूसरे अभ्यर्थियों को निर्णय लेने में मदद करती हैं और हमें बताती हैं कि आगे क्या बनाना चाहिए।')}</p>
            </div>
            <Close onClick={later} label={L('Not now', 'अभी नहीं')} />
          </div>

          <label className="rv-label" htmlFor="rv-review">{L('What has it changed in your preparation?', 'इसने आपकी तैयारी में क्या बदलाव किया है?')}</label>
          <textarea id="rv-review" className="rv-input rv-text" rows={4} value={review} onChange={(e) => setReview(e.target.value)}
            placeholder={L('The notes, answer checking, topper copies, the AI… whatever helped you most.', 'नोट्स, उत्तर जाँच, टॉपर की कॉपियाँ, AI… जो भी आपके सबसे ज़्यादा काम आया।')} />

          <label className="rv-label" htmlFor="rv-sugg">{L('Suggestions', 'सुझाव')} <span className="rv-opt">{L('optional', 'वैकल्पिक')}</span></label>
          <textarea id="rv-sugg" className="rv-input rv-text" rows={3} value={suggestions} onChange={(e) => setSuggestions(e.target.value)}
            placeholder={L('What should we add, change or fix?', 'हमें क्या जोड़ना, बदलना या ठीक करना चाहिए?')} />

          <label className="rv-label" htmlFor="rv-name">{L('Your name', 'आपका नाम')}</label>
          <input id="rv-name" className="rv-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" />

          <span className="rv-label" id="rv-attempt-label">{L('Which UPSC attempt is this?', 'UPSC का आपका कौन-सा प्रयास है?')}</span>
          <div className="rv-chips" role="radiogroup" aria-labelledby="rv-attempt-label">
            {ATTEMPTS.map((a) => (
              <button key={a.id} type="button" role="radio" aria-checked={attempt === a.id} className={`rv-chip${attempt === a.id ? ' on' : ''}`}
                onClick={() => setAttempt((x) => (x === a.id ? '' : a.id))}>{L(a.label, a.labelHi)}</button>
            ))}
          </div>

          <label className="rv-label" htmlFor="rv-about">{L('Designation or what you do', 'पद या आप क्या करते हैं')} <span className="rv-opt">{L('optional', 'वैकल्पिक')}</span></label>
          <input id="rv-about" className="rv-input" value={about} onChange={(e) => setAbout(e.target.value)} maxLength={120}
            placeholder={L('e.g. Student, Working professional', 'जैसे: विद्यार्थी, नौकरीपेशा पेशेवर')} />

          <p className="rv-note">{L('Your review may be shown on Distilled Crux with your name, attempt and designation.', 'आपकी समीक्षा Distilled Crux पर आपके नाम, प्रयास और पद के साथ दिखाई जा सकती है।')}</p>

          {error && <p className="rv-error" role="alert">{error}</p>}
          {!enough && (review || suggestions) && <p className="rv-hint">{L(`A few more words, at least ${MIN_WORDS} in one box.`, `कुछ और शब्द लिखें—कम-से-कम एक बॉक्स में ${MIN_WORDS} शब्द।`)}</p>}

          <div className="rv-actions">
            <button type="button" className="ds-btn ds-btn-ghost" onClick={later}>{L('Not now', 'अभी नहीं')}</button>
            <button type="button" className="ds-btn rv-send" onClick={submit} disabled={!ready}>{sending ? L('Sending…', 'भेजा जा रहा है…') : L('Send', 'भेजें')}</button>
          </div>
        </>) : (
          <div className="rv-done">
            <span className="rv-icon big" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            </span>
            <h2 id="rv-title">{L('Thank you!', 'धन्यवाद!')}</h2>
            <p>{L('We read every review and suggestion.', 'हम हर समीक्षा और सुझाव पढ़ते हैं।')}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* The colours are the optionals' own tints (globals.css): Sociology's indigo,
   PSIR's coral and History's gold, as on History Optional's review form. */
const RV_CSS = `
.rv-overlay { z-index: 9999; }
.rv { --c1: var(--tint-sociology); --c2: var(--tint-polsci); --c3: var(--tint-history);
  max-width: 520px; padding: 0; overflow-x: hidden; border: 2px solid transparent;
  background: linear-gradient(var(--ds-card), var(--ds-card)) padding-box, linear-gradient(120deg, var(--c1), var(--c2), var(--c3)) border-box;
  box-shadow: 0 30px 80px -30px color-mix(in srgb, var(--c1) 70%, transparent), 0 20px 60px -30px color-mix(in srgb, var(--c2) 60%, transparent); }
.rv-sm { max-width: 440px; }
.rv > * { margin-left: var(--space-6); margin-right: var(--space-6); }
.rv-top { position: relative; display: flex; gap: var(--space-4); align-items: flex-start; margin: 0 0 var(--space-5); padding: var(--space-6) var(--space-6) var(--space-5);
  background: radial-gradient(80% 120% at 0% 0%, color-mix(in srgb, var(--c1) 22%, transparent), transparent 70%), radial-gradient(70% 120% at 100% 0%, color-mix(in srgb, var(--c2) 20%, transparent), transparent 70%);
  border-bottom: 1px solid var(--border); }
.rv-icon { width: 48px; height: 48px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: var(--radius-circle); color: var(--bg);
  background: linear-gradient(135deg, var(--c1), var(--c2)); box-shadow: 0 8px 24px -8px color-mix(in srgb, var(--c2) 70%, transparent); }
.rv-icon.big { width: 60px; height: 60px; }
.rv-head { flex: 1; min-width: 0; padding-right: var(--space-6); }
.rv-eyebrow { display: inline-block; margin-bottom: 4px; font-family: var(--font-ui); font-size: 0.72rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase;
  background: linear-gradient(100deg, var(--c1), var(--c2)); -webkit-background-clip: text; background-clip: text; color: transparent; }
.rv-head h2 { margin: 0; font-size: 1.22rem; line-height: 1.3; font-weight: 800; letter-spacing: -0.015em; color: var(--text); }
.rv-head p { margin: 6px 0 0; font-size: 0.88rem; line-height: 1.5; color: var(--text2); }
.rv-x { position: absolute; top: var(--space-4); right: var(--space-4); }
.rv-label { display: block; margin-top: var(--space-4); margin-bottom: 6px; font-size: 0.9rem; font-weight: 700; color: var(--text); }
.rv-top + .rv-label { margin-top: 0; }
.rv-opt { margin-left: 4px; font-family: var(--font-ui); font-size: 0.74rem; font-weight: 500; color: var(--text3); }
.rv-input { display: block; width: calc(100% - 2 * var(--space-6)); box-sizing: border-box; padding: 10px var(--space-3); border: 1.5px solid var(--border2); border-radius: var(--radius-lg); background: var(--bg); color: var(--text); font: inherit; font-size: 0.95rem; line-height: 1.5; outline: none; }
.rv-text { resize: vertical; min-height: 84px; }
.rv-input:focus { border-color: color-mix(in srgb, var(--c1) 70%, transparent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--c1) 22%, transparent); }
.rv-input::placeholder { color: var(--text3); }
.rv-chips { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.rv-chip { padding: 8px 14px; border: 1.5px solid var(--border2); border-radius: var(--radius-full); background: var(--bg); color: var(--text2); font: inherit; font-family: var(--font-ui); font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: border-color 0.15s, background 0.15s; }
.rv-chip:hover { border-color: color-mix(in srgb, var(--c1) 60%, transparent); }
.rv-chip.on { border-color: transparent; color: var(--bg); background: linear-gradient(120deg, var(--c1), var(--c2)); }
.rv-chip:focus-visible { outline: 2px solid var(--c1); outline-offset: 2px; }
.rv-note { margin-top: var(--space-5); margin-bottom: 0; font-size: 0.8rem; line-height: 1.5; color: var(--text3); }
.rv-error { margin: var(--space-3) var(--space-6) 0; font-size: 0.86rem; color: var(--danger-text); }
.rv-hint { margin: var(--space-3) var(--space-6) 0; font-size: 0.82rem; color: var(--text3); }
.rv-actions { display: flex; gap: var(--space-2); margin-top: var(--space-5); margin-bottom: var(--space-6); }
.rv-actions .ds-btn { flex: 1; justify-content: center; }
.rv-send { border: none; color: var(--bg); background: linear-gradient(120deg, var(--c1), var(--c2) 60%, var(--c3)); box-shadow: 0 10px 26px -12px color-mix(in srgb, var(--c2) 80%, transparent); }
.rv-send:hover:not(:disabled) { filter: brightness(1.06); }
.rv-send:disabled { opacity: 0.45; cursor: not-allowed; box-shadow: none; }
.rv-done { display: flex; flex-direction: column; align-items: center; gap: var(--space-2); padding: var(--space-8) 0; text-align: center; }
.rv-done h2 { margin: var(--space-2) 0 0; font-size: 1.4rem; font-weight: 800; background: linear-gradient(100deg, var(--c1), var(--c2), var(--c3)); -webkit-background-clip: text; background-clip: text; color: transparent; }
.rv-done p { margin: 0; font-size: 0.92rem; color: var(--text2); }
@media (max-width: 640px) {
  .rv > * { margin-left: var(--space-4); margin-right: var(--space-4); }
  .rv-top { margin: 0 0 var(--space-4); padding: var(--space-5) var(--space-4) var(--space-4); }
  .rv-input { width: calc(100% - 2 * var(--space-4)); }
  .rv-icon { width: 40px; height: 40px; }
  .rv-head h2 { font-size: 1.08rem; }
  .rv-actions { flex-direction: column-reverse; }
}
`;
