import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import AuthCard from '@/components/admin/AuthCard';
import ActionForm, { SubmitButton } from '@/components/admin/ActionForm';
import { col } from '@/lib/db';
import { setupAction } from '../auth-actions';

export const metadata: Metadata = { title: 'Set up · Invitations', robots: { index: false } };
export const dynamic = 'force-dynamic';

/** Shown only until the super admin exists. */
export default async function SetupPage() {
  if (await (await col('users')).countDocuments({}, { limit: 1 })) redirect('/login');
  const username = process.env.SUPER_ADMIN_USERNAME || '';
  const needsCode = Boolean(process.env.SETUP_CODE);
  return (
    <AuthCard title="Set up the super admin" subtitle="Choose the password for the super admin account. You only do this once.">
      <ActionForm action={setupAction}>
        <div>
          <label className="label" htmlFor="username">Username</label>
          <input className="input" id="username" name="username" defaultValue={username} readOnly={Boolean(username)} required autoComplete="username" />
        </div>
        {needsCode && (
          <div>
            <label className="label" htmlFor="setupCode">Setup code</label>
            <input className="input" id="setupCode" name="setupCode" required autoComplete="off" />
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
        <SubmitButton className="btn btn-primary btn-lg w-full">Create super admin</SubmitButton>
      </ActionForm>
    </AuthCard>
  );
}
