'use client';

import { useEffect, useState } from 'react';
import type { DbErrorInfo } from '@/lib/db-errors';

export type DbStatus =
  | { state: 'checking' }
  | { state: 'down'; info: DbErrorInfo } // the database is the problem
  | { state: 'up' } // the database is fine: the error is something else
  | { state: 'unknown' }; // couldn't even reach /api/health (offline, server down)

/**
 * In production Next.js hides server error messages from the browser, so an error page can't tell
 * on its own whether the database was the problem. This asks /api/health, which says why.
 */
export function useDbStatus(error: unknown): DbStatus {
  const [status, setStatus] = useState<DbStatus>({ state: 'checking' });
  useEffect(() => {
    let cancelled = false;
    setStatus({ state: 'checking' });
    fetch('/api/health?quick=1', { cache: 'no-store' })
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (cancelled) return;
        if (res.ok) setStatus({ state: 'up' });
        else if (body?.database?.error) {
          const d = body.database;
          setStatus({ state: 'down', info: { code: d.error, title: d.title, message: d.message, fix: d.fix } });
        } else setStatus({ state: 'unknown' });
      })
      .catch(() => { if (!cancelled) setStatus({ state: 'unknown' }); });
    return () => { cancelled = true; };
  }, [error]);
  return status;
}

export function errorDigest(error: unknown): string | undefined {
  return error && typeof error === 'object' && 'digest' in error ? String((error as { digest?: unknown }).digest ?? '') || undefined : undefined;
}
