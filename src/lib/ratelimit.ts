import 'server-only';
import { headers } from 'next/headers';
import { col } from './db';

/** The visitor's IP address (Vercel sets x-forwarded-for). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get('x-forwarded-for') || '').split(',')[0].trim() || h.get('x-real-ip') || 'local';
}

/** Counts one hit for `key` in a window of `windowSec`; returns the count so far. */
export async function hit(key: string, windowSec: number): Promise<number> {
  const rl = await col('rate_limits');
  const doc = await rl.findOneAndUpdate(
    { _id: key },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(Date.now() + windowSec * 1000) } },
    { upsert: true, returnDocument: 'after' },
  );
  return doc?.count ?? 1;
}

export async function count(key: string): Promise<number> {
  const doc = await (await col('rate_limits')).findOne({ _id: key });
  return doc && doc.expiresAt > new Date() ? doc.count : 0;
}

export async function clear(key: string) {
  await (await col('rate_limits')).deleteOne({ _id: key });
}
