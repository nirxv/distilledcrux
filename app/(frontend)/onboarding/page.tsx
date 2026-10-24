'use client';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { normalizeIndianMobile } from '@/lib/phone';
import SubjectIcon from '@/components/SubjectIcon';
import OwlLoader from '@/components/OwlLoader';
import { labelForOptional, publishOptional, routeSlugForOptional } from '@/lib/optionals';
import SplitShell from '@/components/onboarding/SplitShell';

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
  const [step, setStep] = useState(0);
  // Whether a number was already on file when the page opened, which decides
  // the steps; what is typed here must not reshape them mid-flow.
  const [phoneOnFile, setPhoneOnFile] = useState(false);

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
          if (data.phone) { setPhone(String(data.phone).replace(/^\+91/, '')); setPhoneOnFile(true); }
          if (data.optional && !data.phone && !isChanging) { setPhoneOnly(true); setStep(1); }
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

  if (loading) return <OwlLoader size="page" label="Getting your profile" />;

  // The flow, one question to a screen. Someone changing their optional who
  // already gave a number answers only the first; someone here only for the
  // number starts on the second, with the first a step back if they want it.
  const steps: ('optional' | 'phone')[] = isChanging && phoneOnFile ? ['optional'] : ['optional', 'phone'];
  const at = Math.min(step, steps.length - 1);
  const screen = steps[at];
  const last = at === steps.length - 1;
  const canNext = screen === 'optional' ? Boolean(selected) : normalizeIndianMobile(phone).ok;

  const paidLabel = labelForOptional(paidFor);
  const leavingPaid = Boolean(paidFor && selected && selected !== paidFor);

  const title = screen === 'phone'
    ? (phoneOnly ? 'Add your mobile number' : 'Your mobile number')
    : isChanging ? 'Change your optional' : 'Which optional are you taking?';
  const lede = screen === 'phone'
    ? (phoneOnly
        ? 'We ask everyone for one now, so we can reach you about new features, materials, offers and discounts. Your optional stays as it is.'
        : 'So we can reach you about new features, materials, offers and discounts.')
    : isChanging
      ? 'Your notes, past questions, chat and evaluations will all switch to the new one.'
      : 'Your notes, past questions, chat and evaluations are all set to it. You can change it later from your profile.';

  return (
    <SplitShell pose={screen === 'phone' ? 'celebrate' : 'reading'} tint={routeSlugForOptional(selected)} steps={steps.length} step={at}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <h1 className="sp-title">{title}</h1>
      <p className="sp-lede">{lede}</p>

      <div className="sp-content">
        {screen === 'optional' ? (
          <>
            <div className="ob-opts" role="radiogroup" aria-label="Optional">
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
            {leavingPaid && paidLabel && (
              <p className="ob-note">
                Your Premium plan is for {paidLabel}, and it stays with {paidLabel}. {labelForOptional(selected)} would be on the free plan. Switching back to {paidLabel} brings Premium back.
              </p>
            )}
          </>
        ) : (
          <>
            <label htmlFor="phone" className="ob-label">Mobile number <i aria-hidden="true">*</i></label>
            <div className={`ob-phone${phoneError ? ' bad' : ''}`}>
              <span>+91</span>
              <input
                id="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                autoFocus
                placeholder="10-digit mobile number"
                value={phone}
                // Ten digits is the whole alphabet of this field, so anything
                // else is dropped as it is typed rather than rejected afterwards.
                maxLength={10}
                onChange={(e) => {
                  setPhone(e.target.value.replace(/\D/g, '').slice(0, 10));
                  if (phoneError) setPhoneError(null);
                }}
                onKeyDown={(e) => { if (e.key === 'Enter' && canNext && !saving) handleContinue(); }}
                aria-invalid={phoneError ? true : undefined}
                aria-describedby={phoneError ? 'phone-error' : 'phone-hint'}
              />
            </div>
            {phoneError ? (
              <p id="phone-error" role="alert" className="ob-hint bad">{phoneError}</p>
            ) : (
              <p id="phone-hint" className="ob-hint">Kept private, and never shared with anyone.</p>
            )}
          </>
        )}
      </div>

      <div className="sp-nav">
        {at > 0 ? (
          <button type="button" className="ds-btn ds-btn-line" onClick={() => setStep(at - 1)}>{ARROW_LEFT}Previous</button>
        ) : isChanging ? (
          <button type="button" className="ds-btn ds-btn-line" onClick={() => router.push(next ?? '/dashboard')}>Keep {labelForOptional(current) ?? 'my optional'}</button>
        ) : null}
        <div className="sp-right">
          {last ? (
            <button type="button" className="ds-btn ds-btn-solid" onClick={handleContinue} disabled={!canNext || saving}>
              {saving ? 'Saving…' : isChanging ? 'Save' : 'Continue'}{!saving && ARROW_RIGHT}
            </button>
          ) : (
            <button type="button" className="ds-btn ds-btn-solid" onClick={() => setStep(at + 1)} disabled={!canNext}>Next{ARROW_RIGHT}</button>
          )}
        </div>
      </div>
    </SplitShell>
  );
}

