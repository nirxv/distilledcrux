'use client';
import { useState } from 'react';
import { auth } from '@/lib/firebase';
import { toast } from '@/components/ui/Toast';

/**
 * Publishes this answer check as a card at /s/<id>: the question, the marks
 * and a few lines of feedback, never the answer. `token` is the signed card
 * /api/evaluate returned. The phone's share sheet opens where there is one,
 * otherwise the link is copied. Once shared, it can be copied again or taken
 * down.
 */
export default function ShareButton({ token, marks, outOf, subject }: {
  token: string; marks: number; outOf: number; subject: string;
}) {
  const [shared, setShared] = useState<{ id: string; url: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const call = async (method: 'POST' | 'DELETE', body: object) => {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) throw new Error('Sign in to share.');
    const res = await fetch('/api/share', {
      method, headers: { 'Content-Type': 'application/json', 'x-user-token': idToken }, body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? 'That did not go through. Try again.');
    return data as { shareId?: string; url?: string };
  };

  const copy = async (link: string) => {
    try { await navigator.clipboard.writeText(link); toast('Link copied'); }
    catch { toast(link); }
  };

  const share = async () => {
    setBusy(true);
    try {
      let link = shared?.url;
      if (!link) {
        const d = await call('POST', { token });
        link = d.url!;
        setShared({ id: d.shareId!, url: link });
      }
      const text = `I scored ${marks}/${outOf} on a UPSC ${subject} answer. Get yours checked:`;
      if (navigator.share) {
        try { await navigator.share({ title: 'Distilled Crux', text, url: link }); }
        catch (e) { if ((e as Error).name !== 'AbortError') await copy(link); }
      } else await copy(link);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally { setBusy(false); }
  };

  const stop = async () => {
    if (!shared) return;
    setBusy(true);
    try { await call('DELETE', { shareId: shared.id }); setShared(null); toast('Sharing stopped. The link no longer opens.'); }
    catch (e) { toast((e as Error).message, 'error'); }
    finally { setBusy(false); }
  };

  return (
    <div className="ev-share">
      <button type="button" className="ds-btn ds-btn-line" onClick={share} disabled={busy}>Share your score</button>
      {shared && (
        <p className="ev-share-note">
          Shows the question, marks and feedback, not your answer.{' '}
          <button type="button" className="ev-share-link" onClick={() => copy(shared.url)} disabled={busy}>Copy link</button>
          {' · '}
          <button type="button" className="ev-share-link" onClick={stop} disabled={busy}>Stop sharing</button>
        </p>
      )}
    </div>
  );
}
