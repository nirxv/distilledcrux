import { isRefCode } from '@/lib/referral';

/**
 * The invite code a visitor arrived with, kept in this browser until they buy.
 * The first code wins for 30 days, so a later link does not take the credit
 * from the friend who sent them first.
 */
const KEY = 'dc_ref';
const KEEP_MS = 30 * 24 * 60 * 60 * 1000;

type Stored = { code: string; at: number };

function read(): Stored | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Stored | null;
    return s && isRefCode(s.code) && Date.now() - s.at < KEEP_MS ? s : null;
  } catch { return null; }
}

export function captureRef(code: string): void {
  if (!isRefCode(code) || read()) return;
  try { localStorage.setItem(KEY, JSON.stringify({ code: code.toUpperCase(), at: Date.now() })); } catch { /* private mode */ }
}

export const readRef = (): string | null => read()?.code ?? null;

export function clearRef(): void {
  try { localStorage.removeItem(KEY); } catch { /* private mode */ }
}
