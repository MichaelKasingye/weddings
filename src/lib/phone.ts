import { parsePhoneNumberFromString } from 'libphonenumber-js';

/**
 * Turns any way of writing a phone number into the international form (+256772123456).
 * Numbers without a country code are read as Ugandan: 0772 123456, 772123456, 256772123456 all work.
 */
export function normalizePhone(raw: string): string | null {
  let s = String(raw ?? '').trim();
  if (!s) return null;
  s = s.replace(/^00/, '+');
  // "256772…" without the plus
  if (/^256\d{9}$/.test(s.replace(/\D/g, '')) && !s.startsWith('+')) s = '+' + s.replace(/\D/g, '');
  const p = parsePhoneNumberFromString(s, 'UG');
  return p && p.isValid() ? p.number : null;
}

/** +256772123456 → +256 772 123456 */
export function formatPhone(e164: string): string {
  const p = parsePhoneNumberFromString(e164);
  return p ? p.formatInternational() : e164;
}

/** Digits only, for wa.me links. */
export const waDigits = (e164: string) => e164.replace(/\D/g, '');
