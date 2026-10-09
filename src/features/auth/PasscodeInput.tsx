import { useEffect, useRef } from 'react';
import { Delete } from 'lucide-react';

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

  const press = (digit: string) => {
    if (disabled || value.length >= length) return;
    onChange(value + digit);
  };

  const back = () => {
    if (disabled || value.length === 0) return;
    onChange(value.slice(0, -1));
  };

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
          // 16px even though it is invisible: iOS decides whether to zoom from the font size.
          className="absolute inset-0 h-full w-full cursor-default text-base text-transparent caret-transparent opacity-0"
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

      {/* A keypad of our own on touch screens.
          The system keyboard covers half a phone to offer letters nobody needs here, and on the
          way up it pushes the cells it is there to fill off the top of the screen. Three columns,
          because that is where a thumb expects digits — and the hidden field above still accepts
          a pasted code or a one-time-code autofill. */}
      <div className="mt-5 grid grid-cols-3 gap-2 sm:hidden">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(digit => (
          <KeypadKey key={digit} onPress={() => press(digit)} disabled={disabled}>{digit}</KeypadKey>
        ))}
        <span aria-hidden="true" />
        <KeypadKey onPress={() => press('0')} disabled={disabled}>0</KeypadKey>
        <KeypadKey onPress={back} disabled={disabled || value.length === 0} label="Стереть">
          <Delete size={20} />
        </KeypadKey>
      </div>
    </div>
  );
}

function KeypadKey({
  children,
  onPress,
  disabled,
  label,
}: {
  children: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      // The hidden field keeps focus, so the caret never leaves and the system keyboard never
      // arrives to fight this one for the screen.
      onMouseDown={event => event.preventDefault()}
      onClick={onPress}
      disabled={disabled}
      aria-label={label}
      className="flex h-14 items-center justify-center rounded-xl bg-gray-100 text-2xl font-medium text-gray-900 transition active:bg-gray-200 disabled:opacity-40"
    >
      {children}
    </button>
  );
}
