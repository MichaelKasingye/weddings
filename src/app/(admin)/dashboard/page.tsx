import Link from 'next/link';
import Icon from '@/components/admin/Icon';
import { col } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { when } from '@/lib/format';

const SENT = { $or: [{ whatsapp: { $ne: null } }, { 'sms.status': { $in: ['sent', 'delivered'] } }] };

export default async function Overview() {
  const user = await requireUser();
  const guests = await col('guests');
  const [totals] = await guests
    .aggregate<{ invitations: number; people: number; views: number; downloads: number }>([
      { $group: { _id: null, invitations: { $sum: 1 }, people: { $sum: '$seats' }, views: { $sum: { $ifNull: ['$opens.count', 0] } }, downloads: { $sum: { $ifNull: ['$pdf.count', 0] } } } },
    ])
    .toArray();
  const [sent, viewed, sentNotViewed, downloaded] = await Promise.all([
    guests.countDocuments(SENT),
    guests.countDocuments({ opens: { $ne: null } }),
    guests.countDocuments({ $and: [SENT, { opens: null }] }),
    guests.countDocuments({ pdf: { $ne: null } }),
  ]);
  const invitations = totals?.invitations ?? 0;
  const people = totals?.people ?? 0;
  const views = totals?.views ?? 0;
  const downloads = totals?.downloads ?? 0;

  // the latest views and downloads, with the guest's name
  const recent = await (await col('guest_events')).find({}).sort({ at: -1 }).limit(12).toArray();
  const recentIds = [...new Map(recent.map((e) => [e.guestId.toHexString(), e.guestId])).values()];
  const recentGuests = new Map(
    (await guests.find({ _id: { $in: recentIds } }, { projection: { name: 1 } }).toArray()).map((g) => [g._id.toHexString(), g.name]),
  );
  const activity = await (await col('activity')).find({}).sort({ at: -1 }).limit(12).toArray();
  const pct = (n: number) => (invitations ? Math.round((n / invitations) * 100) : 0);

  const tiles = [
    { label: 'Invitations', value: invitations, note: 'guests on the list', href: '/dashboard/guests' },
    { label: 'People invited', value: people, note: 'couples count as 2', href: '/dashboard/guests' },
    { label: 'Sent', value: sent, note: `${pct(sent)}% of invitations`, href: '/dashboard/guests?filter=sent', tone: 'var(--ok)' },
    { label: 'Not sent yet', value: invitations - sent, note: 'waiting to be sent', href: '/dashboard/guests?filter=unsent' },
    { label: 'Viewed', value: viewed, note: `${pct(viewed)}% of guests viewed their invite`, href: '/dashboard/guests?filter=viewed', tone: 'var(--info)' },
    { label: 'Sent, not viewed', value: sentNotViewed, note: 'maybe follow up', href: '/dashboard/guests?filter=unviewed', tone: 'var(--warn)' },
    { label: 'Downloaded PDF', value: downloaded, note: `${downloads.toLocaleString('en-GB')} downloads in total`, href: '/dashboard/guests?filter=pdf', tone: 'var(--info)' },
    { label: 'Views in total', value: views, note: 'every time an invite was viewed', href: '/dashboard/guests?filter=viewed' },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Overview</h1>
          <p>Welcome, {user.username}. Click a number to see those guests.</p>
        </div>
        {user.role === 'super' && invitations === 0 && (
          <Link className="btn btn-primary" href="/dashboard/upload"><Icon name="upload" /> Upload the guest list</Link>
        )}
      </div>

      <div className="panel grid grid-cols-2 lg:grid-cols-4 overflow-hidden" style={{ gap: 1, background: 'var(--line)' }}>
        {tiles.map((t) => (
          <Link key={t.label} href={t.href} className="block p-5 transition-colors hover:bg-[#FAFAFA]" style={{ background: 'var(--panel)' }}>
            <p className="muted text-[13px] font-medium flex items-center gap-2">
              {t.tone && <span className="dot" style={{ color: t.tone }} />}
              {t.label}
            </p>
            <p className="text-3xl font-semibold tracking-tight mt-2 tabular-nums">{t.value.toLocaleString('en-GB')}</p>
            <p className="subtle text-xs mt-1">{t.note}</p>
          </Link>
        ))}
      </div>

      {invitations > 0 && (
        <section className="panel p-5 mt-4">
          <div className="flex flex-wrap justify-between gap-2 text-[13px] mb-3">
            <span className="font-medium">Progress</span>
            <span className="muted tabular-nums">{sent} of {invitations} sent · {viewed} viewed · {downloaded} downloaded the PDF</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden flex" style={{ background: 'var(--active)' }} role="img" aria-label={`${pct(viewed)}% viewed, ${pct(sentNotViewed)}% sent but not viewed`}>
            <div style={{ width: `${pct(viewed)}%`, background: 'var(--info)' }} />
            <div style={{ width: `${pct(sentNotViewed)}%`, background: 'var(--warn)' }} />
          </div>
          <div className="flex gap-4 text-xs muted mt-3">
            <span className="flex items-center gap-1.5"><span className="dot" style={{ color: 'var(--info)' }} />Viewed</span>
            <span className="flex items-center gap-1.5"><span className="dot" style={{ color: 'var(--warn)' }} />Sent, not viewed</span>
          </div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-base font-semibold mb-3">Recent guest activity</h2>
        {recent.length === 0 ? (
          <p className="muted panel p-5">No views or downloads yet.</p>
        ) : (
          <div className="panel overflow-x-auto">
            <table className="table">
              <thead>
                <tr><th>Guest</th><th>What</th><th>Device</th><th style={{ textAlign: 'right' }}>When</th></tr>
              </thead>
              <tbody>
                {recent.map((e) => (
                  <tr key={e._id!.toHexString()}>
                    <td className="font-medium">
                      <Link className="hover:underline" href={`/dashboard/guests/${e.guestId.toHexString()}/history`}>{recentGuests.get(e.guestId.toHexString()) ?? 'Deleted guest'}</Link>
                    </td>
                    <td className="muted whitespace-nowrap">{e.type === 'pdf' ? 'Downloaded the PDF' : 'Viewed the invitation'}</td>
                    <td className="muted whitespace-nowrap">{e.device}</td>
                    <td className="subtle tabular-nums whitespace-nowrap text-right">{when(e.at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-base font-semibold mb-3">Recent admin activity</h2>
        {activity.length === 0 ? (
          <p className="muted panel p-5">Nothing yet.</p>
        ) : (
          <div className="panel overflow-x-auto">
            <table className="table">
              <thead>
                <tr><th>Who</th><th>What</th><th style={{ textAlign: 'right' }}>When</th></tr>
              </thead>
              <tbody>
                {activity.map((a) => (
                  <tr key={a._id!.toHexString()}>
                    <td className="font-medium whitespace-nowrap">{a.username}</td>
                    <td className="muted">
                      {a.action}
                      {typeof a.details?.guest === 'string' && <>: <span style={{ color: 'var(--ink)' }}>{a.details.guest}</span></>}
                      {typeof a.details?.admin === 'string' && <>: <span style={{ color: 'var(--ink)' }}>{a.details.admin}</span></>}
                    </td>
                    <td className="subtle tabular-nums whitespace-nowrap text-right">{when(a.at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
