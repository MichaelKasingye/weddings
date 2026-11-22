'use client';

import { useEffect } from 'react';
import AuthCard from '@/components/admin/AuthCard';
import { errorDigest, useDbStatus } from '@/components/errors/useDbStatus';

/** Login, setup, join and every dashboard page: says what went wrong, and how to fix it when it's the database. */
export default function AdminError({ error, retry }: { error: unknown; retry: () => void }) {
  const status = useDbStatus(error);
  const digest = errorDigest(error);
  useEffect(() => console.error(error), [error]);

  const title =
    status.state === 'checking' ? 'Something went wrong' :
    status.state === 'down' ? status.info.title :
    status.state === 'unknown' ? 'The server can’t be reached' :
    'Something went wrong';

  return (
    <AuthCard title={title}>
      <div className="space-y-4 text-[14px]">
        {status.state === 'checking' && <p className="muted text-center">Checking the database connection…</p>}

        {status.state === 'down' && (
          <>
            <p className="alert alert-bad" role="alert">{status.info.message}</p>
            <div>
              <p className="label">How to fix it</p>
              <p className="muted">{status.info.fix}</p>
            </div>
          </>
        )}

        {status.state === 'up' && (
          <p className="alert alert-warn" role="alert">
            The database is connected, but this page hit an error.
            {process.env.NODE_ENV !== 'production' && error instanceof Error && <><br /><code>{error.message}</code></>}
          </p>
        )}

        {status.state === 'unknown' && (
          <p className="alert alert-bad" role="alert">The app didn’t answer. Check your internet connection, or the server may be restarting.</p>
        )}

        <button type="button" className="btn btn-primary btn-lg w-full" onClick={() => retry()}>Try again</button>

        <p className="subtle text-xs text-center">
          {status.state === 'down' && <>Error: <code>{status.info.code}</code>{digest && ' · '}</>}
          {digest && <>Reference: <code>{digest}</code></>}
        </p>
      </div>
    </AuthCard>
  );
}
