'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth, signInWithGoogle } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import { OPTIONALS, labelForOptional, publishOptional, routeSlugForOptional, type OptionalId } from '@/lib/optionals';
import { PLANS } from '@/lib/plans';
import { normalizeIndianMobile } from '@/lib/phone';
import SubjectIcon from '@/components/SubjectIcon';
import Mascot from '@/components/Mascot';
import { toast, toastSignInError } from '@/components/ui/Toast';

/**
 * Profile and settings on one page: who the reader is, their optional, the
 * number we reach them on, the plan, and the site's own settings. Before, the
 * optional could only be changed by going back through onboarding, and the
 * number not at all.
 *
 * The optional and the number are saved together, as the profile route has
 * always required. The theme applies as soon as it is picked.
 */

type Sub = { plan: string; optional: string | null; daysLeft: number } | null;

const Icon = {
  back: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>,
  google: <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-7.9z" /><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z" /><path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.1a11 11 0 0 0 0 9.9z" /><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z" /></svg>,
};

export default function ProfileSettings() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [saved, setSaved] = useState<{ optional: string | null; phone: string }>({ optional: null, phone: '' });
  const [optional, setOptional] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [profileReady, setProfileReady] = useState(false);
  const [saving, setSaving] = useState<'optional' | 'phone' | null>(null);
  const [sub, setSub] = useState<Sub | undefined>(undefined);
  const [dark, setDark] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setDark(document.documentElement.getAttribute('data-theme') === 'dark');
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const token = await user.getIdToken();
      const [prof, status] = await Promise.all([
        fetch('/api/user-profile', { headers: { 'x-user-token': token } }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch('/api/sub-status', { headers: { 'x-user-token': token } }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);
      if (cancelled) return;
      const number = prof?.phone ? String(prof.phone).replace(/^\+91/, '') : '';
      setSaved({ optional: prof?.optional ?? null, phone: number });
      setOptional(prof?.optional ?? null);
      setPhone(number);
      setSub(status?.active ? { plan: status.plan, optional: status.optional ?? null, daysLeft: Math.max(0, Math.ceil((new Date(status.expiresAt).getTime() - Date.now()) / 86400000)) } : null);
      setProfileReady(true);
    })();
    return () => { cancelled = true; };
  }, [user]);

  // The route takes both, so each save sends the other as it stands.
  const save = async (what: 'optional' | 'phone') => {
    if (!user) return;
    const nextOptional = what === 'optional' ? optional : saved.optional;
    const number = normalizeIndianMobile(what === 'phone' ? phone : saved.phone);
    if (!nextOptional) { toast('Pick your optional first.', 'error'); return; }
    if (!number.ok) {
      if (what === 'phone') setPhoneError(number.error);
      else toast('Add your mobile number below first.', 'error');
      return;
    }
    setPhoneError(null);
    setSaving(what);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/user-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-token': token },
        body: JSON.stringify({ optional: nextOptional, phone: number.phone }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast(data?.error ?? 'Could not save. Try again in a moment.', 'error');
        return;
      }
      const plain = number.phone.replace(/^\+91/, '');
      setSaved({ optional: nextOptional, phone: plain });
      setPhone(plain);
      if (what === 'optional') {
        publishOptional(nextOptional);
        toast(`Your optional is now ${labelForOptional(nextOptional)}`);
      } else {
        toast('Your number is saved');
      }
    } catch {
      toast('Could not save. Check your connection.', 'error');
    } finally {
      setSaving(null);
    }
  };

  const pickTheme = (d: boolean) => {
    const t = d ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('theme', t); } catch { /* for this visit only */ }
    setDark(d);
  };

  const handleSignIn = async () => {
    setSigningIn(true);
    try { await signInWithGoogle(); }
    catch (err) { toastSignInError(err); }
    finally { setSigningIn(false); }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    router.push('/');
  };

  if (loading) return <div className="pf ds"><style dangerouslySetInnerHTML={{ __html: PF_CSS }} /><div className="pf-wrap" /></div>;

  if (!user) {
    return (
      <div className="pf ds">
        <style dangerouslySetInnerHTML={{ __html: PF_CSS }} />
        <div className="pf-wrap pf-signin">
          <Mascot pose="peek" width={120} />
          <h1>Sign in to continue</h1>
          <p>Your profile and settings are kept on your account.</p>
          <button type="button" className="pf-google" onClick={handleSignIn} disabled={signingIn}>
            {Icon.google}{signingIn ? 'Opening Google…' : 'Sign in with Google'}
          </button>
        </div>
      </div>
    );
  }

  const name = user.displayName || 'UPSC aspirant';
  const savedLabel = labelForOptional(saved.optional);
  const paidLabel = labelForOptional(sub?.optional);
  const leavingPaid = Boolean(sub?.optional && optional && optional !== sub.optional);
  const planLabel = sub ? (PLANS[sub.plan as keyof typeof PLANS]?.label ?? sub.plan) : null;
  const planDays = sub?.daysLeft ?? 0;
  const initial = (user.displayName?.[0] ?? user.email?.[0] ?? '?').toUpperCase();

  return (
    <div className="pf ds">
      <style dangerouslySetInnerHTML={{ __html: PF_CSS }} />
      <div className="pf-wrap">
        <div className="pf-top">
          <Link href="/dashboard" className="pf-back" aria-label="Back to your dashboard">{Icon.back}</Link>
          <h1>Profile and settings</h1>
        </div>

        <header className="pf-who">
          <span className="pf-avatar">
            {user.photoURL
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={user.photoURL} alt="" width={64} height={64} referrerPolicy="no-referrer" />
              : initial}
          </span>
          <div className="pf-who-text">
            <strong>{name}</strong>
            <span>{savedLabel ? `${savedLabel} optional · ${user.email}` : user.email}</span>
          </div>
          <span className={`pf-plan${sub ? ' premium' : ''}`}>{sub ? `${planLabel}` : 'Free plan'}</span>
        </header>

        <section className="pf-sec">
          <div className="pf-sec-head">
            <h2>Your optional</h2>
            <p>Your notes, past questions, chat and evaluations are all set to it.</p>
          </div>
          <div className="pf-opts" role="radiogroup" aria-label="Optional">
            {(Object.keys(OPTIONALS) as OptionalId[]).map((id) => {
              const on = optional === id;
              const slug = routeSlugForOptional(id);
              return (
                <button key={id} type="button" role="radio" aria-checked={on} className={`pf-opt${on ? ' on' : ''}`}
                  disabled={!profileReady}
                  onClick={() => setOptional(id)}
                  style={{ ['--t' as string]: `var(--tint-${slug})`, ['--w' as string]: `var(--wash-${slug})` }}>
                  <span className="pf-opt-icon"><SubjectIcon id={id} size={20} /></span>
                  <span className="pf-opt-text">
                    <strong>{OPTIONALS[id].label}</strong>
                    {saved.optional === id && <span>Current</span>}
                  </span>
                </button>
              );
            })}
          </div>
          {leavingPaid && paidLabel && (
            <p className="pf-note">Your Premium plan is for {paidLabel}, and it stays with {paidLabel}. {labelForOptional(optional)} would be on the free plan. Switching back to {paidLabel} brings Premium back.</p>
          )}
          <div className="pf-save-row">
            {optional !== saved.optional && <button type="button" className="ds-btn ds-btn-line pf-btn" onClick={() => setOptional(saved.optional)}>Keep {savedLabel ?? 'it'}</button>}
            <button type="button" className="ds-btn ds-btn-solid pf-btn" onClick={() => save('optional')} disabled={optional === saved.optional || saving !== null}>
              {saving === 'optional' ? 'Saving…' : 'Save'}
            </button>
          </div>
        </section>

        <section className="pf-sec">
          <div className="pf-sec-head">
            <h2>Your account</h2>
            <p>How you sign in, the number we reach you on, and your plan.</p>
          </div>
          <div className="pf-rows">
            <div className="pf-row">
              <div><strong>Email</strong><span>{user.email}</span></div>
            </div>
            <div className="pf-row">
              <div style={{ flex: 1 }}>
                <strong>Mobile number</strong>
                <span>So we can reach you about new features, materials, offers and discounts.</span>
                <div className="pf-phone-row">
                  <div className="pf-phone">
                    <span>+91</span>
                    <input type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={10} placeholder="10-digit mobile number"
                      value={phone} disabled={!profileReady} aria-label="Mobile number" aria-invalid={phoneError ? true : undefined}
                      onChange={(e) => { setPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); if (phoneError) setPhoneError(null); }} />
                  </div>
                  {phone !== saved.phone && (
                    <button type="button" className="ds-btn ds-btn-solid pf-btn" onClick={() => save('phone')} disabled={saving !== null}>
                      {saving === 'phone' ? 'Saving…' : 'Save number'}
                    </button>
                  )}
                </div>
                {phoneError && <p className="pf-err" role="alert">{phoneError}</p>}
              </div>
            </div>
            <div className="pf-row">
              <div>
                <strong>Plan</strong>
                <span>
                  {sub === undefined ? 'Loading…'
                    : sub ? `${planLabel} for ${paidLabel ?? 'your optional'}, ${planDays} day${planDays === 1 ? '' : 's'} left`
                      : 'Free plan'}
                </span>
              </div>
              <Link href="/pricing" className={`ds-btn pf-btn ${sub ? 'ds-btn-line' : 'ds-btn-premium'}`}>{sub ? 'See plans' : 'Upgrade'}</Link>
            </div>
          </div>
        </section>

        <section className="pf-sec">
          <div className="pf-sec-head">
            <h2>Settings</h2>
            <p>These apply straight away, on this device.</p>
          </div>
          <div className="pf-rows">
            <div className="pf-row">
              <div><strong>Theme</strong><span>Paper or dark</span></div>
              <div className="pf-seg" role="radiogroup" aria-label="Theme">
                <button type="button" role="radio" aria-checked={!dark} className={!dark ? 'on' : ''} onClick={() => pickTheme(false)}>Light</button>
                <button type="button" role="radio" aria-checked={dark} className={dark ? 'on' : ''} onClick={() => pickTheme(true)}>Dark</button>
              </div>
            </div>
            <div className="pf-row">
              <div><strong>Sign out</strong><span>Your notes and progress stay on your account.</span></div>
              <button type="button" className="ds-btn ds-btn-line pf-btn pf-danger" onClick={handleSignOut}>Sign out</button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

