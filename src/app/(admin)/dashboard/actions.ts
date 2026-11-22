'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { col, type GuestDoc } from '@/lib/db';
import { assertUser, checkUsername, endAllSessions, logActivity, MAX_SUPER_ADMINS, type CurrentUser } from '@/lib/auth';
import { checkPasswordStrength, hashPassword, newToken, sha256, verifyPassword } from '@/lib/crypto';
import { checkGuestName, checkSeats, fillMessage, slugify, uniqueGuestCode } from '@/lib/guests';
import { normalizePhone } from '@/lib/phone';
import { appUrl, getSettings } from '@/lib/settings';
import { sendSms, smsConfig } from '@/lib/sms';
import { INVITE_HOURS } from '@/lib/invites';
import { defaultSeats, MAX_RSVP_CONTACTS } from '@/lib/wedding';
import { classifyDbError } from '@/lib/db-errors';

type FormState = { error?: string; ok?: string } | undefined;
type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const refresh = () => revalidatePath('/dashboard', 'layout');
const oid = (id: string) => (ObjectId.isValid(id) ? new ObjectId(id) : null);
// a database failure shows its plain explanation, not the driver's raw message
const errMsg = (e: unknown) => { const db = classifyDbError(e); return db ? `${db.title}. ${db.message}` : e instanceof Error ? e.message : 'Something went wrong.'; };

/* =====================================================================
   Guests (super admin)
   ===================================================================== */

async function buildGuest(user: CurrentUser, input: { name: unknown; phone: unknown; seats?: unknown }, taken?: Set<string>): Promise<Result<{ guest: GuestDoc }>> {
  const n = checkGuestName(String(input.name ?? ''));
  if (!n.ok) return { ok: false, error: n.error };
  const phone = normalizePhone(String(input.phone ?? ''));
  if (!phone) return { ok: false, error: `“${String(input.phone ?? '')}” is not a valid phone number.` };
  const s = checkSeats(input.seats, defaultSeats(n.name));
  if (!s.ok) return { ok: false, error: s.error };
  const now = new Date();
  const code = await uniqueGuestCode(taken);
  taken?.add(code);
  return {
    ok: true,
    guest: { _id: new ObjectId(), name: n.name, phone, seats: s.seats, code, slug: slugify(n.name), createdAt: now, createdBy: user._id, updatedAt: now, whatsapp: null, sms: null, opens: null },
  };
}

export async function addGuestAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    const user = await assertUser('super');
    const built = await buildGuest(user, { name: form.get('name'), phone: form.get('phone'), seats: form.get('seats') });
    if (!built.ok) return { error: built.error };
    await (await col('guests')).insertOne(built.guest);
    await logActivity(user, 'Added a guest', { guest: built.guest.name });
    refresh();
    return { ok: `${built.guest.name} was added.` };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

export async function updateGuestAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    const user = await assertUser('super');
    const id = oid(String(form.get('id') || ''));
    if (!id) return { error: 'Guest not found.' };
    const n = checkGuestName(String(form.get('name') || ''));
    if (!n.ok) return { error: n.error };
    const phone = normalizePhone(String(form.get('phone') || ''));
    if (!phone) return { error: 'That is not a valid phone number.' };
    const s = checkSeats(form.get('seats'), defaultSeats(n.name));
    if (!s.ok) return { error: s.error };
    // the link code never changes, so a link already sent keeps working (it moves to the new name)
    const res = await (await col('guests')).updateOne({ _id: id }, { $set: { name: n.name, phone, seats: s.seats, slug: slugify(n.name), updatedAt: new Date() } });
    if (!res.matchedCount) return { error: 'Guest not found.' };
    await logActivity(user, 'Edited a guest', { guest: n.name });
    refresh();
    return { ok: 'Saved.' };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

