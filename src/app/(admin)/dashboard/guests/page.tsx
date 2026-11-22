import Link from 'next/link';
import GuestTable, { type Filter } from '@/components/admin/GuestTable';
import Icon from '@/components/admin/Icon';
import { requireUser } from '@/lib/auth';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { listGuestRows } from '@/lib/guests';
import { makeQueryClient } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { getSettings } from '@/lib/settings';
import { smsConfig } from '@/lib/sms';

const FILTERS: Filter[] = ['all', 'unsent', 'sent', 'opened', 'unopened'];

export default async function GuestsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const user = await requireUser();
  const { filter } = await searchParams;
  const [settings, rows] = await Promise.all([getSettings(), listGuestRows()]);
  const people = rows.reduce((n, g) => n + g.seats, 0);
  // hand the list to React Query in the browser, so it starts with this data instead of fetching it again
  const queryClient = makeQueryClient();
  queryClient.setQueryData(queryKeys.guests, rows);
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
      <HydrationBoundary state={dehydrate(queryClient)}>
        <GuestTable
          isSuper={user.role === 'super'}
          smsReady={smsConfig().configured && settings.smsEnabled}
          me={user.username}
          initialFilter={FILTERS.includes(filter as Filter) ? (filter as Filter) : 'all'}
        />
      </HydrationBoundary>
    </>
  );
}
