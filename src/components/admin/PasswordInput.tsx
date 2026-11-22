'use client';

import { useState } from 'react';
import Icon from './Icon';

/** A password field with an eye button to show or hide what was typed. */
export default function PasswordInput({
  id,
  name,
  autoComplete,
  minLength,
  required,
  autoFocus,
}: {
  id: string;
  name: string;
  autoComplete?: string;
  minLength?: number;
  required?: boolean;
  autoFocus?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        className="input pr-10"
        id={id}
        name={name}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        minLength={minLength}
        required={required}
        autoFocus={autoFocus}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-1 top-1/2 -translate-y-1/2 grid place-items-center w-8 h-8 rounded-md subtle hover:text-[var(--ink)] hover:bg-[var(--hover)]"
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        aria-controls={id}
        title={visible ? 'Hide password' : 'Show password'}
      >
        <Icon name={visible ? 'eyeOff' : 'eye'} size={16} />
      </button>
    </div>
  );
}