export async function deleteGuestsAction(ids: string[]): Promise<Result<{ deleted: number }>> {
  try {
    const user = await assertUser('super');
    const objectIds = ids.map(oid).filter((x): x is ObjectId => !!x);
    if (!objectIds.length) return { ok: false, error: 'No guests selected.' };
    const guests = await col('guests');
    const names = (await guests.find({ _id: { $in: objectIds } }, { projection: { name: 1 } }).toArray()).map((g) => g.name);
    const res = await guests.deleteMany({ _id: { $in: objectIds } });
    await logActivity(user, `Deleted ${res.deletedCount} guest(s)`, { guests: names.slice(0, 50) });
    refresh();
    return { ok: true, deleted: res.deletedCount };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export type ImportRow = { name: string; phone: string; seats?: string | number | null };
export type ImportResult = Result<{ added: number; skipped: { row: number; name: string; reason: string }[] }>;

/** Adds the rows from an uploaded guest list. Rows already on the list (same name and phone) are skipped. */
export async function importGuestsAction(rows: ImportRow[]): Promise<ImportResult> {
  try {
    const user = await assertUser('super');
    if (!Array.isArray(rows) || !rows.length) return { ok: false, error: 'The file has no guests.' };
    if (rows.length > 3000) return { ok: false, error: 'Please upload at most 3,000 guests at a time.' };
    const guests = await col('guests');
    const existing = new Set((await guests.find({}, { projection: { name: 1, phone: 1 } }).toArray()).map((g) => g.name.toLowerCase() + '|' + g.phone));
    const taken = new Set<string>();
    const toAdd: GuestDoc[] = [];
    const skipped: { row: number; name: string; reason: string }[] = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const built = await buildGuest(user, r, taken);
      if (!built.ok) { skipped.push({ row: i + 1, name: String(r?.name ?? ''), reason: built.error }); continue; }
      const key = built.guest.name.toLowerCase() + '|' + built.guest.phone;
      if (existing.has(key)) { skipped.push({ row: i + 1, name: built.guest.name, reason: 'Already on the guest list.' }); continue; }
      existing.add(key);
      toAdd.push(built.guest);
    }
    if (toAdd.length) await guests.insertMany(toAdd, { ordered: false });
    await logActivity(user, `Uploaded a guest list: ${toAdd.length} added, ${skipped.length} skipped`);
    refresh();
    return { ok: true, added: toAdd.length, skipped };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

/* =====================================================================
   Sending (all admins)
   ===================================================================== */

/** Called when an admin opens WhatsApp for a guest: the guest counts as sent. */
export async function markWhatsappSentAction(id: string): Promise<Result<{ at: string; byName: string }>> {
  try {
    const user = await assertUser();
    const _id = oid(id);
    if (!_id) return { ok: false, error: 'Guest not found.' };
    const at = new Date();
    const res = await (await col('guests')).findOneAndUpdate({ _id }, { $set: { whatsapp: { at, by: user._id, byName: user.username } } }, { projection: { name: 1 } });
    if (!res) return { ok: false, error: 'Guest not found.' };
    await logActivity(user, 'Sent an invitation on WhatsApp', { guest: res.name });
    refresh();
    return { ok: true, at: at.toISOString(), byName: user.username };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

/** Undo "sent" (e.g. WhatsApp was opened but the message wasn't actually sent). */
export async function clearSentAction(id: string, channel: 'whatsapp' | 'sms'): Promise<Result> {
  try {
    const user = await assertUser();
    const _id = oid(id);
    if (!_id) return { ok: false, error: 'Guest not found.' };
    const res = await (await col('guests')).findOneAndUpdate({ _id }, { $set: { [channel]: null } }, { projection: { name: 1 } });
    if (!res) return { ok: false, error: 'Guest not found.' };
    await logActivity(user, `Marked ${channel === 'sms' ? 'SMS' : 'WhatsApp'} as not sent`, { guest: res.name });
    refresh();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export type SmsSendResult = Result<{ results: { id: string; ok: boolean; error?: string }[] }>;

/** Sends the SMS invitation to up to 20 guests per call (the browser sends bigger lists in batches). */
export async function sendSmsAction(ids: string[]): Promise<SmsSendResult> {
  try {
    const user = await assertUser();
    const settings = await getSettings();
    const cfg = smsConfig();
    if (!cfg.configured) return { ok: false, error: 'SMS is not set up yet.' };
    if (!settings.smsEnabled) return { ok: false, error: 'SMS sending is switched off in Settings.' };
    const objectIds = ids.slice(0, 20).map(oid).filter((x): x is ObjectId => !!x);
    const guests = await col('guests');
    const list = await guests.find({ _id: { $in: objectIds } }).toArray();
    const results: { id: string; ok: boolean; error?: string }[] = [];
    for (const g of list) {
      const r = await sendSms(g.phone, fillMessage(settings.smsMessage, g));
      const at = new Date();
      await guests.updateOne(
        { _id: g._id },
        { $set: { sms: r.ok
          ? { at, by: user._id, byName: user.username, status: 'sent', messageId: r.messageId, cost: r.cost, error: null }
          : { at, by: user._id, byName: user.username, status: 'failed', messageId: null, cost: null, error: r.error } } },
      );
      results.push({ id: g._id.toHexString(), ok: r.ok, error: r.ok ? undefined : r.error });
    }
    const sent = results.filter((r) => r.ok).length;
    await logActivity(user, `Sent ${sent} SMS invitation(s)${results.length - sent ? `, ${results.length - sent} failed` : ''}`);
    refresh();
    return { ok: true, results };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

/* =====================================================================
   Team (super admin)
   ===================================================================== */

async function makeLink(user: CurrentUser, purpose: 'join' | 'reset', userId: ObjectId | null): Promise<string> {
  const token = newToken();
  const now = new Date();
  await (await col('invites')).insertOne({
    _id: new ObjectId(),
    tokenHash: sha256(token),
    purpose,
    role: 'admin',
    userId,
    createdBy: user._id,
    createdAt: now,
    expiresAt: new Date(now.getTime() + INVITE_HOURS * 3600_000),
    usedAt: null,
    usedBy: null,
    revokedAt: null,
  });
  return `${appUrl()}/join/${token}`;
}

export async function createInviteLinkAction(): Promise<Result<{ link: string }>> {
  try {
    const user = await assertUser('super');
    const link = await makeLink(user, 'join', null);
    await logActivity(user, 'Created an admin invite link');
    refresh();
    return { ok: true, link };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function createResetLinkAction(userId: string): Promise<Result<{ link: string; username: string }>> {
  try {
    const user = await assertUser('super');
    const _id = oid(userId);
    const target = _id ? await (await col('users')).findOne({ _id, active: true }) : null;
    if (!target) return { ok: false, error: 'Admin not found.' };
    // older reset links for this admin stop working
    await (await col('invites')).updateMany({ purpose: 'reset', userId: target._id, usedAt: null, revokedAt: null }, { $set: { revokedAt: new Date() } });
    const link = await makeLink(user, 'reset', target._id);
    await logActivity(user, 'Created a password reset link', { admin: target.username });
    refresh();
    return { ok: true, link, username: target.username };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function revokeInviteAction(inviteId: string): Promise<Result> {
  try {
    const user = await assertUser('super');
    const _id = oid(inviteId);
    if (!_id) return { ok: false, error: 'Link not found.' };
    await (await col('invites')).updateOne({ _id, usedAt: null }, { $set: { revokedAt: new Date() } });
    await logActivity(user, 'Cancelled a link');
    refresh();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

/** Makes an admin a super admin (at most MAX_SUPER_ADMINS), or a super admin a regular admin (never the last one). */
export async function setAdminRoleAction(userId: string, role: 'super' | 'admin'): Promise<Result> {
  try {
    const user = await assertUser('super');
    const _id = oid(userId);
    const users = await col('users');
    const target = _id ? await users.findOne({ _id, active: true }) : null;
    if (!target) return { ok: false, error: 'Admin not found.' };
    if (target.role === role) return { ok: true };

    const supers = await users.countDocuments({ role: 'super', active: true });
    if (role === 'super' && supers >= MAX_SUPER_ADMINS) {
      return { ok: false, error: `There can be at most ${MAX_SUPER_ADMINS} super admins. Make one of them a regular admin first.` };
    }
    if (role === 'admin' && supers <= 1) return { ok: false, error: 'There must always be at least one super admin.' };

    // the count is checked again in the update, so two clicks at once can't go past the limits
    const changed = await users.updateOne({ _id: target._id, role: target.role }, { $set: { role } });
    if (!changed.modifiedCount) return { ok: false, error: 'Their role was just changed by someone else. Reload the page.' };
    const after = await users.countDocuments({ role: 'super', active: true });
    if (after > MAX_SUPER_ADMINS || after < 1) {
      await users.updateOne({ _id: target._id }, { $set: { role: target.role } });
      return { ok: false, error: 'Someone else changed the super admins at the same time. Please try again.' };
    }

    await logActivity(user, role === 'super' ? 'Made a super admin' : 'Made a regular admin', { admin: target.username });
    refresh();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function removeAdminAction(userId: string): Promise<Result> {
  try {
    const user = await assertUser('super');
    const _id = oid(userId);
    if (!_id) return { ok: false, error: 'Admin not found.' };
    const users = await col('users');
    const target = await users.findOne({ _id });
    if (!target) return { ok: false, error: 'Admin not found.' };
    if (target.role === 'super') return { ok: false, error: `${target.username} is a super admin. Make them a regular admin first, then remove them.` };
    await users.deleteOne({ _id });
    await endAllSessions(_id);
    await (await col('invites')).updateMany({ userId: _id, usedAt: null }, { $set: { revokedAt: new Date() } });
    await logActivity(user, 'Removed an admin', { admin: target.username });
    refresh();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

/* =====================================================================
   Settings (super admin)
   ===================================================================== */

export async function saveRsvpAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    const user = await assertUser('super');
    const contacts: { name: string; phone: string }[] = [];
    for (let i = 0; i < MAX_RSVP_CONTACTS; i++) {
      const name = String(form.get(`name${i}`) || '').trim().replace(/\s+/g, ' ');
      const phoneRaw = String(form.get(`phone${i}`) || '').trim();
      if (!name && !phoneRaw) continue;
      if (!name) return { error: `Contact ${i + 1}: the name is missing.` };
      if (name.length > 40) return { error: `Contact ${i + 1}: the name is too long for the RSVP bar (40 characters at most).` };
      const e164 = normalizePhone(phoneRaw);
      if (!e164) return { error: `Contact ${i + 1}: “${phoneRaw}” is not a valid phone number.` };
      // shown on the poster as typed (e.g. "+256 771 008212"); the number itself is checked above
      contacts.push({ name, phone: phoneRaw.replace(/\s+/g, ' ') });
    }
    if (!contacts.length) return { error: 'Add at least one RSVP contact.' };
    await (await col('settings')).updateOne({ _id: 'site' }, { $set: { rsvpContacts: contacts, updatedAt: new Date(), updatedBy: user._id } });
    await logActivity(user, 'Updated the RSVP contacts', { contacts: contacts.map((c) => c.name) });
    revalidatePath('/', 'layout');
    return { ok: 'RSVP contacts saved. Every invitation now shows them.' };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

export async function saveMessagesAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    const user = await assertUser('super');
    const whatsappMessage = String(form.get('whatsappMessage') || '').trim();
    const smsMessage = String(form.get('smsMessage') || '').trim();
    for (const [label, msg] of [['WhatsApp', whatsappMessage], ['SMS', smsMessage]] as const) {
      if (!msg) return { error: `The ${label} message is empty.` };
      if (!msg.includes('{link}')) return { error: `The ${label} message must include {link}, where the guest’s personal link goes.` };
      if (msg.length > 1000) return { error: `The ${label} message is too long.` };
    }
    await (await col('settings')).updateOne({ _id: 'site' }, { $set: { whatsappMessage, smsMessage, updatedAt: new Date(), updatedBy: user._id } });
    await logActivity(user, 'Updated the invitation messages');
    refresh();
    return { ok: 'Messages saved.' };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

export async function setSmsEnabledAction(enabled: boolean): Promise<Result> {
  try {
    const user = await assertUser('super');
    if (enabled && !smsConfig().configured) return { ok: false, error: 'Add the Africa’s Talking details to the server settings first.' };
    await (await col('settings')).updateOne({ _id: 'site' }, { $set: { smsEnabled: enabled, updatedAt: new Date(), updatedBy: user._id } });
    await logActivity(user, enabled ? 'Switched SMS sending on' : 'Switched SMS sending off');
    refresh();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

/* =====================================================================
   My account (everyone)
   ===================================================================== */

export async function changeUsernameAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    const user = await assertUser();
    const n = checkUsername(String(form.get('username') || ''));
    if (!n.ok) return { error: n.error };
    const users = await col('users');
    const me = await users.findOne({ _id: user._id });
    if (!me || !(await verifyPassword(String(form.get('password') || ''), me.passwordHash))) return { error: 'Your current password is wrong.' };
    if (n.username === me.username) return { ok: 'That is already your username.' };
    const clash = await users.findOne({ usernameLower: n.username.toLowerCase(), _id: { $ne: me._id } });
    if (clash) return { error: 'That username is taken.' };
    await users.updateOne({ _id: me._id }, { $set: { username: n.username, usernameLower: n.username.toLowerCase() } });
    await logActivity(user, 'Changed their username', { from: me.username, to: n.username });
    refresh();
    return { ok: `Your username is now ${n.username}.` };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

export async function changePasswordAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    const user = await assertUser();
    const users = await col('users');
    const me = await users.findOne({ _id: user._id });
    if (!me || !(await verifyPassword(String(form.get('current') || ''), me.passwordHash))) return { error: 'Your current password is wrong.' };
    const password = String(form.get('password') || '');
    if (password !== String(form.get('confirm') || '')) return { error: 'The two new passwords don’t match.' };
    const weak = checkPasswordStrength(password);
    if (weak) return { error: weak };
    await users.updateOne({ _id: me._id }, { $set: { passwordHash: await hashPassword(password) } });
    await logActivity(user, 'Changed their password');
    return { ok: 'Password changed.' };
  } catch (e) {
    return { error: errMsg(e) };
  }
}
