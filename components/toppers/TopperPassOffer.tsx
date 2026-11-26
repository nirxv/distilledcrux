'use client';
import { useState } from 'react';
import { useLang } from '@/lib/i18n/LangContext';
import Link from '@/components/Link';
import { TOPPER_PASS_RUPEES, TOPPER_SUBJECT_NAME, isTopperSubject } from '@/lib/toppers/meta';
import { labelForSlug } from '@/lib/optionals';
import TopperComing from './TopperComing';
import { buyTopperPass } from './buyPass';

type Props = {
  subject: string;
  /** 'card' inside the viewer's locked box; 'line' in the list's allowance note. */
  look?: 'card' | 'line';
  /** The optional on the reader's profile as a route slug, undefined while unknown. */
  own?: string | null;
};

/**
 * The topper pass on offer: every copy in this optional for a year, ₹999 paid
 * once, with Premium named as the other way in. On a granted payment the page
 * reloads, so every list and viewer reads the new access from the server.
 *
 * Only copies of the optional on the reader's profile open past the free
 * five, so on any other optional's copies this says so instead of selling a
 * pass that would not open them.
 */
export default function TopperPassOffer({ subject, look = 'card', own }: Props) {
  const { L } = useLang();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = isTopperSubject(subject) ? TOPPER_SUBJECT_NAME[subject] : L('this optional', 'यह वैकल्पिक विषय');

  const buy = async () => {
    setError(null);
    setBusy(true);
    try {
      const out = await buyTopperPass(subject);
      if (out === 'login') { window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`); return; }
      if (out === 'done') { setDone(true); setTimeout(() => window.location.reload(), 900); return; }
    } catch (e) {
      setError(e instanceof Error ? e.message : L('Something went wrong. Please try again.', 'कुछ गड़बड़ हुई। कृपया फिर से कोशिश करें।'));
    }
    setBusy(false);
  };

  if (done) return <p className={`tpo tpo-${look} tpo-done`} role="status">{L(`Every ${name} copy is open to you now.`, `अब आप ${name} की सभी प्रतियाँ देख सकते हैं।`)}</p>;

  if (own !== undefined && own !== subject) {
    const mine = labelForSlug(own);
    // Their own optional has no copies yet: say they are coming, not "switch".
    if (mine && !isTopperSubject(own)) return <TopperComing optional={mine} />;
    return (
      <div className={`tpo tpo-${look}`}>
        <p className="tpo-what">
           <strong>{mine ? L(`Your optional is ${mine}`, `आपका वैकल्पिक विषय ${mine} है`) : L('Your optional is not set', 'आपका वैकल्पिक विषय सेट नहीं है')}</strong>
           <span>{L(`Premium and the topper pass open copies for the optional on your profile. Switch to ${name} to open the rest of these.`, `Premium और टॉपर पास से आपकी प्रोफ़ाइल के वैकल्पिक विषय की प्रतियाँ खुलती हैं। बाकी प्रतियाँ खोलने के लिए ${name} पर स्विच करें।`)}</span>
        </p>
        <div className="tpo-acts">
           <Link href="/onboarding?change=1" className="ds-btn ds-btn-line ds-btn-sm">{L('Change optional', 'वैकल्पिक विषय बदलें')}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`tpo tpo-${look}`}>
      <p className="tpo-what">
        <strong>{L(`Every ${name} copy for a year: ₹${TOPPER_PASS_RUPEES}`, `${name} की सभी प्रतियाँ एक साल के लिए: ₹${TOPPER_PASS_RUPEES}`)}</strong>
        <span>{L('Paid once, nothing renews. Premium includes them too.', 'एक बार भुगतान करें, कोई नवीनीकरण नहीं। Premium में ये प्रतियाँ भी शामिल हैं।')}</span>
      </p>
      <div className="tpo-acts">
        <button type="button" className={`ds-btn ds-btn-solid ds-btn-sm${busy ? ' is-loading' : ''}`} onClick={buy} disabled={busy}>
          {busy ? L('Opening payment', 'भुगतान पेज खोला जा रहा है') : L(`Unlock for ₹${TOPPER_PASS_RUPEES}`, `₹${TOPPER_PASS_RUPEES} में अनलॉक करें`)}
        </button>
        <Link href="/pricing" className="tpo-plans">{L('See Premium', 'Premium देखें')}</Link>
      </div>
      {error && <p className="tpo-err" role="alert">{error}</p>}
    </div>
  );
}
