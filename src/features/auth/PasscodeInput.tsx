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
      <label className="mb-2.5 block text-xs font-medium text-foreground">{label}</label>
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
        <div className="pointer-events-none flex gap-2 sm:gap-2.5">
          {Array.from({ length }, (_, index) => (
            <div
              key={index}
              className={`flex h-12 min-w-0 max-w-[3rem] flex-1 items-center justify-center rounded-xl border text-xl leading-none transition-colors ${
                index === value.length && !disabled
                  ? 'border-primary bg-background ring-2 ring-primary/15'
                  : 'border-input bg-muted/40'
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
