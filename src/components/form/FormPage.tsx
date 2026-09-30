import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * One column of sections with a bar of actions at the end — the shape of every create/edit page
 * (after Ozon's «Создание товара»). Sections are headings, not cards: the page is the container.
 * The column starts at the page's left edge, under the heading, instead of floating in the middle
 * of a wide screen away from everything else.
 */
export function FormPage({ children, className, wide = false }: { children: ReactNode; className?: string; wide?: boolean }) {
  // No horizontal padding of its own: SectionPage already sets the page's gutter, and adding a
  // second one pushed the fields in from the heading above them.
  return <div className={cn('w-full pb-28 pt-2', wide ? 'max-w-3xl' : 'max-w-xl', className)}>{children}</div>;
}

export function FormSection({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('pt-8 first:pt-4', className)}>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-950">{title}</h2>
          {description && <p className="mt-1 text-sm leading-5 text-gray-500">{description}</p>}
        </div>
        {action}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

/**
 * The steps of a long form, as a segmented control: the sections of one page, not a queue to be
 * marched through. Every step stays reachable — editing is not a wizard, and someone who came back
 * to fix the price should not have to walk past the description — and a step holding an error says
 * so on the toggle itself.
 */
export function FormStepper({
  steps,
  current,
  onSelect,
}: {
  steps: Array<{ label: string; done?: boolean; invalid?: boolean }>;
  current: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="mb-6 inline-flex max-w-full gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1">
      {steps.map((step, index) => {
        const isCurrent = index === current;
        return (
          <button
            key={step.label}
            type="button"
            onClick={() => onSelect(index)}
            aria-current={isCurrent ? 'step' : undefined}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm transition-colors',
              isCurrent
                ? 'bg-white font-medium text-gray-950 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            {step.label}
            {step.invalid ? (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">!</span>
            ) : step.done && !isCurrent ? (
              <Check size={14} className="text-emerald-600" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** The bar at the end: secondary actions on the left, the one primary on the right; stays put while the page scrolls. */
export function ActionBar({ left, right, error }: { left?: ReactNode; right: ReactNode; error?: string }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-screen-xl flex-wrap items-center justify-between gap-3 px-6 py-3">
        <div className="flex flex-wrap items-center gap-2">{left}</div>
        <div className="flex items-center gap-3">
          {error && <p className="max-w-md text-xs text-red-600">{error}</p>}
          {right}
        </div>
      </div>
    </div>
  );
}

/** A group of large radio-like cards for a choice that deserves an explanation, e.g. the pricing mode. */
export function ChoiceCards<T extends string>({
  options,
  value,
  onChange,
  columns = 1,
}: {
  options: Array<{ value: T; title: string; description?: string | null; disabled?: boolean }>;
  value: T | '';
  onChange: (value: T) => void;
  columns?: 1 | 2 | 3;
}) {
  return (
    <div className={cn('grid gap-2', columns === 2 && 'sm:grid-cols-2', columns === 3 && 'sm:grid-cols-3')} role="radiogroup">
      {options.map(option => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex items-start gap-3 rounded-lg border px-3.5 py-3 text-left transition',
              option.disabled ? 'cursor-not-allowed border-gray-100 bg-gray-50 opacity-60' : selected ? 'border-blue-600 bg-blue-50/60' : 'border-gray-300 hover:border-gray-400'
            )}
          >
            <span className={cn('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border', selected ? 'border-blue-600' : 'border-gray-400')}>
              {selected && <span className="h-2 w-2 rounded-full bg-blue-600" />}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-gray-900">{option.title}</span>
              {option.description && <span className="mt-0.5 block text-xs leading-4 text-gray-500">{option.description}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
