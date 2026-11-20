import Icon from '@/components/admin/Icon';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ObjectId } from 'mongodb';
import ActionForm, { SubmitButton } from '@/components/admin/ActionForm';
import GuestFields from '@/components/admin/GuestFields';
import DeleteGuestButton from '@/components/admin/DeleteGuestButton';
import { requireUser } from '@/lib/auth';
import { col } from '@/lib/db';
import { guestUrl } from '@/lib/guests';
import { formatPhone } from '@/lib/phone';
import { updateGuestAction } from '../../actions';

export default async function EditGuestPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser('super');
  const { id } = await params;
  const guest = ObjectId.isValid(id) ? await (await col('guests')).findOne({ _id: new ObjectId(id) }) : null;
  if (!guest) notFound();
  return (
    <div className="max-w-lg space-y-4">
      <Link href="/dashboard/guests" className="muted text-[13px] inline-flex items-center gap-1.5 hover:text-[var(--ink)]"><Icon name="arrowLeft" size={14} /> Guests</Link>
      <h1>Edit guest</h1>
      <section className="panel p-5">
        <ActionForm action={updateGuestAction}>
          <input type="hidden" name="id" value={id} />
          <GuestFields name={guest.name} phone={formatPhone(guest.phone)} seats={guest.seats} />
          <p className="muted text-xs">
            Personal link: <a className="underline break-all" href={guestUrl(guest)} target="_blank" rel="noopener">{guestUrl(guest)}</a>
            <br />If you change the name, a link already sent keeps working.
          </p>
          <SubmitButton>Save</SubmitButton>
        </ActionForm>
      </section>
      <section className="panel p-5">
        <h2 className="font-semibold">Delete this guest</h2>
        <p className="muted text-sm mt-1 mb-3">Their invitation link stops working and shows “Invitation not found”.</p>
        <DeleteGuestButton id={id} name={guest.name} />
      </section>
    </div>
  );
}
