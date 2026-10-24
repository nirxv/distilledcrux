'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * A yes-or-no question in the site's own modal, in place of window.confirm(),
 * which looked like a browser error and could not say which button was the
 * destructive one.
 *
 *   if (!(await confirmDialog({ title: 'Remove all highlights?', tone: 'danger' }))) return;
 *
 * The one <ConfirmHost /> in the root layout draws it.
 */

export type ConfirmOptions = {
  title: string;
  text?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'default';
};

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

const EVENT = 'dc-confirm';

export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  return new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: { ...opts, resolve } }));
  });
}

export default function ConfirmHost() {
  const [pending, setPending] = useState<Pending | null>(null);
  const pendingRef = useRef<Pending | null>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { pendingRef.current = pending; });

  const answer = (ok: boolean) => {
    pendingRef.current?.resolve(ok);
    pendingRef.current = null;
    setPending(null);
  };

  useEffect(() => {
    const onAsk = (e: Event) => {
      // A second question while one is open answers the first with no.
      pendingRef.current?.resolve(false);
      const detail = (e as CustomEvent<Pending>).detail;
      pendingRef.current = detail;
      setPending(detail);
    };
    window.addEventListener(EVENT, onAsk);
    return () => window.removeEventListener(EVENT, onAsk);
  }, []);

  useEffect(() => {
    if (!pending) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') answer(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!pending) return null;

  const danger = pending.tone === 'danger';
  return (
    <div className="ds ds-overlay" onClick={() => answer(false)}>
      <div className="ds-modal ds-modal-sm" role="alertdialog" aria-modal="true" aria-labelledby="cd-title" aria-describedby={pending.text ? 'cd-text' : undefined} onClick={(e) => e.stopPropagation()}>
        <button className="ds-x ds-modal-x" onClick={() => answer(false)} aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
        <span className={`ds-modal-icon${danger ? ' danger' : ''}`} aria-hidden="true">
          {danger
            ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
            : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>}
        </span>
        <h2 id="cd-title" className="ds-modal-title">{pending.title}</h2>
        {pending.text && <p id="cd-text" className="ds-modal-text">{pending.text}</p>}
        <div className="ds-modal-actions">
          <button className="ds-btn ds-btn-line" onClick={() => answer(false)}>{pending.cancelLabel ?? 'Cancel'}</button>
          <button ref={confirmRef} className={`ds-btn ${danger ? 'ds-btn-danger' : 'ds-btn-solid'}`} onClick={() => answer(true)}>{pending.confirmLabel ?? 'Confirm'}</button>
        </div>
      </div>
    </div>
  );
}
