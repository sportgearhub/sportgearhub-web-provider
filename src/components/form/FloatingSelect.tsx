import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { FieldNote, RequiredMark, fieldBox } from './FloatingField';

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
  /** Shown under the label in the list — the reason to pick this one. */
  description?: string | null;
};

type FloatingSelectProps = {
  label: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
  placeholder?: string;
};

/**
 * A short, fixed list of values in the floating box. Not the native select: options carry a line
 * of explanation, which a native <option> cannot show, and the closed field matches the console's
 * other fields on every platform rather than whatever the OS draws.
 */
export function FloatingSelect({
  label,
  options,
  value,
  onChange,
  hint,
  error,
  required,
  disabled,
  className,
  id,
  placeholder,
}: FloatingSelectProps) {
  const generated = useId();
  const fieldId = id ?? generated;
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = options.find(option => option.value === value) ?? null;
  const hasValue = Boolean(selected);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [open]);

  const pick = (option: SelectOption) => {
    if (option.disabled) return;
    onChange(option.value);
    setOpen(false);
  };

  const move = (step: number) => {
    const enabled = options.filter(option => !option.disabled);
    if (enabled.length === 0) return;
    const current = enabled.findIndex(option => option.value === (activeIndex >= 0 ? options[activeIndex]?.value : value));
    const next = enabled[(current + step + enabled.length) % enabled.length] ?? enabled[0];
    setActiveIndex(options.indexOf(next));
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) setOpen(true);
      else move(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if ((event.key === 'Enter' || event.key === ' ') && open && activeIndex >= 0) {
      event.preventDefault();
      pick(options[activeIndex]);
    }
  };

  return (
    <div className={className} ref={rootRef}>
      <div className="relative">
        <button
          type="button"
          id={fieldId}
          disabled={disabled}
          onClick={() => setOpen(current => !current)}
          onKeyDown={onKeyDown}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-invalid={Boolean(error) || undefined}
          className={cn(
            fieldBox,
            'flex h-14 items-center justify-between gap-3 pr-10 text-left',
            open && 'border-blue-500 ring-2 ring-blue-500/15',
            error && 'border-red-400 focus:border-red-500 focus:ring-red-500/15'
          )}
        >
          <span className={cn('truncate', !hasValue && 'text-gray-400')}>
            {selected?.label ?? (placeholder ?? '')}
          </span>
        </button>
        <label
          htmlFor={fieldId}
          className={cn(
            'pointer-events-none absolute left-3.5 text-gray-500 transition-all',
            hasValue || open ? 'top-2.5 text-[11px]' : 'top-1/2 -translate-y-1/2 text-sm',
            open && 'text-blue-600'
          )}
        >
          {label}
          {required && <RequiredMark />}
        </label>
        <ChevronDown
          size={16}
          className={cn('pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 transition-transform', open && 'rotate-180')}
        />

        {open && (
          <div
            role="listbox"
            aria-labelledby={fieldId}
            className="absolute left-0 right-0 top-full z-40 mt-1 max-h-72 overflow-auto rounded-lg border border-gray-200 bg-white p-1 shadow-lg"
          >
            {options.length === 0 && <p className="px-3 py-2 text-sm text-gray-500">Нет вариантов</p>}
            {options.map((option, index) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={option.disabled}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => pick(option)}
                  className={cn(
                    'flex w-full items-start gap-2 rounded-md px-3 py-2 text-left text-sm transition',
                    option.disabled
                      ? 'cursor-not-allowed text-gray-400'
                      : isSelected
                        ? 'bg-blue-50 text-blue-900'
                        : index === activeIndex
                          ? 'bg-gray-50 text-gray-900'
                          : 'text-gray-900'
                  )}
                >
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                    {isSelected && <Check size={14} className="text-blue-600" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{option.label}</span>
                    {option.description && <span className="mt-0.5 block text-xs leading-4 text-gray-500">{option.description}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <FieldNote hint={hint} error={error} />
    </div>
  );
}
