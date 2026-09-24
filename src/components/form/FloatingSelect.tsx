import { useId, type ReactNode, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { FieldNote, RequiredMark, fieldBox } from './FloatingField';

export type SelectOption = { value: string; label: string; disabled?: boolean };

type FloatingSelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'placeholder'> & {
  label: string;
  options: SelectOption[];
  hint?: ReactNode;
  error?: string;
};

/** A short, fixed list of values (booking mode, VAT rate): the native select in the floating box. */
export function FloatingSelect({ label, options, hint, error, required, className, id, value, ...props }: FloatingSelectProps) {
  const generated = useId();
  const inputId = id ?? generated;
  const hasValue = value !== undefined && value !== '';
  return (
    <div className={className}>
      <div className="relative">
        <select
          id={inputId}
          value={value}
          aria-invalid={Boolean(error) || undefined}
          className={cn(fieldBox, 'h-14 appearance-none pr-10', !hasValue && 'text-transparent', error && 'border-red-400 focus:border-red-500 focus:ring-red-500/15')}
          {...props}
        >
          <option value="" disabled hidden />
          {options.map(option => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        <label
          htmlFor={inputId}
          className={cn(
            'pointer-events-none absolute left-3.5 text-gray-500 transition-all',
            hasValue ? 'top-2.5 text-[11px]' : 'top-1/2 -translate-y-1/2 text-sm'
          )}
        >
          {label}
          {required && <RequiredMark />}
        </label>
        <ChevronDown size={16} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
      </div>
      <FieldNote hint={hint} error={error} />
    </div>
  );
}
