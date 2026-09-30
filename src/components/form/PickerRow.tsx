import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronRight, Search, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { FieldNote, RequiredMark } from './FloatingField';

export type PickerItem = {
  value: string;
  label: string;
  description?: string | null;
  disabled?: boolean;
  disabledReason?: string;
};

type PickerRowProps = {
  label: string;
  items: PickerItem[];
  value: string;
  onChange: (value: string) => void;
  /** Title of the dialog; defaults to the label. */
  sheetTitle?: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  loading?: boolean;
  /** Shown at the bottom of the dialog, e.g. a link to create what is missing. */
  footer?: ReactNode;
  emptyText?: string;
  searchable?: boolean;
};

/** Below this many options a search box is noise; above it, the list needs one. */
const SEARCH_THRESHOLD = 6;

/**
 * A choice made by reading, not by recognising: a category with its activities, a pickup point
 * with its address. The closed row looks like a field with a chevron; opening it gives the whole
 * dialog to the list, with search, so long options can be read in full instead of being cut to fit
 * a line. Plain lists of short labels belong in FloatingSelect, not here.
 */
export function PickerRow({
  label,
  items,
  value,
  onChange,
  sheetTitle,
  hint,
  error,
  required,
  disabled,
  loading,
  footer,
  emptyText = 'Пока нечего выбрать.',
  searchable,
}: PickerRowProps) {
  const [open, setOpen] = useState(false);
  const selected = items.find(item => item.value === value);
  const hasValue = Boolean(selected);

  return (
    <div>
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-invalid={Boolean(error) || undefined}
        className={cn(
          // The row grows with what is in it. A fixed height is what forced the address onto the
          // same line as the name and then cut it.
          'relative flex min-h-14 w-full items-center rounded-lg border bg-white py-2.5 pl-3.5 pr-10 text-left transition focus:outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/15 disabled:cursor-not-allowed disabled:bg-gray-50',
          error ? 'border-red-400' : 'border-gray-300 hover:border-gray-400'
        )}
      >
        <span
          className={cn(
            'pointer-events-none absolute left-3.5 text-gray-500 transition-all',
            hasValue ? 'top-2 text-xs' : 'top-1/2 -translate-y-1/2 text-sm'
          )}
        >
          {label}
          {required && <RequiredMark />}
        </span>

        {hasValue && (
          <span className="mt-4 block min-w-0 flex-1">
            <span className="block text-sm leading-5 text-gray-900">{selected!.label}</span>
            {selected!.description && (
              <span className="mt-0.5 block text-xs leading-4 text-gray-500">{selected!.description}</span>
            )}
          </span>
        )}
        {loading && <span className="block text-sm text-gray-400">Загружаем…</span>}

        <ChevronRight size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
      </button>

      <FieldNote hint={hint} error={error} />

      {open && (
        <PickerDialog
          title={sheetTitle ?? label}
          items={items}
          value={value}
          searchable={searchable ?? items.length >= SEARCH_THRESHOLD}
          emptyText={emptyText}
          footer={footer}
          onClose={() => setOpen(false)}
          onPick={next => {
            onChange(next);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

function PickerDialog({
  title,
  items,
  value,
  searchable,
  emptyText,
  footer,
  onClose,
  onPick,
}: {
  title: string;
  items: PickerItem[];
  value: string;
  searchable: boolean;
  emptyText: string;
  footer?: ReactNode;
  onClose: () => void;
  onPick: (value: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(() => Math.max(items.findIndex(item => item.value === value), 0));
  const listRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(item => `${item.label} ${item.description ?? ''}`.toLowerCase().includes(needle));
  }, [items, query]);

  // A search narrows the list under the cursor, so the cursor goes back to the top of what is left.
  useEffect(() => { setActive(0); }, [query]);

  // Open on whatever is already chosen rather than at the top of a list it may be far down.
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'center' });
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { onClose(); return; }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        setActive(current => {
          const step = event.key === 'ArrowDown' ? 1 : -1;
          const usable = filtered.filter(item => !item.disabled);
          if (usable.length === 0) return current;
          const currentItem = filtered[current];
          const position = usable.indexOf(currentItem);
          const next = usable[(position + step + usable.length) % usable.length];
          return filtered.indexOf(next);
        });
        return;
      }
      if (event.key === 'Enter') {
        const item = filtered[active];
        if (item && !item.disabled) {
          event.preventDefault();
          onPick(item.value);
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, onPick, filtered, active]);

  // Keep the highlighted row in view while arrowing through a long list.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-gray-950/40" onClick={onClose} />

      <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-5">
          <h2 className="text-base font-semibold text-gray-950">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="-mr-1 rounded-lg p-1 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
            aria-label="Закрыть"
          >
            <X size={18} />
          </button>
        </div>

        {searchable && (
          <div className="px-5 pb-3">
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                autoFocus
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Поиск"
                className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-9 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                  aria-label="Очистить поиск"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            {query && (
              <p className="mt-1.5 text-xs text-gray-500">
                {filtered.length > 0 ? `Найдено: ${filtered.length}` : 'Ничего не найдено'}
              </p>
            )}
          </div>
        )}

        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {filtered.length === 0 ? (
            <p className="px-3 py-10 text-center text-sm text-gray-500">{query ? 'Измените запрос.' : emptyText}</p>
          ) : (
            filtered.map((item, index) => {
              const isSelected = item.value === value;
              return (
                <button
                  key={item.value}
                  ref={isSelected ? selectedRef : undefined}
                  type="button"
                  data-active={index === active}
                  disabled={item.disabled}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => onPick(item.value)}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition',
                    item.disabled
                      ? 'cursor-not-allowed opacity-50'
                      : isSelected
                        ? 'bg-blue-50'
                        : index === active
                          ? 'bg-gray-50'
                          : ''
                  )}
                >
                  <span className="min-w-0 flex-1">
                    {/* Wrapped, not truncated: the second line is usually the address or the
                        activities, which is the thing being chosen between. */}
                    <span className="block text-sm font-medium leading-5 text-gray-900">{item.label}</span>
                    {(item.description || item.disabledReason) && (
                      <span className="mt-0.5 block text-xs leading-4 text-gray-500">
                        {item.disabled ? item.disabledReason ?? item.description : item.description}
                      </span>
                    )}
                  </span>
                  {isSelected && <Check size={16} className="mt-0.5 shrink-0 text-blue-600" />}
                </button>
              );
            })
          )}
        </div>

        {footer && <div className="border-t border-gray-100 px-5 py-3 text-sm">{footer}</div>}
      </div>
    </div>
  );
}
