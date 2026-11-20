'use client';

import { useState } from 'react';
import { setSmsEnabledAction } from '@/app/(admin)/dashboard/actions';

export default function SmsToggle({ enabled }: { enabled: boolean }) {
  const [on, setOn] = useState(enabled);
  const [error, setError] = useState('');
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-3 cursor-pointer text-sm font-medium">
        <input
          type="checkbox"
          className="w-4 h-4"
          checked={on}
          onChange={async (e) => {
            const want = e.target.checked;
            setOn(want); setError('');
            const r = await setSmsEnabledAction(want);
            if (!r.ok) { setOn(!want); setError(r.error); }
          }}
        />
        Allow admins to send SMS invitations
      </label>
      {error && <p className="alert alert-bad">{error}</p>}
    </div>
  );
}
