import { useRef, useState, type ChangeEvent } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { AnchoredPopover } from './AnchoredPopover';

interface SelectProps {
  label?: string;
  error?: string;
  options: { value: string; label: string; disabled?: boolean }[];
  value?: string | number | readonly string[];
  /** Kept event-shaped so the call sites read the same as any other field: `e.target.value`. */
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
  'aria-label'?: string;
}

/**
 * A dropdown, not the platform's select.
 *
 * It looks the same on every OS, its list can be styled to match the rest of the console, and a
 * long option wraps instead of being cut to the width of the closed field. The panel is portalled,
 * so it is not clipped when the field sits inside a dialog or a scrolling panel.
 */
export function Select({
  label,
  error,
  options,
  className = '',
  value,
  onChange,
  disabled,
  id,
  name,
  'aria-label': ariaLabel,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const current = String(value ?? '');
  const selected = options.find(option => option.value === current);

  const pick = (next: string) => {
    setOpen(false);
    // The call sites only ever read `target.value`, and keeping that shape means none of them had
    // to change when this stopped being a <select>.
    onChange?.({ target: { value: next, name: name ?? '' } } as ChangeEvent<HTMLSelectElement>);
  };

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-xs font-medium text-foreground">{label}</label>
      )}

      <button
        ref={buttonRef}
        aria-label={ariaLabel}
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setOpen(current => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={Boolean(error) || undefined}
        className={cn(
          'flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 py-2 text-left text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          open && 'border-blue-500 ring-2 ring-blue-500/15',
          error && 'border-destructive focus-visible:ring-destructive/40',
          className
        )}
      >
        <span className={cn('truncate', !selected && 'text-muted-foreground')}>
          {selected?.label ?? ''}
        </span>
        <ChevronDown size={15} className={cn('shrink-0 text-gray-400 transition-transform', open && 'rotate-180')} />
      </button>

      <AnchoredPopover
        anchorRef={buttonRef}
        open={open}
        onClose={() => setOpen(false)}
        width={buttonRef.current?.offsetWidth}
      >
        <div role="listbox" className="max-h-72 overflow-y-auto">
          {options.length === 0 && <p className="px-3 py-2 text-sm text-gray-500">Нет вариантов</p>}
          {options.map(option => {
            const isSelected = option.value === current;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={option.disabled}
                onClick={() => pick(option.value)}
                className={cn(
                  'flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition',
                  option.disabled
                    ? 'cursor-not-allowed text-gray-400'
                    : isSelected
                      ? 'bg-blue-50 text-blue-900'
                      : 'text-gray-900 hover:bg-gray-50'
                )}
              >
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                  {isSelected && <Check size={14} className="text-blue-600" />}
                </span>
                {/* Wrapped: a long option is not worth showing if it cannot be read. */}
                <span className="min-w-0 flex-1 leading-5">{option.label}</span>
              </button>
            );
          })}
        </div>
      </AnchoredPopover>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
