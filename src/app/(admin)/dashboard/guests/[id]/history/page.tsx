import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ObjectId } from 'mongodb';
import Icon from '@/components/admin/Icon';
import { requireUser } from '@/lib/auth';
import { col } from '@/lib/db';
import { guestPath } from '@/lib/guests';
import { formatPhone } from '@/lib/phone';
import { when } from '@/lib/format';

const SHOW = 200;

/** Everything a guest did with their invitation: each view and each PDF download, with the device. */
export default async function GuestHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const guest = ObjectId.isValid(id) ? await (await col('guests')).findOne({ _id: new ObjectId(id) }) : null;
  if (!guest) notFound();
  const guestEvents = await col('guest_events');
  const [events, loggedViews] = await Promise.all([
    guestEvents.find({ guestId: guest._id }).sort({ at: -1 }).limit(SHOW).toArray(),
    guestEvents.countDocuments({ guestId: guest._id, type: 'view' }),
  ]);
  // views counted before the history was added have a count but no rows
  const earlierViews = Math.max(0, (guest.opens?.count ?? 0) - loggedViews);

  const stat = (label: string, c: { count: number; firstAt: Date; lastAt: Date } | null | undefined, none: string) => (
    <div className="p-5" style={{ background: 'var(--panel)' }}>
      <p className="muted text-[13px] font-medium">{label}</p>
      <p className="text-3xl font-semibold tracking-tight mt-2 tabular-nums">{c?.count ?? 0}</p>
      <p className="subtle text-xs mt-1">{c ? `first ${when(c.firstAt)} · last ${when(c.lastAt)}` : none}</p>
    </div>
  );

  return (
    <div className="max-w-3xl space-y-4">
      <Link href="/dashboard/guests" className="muted text-[13px] inline-flex items-center gap-1.5 hover:text-[var(--ink)]"><Icon name="arrowLeft" size={14} /> Guests</Link>
      <div className="page-head">
        <div>
          <h1>{guest.name}</h1>
          <p>{formatPhone(guest.phone)} · {guest.seats} {guest.seats === 1 ? 'seat' : 'seats'}</p>
        </div>
        <div className="flex gap-2">
          <a className="btn" href={guestPath(guest)} target="_blank" rel="noopener"><Icon name="external" /> View invitation</a>
          {user.role === 'super' && <Link className="btn" href={`/dashboard/guests/${id}`}><Icon name="pencil" /> Edit</Link>}
        </div>
      </div>

      <div className="panel grid grid-cols-2 overflow-hidden" style={{ gap: 1, background: 'var(--line)' }}>
        {stat('Viewed', guest.opens, 'not viewed yet')}
        {stat('Downloaded as PDF', guest.pdf, 'not downloaded yet')}
      </div>

      <section className="panel overflow-x-auto">
        <h2 className="font-semibold px-5 pt-4 pb-2">History{events.length === SHOW ? ` (latest ${SHOW})` : ''}</h2>
        {events.length === 0 ? (
          <p className="muted text-sm px-5 pb-4">Nothing yet. Views and downloads appear here as they happen.</p>
        ) : (
          <table className="table">
            <thead>
              <tr><th>What</th><th>Device</th><th style={{ textAlign: 'right' }}>When</th></tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e._id!.toHexString()}>
                  <td className="font-medium whitespace-nowrap">
                    <span className="inline-flex items-center gap-2">
                      <Icon name={e.type === 'pdf' ? 'download' : 'eye'} size={14} />
                      {e.type === 'pdf' ? 'Downloaded the PDF' : 'Viewed the invitation'}
                    </span>
                  </td>
                  <td className="muted">{e.device}</td>
                  <td className="subtle tabular-nums whitespace-nowrap text-right">{when(e.at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <p className="subtle text-xs">
        A view is counted when the invitation loads on a screen; WhatsApp’s link preview and admins previewing it don’t count.
        Everything on this personal link is counted for {guest.name}, including anyone they forwarded it to.
        {earlierViews > 0 && ` ${earlierViews} earlier ${earlierViews === 1 ? 'view was' : 'views were'} counted before this history started, so ${earlierViews === 1 ? 'it isn’t' : 'they aren’t'} listed.`}
      </p>
    </div>
  );
}
