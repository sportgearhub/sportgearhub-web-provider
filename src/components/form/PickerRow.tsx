import { useEffect, useMemo, useState, type ReactNode } from 'react';
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
  /** Title of the sheet; defaults to the label. */
  sheetTitle?: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  loading?: boolean;
  /** Shown at the bottom of the sheet, e.g. a link to create what is missing. */
  footer?: ReactNode;
  emptyText?: string;
  searchable?: boolean;
};

/**
 * A choice that deserves more than a dropdown — category, пункт проката, inventory. The row looks
 * like a field with a chevron (Ozon's «Категория и тип ›»); tapping it opens a sheet with search
 * and one line per option, so long lists and descriptions have room.
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
          'relative flex h-14 w-full items-center rounded-lg border bg-white pl-3.5 pr-10 text-left transition focus:outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/15 disabled:cursor-not-allowed disabled:bg-gray-50',
          error ? 'border-red-400' : 'border-gray-300 hover:border-gray-400'
        )}
      >
        <span
          className={cn(
            'pointer-events-none absolute left-3.5 text-gray-500 transition-all',
            hasValue ? 'top-2.5 text-[11px]' : 'top-1/2 -translate-y-1/2 text-sm'
          )}
        >
          {label}
          {required && <RequiredMark />}
        </span>
        {hasValue && (
          <span className="mt-3.5 block min-w-0 truncate text-sm text-gray-900">
            {selected!.label}
            {selected!.description && <span className="ml-1.5 text-gray-400">· {selected!.description}</span>}
          </span>
        )}
        {loading && <span className="mt-3.5 block text-sm text-gray-400">Загружаем…</span>}
        <ChevronRight size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
      </button>
      <FieldNote hint={hint} error={error} />
      {open && (
        <PickerSheet
          title={sheetTitle ?? label}
          items={items}
          value={value}
          searchable={searchable ?? items.length > 7}
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

function PickerSheet({
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
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(item => `${item.label} ${item.description ?? ''}`.toLowerCase().includes(needle));
  }, [items, query]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-gray-950/40" onClick={onClose} />
      <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-5">
          <h2 className="text-base font-semibold text-gray-950">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900" aria-label="Закрыть">
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
                className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
              />
            </div>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {filtered.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-gray-500">{emptyText}</p>
          ) : (
            filtered.map(item => {
              const active = item.value === value;
              return (
                <button
                  key={item.value}
                  type="button"
                  disabled={item.disabled}
                  onClick={() => onPick(item.value)}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition',
                    item.disabled ? 'cursor-not-allowed opacity-50' : active ? 'bg-blue-50' : 'hover:bg-gray-50'
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-gray-900">{item.label}</span>
                    {(item.description || item.disabledReason) && (
                      <span className="mt-0.5 block text-xs leading-4 text-gray-500">{item.disabled ? item.disabledReason ?? item.description : item.description}</span>
                    )}
                  </span>
                  {active && <Check size={16} className="mt-0.5 shrink-0 text-blue-600" />}
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
