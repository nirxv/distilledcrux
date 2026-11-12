'use client';
import { useCallback, useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { FREE_TOPPER_LIMIT } from '@/lib/toppers/meta';

export type TopperAllowance = {
  /** Still finding out who is reading. */
  loading: boolean;
  signedIn: boolean;
  unlimited: boolean;
  used: number;
  limit: number;
  /** Copies in this optional already opened, free to open again. */
  opened: Set<string>;
  /** What opens every copy: a subscription or a topper pass. */
  via: 'subscription' | 'pass' | null;
  /** When the topper pass runs out, if a pass is what opens them. */
  passUntil: string | null;
  /**
   * The optional on the reader's profile as a route slug, the only one whose
   * copies a subscription or pass opens. Undefined until the server says.
   */
  own: string | null | undefined;
  /** The allowance could not be read just now. */
  unavailable: boolean;
};

const START: TopperAllowance = {
  loading: true, signedIn: false, unlimited: false, used: 0, limit: FREE_TOPPER_LIMIT, opened: new Set(), unavailable: false, via: null, passUntil: null, own: undefined,
};

/**
 * The reader's topper copy allowance in one optional, from /api/toppers/status,
 * kept in step with what they open on the page: `noteOpened` records an open
 * the server has just granted, so the count moves without another request.
 */
export function useTopperStatus(subject: string) {
  const [state, setState] = useState<TopperAllowance>(START);

  useEffect(() => {
    let cancelled = false;
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        if (!cancelled) setState({ ...START, loading: false, own: null });
        return;
      }
      try {
        const token = await user.getIdToken();
        const r = await fetch(`/api/toppers/status?subject=${subject}`, { headers: { 'x-user-token': token } });
        const d = await r.json();
        if (cancelled) return;
        if (!r.ok) {
          setState({ ...START, loading: false, signedIn: true, unavailable: true });
          return;
        }
        setState({
          loading: false, signedIn: true, unavailable: false,
          unlimited: d.unlimited === true, used: d.used ?? 0, limit: d.limit ?? FREE_TOPPER_LIMIT,
          opened: new Set<string>(d.opened ?? []),
          via: d.via === 'subscription' || d.via === 'pass' ? d.via : null,
          passUntil: typeof d.passUntil === 'string' ? d.passUntil : null,
          own: typeof d.own === 'string' ? d.own : null,
        });
      } catch {
        if (!cancelled) setState({ ...START, loading: false, signedIn: true, unavailable: true });
      }
    });
    return () => { cancelled = true; unsub(); };
  }, [subject]);

  const noteOpened = useCallback((id: string, used: number, unlimited: boolean) => {
    setState((s) => ({ ...s, used: unlimited ? s.used : used, unlimited: s.unlimited || unlimited, opened: new Set(s.opened).add(id) }));
  }, []);

  return { ...state, noteOpened };
}

/** "3 of 5 free copies left", or nothing worth saying. */
export function allowanceLine(a: TopperAllowance, subject: string): string | null {
  if (a.loading || !a.signedIn || a.unlimited || a.unavailable) return null;
  const left = Math.max(0, a.limit - a.used);
  if (left > 0) return `${left} of ${a.limit} free ${left === 1 ? 'copy' : 'copies'} left to open. Copies you have opened stay free.`;
  return a.own === subject
    ? `You have opened your ${a.limit} free copies. They stay open to you, and Premium or a topper pass opens the rest.`
    : `You have opened your ${a.limit} free copies. They stay open to you.`;
}

/** Whether a viewer may open `id` straight away, should ask first, or must wait for the allowance. */
export function gateFor(a: TopperAllowance, id: string): 'wait' | 'confirm' | 'go' {
  if (a.loading) return 'wait';
  if (!a.signedIn || a.unlimited || a.unavailable || a.opened.has(id) || a.used >= a.limit) return 'go';
  return 'confirm';
}