const ARROW_LEFT = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>;
const ARROW_RIGHT = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;

export default function Onboarding() {
  return (
    <Suspense fallback={<OwlLoader size="page" label="Getting your profile" />}>
      <OnboardingInner />
    </Suspense>
  );
}

const CSS = `
.ob-opts { display: flex; flex-direction: column; gap: var(--space-2); }
/* A choice: icon, name, and a radio at the right, the design's "what brings you" card. */
.ob-opt { position: relative; display: flex; align-items: center; gap: var(--space-3); min-height: 56px; padding: 6px var(--space-4) 6px 6px; border: 1px solid var(--border2); border-radius: var(--radius-md); background: var(--ds-card); color: var(--text); font: inherit; text-align: left; cursor: pointer; box-shadow: var(--shadow-xs); transition: border-color 0.15s, background 0.15s, box-shadow 0.15s; }
.ob-opt::after { content: ''; margin-left: auto; width: 16px; height: 16px; flex-shrink: 0; border-radius: 50%; border: 1.5px solid var(--border3); box-sizing: border-box; transition: border 0.15s; }
.ob-opt:hover { border-color: color-mix(in srgb, var(--t) 50%, transparent); }
.ob-opt.on { border-color: var(--t); background: var(--w); box-shadow: inset 0 0 0 1px var(--t); }
.ob-opt.on::after { border: 5px solid var(--t); }
.ob-opt:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.ob-opt-icon { width: 40px; height: 40px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: var(--radius-md); background: var(--w); color: var(--t); }
.ob-opt.on .ob-opt-icon { background: var(--ds-card); }
.ob-opt-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.ob-opt-label { font-size: 0.94rem; font-weight: 600; line-height: 1.25; }
.ob-opt-now { font-size: 0.76rem; font-weight: 500; color: var(--text3); }
.ob-note { margin: var(--space-4) 0 0; padding: var(--space-3) var(--space-4); border-radius: var(--radius-md); background: var(--warning-wash); font-size: 0.9rem; line-height: 1.55; }
.ob-label { display: block; margin-bottom: 6px; font-size: 0.875rem; font-weight: 500; color: var(--text2); }
.ob-label i { font-style: normal; color: var(--accent-text); }
.ob-phone { display: flex; align-items: stretch; height: 44px; border: 1px solid var(--border2); border-radius: var(--radius-md); background: var(--ds-card); overflow: hidden; box-shadow: var(--shadow-xs); transition: border-color 0.15s, box-shadow 0.15s; }
.ob-phone:focus-within { border-color: color-mix(in srgb, var(--accent) 65%, transparent); box-shadow: 0 0 0 4px var(--accent-glow); }
.ob-phone.bad { border-color: color-mix(in srgb, var(--danger-text) 60%, transparent); }
.ob-phone span { display: flex; align-items: center; padding: 0 var(--space-3); border-right: 1px solid var(--border); background: var(--ds-soft); font-weight: 600; color: var(--text2); font-variant-numeric: tabular-nums; }
.ob-phone input { flex: 1; min-width: 0; padding: 0 var(--space-3); border: none; outline: none; background: none; color: var(--text); font: inherit; font-size: 1rem; letter-spacing: 0.02em; }
.ob-hint { margin: 6px 0 0; font-size: 0.84rem; line-height: 1.45; color: var(--text3); }
.ob-hint.bad { color: var(--danger-text); }
`;
