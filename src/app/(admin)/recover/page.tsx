import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import AuthCard from '@/components/admin/AuthCard';
import ActionForm, { SubmitButton } from '@/components/admin/ActionForm';
import PasswordInput from '@/components/admin/PasswordInput';
import { col } from '@/lib/db';
import { recoverAction } from '../auth-actions';

export const metadata: Metadata = { title: 'Reset super admin password · Invitations', robots: { index: false } };
export const dynamic = 'force-dynamic';

/** The super admin forgot their password: a new one with the SETUP_CODE from the environment variables. */
export default async function RecoverPage() {
  const supers = await (await col('users')).find({ role: 'super', active: true }, { sort: { createdAt: 1 }, projection: { username: 1 } }).toArray();
  if (!supers.length) redirect('/setup');

  if (!process.env.SETUP_CODE) {
    return (
      <AuthCard title="Reset the super admin password">
        <div className="space-y-4 text-[14px]">
          <p className="alert alert-warn">This needs a setup code, and none is set.</p>
          <p className="muted">
            Add <code>SETUP_CODE</code> (any secret) to the environment variables (<code>.env.local</code>, or Vercel → Settings →
            Environment Variables, then redeploy) and open this page again. Or, on a computer with the project, run{' '}
            <code>npm run reset-password</code>.
          </p>
          <p className="text-center"><a className="underline text-[13px]" href="/login">Back to log in</a></p>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset the super admin password"
      subtitle="Enter the setup code (SETUP_CODE in the environment variables) and choose a new password."
    >
      <ActionForm action={recoverAction}>
        <div>
          <label className="label" htmlFor="username">{supers.length > 1 ? 'Which super admin?' : 'Username'}</label>
          {supers.length > 1 ? (
            <select className="input" id="username" name="username" required defaultValue="">
              <option value="" disabled>Choose…</option>
              {supers.map((u) => <option key={u._id.toHexString()} value={u.username}>{u.username}</option>)}
            </select>
          ) : (
            <input className="input" id="username" name="username" defaultValue={supers[0].username} readOnly autoComplete="username" />
          )}
        </div>
        <div>
          <label className="label" htmlFor="setupCode">Setup code</label>
          <input className="input" id="setupCode" name="setupCode" required autoComplete="off" autoFocus />
        </div>
        <div>
          <label className="label" htmlFor="password">New password (at least 8 characters)</label>
          <PasswordInput id="password" name="password" minLength={8} required autoComplete="new-password" />
        </div>
        <div>
          <label className="label" htmlFor="confirm">Repeat new password</label>
          <PasswordInput id="confirm" name="confirm" minLength={8} required autoComplete="new-password" />
        </div>
        <SubmitButton className="btn btn-primary btn-lg w-full" pendingText="Saving…">Save new password and log in</SubmitButton>
        <p className="muted text-xs text-center">This logs that super admin out on every other device. <a className="underline" href="/login">Back to log in</a></p>
      </ActionForm>
    </AuthCard>
  );
}
