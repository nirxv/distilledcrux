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

/** The code this browser last saved to an account, for that account, so it is sent once. */
const CLAIMED = `${KEY}_claimed`;
export function claimedFor(uid: string): string | null {
  try {
    const s = JSON.parse(localStorage.getItem(CLAIMED) ?? 'null') as { uid: string; code: string } | null;
    return s?.uid === uid ? s.code : null;
  } catch { return null; }
}
export function markClaimed(uid: string, code: string): void {
  try { localStorage.setItem(CLAIMED, JSON.stringify({ uid, code })); } catch { /* private mode */ }
}

/**
 * The navbar's copy of the reader's invite balance, kept for half an hour so
 * it is fetched about once a session. The invite page refreshes it, and a
 * purchase clears it, since either can change the balance.
 */
const BALANCE = 'dc_invite_balance';
const BALANCE_MS = 30 * 60 * 1000;
export function cachedBalance(uid: string): number | null {
  try {
    const s = JSON.parse(localStorage.getItem(BALANCE) ?? 'null') as { uid: string; paise: number; at: number } | null;
    return s && s.uid === uid && Date.now() - s.at < BALANCE_MS ? s.paise : null;
  } catch { return null; }
}
export function cacheBalance(uid: string, paise: number): void {
  try { localStorage.setItem(BALANCE, JSON.stringify({ uid, paise, at: Date.now() })); } catch { /* private mode */ }
}
export function clearBalance(): void {
  try { localStorage.removeItem(BALANCE); } catch { /* private mode */ }
}

export function clearRef(): void {
  try { localStorage.removeItem(KEY); } catch { /* private mode */ }
}
