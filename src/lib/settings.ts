import 'server-only';
import { col, type SettingsDoc } from './db';
import { DEFAULT_SETTINGS } from './wedding';

/** The editable settings (RSVP contacts, message wording), created with the defaults on first use. */
export async function getSettings(): Promise<SettingsDoc> {
  const settings = await col('settings');
  const doc = await settings.findOne({ _id: 'site' });
  if (doc) return { ...DEFAULT_SETTINGS, ...doc, smsEnabled: doc.smsEnabled ?? false };
  const fresh: SettingsDoc = { _id: 'site', ...DEFAULT_SETTINGS, smsEnabled: false, updatedAt: new Date(), updatedBy: null };
  await settings.updateOne({ _id: 'site' }, { $setOnInsert: fresh }, { upsert: true });
  return fresh;
}

/** The public address used in guest links. */
export function appUrl(): string {
  const url = process.env.APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL : 'http://localhost:3000');
  return url.replace(/\/+$/, '');
}
