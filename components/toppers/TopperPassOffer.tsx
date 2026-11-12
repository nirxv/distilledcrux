'use client';
import { useState } from 'react';
import Link from 'next/link';
import { TOPPER_PASS_RUPEES, TOPPER_SUBJECT_NAME, isTopperSubject } from '@/lib/toppers/meta';
import { labelForSlug } from '@/lib/optionals';
import { buyTopperPass } from './buyPass';

type Props = {
  subject: string;
  /** 'card' inside the viewer's locked box; 'line' in the list's allowance note. */
  look?: 'card' | 'line';
  /** The optional on the reader's profile as a route slug, undefined while unknown. */
  own?: string | null;
};

/**
 * The topper pass on offer: every copy in this optional for a year, ₹799 paid
 * once, with Premium named as the other way in. On a granted payment the page
 * reloads, so every list and viewer reads the new access from the server.
 *
 * Only copies of the optional on the reader's profile open past the free
 * five, so on any other optional's copies this says so instead of selling a
 * pass that would not open them.
 */
export default function TopperPassOffer({ subject, look = 'card', own }: Props) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = isTopperSubject(subject) ? TOPPER_SUBJECT_NAME[subject] : 'this optional';

  const buy = async () => {
    setError(null);
    setBusy(true);
    try {
      const out = await buyTopperPass(subject);
      if (out === 'login') { window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`); return; }
      if (out === 'done') { setDone(true); setTimeout(() => window.location.reload(), 900); return; }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    }
    setBusy(false);
  };

  if (done) return <p className={`tpo tpo-${look} tpo-done`} role="status">Every {name} copy is open to you now.</p>;

  if (own !== undefined && own !== subject) {
    const mine = labelForSlug(own);
    return (
      <div className={`tpo tpo-${look}`}>
        <p className="tpo-what">
          <strong>{mine ? `Your optional is ${mine}` : 'Your optional is not set'}</strong>
          <span>Premium and the topper pass open copies for the optional on your profile. Switch to {name} to open the rest of these.</span>
        </p>
        <div className="tpo-acts">
          <Link href="/onboarding?change=1" className="ds-btn ds-btn-line ds-btn-sm">Change optional</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`tpo tpo-${look}`}>
      <p className="tpo-what">
        <strong>Every {name} copy for a year: ₹{TOPPER_PASS_RUPEES}</strong>
        <span>Paid once, nothing renews. Premium includes them too.</span>
      </p>
      <div className="tpo-acts">
        <button type="button" className={`ds-btn ds-btn-solid ds-btn-sm${busy ? ' is-loading' : ''}`} onClick={buy} disabled={busy}>
          {busy ? 'Opening payment' : `Unlock for ₹${TOPPER_PASS_RUPEES}`}
        </button>
        <Link href="/pricing" className="tpo-plans">See Premium</Link>
      </div>
      {error && <p className="tpo-err" role="alert">{error}</p>}
    </div>
  );
}
