import 'server-only';
import type { ObjectId } from 'mongodb';
import { col, type GuestEventDoc } from './db';

/** A plain description of the device from its User-Agent. Only this label is stored, not the User-Agent. */
export function deviceLabel(ua: string | null | undefined): string {
  const s = ua || '';
  if (/iPad/i.test(s)) return 'iPad';
  if (/iPhone|iPod/i.test(s)) return 'iPhone';
  if (/Android/i.test(s)) return /Mobile/i.test(s) ? 'Android phone' : 'Android tablet';
  if (/Windows Phone/i.test(s)) return 'Windows phone';
  if (/Windows/i.test(s)) return 'Windows computer';
  if (/Macintosh|Mac OS X/i.test(s)) return 'Mac';
  if (/CrOS/i.test(s)) return 'Chromebook';
  if (/Linux/i.test(s)) return 'Linux computer';
  return 'Unknown device';
}

/**
 * Counts a view or a PDF download on the guest (count, first and last time) and adds it to their history.
 * `field` is the counter on the guest document: "opens" for views, "pdf" for downloads.
 */
export async function recordGuestEvent(guestId: ObjectId, type: GuestEventDoc['type'], userAgent: string | null) {
  const now = new Date();
  const field = type === 'view' ? 'opens' : 'pdf';
  const guests = await col('guests');
  // one update for both cases: start the counter, or add one to it
  const added = await guests.updateOne(
    { _id: guestId, [field]: { $type: 'object' } },
    { $inc: { [`${field}.count`]: 1 }, $set: { [`${field}.lastAt`]: now } },
  );
  if (!added.matchedCount) {
    await guests.updateOne({ _id: guestId }, { $set: { [field]: { count: 1, firstAt: now, lastAt: now } } });
  }
  await (await col('guest_events')).insertOne({ guestId, type, at: now, device: deviceLabel(userAgent) });
}
