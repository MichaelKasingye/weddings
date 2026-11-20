'use server';

import { redirect } from 'next/navigation';
import { ObjectId } from 'mongodb';
import { col, type UserDoc } from '@/lib/db';
import { checkPasswordStrength, hashPassword, verifyPassword } from '@/lib/crypto';
import { checkUsername, endAllSessions, endSession, logActivity, startSession } from '@/lib/auth';
import { clear, clientIp, count, hit } from '@/lib/ratelimit';
import { findValidInvite } from '@/lib/invites';

export type FormState = { error?: string; ok?: string } | undefined;

const MAX_LOGIN_FAILS = 10;
const LOGIN_WINDOW = 15 * 60;

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const username = String(form.get('username') || '').trim();
  const password = String(form.get('password') || '');
  if (!username || !password) return { error: 'Enter your username and password.' };

  const ip = await clientIp();
  const ipKey = 'login-ip:' + ip, userKey = 'login-user:' + username.toLowerCase();
  if ((await count(ipKey)) >= MAX_LOGIN_FAILS * 3 || (await count(userKey)) >= MAX_LOGIN_FAILS) {
    return { error: 'Too many failed attempts. Please wait 15 minutes and try again.' };
  }

  const user = await (await col('users')).findOne({ usernameLower: username.toLowerCase(), active: true });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    await Promise.all([hit(ipKey, LOGIN_WINDOW), hit(userKey, LOGIN_WINDOW)]);
    return { error: 'Wrong username or password.' };
  }
  await clear(userKey);
  await startSession(user);
  redirect('/dashboard');
}

export async function logoutAction() {
  await endSession();
  redirect('/login');
}

/** First run only: creates the super admin (the username comes from SUPER_ADMIN_USERNAME). */
export async function setupAction(_: FormState, form: FormData): Promise<FormState> {
  const users = await col('users');
  if (await users.countDocuments({}, { limit: 1 })) return { error: 'Setup is already done. Please log in.' };

  const setupCode = process.env.SETUP_CODE;
  if (setupCode && String(form.get('setupCode') || '') !== setupCode) {
    await hit('setup:' + (await clientIp()), 3600);
    return { error: 'The setup code is wrong.' };
  }
  if (!setupCode && process.env.VERCEL) {
    return { error: 'Set SETUP_CODE in the Vercel environment variables before setting up the super admin.' };
  }

  const name = checkUsername(process.env.SUPER_ADMIN_USERNAME || String(form.get('username') || ''));
  if (!name.ok) return { error: name.error };
  const password = String(form.get('password') || '');
  if (password !== String(form.get('confirm') || '')) return { error: 'The two passwords don’t match.' };
  const weak = checkPasswordStrength(password);
  if (weak) return { error: weak };

  const user: UserDoc = {
    _id: new ObjectId(),
    username: name.username,
    usernameLower: name.username.toLowerCase(),
    passwordHash: await hashPassword(password),
    role: 'super',
    active: true,
    createdAt: new Date(),
    createdBy: null,
  };
  try {
    await users.insertOne(user);
  } catch {
    return { error: 'Setup is already done. Please log in.' };
  }
  await logActivity({ id: user._id.toHexString(), _id: user._id, username: user.username, role: 'super' }, 'Set up the super admin');
  await startSession(user);
  redirect('/dashboard');
}

/** Opening a join link: create the admin account. Opening a reset link: set a new password. */
export async function joinAction(_: FormState, form: FormData): Promise<FormState> {
  const token = String(form.get('token') || '');
  const found = await findValidInvite(token);
  if (!found) return { error: 'This link has expired or was already used. Ask the super admin for a new one.' };
  const { invite, user: resetUser } = found;

  const password = String(form.get('password') || '');
  if (password !== String(form.get('confirm') || '')) return { error: 'The two passwords don’t match.' };
  const weak = checkPasswordStrength(password);
  if (weak) return { error: weak };

  const users = await col('users');
  const invites = await col('invites');
  const now = new Date();

  if (invite.purpose === 'reset' && resetUser) {
    // claim the link first, so it can only ever be used once
    const claimed = await invites.updateOne({ _id: invite._id, usedAt: null }, { $set: { usedAt: now, usedBy: resetUser._id } });
    if (!claimed.modifiedCount) return { error: 'This link was already used.' };
    await users.updateOne({ _id: resetUser._id }, { $set: { passwordHash: await hashPassword(password) } });
    await endAllSessions(resetUser._id);
    await logActivity({ id: resetUser._id.toHexString(), _id: resetUser._id, username: resetUser.username, role: resetUser.role }, 'Reset their password with a reset link');
    await startSession(resetUser);
    redirect('/dashboard');
  }

  const name = checkUsername(String(form.get('username') || ''));
  if (!name.ok) return { error: name.error };
  if (await users.findOne({ usernameLower: name.username.toLowerCase() })) return { error: 'That username is taken. Please choose another.' };

  const user: UserDoc = {
    _id: new ObjectId(),
    username: name.username,
    usernameLower: name.username.toLowerCase(),
    passwordHash: await hashPassword(password),
    role: invite.role,
    active: true,
    createdAt: now,
    createdBy: invite.createdBy,
  };
  const claimed = await invites.updateOne({ _id: invite._id, usedAt: null }, { $set: { usedAt: now, usedBy: user._id } });
  if (!claimed.modifiedCount) return { error: 'This link was already used.' };
  try {
    await users.insertOne(user);
  } catch {
    await invites.updateOne({ _id: invite._id }, { $set: { usedAt: null, usedBy: null } });
    return { error: 'That username is taken. Please choose another.' };
  }
  await logActivity({ id: user._id.toHexString(), _id: user._id, username: user.username, role: user.role }, 'Joined as an admin');
  await startSession(user);
  redirect('/dashboard');
}
