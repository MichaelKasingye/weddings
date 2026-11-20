'use client';

import { useState } from 'react';
import { when } from '@/lib/format';
import { createInviteLinkAction, createResetLinkAction, removeAdminAction, revokeInviteAction } from '@/app/(admin)/dashboard/actions';

type U = { id: string; username: string; role: 'super' | 'admin'; lastLoginAt: string | null; createdAt: string };
type P = { id: string; purpose: 'join' | 'reset'; forUser: string | null; createdAt: string; expiresAt: string };

/** Shows a freshly made link once, with Copy and Send on WhatsApp. */
function NewLink({ link, title, message, onClose }: { link: string; title: string; message: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="alert alert-ok space-y-2">
      <p className="font-semibold">{title}</p>
      <input className="input font-mono text-xs" readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Link" />
      <p className="text-xs">Send it however you like. It works once and expires in 24 hours. It won’t be shown again, so copy it now.</p>
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-sm btn-primary" onClick={async () => { try { await navigator.clipboard.writeText(link); setCopied(true); } catch { /* the field above is selectable */ } }}>
          {copied ? 'Copied ✓' : 'Copy link'}
        </button>
        <a className="btn btn-sm btn-wa" href={'https://wa.me/?text=' + encodeURIComponent(message + ' ' + link)} target="_blank" rel="noopener">Send on WhatsApp</a>
        <button className="btn btn-sm" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}

export default function TeamManager({ meId, users, pending }: { meId: string; users: U[]; pending: P[] }) {
  const [link, setLink] = useState<{ link: string; title: string; message: string } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function newInvite() {
    setBusy(true); setError('');
    const r = await createInviteLinkAction();
    setBusy(false);
    if (r.ok) setLink({ link: r.link, title: 'Invite link created', message: 'You are invited to help send the invitations for the wedding of Aaron & Josephine. Open this link to create your account:' });
    else setError(r.error);
  }
  async function reset(u: U) {
    if (!confirm(`Create a password reset link for ${u.username}? Any older reset link for them stops working.`)) return;
    setError('');
    const r = await createResetLinkAction(u.id);
    if (r.ok) setLink({ link: r.link, title: `Password reset link for ${r.username}`, message: `${r.username}, open this link to set a new password for the wedding invitations dashboard:` });
    else setError(r.error);
  }
  async function remove(u: U) {
    if (!confirm(`Remove ${u.username}? They are logged out and can no longer log in.`)) return;
    const r = await removeAdminAction(u.id);
    if (!r.ok) setError(r.error);
  }
  async function revoke(p: P) {
    if (!confirm('Cancel this link? It will stop working.')) return;
    const r = await revokeInviteAction(p.id);
    if (!r.ok) setError(r.error);
  }

  return (
    <div className="space-y-4">
      {error && <p className="alert alert-bad">{error}</p>}
      {link && <NewLink {...link} onClose={() => setLink(null)} />}

      <section className="panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Invite an admin</h2>
            <p className="muted text-sm">Creates a link. The person opens it, picks a username and password, and is in.</p>
          </div>
          <button className="btn btn-primary" onClick={newInvite} disabled={busy}>{busy ? 'Creating…' : 'Create invite link'}</button>
        </div>
      </section>

      <section className="panel">
        <h2 className="font-semibold px-5 pt-4 pb-2">Members ({users.length})</h2>
        <ul>
          {users.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-3 px-5 py-3 border-t" style={{ borderColor: 'var(--line)' }}>
              <div className="flex-1 min-w-[10rem]">
                <p className="font-medium">
                  {u.username} {u.id === meId && <span className="muted text-xs">(you)</span>}{' '}
                  <span className={'chip ' + (u.role === 'super' ? 'chip-info' : 'chip-muted')}>{u.role === 'super' ? 'Super admin' : 'Admin'}</span>
                </p>
                <p className="muted text-xs">{u.lastLoginAt ? `Last login ${when(u.lastLoginAt)}` : 'Never logged in'} · joined {when(u.createdAt)}</p>
              </div>
              {u.role !== 'super' && (
                <div className="flex gap-2">
                  <button className="btn btn-sm" onClick={() => reset(u)}>Reset password</button>
                  <button className="btn btn-sm btn-danger" onClick={() => remove(u)}>Remove</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h2 className="font-semibold px-5 pt-4 pb-2">Links not used yet ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="muted text-sm px-5 pb-4">None.</p>
        ) : (
          <ul>
            {pending.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3 border-t" style={{ borderColor: 'var(--line)' }}>
                <div className="flex-1 min-w-[10rem] text-sm">
                  <p className="font-medium">{p.purpose === 'join' ? 'Admin invite' : `Password reset for ${p.forUser ?? '?'}`}</p>
                  <p className="muted text-xs">Created {when(p.createdAt)} · expires {when(p.expiresAt)}</p>
                </div>
                <button className="btn btn-sm btn-danger" onClick={() => revoke(p)}>Cancel link</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
