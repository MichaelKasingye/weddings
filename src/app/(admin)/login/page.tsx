import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import AuthCard from '@/components/admin/AuthCard';
import ActionForm, { SubmitButton } from '@/components/admin/ActionForm';
import { getCurrentUser } from '@/lib/auth';
import { col } from '@/lib/db';
import { loginAction } from '../auth-actions';

export const metadata: Metadata = { title: 'Log in · Invitations', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  if (await getCurrentUser()) redirect('/dashboard');
  if (!(await (await col('users')).countDocuments({}, { limit: 1 }))) redirect('/setup');
  return (
    <AuthCard title="Log in to the dashboard" subtitle="Aaron &amp; Josephine’s wedding invitations">
      <ActionForm action={loginAction}>
        <div>
          <label className="label" htmlFor="username">Username</label>
          <input className="input" id="username" name="username" autoComplete="username" required autoFocus />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <SubmitButton className="btn btn-primary btn-lg w-full" pendingText="Logging in…">Log in</SubmitButton>
        <p className="muted text-xs text-center">Forgot your password? Ask the super admin for a reset link.</p>
      </ActionForm>
    </AuthCard>
  );
}
