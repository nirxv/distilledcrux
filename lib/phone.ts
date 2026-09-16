/**
 * Phone normalisation and validation, shared by the onboarding form and the
 * route that stores the number.
 *
 * It lives here rather than in either of them so the two cannot drift on what
 * counts as valid: the form must not accept a number the route will reject,
 * and the route must never trust that the form checked anything.
 */

/** Digits only, no country code, per ITU E.164 minus the leading '+'. */
const MIN_DIGITS = 8;
const MAX_DIGITS = 15;

/**
 * Numbers that are syntactically fine and obviously fake. Collected numbers
 * are only worth having if someone can be reached on them, and these are what
 * people type when a modal will not let them past.
 */
function isJunk(digits: string): boolean {
  const national = digits.length > 10 ? digits.slice(-10) : digits;
  if (/^(\d)\1+$/.test(national)) return true;           // 9999999999
  if (national === '1234567890') return true;
  if (national === '0123456789') return true;
  return false;
}

export type PhoneResult =
  | { ok: true; phone: string }
  | { ok: false; error: string };

export function normalizePhone(raw: unknown): PhoneResult {
  if (typeof raw !== 'string') return { ok: false, error: 'Please enter your phone number.' };

  // Strip the separators people actually type. Anything else surviving this is
  // a real character in the wrong place, and should fail rather than be
  // silently dropped.
  const cleaned = raw.replace(/[\s\-().]/g, '');
  const match = cleaned.match(/^(\+?)(\d+)$/);
  if (!match) return { ok: false, error: 'That does not look like a phone number.' };

  let digits = match[2];
  if (digits.length < MIN_DIGITS || digits.length > MAX_DIGITS) {
    return { ok: false, error: 'That number looks too short or too long.' };
  }
  if (isJunk(digits)) return { ok: false, error: 'Please enter a real phone number.' };

  // The field is prefixed +91 and people type their number again with the
  // country code in it, giving +91 91 XXXXXXXXXX. Fourteen digits passes the
  // generic international check and is not dialable. The intent is not in
  // doubt, so the duplicate is dropped rather than refused.
  if (digits.length === 14 && digits.startsWith('9191') && /^[6-9]\d{9}$/.test(digits.slice(4))) {
    digits = digits.slice(2);
  }

  // An Indian mobile is 10 digits starting 6-9. The field defaults to +91, so
  // this is the case worth checking properly.
  if (digits.startsWith('91') && digits.length === 12) {
    const national = digits.slice(2);
    if (!/^[6-9]\d{9}$/.test(national)) {
      return { ok: false, error: 'Indian mobile numbers are 10 digits starting with 6, 7, 8 or 9.' };
    }
  }

  return { ok: true, phone: '+' + digits };
}

/**
 * For a field that already shows a fixed +91, where what gets typed is a
 * national number rather than an international one.
 *
 * Without this, a reader typing the ten digits under a +91 label would be
 * stored as +9876543210: ten digits passes the generic length check, so it
 * looks valid and is not dialable. Three shapes are accepted because all three
 * are what people actually type into a field labelled +91:
 *
 *   9876543210        the ten digits, as the label invites
 *   09876543210       with the trunk prefix, as written on forms in India
 *   +919876543210     the whole thing again, ignoring the label
 */
export function normalizeIndianMobile(raw: unknown): PhoneResult {
  if (typeof raw !== 'string') return { ok: false, error: 'Please enter your mobile number.' };

  const cleaned = raw.replace(/[\s\-().]/g, '');
  const national = /^0([6-9]\d{9})$/.exec(cleaned)?.[1] ?? cleaned;

  if (/^[6-9]\d{9}$/.test(national)) return normalizePhone(`91${national}`);

  // Ten bare digits under a +91 label mean an Indian number and nothing else,
  // so a ten-digit string that is not a valid Indian mobile is wrong rather
  // than foreign. Without this it fell through to the generic check, which
  // accepts any 8 to 15 digits, and 5876543210 was stored as +5876543210.
  if (/^\d{10}$/.test(cleaned)) {
    return { ok: false, error: 'Indian mobile numbers are 10 digits starting with 6, 7, 8 or 9.' };
  }

  // Anything else goes through as typed, so someone entering a genuine
  // international number with its own country code still works.
  return normalizePhone(cleaned);
}
