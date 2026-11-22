import 'server-only';
import { col, type GuestDoc } from './db';
import { CODE_LENGTH, isGuestCode, newGuestCode } from './crypto';
import { appUrl, getSettings } from './settings';
import { formatPhone } from './phone';

/** "Mr. & Mrs. John Doe" → "mr-mrs-john-doe" (the readable part of the link). */
export function slugify(name: string): string {
  return (
    name
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/&/g, ' ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)
      .replace(/-+$/g, '') || 'guest'
  );
}

export const guestPath = (g: Pick<GuestDoc, 'slug' | 'code'>) => `/i/${g.slug}-${g.code}`;
export const guestUrl = (g: Pick<GuestDoc, 'slug' | 'code'>) => appUrl() + guestPath(g);

/** "/i/mr-mrs-john-doe-k3x9pqr" → "k3x9pqr" (or null if it can't be a real code). */
export function codeFromSlug(slugParam: string): string | null {
  const s = decodeURIComponent(slugParam || '').toLowerCase();
  const code = s.slice(-CODE_LENGTH);
  if (s.length > CODE_LENGTH && s[s.length - CODE_LENGTH - 1] !== '-') return null;
  return isGuestCode(code) ? code : null;
}

export async function findGuestByCode(code: string): Promise<GuestDoc | null> {
  return (await col('guests')).findOne({ code });
}

/** A new code that no other guest has. */
export async function uniqueGuestCode(taken?: Set<string>): Promise<string> {
  const guests = await col('guests');
  for (let i = 0; i < 20; i++) {
    const code = newGuestCode();
    if (taken?.has(code)) continue;
    if (!(await guests.findOne({ code }, { projection: { _id: 1 } }))) return code;
  }
  throw new Error('Could not create a unique link code.');
}

/** Fills {name} and {link} in a message template. */
export function fillMessage(template: string, guest: Pick<GuestDoc, 'name' | 'slug' | 'code'>): string {
  return template.replaceAll('{name}', guest.name).replaceAll('{link}', guestUrl(guest));
}

/** What the dashboard's guest table needs (plain values only, safe to send to the browser). */
export type GuestRow = {
  id: string;
  name: string;
  phone: string;
  phoneDisplay: string;
  seats: number;
  url: string;
  path: string;
  whatsappText: string;
  smsText: string;
  whatsapp: { at: string; byName: string } | null;
  sms: { at: string; byName: string; status: string; error?: string | null } | null;
  /** viewed: the invitation loaded on the guest's screen */
  opens: { count: number; firstAt: string; lastAt: string } | null;
  /** downloaded as a PDF */
  pdf: { count: number; firstAt: string; lastAt: string } | null;
  createdAt: string;
};

export function toGuestRow(g: GuestDoc, templates: { whatsapp: string; sms: string }): GuestRow {
  return {
    id: g._id.toHexString(),
    name: g.name,
    phone: g.phone,
    phoneDisplay: formatPhone(g.phone),
    seats: g.seats,
    url: guestUrl(g),
    path: guestPath(g),
    whatsappText: fillMessage(templates.whatsapp, g),
    smsText: fillMessage(templates.sms, g),
    whatsapp: g.whatsapp ? { at: g.whatsapp.at.toISOString(), byName: g.whatsapp.byName } : null,
    sms: g.sms ? { at: g.sms.at.toISOString(), byName: g.sms.byName, status: g.sms.status, error: g.sms.error ?? null } : null,
    opens: g.opens ? { count: g.opens.count, firstAt: g.opens.firstAt.toISOString(), lastAt: g.opens.lastAt.toISOString() } : null,
    pdf: g.pdf ? { count: g.pdf.count, firstAt: g.pdf.firstAt.toISOString(), lastAt: g.pdf.lastAt.toISOString() } : null,
    createdAt: g.createdAt.toISOString(),
  };
}

/** Every guest as a row for the dashboard list, sorted by name (used by the Guests page and GET /api/admin/guests). */
export async function listGuestRows(): Promise<GuestRow[]> {
  const [settings, docs] = await Promise.all([
    getSettings(),
    (await col('guests')).find({}).collation({ locale: 'en', strength: 2 }).sort({ name: 1 }).toArray(),
  ]);
  const templates = { whatsapp: settings.whatsappMessage, sms: settings.smsMessage };
  return docs.map((g) => toGuestRow(g, templates));
}

export const NAME_MAX = 80;

export function checkGuestName(raw: string): { ok: true; name: string } | { ok: false; error: string } {
  const name = String(raw ?? '').trim().replace(/\s+/g, ' ');
  if (!name) return { ok: false, error: 'Name is missing.' };
  if (name.length > NAME_MAX) return { ok: false, error: `Name is longer than ${NAME_MAX} characters.` };
  return { ok: true, name };
}

export function checkSeats(raw: unknown, fallback: number): { ok: true; seats: number } | { ok: false; error: string } {
  if (raw === undefined || raw === null || String(raw).trim() === '') return { ok: true, seats: fallback };
  const n = Number(String(raw).trim());
  if (!Number.isInteger(n) || n < 1 || n > 20) return { ok: false, error: 'Seats must be a whole number from 1 to 20.' };
  return { ok: true, seats: n };
}
