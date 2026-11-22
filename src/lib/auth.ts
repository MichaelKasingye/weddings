import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ObjectId } from 'mongodb';
import { col, type Role, type UserDoc } from './db';
import { newToken, sha256 } from './crypto';

export const SESSION_COOKIE = 'aj_session';

/** How many super admins there can be at the same time. */
export const MAX_SUPER_ADMINS = 3;
const SESSION_DAYS = 30;

export type CurrentUser = { id: string; _id: ObjectId; username: string; role: Role };

/** Starts a session for the user and sets the login cookie. */
export async function startSession(user: UserDoc) {
  const token = newToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * 86400_000);
  await (await col('sessions')).insertOne({ _id: new ObjectId(), tokenHash: sha256(token), userId: user._id, createdAt: now, expiresAt });
  await (await col('users')).updateOne({ _id: user._id }, { $set: { lastLoginAt: now } });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await (await col('sessions')).deleteOne({ tokenHash: sha256(token) });
  jar.delete(SESSION_COOKIE);
}

/** Logs a user out everywhere (after a password reset or removal). */
export async function endAllSessions(userId: ObjectId) {
  await (await col('sessions')).deleteMany({ userId });
}

/** The logged-in admin, or null. Cached for the duration of one request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await (await col('sessions')).findOne({ tokenHash: sha256(token), expiresAt: { $gt: new Date() } });
  if (!session) return null;
  const user = await (await col('users')).findOne({ _id: session.userId, active: true });
  if (!user) return null;
  return { id: user._id.toHexString(), _id: user._id, username: user.username, role: user.role };
});

/** For pages: sends visitors who aren't logged in to /login, and admins without the right role to the dashboard. */
export async function requireUser(role?: Role): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (role === 'super' && user.role !== 'super') redirect('/dashboard');
  return user;
}

/** For server actions: throws instead of redirecting. */
export async function assertUser(role?: Role): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error('You are not logged in.');
  if (role === 'super' && user.role !== 'super') throw new Error('Only the super admin can do this.');
  return user;
}

export async function logActivity(user: CurrentUser | null, action: string, details?: Record<string, unknown>) {
  await (await col('activity')).insertOne({
    at: new Date(),
    userId: user?._id ?? null,
    username: user?.username ?? 'system',
    action,
    details,
  });
}

/** Usernames: 3–32 letters, numbers, dots, dashes, underscores or spaces. */
export function checkUsername(raw: string): { ok: true; username: string } | { ok: false; error: string } {
  const username = raw.trim().replace(/\s+/g, ' ');
  if (username.length < 3) return { ok: false, error: 'Username must be at least 3 characters.' };
  if (username.length > 32) return { ok: false, error: 'Username must be 32 characters or fewer.' };
  if (!/^[\p{L}\p{N}._\- ]+$/u.test(username)) return { ok: false, error: 'Use only letters, numbers, spaces, dots, dashes or underscores.' };
  return { ok: true, username };
}
