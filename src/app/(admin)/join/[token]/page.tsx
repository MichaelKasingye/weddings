import type { Metadata } from 'next';
import AuthCard from '@/components/admin/AuthCard';
import ActionForm, { SubmitButton } from '@/components/admin/ActionForm';
import { findValidInvite } from '@/lib/invites';
import { joinAction } from '../../auth-actions';

export const metadata: Metadata = { title: 'Join · Invitations', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await findValidInvite(token);
  if (!found) {
    return (
      <AuthCard title="This link no longer works">
        <p className="text-sm">Links expire after 24 hours and can only be used once. Ask the super admin to send you a new one.</p>
        <a className="btn btn-lg mt-2 w-full" href="/login">Go to log in</a>
      </AuthCard>
    );
  }
  const reset = found.invite.purpose === 'reset';
  const expires = found.invite.expiresAt.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Kampala' });
  return (
    <AuthCard
      title={reset ? `Set a new password for ${found.user!.username}` : 'Join the invitations team'}
      subtitle={reset ? `This link works once, until ${expires}.` : `Choose your username and password. This link works once, until ${expires}.`}
    >
      <ActionForm action={joinAction}>
        <input type="hidden" name="token" value={token} />
        {!reset && (
          <div>
            <label className="label" htmlFor="username">Username</label>
            <input className="input" id="username" name="username" required minLength={3} maxLength={32} autoComplete="username" autoFocus />
          </div>
        )}
        <div>
          <label className="label" htmlFor="password">Password (at least 8 characters)</label>
          <input className="input" id="password" name="password" type="password" minLength={8} required autoComplete="new-password" />
        </div>
        <div>
          <label className="label" htmlFor="confirm">Repeat password</label>
          <input className="input" id="confirm" name="confirm" type="password" minLength={8} required autoComplete="new-password" />
        </div>
        <SubmitButton className="btn btn-primary btn-lg w-full">{reset ? 'Save new password' : 'Create my account'}</SubmitButton>
      </ActionForm>
    </AuthCard>
  );
}
