/*
 * React Query hooks for the dashboard (client side). The server renders the first copy of the data
 * and hands it over with <HydrationBoundary>; these hooks keep it fresh and update it after changes.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { GuestRow } from '@/lib/guests';
import { queryKeys } from '@/lib/query-keys';

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' });
  if (res.status === 401) {
    window.location.href = '/login'; // the session ended (logged out elsewhere, or password reset)
    throw new Error('You are not logged in.');
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error || `The server answered ${res.status}.`);
  return body as T;
}

/**
 * The guest list. Refreshes in the background every minute and whenever you come back to the tab
 * (e.g. from WhatsApp), so "Opened" and SMS delivery reports show up without reloading the page.
 */
export function useGuests() {
  return useQuery({
    queryKey: queryKeys.guests,
    queryFn: () => getJson<{ rows: GuestRow[] }>('/api/admin/guests').then((d) => d.rows),
    refetchInterval: 60_000,
  });
}

type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * A change to guests through a server action, applied to the cached list straight away (optimistic).
 * If the server says no, the list goes back to how it was. Afterwards the list is fetched again.
 */
export function useGuestMutation<V, R extends ActionResult>({
  action,
  update,
  onSuccess,
  onError,
}: {
  action: (vars: V) => Promise<R>;
  update: (rows: GuestRow[], vars: V) => GuestRow[];
  onSuccess?: (result: Extract<R, { ok: true }>, vars: V) => void;
  onError?: (message: string) => void;
}) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: queryKeys.guests,
    mutationFn: async (vars: V) => {
      const r = await action(vars);
      if (!r.ok) throw new Error(r.error);
      return r as Extract<R, { ok: true }>;
    },
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: queryKeys.guests }); // a refetch in flight mustn't overwrite the change
      const previous = qc.getQueryData<GuestRow[]>(queryKeys.guests);
      if (previous) qc.setQueryData<GuestRow[]>(queryKeys.guests, update(previous, vars));
      return { previous };
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKeys.guests, ctx.previous);
      onError?.(e instanceof Error ? e.message : 'Something went wrong.');
    },
    onSuccess: (r, vars) => onSuccess?.(r, vars),
    onSettled: () => {
      // refetch once the last of several quick changes has finished, so the list doesn't flicker
      if (qc.isMutating({ mutationKey: queryKeys.guests }) === 1) void qc.invalidateQueries({ queryKey: queryKeys.guests });
    },
  });
}

/** Changes the cached guest list directly (e.g. after each batch of SMS). */
export function useSetGuests() {
  const qc = useQueryClient();
  return (fn: (rows: GuestRow[]) => GuestRow[]) => qc.setQueryData<GuestRow[]>(queryKeys.guests, (rows) => fn(rows ?? []));
}
