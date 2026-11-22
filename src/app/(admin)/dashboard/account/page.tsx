import ActionForm, { SubmitButton } from '@/components/admin/ActionForm';
import { requireUser } from '@/lib/auth';
import { changePasswordAction, changeUsernameAction } from '../actions';
import PasswordInput from '@/components/admin/PasswordInput';

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <div className="max-w-lg space-y-4">
      <h1>My account</h1>

      <section className="panel p-5">
        <h2 className="font-semibold mb-3">Change username</h2>
        <ActionForm action={changeUsernameAction}>
          <div>
            <label className="label" htmlFor="username">New username</label>
            <input className="input" id="username" name="username" defaultValue={user.username} required minLength={3} maxLength={32} autoComplete="username" />
          </div>
          <div>
            <label className="label" htmlFor="password-u">Current password</label>
            <PasswordInput id="password-u" name="password" required autoComplete="current-password" />
          </div>
          <SubmitButton>Save username</SubmitButton>
        </ActionForm>
      </section>

      <section className="panel p-5">
        <h2 className="font-semibold mb-3">Change password</h2>
        <ActionForm action={changePasswordAction} resetOnSuccess>
          <div>
            <label className="label" htmlFor="current">Current password</label>
            <PasswordInput id="current" name="current" required autoComplete="current-password" />
          </div>
          <div>
            <label className="label" htmlFor="password">New password (at least 8 characters)</label>
            <PasswordInput id="password" name="password" minLength={8} required autoComplete="new-password" />
          </div>
          <div>
            <label className="label" htmlFor="confirm">Repeat new password</label>
            <PasswordInput id="confirm" name="confirm" minLength={8} required autoComplete="new-password" />
          </div>
          <SubmitButton>Change password</SubmitButton>
        </ActionForm>
      </section>
    </div>
  );
}
