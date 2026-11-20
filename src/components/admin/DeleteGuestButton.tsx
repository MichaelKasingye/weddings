'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { deleteGuestsAction } from '@/app/(admin)/dashboard/actions';

export default function DeleteGuestButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [error, setError] = useState('');
  return (
    <>
      {error && <p className="alert alert-bad mb-3">{error}</p>}
      <button
        className="btn btn-danger"
        onClick={async () => {
          if (!confirm(`Delete ${name}? Their invitation link will stop working.`)) return;
          const r = await deleteGuestsAction([id]);
          if (r.ok) router.push('/dashboard/guests'); else setError(r.error);
        }}
      >
        Delete {name}
      </button>
    </>
  );
}
