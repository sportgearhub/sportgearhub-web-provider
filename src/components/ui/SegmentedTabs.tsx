import { useLayoutEffect, useRef, useState } from 'react';
import { cn } from '../../lib/utils';

/** How a segment reads: plain, finished, or holding a problem. */
export type SegmentTone = 'default' | 'done' | 'invalid';

export type SegmentedItem<T extends string> = {
  value: T;
  label: string;
  /** A number beside the label, e.g. how many rows that tab holds. */
  count?: number;
  tone?: SegmentTone;
};

const toneClass: Record<SegmentTone, { active: string; idle: string }> = {
  default: { active: 'text-gray-950', idle: 'text-gray-600 hover:text-gray-900' },
  done: { active: 'text-emerald-700', idle: 'text-emerald-600 hover:text-emerald-700' },
  invalid: { active: 'text-red-700', idle: 'text-red-600 hover:text-red-700' },
};

/**
 * One row of toggles with the highlight sliding to whichever is chosen, rather than blinking
 * between them. The console's single way of switching between sibling views — the catalogue's
 * tabs, a long form's steps, the parts of a product — so the same gesture looks the same wherever
 * it appears.
 */
export function SegmentedTabs<T extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: Array<SegmentedItem<T>>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>(`[data-value="${value}"]`);
    if (!active) return;
    setPill({ left: active.offsetLeft, width: active.offsetWidth });
  }, [value, items]);

  return (
    <div
      ref={listRef}
      className={cn('relative flex gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1', className)}
    >
      {pill && (
        <span
          aria-hidden="true"
          style={{ transform: `translateX(${pill.left - 4}px)`, width: pill.width }}
          className="pointer-events-none absolute inset-y-1 left-1 rounded-lg bg-white shadow-sm transition-transform duration-200 ease-out"
        />
      )}
      {items.map(item => {
        const active = item.value === value;
        const tone = toneClass[item.tone ?? 'default'];
        return (
          <button
            key={item.value}
            type="button"
            data-value={item.value}
            onClick={() => onChange(item.value)}
            aria-current={active ? 'true' : undefined}
            className={cn(
              'relative z-10 flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm transition-colors',
              active ? `font-medium ${tone.active}` : tone.idle
            )}
          >
            {item.label}
            {item.count !== undefined && (
              <span className={cn('text-xs', active ? 'text-gray-500' : 'text-gray-400')}>{item.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
