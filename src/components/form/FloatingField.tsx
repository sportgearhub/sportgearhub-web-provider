import {
  forwardRef,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { Info, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { AnchoredPopover } from '../ui/AnchoredPopover';

/**
 * The console's field, after Ozon Seller's: the label lives inside the box and floats up once
 * there is a value or focus, so a form reads as a list of named boxes rather than label/box pairs.
 *
 * Three sizes and no more: the value is 14px, the floated label 12px, and notes under the box
 * 12px. A label that shrinks to 11px when it floats reads as a different kind of thing from the
 * label next to it that has not floated yet.
 */
export const fieldBox =
  'peer block w-full rounded-lg border bg-white px-3.5 pb-2 pt-6 text-base sm:text-sm text-gray-900 outline-none transition placeholder-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500';
export const fieldLabel =
  'pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-500 transition-all peer-focus:top-2.5 peer-focus:translate-y-0 peer-focus:text-xs peer-focus:text-blue-600 peer-[:not(:placeholder-shown)]:top-2.5 peer-[:not(:placeholder-shown)]:translate-y-0 peer-[:not(:placeholder-shown)]:text-xs';

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

/**
 * Guidance as a mark inside the field rather than a line under it.
 *
 * A paragraph under every box turns a form into prose with boxes in it, and the advice is read
 * once and then skipped forever. Behind an ⓘ it is there when wanted — on hover, and on keyboard
 * focus, which is the half people usually forget.
 */
function FieldHint({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        tabIndex={0}
        aria-label="Подсказка"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={event => { event.preventDefault(); setOpen(current => !current); }}
        className="flex h-6 w-6 items-center justify-center rounded-full text-gray-400 transition hover:text-gray-600 focus-visible:outline-none focus-visible:text-blue-600"
      >
        <Info size={16} />
      </button>
      <AnchoredPopover anchorRef={anchorRef} open={open} onClose={() => setOpen(false)} align="end" width={240}>
        <p className="px-3 py-2 text-xs leading-4 text-gray-700">{children}</p>
      </AnchoredPopover>
    </>
  );
}

/** The × that empties a field, as Ozon puts one in every text box that has something in it. */
function ClearButton({ onClear }: { onClear: () => void }) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label="Очистить поле"
      onClick={onClear}
      className="flex h-6 w-6 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
    >
      <X size={15} />
    </button>
  );
}

type FloatingInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'placeholder'> & {
  label: string;
  hint?: ReactNode;
  error?: string;
  /** Text shown inside the box on the right, e.g. a unit or currency. */
  suffix?: ReactNode;
  /** Off for fields where emptying in one click is not a kindness, e.g. a confirmed amount. */
  clearable?: boolean;
};

export const FloatingInput = forwardRef<HTMLInputElement, FloatingInputProps>(function FloatingInput(
  { label, hint, error, suffix, clearable = true, required, className, id, value, onChange, disabled, ...props },
  ref
) {
  const generated = useId();
  const inputId = id ?? generated;

  const hasValue = value !== undefined && value !== null && String(value) !== '';
  const showClear = clearable && hasValue && !disabled && Boolean(onChange);
  const showHint = Boolean(hint);

  // Whatever sits on the right has to be reserved for, or the value slides under it.
  const adornments = (showClear ? 1 : 0) + (showHint ? 1 : 0) + (suffix ? 1 : 0);
  const padding = ['pr-3.5', 'pr-11', 'pr-[4.5rem]', 'pr-[6.25rem]'][Math.min(adornments, 3)];

  return (
    <div className={className}>
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          placeholder=" "
          value={value}
          onChange={onChange}
          disabled={disabled}
          aria-invalid={Boolean(error) || undefined}
          className={cn(fieldBox, 'h-14', padding, error && 'border-red-400 focus:border-red-500 focus:ring-red-500/15')}
          {...props}
        />
        <label htmlFor={inputId} className={fieldLabel}>
          {label}
          {required && <RequiredMark />}
        </label>

        <div className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
          {suffix && <span className="pointer-events-none pr-1 text-sm text-gray-400">{suffix}</span>}
          {showClear && (
            <ClearButton
              onClear={() => onChange?.({ target: { value: '' } } as ChangeEvent<HTMLInputElement>)}
            />
          )}
          {showHint && <FieldHint>{hint}</FieldHint>}
        </div>
      </div>
      {/* The hint has moved into the mark; an error has not, because an error nobody hovers is
          an error nobody reads. */}
      <FieldNote error={error} />
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
          className={cn(fieldBox, 'resize-y leading-5', hint && 'pr-11', error && 'border-red-400 focus:border-red-500 focus:ring-red-500/15')}
          {...props}
        />
        <label htmlFor={inputId} className={cn(fieldLabel, 'top-6')}>
          {label}
          {required && <RequiredMark />}
        </label>
        {hint && (
          <div className="absolute right-2.5 top-3.5">
            <FieldHint>{hint}</FieldHint>
          </div>
        )}
      </div>
      <FieldNote error={error} />
    </div>
  );
}

/** Two or three fields on one line, as Ozon pairs «Предельная цена» and «Зачёркнутая цена». */
export function FieldRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid gap-3 sm:grid-cols-2', className)}>{children}</div>;
}
