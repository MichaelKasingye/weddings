import TeamManager from '@/components/admin/TeamManager';
import { MAX_SUPER_ADMINS, requireUser } from '@/lib/auth';
import { col } from '@/lib/db';

export default async function TeamPage() {
  const me = await requireUser('super');
  const [users, invites] = await Promise.all([
    (await col('users')).find({}).sort({ role: -1, usernameLower: 1 }).toArray(),
    (await col('invites')).find({ usedAt: null, revokedAt: null, expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 }).toArray(),
  ]);
  const names = new Map(users.map((u) => [u._id.toHexString(), u.username]));
  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1>Team</h1>
        <p className="muted text-sm">
          Admins can see the guest list and send invitations. Super admins (up to {MAX_SUPER_ADMINS}) can also add, edit or delete guests,
          change settings and manage the team.
        </p>
      </div>
      <TeamManager
        meId={me.id}
        maxSupers={MAX_SUPER_ADMINS}
        users={users.map((u) => ({ id: u._id.toHexString(), username: u.username, role: u.role, lastLoginAt: u.lastLoginAt?.toISOString() ?? null, createdAt: u.createdAt.toISOString() }))}
        pending={invites.map((i) => ({
          id: i._id.toHexString(),
          purpose: i.purpose,
          forUser: i.userId ? names.get(i.userId.toHexString()) ?? null : null,
          createdAt: i.createdAt.toISOString(),
          expiresAt: i.expiresAt.toISOString(),
        }))}
      />
    </div>
  );
}
