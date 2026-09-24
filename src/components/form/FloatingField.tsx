import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

/**
 * The console's field, after Ozon Seller's: the label lives inside the box and floats up once
 * there is a value or focus, so a form reads as a list of named boxes rather than label/box
 * pairs. Required fields carry the asterisk in the label; help text and errors sit under the box.
 */
export const fieldBox =
  'peer block w-full rounded-lg border bg-white px-3.5 pb-2 pt-6 text-sm text-gray-900 outline-none transition placeholder-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500';
export const fieldLabel =
  'pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-500 transition-all peer-focus:top-2.5 peer-focus:translate-y-0 peer-focus:text-[11px] peer-focus:text-blue-600 peer-[:not(:placeholder-shown)]:top-2.5 peer-[:not(:placeholder-shown)]:translate-y-0 peer-[:not(:placeholder-shown)]:text-[11px]';

export function FieldNote({ hint, error, children }: { hint?: ReactNode; error?: string; children?: ReactNode }) {
  if (!error && !hint && !children) return null;
  return (
    <div className="mt-1.5 px-1 text-xs leading-4">
      {error ? <p className="text-red-600">{error}</p> : hint ? <p className="text-gray-500">{hint}</p> : null}
      {children}
    </div>
  );
}

export function RequiredMark() {
  return <span className="ml-0.5 text-red-500">*</span>;
}

type FloatingInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'placeholder'> & {
  label: string;
  hint?: ReactNode;
  error?: string;
  /** Text shown inside the box on the right, e.g. a unit or currency. */
  suffix?: ReactNode;
};

export const FloatingInput = forwardRef<HTMLInputElement, FloatingInputProps>(function FloatingInput(
  { label, hint, error, suffix, required, className, id, ...props },
  ref
) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <div className={className}>
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          placeholder=" "
          aria-invalid={Boolean(error) || undefined}
          className={cn(fieldBox, 'h-14', suffix && 'pr-14', error && 'border-red-400 focus:border-red-500 focus:ring-red-500/15')}
          {...props}
        />
        <label htmlFor={inputId} className={fieldLabel}>
          {label}
          {required && <RequiredMark />}
        </label>
        {suffix && <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-400">{suffix}</span>}
      </div>
      <FieldNote hint={hint} error={error} />
    </div>
  );
});

type FloatingTextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'placeholder'> & {
  label: string;
  hint?: ReactNode;
  error?: string;
};

export function FloatingTextarea({ label, hint, error, required, className, id, rows = 4, ...props }: FloatingTextareaProps) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <div className={className}>
      <div className="relative">
        <textarea
          id={inputId}
          placeholder=" "
          rows={rows}
          aria-invalid={Boolean(error) || undefined}
          className={cn(fieldBox, 'resize-y leading-5', error && 'border-red-400 focus:border-red-500 focus:ring-red-500/15')}
          {...props}
        />
        <label htmlFor={inputId} className={cn(fieldLabel, 'top-6')}>
          {label}
          {required && <RequiredMark />}
        </label>
      </div>
      <FieldNote hint={hint} error={error} />
    </div>
  );
}

/** Two or three fields on one line, as Ozon pairs «Предельная цена» and «Зачёркнутая цена». */
export function FieldRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid gap-3 sm:grid-cols-2', className)}>{children}</div>;
}
