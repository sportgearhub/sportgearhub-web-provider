import { useEffect, useRef } from 'react';

// A fixed-length numeric passcode entry. It renders one box per digit but keeps a single input behind
// them, so paste, autofill and mobile keyboards behave normally.
export function PasscodeInput({
  value,
  onChange,
  length,
  autoFocus = false,
  label,
  disabled = false,
}: {
  value: string;
  onChange: (next: string) => void;
  length: number;
  autoFocus?: boolean;
  label: string;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-gray-700">{label}</label>
      <div className="relative">
        <input
          ref={inputRef}
          value={value}
          onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, length))}
          inputMode="numeric"
          autoComplete="one-time-code"
          disabled={disabled}
          aria-label={label}
          className="absolute inset-0 h-full w-full cursor-default text-transparent caret-transparent opacity-0"
        />
        <div className="pointer-events-none flex gap-2">
          {Array.from({ length }, (_, index) => (
            <div
              key={index}
              className={`flex h-12 flex-1 items-center justify-center rounded-lg border text-lg font-semibold ${
                index === value.length && !disabled
                  ? 'border-blue-500 bg-white ring-2 ring-blue-100'
                  : 'border-gray-200 bg-gray-50'
              } ${disabled ? 'opacity-60' : ''}`}
            >
              {value[index] ? '•' : ''}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
