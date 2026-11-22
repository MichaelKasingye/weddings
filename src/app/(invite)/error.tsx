'use client';

import { useEffect } from 'react';
import Notice from '@/components/notice/Notice';
import { errorDigest, useDbStatus } from '@/components/errors/useDbStatus';
import { DEFAULT_SETTINGS } from '@/lib/wedding';

/**
 * The guest side (/ and /i/<link>). Guests get a calm message and the RSVP contacts; the technical
 * reason is one small line, so they can pass it on. The fix instructions are only on the admin side.
 */
export default function InviteError({ error, retry }: { error: unknown; retry: () => void }) {
  const status = useDbStatus(error);
  const digest = errorDigest(error);
  useEffect(() => console.error(error), [error]);

  return (
    <Notice
      title="We can’t open the invitation right now"
      contacts={DEFAULT_SETTINGS.rsvpContacts}
      contactsLead="If this keeps happening, please contact:"
    >
      <p>
        {status.state === 'down'
          ? 'Our invitation system can’t reach its database at the moment.'
          : 'Something went wrong while loading this page.'}{' '}
        Please try again in a few minutes.
      </p>
      <p style={{ marginTop: 18 }}>
        <button
          type="button"
          onClick={() => retry()}
          style={{ font: 'inherit', fontWeight: 600, color: '#0B1B45', background: '#F4C553', border: 0, borderRadius: 999, padding: '9px 22px', cursor: 'pointer' }}
        >
          Try again
        </button>
      </p>
      <p style={{ marginTop: 14, fontSize: '.75rem', opacity: 0.6 }}>
        {status.state === 'checking' && 'Checking the connection…'}
        {status.state === 'down' && `Error: ${status.info.title} (${status.info.code})`}
        {status.state === 'unknown' && 'Error: the server did not answer'}
        {digest && ` · Ref ${digest}`}
      </p>
    </Notice>
  );
}
