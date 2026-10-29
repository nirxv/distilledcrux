'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Short notices at the top of the window: a profile saved, a sign-in that
 * failed, a PDF that could not be made. They replace the browser's alert(),
 * which froze the page and looked like a different site.
 *
 * Anything can raise one with toast('...'), with no provider to thread through;
 * the one <Toaster /> in the root layout listens for the event and draws it.
 */

export type ToastKind = 'success' | 'error';

type Item = { id: number; message: string; kind: ToastKind };

const EVENT = 'dc-toast';
const SHOW_MS = 4500;
const MAX_SHOWN = 3;

export function toast(message: string, kind: ToastKind = 'success') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { message, kind } }));
}

/** Sign-in errors that are not failures: the reader shut the popup, or the in-app browser notice is already explaining. */
const QUIET_SIGN_IN = new Set(['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled', 'auth/in-app-browser']);

export function toastSignInError(err: unknown, langHi = false) {
  const code = (err as { code?: string } | null)?.code ?? '';
  if (QUIET_SIGN_IN.has(code)) return;
  toast(langHi ? 'Google साइन-इन नहीं हुआ। फिर कोशिश करें।' : 'Google sign-in failed. Try again.', 'error');
}

const ICON = {
  success: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="m7.5 12 3 3 6-6" /></svg>,
  error: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>,
};

export default function Toaster() {
  const [items, setItems] = useState<Item[]>([]);
  const next = useRef(1);

  useEffect(() => {
    const onToast = (e: Event) => {
      const { message, kind } = (e as CustomEvent<{ message: string; kind: ToastKind }>).detail;
      const id = next.current++;
      setItems((list) => [...list, { id, message, kind }].slice(-MAX_SHOWN));
      window.setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), SHOW_MS);
    };
    window.addEventListener(EVENT, onToast);
    return () => window.removeEventListener(EVENT, onToast);
  }, []);

  return (
    <div className="ds toast" aria-live="polite" role="status">
      <style dangerouslySetInnerHTML={{ __html: TOAST_CSS }} />
      {items.map((t) => (
        <div key={t.id} className={`toast-item ${t.kind}`}>
          <span className="toast-icon">{ICON[t.kind]}</span>
          <p>{t.message}</p>
          <button type="button" className="toast-x" onClick={() => setItems((list) => list.filter((x) => x.id !== t.id))} aria-label="Dismiss">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
      ))}
    </div>
  );
}

const TOAST_CSS = `
.toast {
  position: fixed; top: 72px; left: 50%; transform: translateX(-50%); z-index: 2600;
  width: min(571px, calc(100vw - 24px));
  display: flex; flex-direction: column; gap: var(--space-2); pointer-events: none;
}
.toast-item {
  position: relative; pointer-events: auto;
  display: flex; align-items: flex-start; gap: var(--space-4);
  padding: var(--space-4) 52px var(--space-4) var(--space-4);
  background: var(--ds-card); border: 1px solid var(--border2); border-radius: var(--radius-2xl);
  box-shadow: var(--shadow-2xl);
  animation: toastIn 0.22s cubic-bezier(0.16,1,0.3,1);
}
.toast-item p { margin: 0; font-size: 0.875rem; line-height: 20px; font-weight: 600; color: var(--text2); }
/* The icon's two faint rings, as in the alert design: 30% and 10% of its colour. */
.toast-icon { position: relative; flex-shrink: 0; display: inline-flex; width: 20px; height: 20px; }
.toast-icon::before, .toast-icon::after { content: ''; position: absolute; border: 2px solid currentColor; border-radius: 50%; }
.toast-icon::before { inset: -4px; opacity: 0.3; }
.toast-icon::after { inset: -9px; opacity: 0.1; }
.toast-item.success .toast-icon { color: var(--success-text); }
.toast-item.error .toast-icon { color: var(--danger-text); }
.toast-x {
  position: absolute; top: 7px; right: 7px; width: 36px; height: 36px;
  display: inline-flex; align-items: center; justify-content: center;
  border: none; background: none; border-radius: var(--radius-md); color: var(--text3); cursor: pointer;
}
.toast-x:hover { background: var(--ds-soft); color: var(--text); }
@keyframes toastIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .toast-item { animation: none; } }
`;
