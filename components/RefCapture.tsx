'use client';
import { useEffect } from 'react';
import { captureRef } from '@/lib/referralClient';

/**
 * Keeps the invite code from a ?ref= link, then takes it out of the address
 * bar so it is not copied on to anyone else. No server call: the code only
 * matters if this visitor later buys, and the order carries it then.
 */
export default function RefCapture() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const ref = url.searchParams.get('ref');
    if (!ref) return;
    captureRef(ref);
    url.searchParams.delete('ref');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  }, []);
  return null;
}