const PF_CSS = `
.pf { min-height: calc(100dvh - 60px); background: var(--bg); }
.pf-wrap { max-width: 760px; margin: 0 auto; padding: var(--space-6) var(--space-6) var(--space-12); }
.pf-top { display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-6); }
.pf-top h1 { margin: 0; font-size: 1.125rem; font-weight: 700; letter-spacing: -0.01em; }
.pf-back {
  width: 36px; height: 36px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
  border: 1px solid var(--border2); border-radius: var(--radius-md); color: var(--text2); background: var(--ds-card);
  box-shadow: var(--shadow-xs);
}
.pf-back:hover { color: var(--accent-text); border-color: color-mix(in srgb, var(--accent) 45%, transparent); }

.pf-who {
  display: flex; align-items: center; gap: var(--space-4);
  padding: var(--space-5); background: var(--ds-soft); border: 1px solid var(--border); border-radius: var(--radius-2xl);
}
.pf-avatar { width: 64px; height: 64px; flex-shrink: 0; border-radius: 50%; overflow: hidden; display: inline-flex; align-items: center; justify-content: center; background: var(--accent-dim); color: var(--accent-text); font-size: 1.5rem; font-weight: 700; }
.pf-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
.pf-who-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.pf-who-text strong { font-size: 1.125rem; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pf-who-text span { font-size: 0.875rem; color: var(--text2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pf-plan {
  flex-shrink: 0; padding: 2px var(--space-3); border-radius: var(--radius-full);
  border: 1px solid var(--border2); background: var(--ds-card); font-size: 0.78rem; font-weight: 600; color: var(--text2);
}
.pf-plan.premium { background: var(--premium-wash); color: var(--premium-text); border-color: color-mix(in srgb, var(--premium-text) 35%, transparent); }

.pf-banner {
  position: relative; display: flex; align-items: flex-start; gap: var(--space-3);
  margin-top: var(--space-4); padding: var(--space-4) 52px var(--space-4) var(--space-4);
  border: 1px solid var(--border); border-radius: var(--radius-2xl); background: var(--ds-card);
}
.pf-banner.accent { background: var(--accent-wash); border-color: color-mix(in srgb, var(--accent) 25%, transparent); }
.pf-banner-icon { color: var(--accent-text); display: inline-flex; flex-shrink: 0; margin-top: 1px; }
.pf-banner div { display: flex; flex-direction: column; gap: 2px; }
.pf-banner strong { font-size: 0.875rem; font-weight: 600; }
.pf-banner span { font-size: 0.875rem; color: var(--text2); }
.pf-banner-x {
  position: absolute; top: 8px; right: 8px; width: 36px; height: 36px; display: inline-flex; align-items: center; justify-content: center;
  border: none; background: none; border-radius: var(--radius-md); color: var(--text3); cursor: pointer;
}
.pf-banner-x:hover { color: var(--text); background: color-mix(in srgb, var(--text) 6%, transparent); }

.pf-sec { padding: var(--space-8) 0 0; }
.pf-sec + .pf-sec { margin-top: var(--space-8); border-top: 1px solid var(--border); }
.pf-sec-head { margin-bottom: var(--space-5); }
.pf-sec-head h2 { margin: 0; font-size: 1rem; font-weight: 700; }
.pf-sec-head p { margin: 2px 0 0; font-size: 0.875rem; color: var(--text2); }

.pf-grid { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: var(--space-4); }
.pf-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: var(--space-4); }
.pf-grid .pf-field { margin-bottom: var(--space-4); }
.pf-label { font-size: 0.875rem; font-weight: 500; color: var(--text2); }
.pf-input {
  width: 100%; box-sizing: border-box; min-height: 44px; padding: 0 var(--space-3);
  background: var(--ds-card); color: var(--text); border: 1px solid var(--border2); border-radius: var(--radius-md);
  box-shadow: var(--shadow-xs); font-size: 1rem; outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.pf-input:focus { border-color: color-mix(in srgb, var(--accent) 65%, transparent); box-shadow: 0 0 0 4px var(--accent-glow); }
.pf-input::placeholder { color: var(--text3); }
.pf-pills { display: flex; flex-wrap: wrap; gap: var(--space-2); }
/* A radio pill: the dot inside it, as in the onboarding and profile designs. */
.pf-pill {
  display: inline-flex; align-items: center; gap: var(--space-2);
  min-height: 36px; padding: 0 var(--space-3) 0 var(--space-2-5);
  background: var(--ds-card); color: var(--text); border: 1px solid var(--border2); border-radius: var(--radius-md);
  font-size: 0.875rem; font-weight: 500; cursor: pointer; transition: border-color 0.15s, background 0.15s;
}
.pf-pill::before { content: ''; width: 16px; height: 16px; border-radius: 50%; border: 1.5px solid var(--border3); box-sizing: border-box; transition: border 0.15s; }
.pf-pill:hover { border-color: color-mix(in srgb, var(--accent) 45%, transparent); }
.pf-pill.on { border-color: var(--accent); background: var(--accent-dim); color: var(--accent-text); }
.pf-pill.on::before { border: 5px solid var(--accent); }
.pf-save-row { display: flex; justify-content: flex-end; gap: var(--space-3); margin-top: var(--space-2); }
.pf-btn { border-radius: var(--radius-md); min-height: 40px; font-size: 0.875rem; flex-shrink: 0; }

.pf-rows { display: flex; flex-direction: column; }
.pf-row { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); padding: var(--space-4) 0; }
.pf-row + .pf-row { border-top: 1px solid var(--border); }
.pf-row > div:first-child { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.pf-row strong { font-size: 0.875rem; font-weight: 600; }
.pf-row span { font-size: 0.875rem; color: var(--text2); overflow-wrap: anywhere; }
.pf-danger { color: var(--danger-text); }
.pf-danger:hover { color: var(--danger-text); border-color: color-mix(in srgb, var(--danger-text) 45%, transparent); }
.pf-seg { display: inline-flex; flex-shrink: 0; padding: var(--space-1); gap: var(--space-0-5); background: var(--ds-soft); border: 1px solid var(--border); border-radius: var(--radius-md); }
.pf-seg button {
  min-height: 34px; padding: 0 var(--space-3); border: 1px solid transparent; border-radius: var(--radius-sm);
  background: none; color: var(--text2); font-size: 0.86rem; font-weight: 600; cursor: pointer;
}
.pf-seg button.on { background: var(--ds-card); color: var(--text); border-color: var(--border2); box-shadow: var(--shadow-xs); }

.pf-opts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-2); }
.pf-opt { position: relative; display: flex; align-items: center; gap: var(--space-3); min-height: 56px; padding: 6px var(--space-4) 6px 6px; border: 1px solid var(--border2); border-radius: var(--radius-md); background: var(--ds-card); color: var(--text); font: inherit; text-align: left; cursor: pointer; box-shadow: var(--shadow-xs); transition: border-color 0.15s, background 0.15s; }
.pf-opt::after { content: ''; margin-left: auto; width: 16px; height: 16px; flex-shrink: 0; border-radius: 50%; border: 1.5px solid var(--border3); box-sizing: border-box; transition: border 0.15s; }
.pf-opt:hover { border-color: color-mix(in srgb, var(--t) 50%, transparent); }
.pf-opt.on { border-color: var(--t); background: var(--w); box-shadow: inset 0 0 0 1px var(--t); }
.pf-opt.on::after { border: 5px solid var(--t); }
.pf-opt-icon { width: 40px; height: 40px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: var(--radius-md); background: var(--w); color: var(--t); }
.pf-opt.on .pf-opt-icon { background: var(--ds-card); }
.pf-opt-text { display: flex; flex-direction: column; min-width: 0; }
.pf-opt-text strong { font-size: 0.9rem; font-weight: 600; }
.pf-opt-text span { font-size: 0.76rem; color: var(--text3); }
.pf-note { margin: var(--space-3) 0 0; padding: var(--space-3) var(--space-4); border-radius: var(--radius-md); background: var(--warning-wash); font-size: 0.875rem; line-height: 1.5; }
.pf-phone { display: flex; align-items: stretch; height: 44px; width: min(320px, 100%); border: 1px solid var(--border2); border-radius: var(--radius-md); background: var(--ds-card); overflow: hidden; box-shadow: var(--shadow-xs); }
.pf-phone:focus-within { border-color: color-mix(in srgb, var(--accent) 65%, transparent); box-shadow: 0 0 0 4px var(--accent-glow); }
.pf-phone span { display: flex; align-items: center; padding: 0 var(--space-3); border-right: 1px solid var(--border); font-weight: 600; color: var(--text2); background: var(--ds-soft); }
.pf-phone input { flex: 1; min-width: 0; padding: 0 var(--space-3); border: none; outline: none; background: none; color: var(--text); font: inherit; font-size: 1rem; letter-spacing: 0.02em; }
.pf-phone-row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); margin-top: var(--space-2); }
.pf-err { margin: 6px 0 0; font-size: 0.84rem; color: var(--danger-text); }
.pf-signin { display: flex; flex-direction: column; align-items: center; text-align: center; padding-top: clamp(40px, 12vh, 120px); }
.pf-signin h1 { margin: var(--space-4) 0 var(--space-2); font-size: 1.875rem; font-weight: 700; letter-spacing: -0.02em; }
.pf-signin p { margin: 0 0 var(--space-6); color: var(--text2); font-size: 1rem; max-width: 380px; }
.pf-google {
  display: inline-flex; align-items: center; justify-content: center; gap: var(--space-3);
  width: min(360px, 100%); min-height: 44px; padding: 0 var(--space-4);
  background: var(--ds-card); color: var(--text); border: 1px solid var(--border2); border-radius: var(--radius-md);
  box-shadow: var(--shadow-xs); font-size: 0.95rem; font-weight: 600; cursor: pointer;
}
.pf-google:hover { border-color: color-mix(in srgb, var(--accent) 45%, transparent); }
.pf-google:disabled { opacity: 0.6; cursor: wait; }

@media (max-width: 640px) {
  .pf-opts { grid-template-columns: minmax(0, 1fr); }
  .pf-wrap { padding: var(--space-4) var(--space-4) var(--space-10); }
  .pf-who { padding: var(--space-4); flex-wrap: wrap; }
  .pf-grid { grid-template-columns: minmax(0, 1fr); gap: 0; }
  .pf-save-row { flex-direction: column-reverse; }
  .pf-save-row .pf-btn { width: 100%; min-height: 44px; }
  .pf-row { flex-wrap: wrap; }
  .pf-sec { padding-top: var(--space-6); }
  .pf-sec + .pf-sec { margin-top: var(--space-6); }
}
`;
