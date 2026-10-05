'use client';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { normalizeIndianMobile } from '@/lib/phone';
import SubjectIcon from '@/components/SubjectIcon';
import OwlLoader from '@/components/OwlLoader';
import { labelForOptional, publishOptional, routeSlugForOptional } from '@/lib/optionals';

const optionals = [
  { id: 'sociology',             label: 'Sociology' },
  { id: 'anthropology',          label: 'Anthropology' },
  { id: 'geography',             label: 'Geography' },
  { id: 'political-science',     label: 'PSIR' },
  { id: 'public-administration', label: 'Public Administration' },
];

function OnboardingInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isChanging = searchParams.get('change') === '1';
  // Where the reader was headed before sign-in sent them here. Only a path on
  // this origin; anything else goes to the dashboard.
  const rawNext = searchParams.get('next');
  const next = rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : null;

  const [user, setUser] = useState<User | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  // True when the reader already has an optional and is here only because
  // their profile predates the number being asked for. The card says so
  // rather than telling someone who chose months ago to choose again.
  const [phoneOnly, setPhoneOnly] = useState(false);
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  // The optional a live plan was bought for, if any. A plan stays with it.
  const [paidFor, setPaidFor] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.push('/login?next=/onboarding');
        return;
      }
      setUser(firebaseUser);

      // Check if already onboarded (skip if coming from "Change optional")
      try {
        const token = await firebaseUser.getIdToken();
        const [res, sub] = await Promise.all([
          fetch('/api/user-profile', { headers: { 'x-user-token': token } }),
          fetch('/api/sub-status', { headers: { 'x-user-token': token } }).then(r => r.json()).catch(() => null),
        ]);
        if (sub?.active && sub.optional) setPaidFor(sub.optional);
        if (res.ok) {
          const data = await res.json();
          // A profile only counts as done when it has both. Readers who
          // onboarded before the number was asked for have an optional and no
          // phone, and they are sent through here again rather than waved past,
          // which is what makes the field mandatory rather than merely new.
          if (data.optional && data.phone && !isChanging) {
            router.push(next ?? '/dashboard');
            return;
          }
          if (data.optional) { setSelected(data.optional); setCurrent(data.optional); }
          if (data.phone) setPhone(String(data.phone).replace(/^\+91/, ''));
          if (data.optional && !data.phone && !isChanging) setPhoneOnly(true);
        }
      } catch (err) {
        // Fall through to the picker rather than hanging on the spinner.
        console.error('Profile lookup failed:', err);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router, isChanging, next]);

  const handleContinue = async () => {
    if (!selected || !user) return;

    // Same rules the route applies, so nobody is told their number is fine and
    // then refused by the server.
    const number = normalizeIndianMobile(phone);
    if (!number.ok) {
      setPhoneError(number.error);
      return;
    }
    setPhoneError(null);

    setSaving(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/user-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-token': token,
        },
        body: JSON.stringify({ optional: selected, phone: number.phone }),
      });
      if (res.ok) {
        // So the navbar rebuilds around the new optional now, rather than on
        // the reader's next full page load.
        publishOptional(selected);
        router.push(next ?? '/dashboard');
      } else {
        const data = await res.json().catch(() => null);
        setPhoneError(data?.error ?? 'Could not save. Please try again.');
        setSaving(false);
      }
    } catch {
      setPhoneError('Could not save. Please check your connection.');
      setSaving(false);
    }
  };

  // Both are required, so the button reflects both rather than just the picker.
  const ready = Boolean(selected) && normalizeIndianMobile(phone).ok;

  if (loading) return <OwlLoader size="page" label="Getting your profile" />;

  const title = phoneOnly ? 'Add your mobile number' : isChanging ? 'Change your optional' : 'Which optional are you taking?';
  const lede = phoneOnly
    ? 'We ask everyone for one now, so we can reach you about new features, materials, offers and discounts. Your optional stays as it is.'
    : isChanging
      ? 'Your notes, past questions, chat and evaluations will all switch to the new one.'
      : 'Your notes, past questions, chat and evaluations are all set to it. You can change it later from your dashboard.';
  const paidLabel = labelForOptional(paidFor);
  const leavingPaid = Boolean(paidFor && selected && selected !== paidFor);

  return (
    <div className="ob ds">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="ob-card">
        <div className="ob-intro">
          <h1 className="ob-title">{title}</h1>
          <p className="ob-lede">{lede}</p>
          {leavingPaid && paidLabel && (
            <p className="ob-note">
              Your Premium plan is for {paidLabel}, and it stays with {paidLabel}. {labelForOptional(selected)} would be on the free plan; switching back to {paidLabel} brings Premium back.
            </p>
          )}
        </div>

        <div className="ob-form">
        {phoneOnly && <p className="ob-sub">Your optional, if you want to change it while you’re here:</p>}
        <div className={`ob-opts${phoneOnly ? ' quiet' : ''}`} role="radiogroup" aria-label="Optional">
          {optionals.map((opt) => {
            const on = selected === opt.id;
            const slug = routeSlugForOptional(opt.id);
            return (
              <button key={opt.id} type="button" role="radio" aria-checked={on}
                onClick={() => setSelected(opt.id)}
                className={`ob-opt${on ? ' on' : ''}`}
                style={slug ? { ['--t' as string]: `var(--tint-${slug})`, ['--w' as string]: `var(--wash-${slug})` } : undefined}>
                <span className="ob-opt-icon"><SubjectIcon id={opt.id} size={20} /></span>
                <span className="ob-opt-text">
                  <span className="ob-opt-label">{opt.label}</span>
                  {isChanging && current === opt.id && <span className="ob-opt-now">Current</span>}
                </span>
              </button>
            );
          })}
        </div>

        <label htmlFor="phone" className="ob-label">Mobile number</label>
        <div className={`ob-phone${phoneError ? ' bad' : ''}`}>
          <span>+91</span>
          <input
            id="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="10-digit mobile number"
            value={phone}
            // Ten digits is the whole alphabet of this field, so anything
            // else is dropped as it is typed rather than rejected afterwards.
            maxLength={10}
            onChange={(e) => {
              setPhone(e.target.value.replace(/\D/g, '').slice(0, 10));
              if (phoneError) setPhoneError(null);
            }}
            aria-invalid={phoneError ? true : undefined}
            aria-describedby={phoneError ? 'phone-error' : 'phone-hint'}
          />
        </div>
        {phoneError ? (
          <p id="phone-error" role="alert" className="ob-hint bad">{phoneError}</p>
        ) : (
          <p id="phone-hint" className="ob-hint">So we can reach you about new features, materials, offers and discounts.</p>
        )}

        <div className="ob-actions">
          <button type="button" className="ds-btn ds-btn-solid ob-go" onClick={handleContinue} disabled={!ready || saving}>
            {saving ? 'Saving…' : isChanging ? 'Save' : 'Continue'}
          </button>
          {isChanging && (
            <button type="button" className="ds-btn ds-btn-line ob-cancel" onClick={() => router.push(next ?? '/dashboard')}>
              Keep {labelForOptional(current) ?? 'my optional'}
            </button>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}

export default function Onboarding() {
  return (
    <Suspense fallback={<OwlLoader size="page" label="Getting your profile" />}>
      <OnboardingInner />
    </Suspense>
  );
}

const CSS = `
.ob { min-height: var(--page-min-h); display: flex; align-items: center; justify-content: center; padding: clamp(16px, 4vh, 48px) var(--space-4); background: radial-gradient(ellipse at 50% 0%, color-mix(in srgb, var(--accent-dim) 80%, transparent) 0%, transparent 60%), var(--bg); }
/* Landscape: the words on the left, the choices on the right, so the whole
   card fits a laptop screen without scrolling. Phones stack it. */
.ob-card { width: 100%; max-width: 1000px; display: grid; grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr); gap: var(--space-8); align-items: center; padding: var(--space-6) var(--space-8); background: var(--ds-card); border: 1px solid var(--border); border-radius: var(--radius-xl); box-shadow: var(--elev-2); }
.ob-title { margin: 0 0 var(--space-3); font-size: clamp(1.6rem, 3vw, 2.1rem); font-weight: 800; letter-spacing: -0.02em; line-height: 1.15; }
.ob-lede { margin: 0; color: var(--text2); line-height: 1.6; }
.ob-sub { margin: 0 0 var(--space-2); font-size: 0.9rem; color: var(--text3); }
.ob-opts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-2); margin-bottom: var(--space-4); }
.ob-opts.quiet { opacity: 0.85; }
.ob-opt { position: relative; display: flex; align-items: center; gap: var(--space-3); min-height: 52px; padding: 6px var(--space-3) 6px 6px; border: 1.5px solid var(--border2); border-radius: var(--radius-lg); background: var(--bg); color: var(--text); font: inherit; text-align: left; cursor: pointer; transition: border-color 0.15s, background 0.15s; }
.ob-opt:hover { border-color: color-mix(in srgb, var(--t) 50%, transparent); }
.ob-opt.on { border-color: var(--t); background: var(--w); }
.ob-opt:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.ob-opt-icon { width: 38px; height: 38px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 10px; background: var(--w); color: var(--t); }
.ob-opt.on .ob-opt-icon { background: var(--ds-card); }
.ob-opt-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.ob-opt-label { font-size: 0.94rem; font-weight: 700; line-height: 1.25; }
.ob-opt.on .ob-opt-label { color: var(--t); }
.ob-opt-now { font-size: 0.74rem; font-weight: 500; color: var(--text3); }
.ob-note { margin: var(--space-4) 0 0; padding: var(--space-3) var(--space-4); border-radius: var(--radius-lg); background: var(--warning-wash); font-size: 0.92rem; line-height: 1.55; }
.ob-label { display: block; margin-bottom: var(--space-2); font-size: 0.92rem; font-weight: 700; }
.ob-phone { display: flex; align-items: stretch; height: 48px; border: 1.5px solid var(--border2); border-radius: var(--radius-full); background: var(--bg); overflow: hidden; transition: border-color 0.15s, box-shadow 0.15s; }
.ob-phone:focus-within { border-color: color-mix(in srgb, var(--accent) 65%, transparent); box-shadow: 0 0 0 4px var(--accent-glow); }
.ob-phone.bad { border-color: color-mix(in srgb, var(--danger-text) 60%, transparent); }
.ob-phone span { display: flex; align-items: center; padding: 0 var(--space-3) 0 var(--space-4); border-right: 1px solid var(--border); font-weight: 600; color: var(--text2); font-variant-numeric: tabular-nums; }
.ob-phone input { flex: 1; min-width: 0; padding: 0 var(--space-4); border: none; outline: none; background: none; color: var(--text); font: inherit; font-size: 1rem; letter-spacing: 0.02em; }
.ob-hint { margin: 6px 0 0; font-size: 0.84rem; line-height: 1.45; color: var(--text3); }
.ob-hint.bad { color: var(--danger-text); }
.ob-actions { display: flex; gap: var(--space-2); margin-top: var(--space-5); }
.ob-go { flex: 1; justify-content: center; min-height: 48px; font-size: 1rem; }
.ob-go:disabled { opacity: 0.5; cursor: not-allowed; }
.ob-cancel { min-height: 48px; flex-shrink: 0; }
@media (max-width: 860px) {
  .ob-card { grid-template-columns: minmax(0, 1fr); gap: var(--space-5); max-width: 600px; padding: var(--space-6); }
}
@media (max-width: 640px) {
  .ob-card { padding: var(--space-5) var(--space-4); }
  .ob-opt:last-child { grid-column: 1 / -1; }
  .ob-opt { gap: var(--space-2); padding: 5px var(--space-2) 5px 5px; }
  .ob-opt-icon { width: 32px; height: 32px; border-radius: 9px; }
  .ob-opt-label { font-size: 0.88rem; }
  .ob-actions { flex-direction: column; }
  .ob-cancel { width: 100%; justify-content: center; }
}
`;
