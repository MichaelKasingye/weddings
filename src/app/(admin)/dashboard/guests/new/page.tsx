import Icon from '@/components/admin/Icon';
import Link from 'next/link';
import ActionForm, { SubmitButton } from '@/components/admin/ActionForm';
import GuestFields from '@/components/admin/GuestFields';
import { requireUser } from '@/lib/auth';
import { addGuestAction } from '../../actions';

export default async function NewGuestPage() {
  await requireUser('super');
  return (
    <div className="max-w-lg space-y-4">
      <Link href="/dashboard/guests" className="muted text-[13px] inline-flex items-center gap-1.5 hover:text-[var(--ink)]"><Icon name="arrowLeft" size={14} /> Guests</Link>
      <h1>Add a guest</h1>
      <section className="panel p-5">
        <ActionForm action={addGuestAction} resetOnSuccess>
          <GuestFields />
          <SubmitButton>Add guest</SubmitButton>
        </ActionForm>
      </section>
    </div>
  );
}
