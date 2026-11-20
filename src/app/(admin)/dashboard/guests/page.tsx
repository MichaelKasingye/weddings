import Link from 'next/link';
import GuestTable, { type Filter } from '@/components/admin/GuestTable';
import Icon from '@/components/admin/Icon';
import { requireUser } from '@/lib/auth';
import { col } from '@/lib/db';
import { toGuestRow } from '@/lib/guests';
import { getSettings } from '@/lib/settings';
import { smsConfig } from '@/lib/sms';

const FILTERS: Filter[] = ['all', 'unsent', 'sent', 'opened', 'unopened'];

export default async function GuestsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const user = await requireUser();
  const { filter } = await searchParams;
  const [settings, docs] = await Promise.all([
    getSettings(),
    (await col('guests')).find({}).collation({ locale: 'en', strength: 2 }).sort({ name: 1 }).toArray(),
  ]);
  const templates = { whatsapp: settings.whatsappMessage, sms: settings.smsMessage };
  const rows = docs.map((g) => toGuestRow(g, templates));
  const people = docs.reduce((n, g) => n + g.seats, 0);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Guests</h1>
          <p>{rows.length} invitations · {people} people</p>
        </div>
        {user.role === 'super' && (
          <div className="flex gap-2">
            <Link href="/dashboard/upload" className="btn"><Icon name="upload" /> Upload</Link>
            <Link href="/dashboard/guests/new" className="btn btn-primary"><Icon name="plus" /> Add guest</Link>
          </div>
        )}
      </div>
      <GuestTable
        initialRows={rows}
        isSuper={user.role === 'super'}
        smsReady={smsConfig().configured && settings.smsEnabled}
        me={user.username}
        initialFilter={FILTERS.includes(filter as Filter) ? (filter as Filter) : 'all'}
      />
    </>
  );
}
