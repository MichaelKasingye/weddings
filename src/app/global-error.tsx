'use client';

import { errorDigest, useDbStatus } from '@/components/errors/useDbStatus';

/** Last resort, when even the root layout fails. It brings its own <html> and plain styles. */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  const status = useDbStatus(error);
  const digest = errorDigest(error);
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0B1B45', color: '#FFF8EC', fontFamily: 'system-ui, sans-serif', padding: 16, boxSizing: 'border-box' }}>
        <title>Something went wrong</title>
        <main style={{ maxWidth: 420, textAlign: 'center' }}>
          <h1 style={{ color: '#F4C553', fontSize: '1.3rem' }}>
            {status.state === 'down' ? status.info.title : 'Something went wrong'}
          </h1>
          <p style={{ lineHeight: 1.55 }}>
            {status.state === 'down' ? status.info.message : status.state === 'checking' ? 'Checking the database connection…' : 'Please try again in a few minutes.'}
          </p>
          <button type="button" onClick={() => retry()} style={{ font: 'inherit', fontWeight: 600, color: '#0B1B45', background: '#F4C553', border: 0, borderRadius: 999, padding: '9px 22px', cursor: 'pointer', marginTop: 8 }}>
            Try again
          </button>
          <p style={{ fontSize: '.75rem', opacity: 0.6, marginTop: 16 }}>
            {status.state === 'down' && `Error: ${status.info.code}`}
            {status.state === 'down' && digest && ' · '}
            {digest && `Ref ${digest}`}
          </p>
        </main>
      </body>
    </html>
  );
}
