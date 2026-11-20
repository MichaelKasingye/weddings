import 'server-only';
import { col, type InviteDoc, type UserDoc } from './db';
import { sha256 } from './crypto';

export const INVITE_HOURS = 24;

/** A join / reset link that hasn't been used, cancelled or expired. */
export async function findValidInvite(token: string): Promise<{ invite: InviteDoc; user: UserDoc | null } | null> {
  if (!token || token.length < 20 || token.length > 100) return null;
  const invite = await (await col('invites')).findOne({
    tokenHash: sha256(token),
    usedAt: null,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  });
  if (!invite) return null;
  let user: UserDoc | null = null;
  if (invite.purpose === 'reset') {
    user = invite.userId ? await (await col('users')).findOne({ _id: invite.userId, active: true }) : null;
    if (!user) return null;
  }
  return { invite, user };
}
