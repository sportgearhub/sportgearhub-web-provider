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
      <label className="mb-2 block text-center text-xs font-medium text-gray-700">{label}</label>
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
        {/* Capped rather than fixed: a row of dots stretched edge to edge reads as an input
            missing something, but six cells still have to fit a 320px phone. */}
        <div className="pointer-events-none flex justify-center gap-2 sm:gap-2.5">
          {Array.from({ length }, (_, index) => (
            <div
              key={index}
              className={`flex h-12 min-w-0 max-w-[2.75rem] flex-1 items-center justify-center rounded-lg border text-xl leading-none ${
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
