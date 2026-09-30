import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  EyeOff,
  Filter,
  GripVertical,
  Search,
  Settings2,
} from 'lucide-react';
import { AnchoredPopover } from '../ui/AnchoredPopover';
import { cn } from '../../lib/utils';

export type SortDirection = 'asc' | 'desc';
export type SortState = { key: string; direction: SortDirection } | null;

export type ColumnFilterOption = { value: string; label: string };

// ─── Column header ────────────────────────────────────────────────────────────

/**
 * A column heading is the whole control.
 *
 * Everything a column can do — order by it, narrow it down, put it away — is behind one click on
 * its own title, which is where a person looks for it. Sorting hidden in a small arrow and
 * filtering in a funnel somewhere else make two targets out of one idea; the icons here report
 * state rather than being the state's only handle.
 */
export function ColumnHeader({
  label,
  align = 'left',
  sortable,
  sortState,
  onSort,
  filterOptions,
  filterValues,
  onFilterChange,
  hideable,
  onHide,
}: {
  label: string;
  align?: 'left' | 'right';
  sortable?: boolean;
  sortState: SortState;
  /** The key this column sorts by; `null` clears the sort. */
  onSort?: (direction: SortDirection | null) => void;
  filterOptions?: ColumnFilterOption[];
  filterValues?: string[];
  onFilterChange?: (values: string[]) => void;
  hideable?: boolean;
  onHide?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const anchorRef = useRef<HTMLButtonElement>(null);

  const sorted = sortState?.direction ?? null;
  const filtered = (filterValues?.length ?? 0) > 0;
  const interactive = Boolean(sortable || filterOptions || hideable);

  if (!interactive) {
    return <span className={cn('block px-3 py-2.5 text-xs font-medium text-gray-600', align === 'right' && 'text-right')}>{label}</span>;
  }

  const shown = (filterOptions ?? []).filter(option =>
    option.label.toLowerCase().includes(query.trim().toLowerCase()));

  const toggle = (value: string) => {
    const current = filterValues ?? [];
    onFilterChange?.(current.includes(value) ? current.filter(item => item !== value) : [...current, value]);
  };

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen(current => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'flex w-full items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors',
          align === 'right' && 'justify-end',
          open || sorted || filtered ? 'text-blue-700' : 'text-gray-600 hover:text-gray-900'
        )}
      >
        <span className="truncate">{label}</span>
        {sorted === 'asc' && <ArrowUp size={13} className="shrink-0" />}
        {sorted === 'desc' && <ArrowDown size={13} className="shrink-0" />}
        {filtered && <Filter size={12} className="shrink-0 fill-current" />}
      </button>

      <AnchoredPopover anchorRef={anchorRef} open={open} onClose={() => setOpen(false)} width={220}>
        {sortable && (
          <div className="py-0.5">
            <MenuItem
              icon={<ArrowDown size={15} />}
              active={sorted === 'asc'}
              onClick={() => { onSort?.(sorted === 'asc' ? null : 'asc'); setOpen(false); }}
            >
              От А до Я
            </MenuItem>
            <MenuItem
              icon={<ArrowUp size={15} />}
              active={sorted === 'desc'}
              onClick={() => { onSort?.(sorted === 'desc' ? null : 'desc'); setOpen(false); }}
            >
              От Я до А
            </MenuItem>
          </div>
        )}

        {filterOptions && filterOptions.length > 0 && (
          <div className={cn('py-1', sortable && 'border-t border-gray-100')}>
            {filterOptions.length > 7 && (
              <div className="px-2 pb-1.5 pt-1">
                <div className="relative">
                  <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    autoFocus
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                    placeholder="Поиск"
                    className="h-8 w-full rounded-lg border border-gray-300 pl-8 pr-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                  />
                </div>
              </div>
            )}
            <div className="max-h-60 overflow-y-auto">
              {shown.length === 0 && <p className="px-3 py-2 text-xs text-gray-500">Ничего не найдено</p>}
              {shown.map(option => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-sm text-gray-800 transition hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={(filterValues ?? []).includes(option.value)}
                    onChange={() => toggle(option.value)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500/30"
                  />
                  <span className="truncate">{option.label}</span>
                </label>
              ))}
            </div>
            {filtered && (
              <button
                type="button"
                onClick={() => onFilterChange?.([])}
                className="mt-0.5 w-full px-3 py-1.5 text-left text-xs font-medium text-blue-700 transition hover:bg-gray-50"
              >
                Сбросить фильтр
              </button>
            )}
          </div>
        )}

        {hideable && (
          <div className="border-t border-gray-100 py-0.5">
            <MenuItem icon={<EyeOff size={15} />} onClick={() => { onHide?.(); setOpen(false); }}>
              Скрыть столбец
            </MenuItem>
          </div>
        )}
      </AnchoredPopover>
    </>
  );
}

function MenuItem({
  icon,
  children,
  onClick,
  active,
}: {
  icon: ReactNode;
  children: ReactNode;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition hover:bg-gray-50',
        active ? 'font-medium text-blue-700' : 'text-gray-800'
      )}
    >
      <span className={active ? 'text-blue-600' : 'text-gray-400'}>{icon}</span>
      {children}
    </button>
  );
}

// ─── Column settings ──────────────────────────────────────────────────────────

export type ColumnSetting = { key: string; label: string; visible: boolean; fixed?: boolean };

/** Which columns show and in what order — drag a row to move it, uncheck it to put it away. */
export function ColumnSettings({
  columns,
  onChange,
}: {
  columns: ColumnSetting[];
  onChange: (next: ColumnSetting[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);

  const hidden = columns.filter(column => !column.visible).length;

  const moveTo = (from: string, to: string) => {
    if (from === to) return;
    const next = [...columns];
    const fromIndex = next.findIndex(column => column.key === from);
    const toIndex = next.findIndex(column => column.key === to);
    if (fromIndex < 0 || toIndex < 0) return;
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    onChange(next);
  };

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen(current => !current)}
        aria-label="Настройки таблицы"
        className={cn(
          'flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-sm transition',
          hidden > 0 ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-900'
        )}
      >
        <Settings2 size={15} />
        {hidden > 0 && <span className="text-xs font-medium">{columns.length - hidden}/{columns.length}</span>}
      </button>

      <AnchoredPopover anchorRef={anchorRef} open={open} onClose={() => setOpen(false)} align="end" width={260}>
        <p className="px-3 py-2 text-xs font-medium text-gray-500">Столбцы таблицы</p>
        <ul className="max-h-80 overflow-y-auto pb-1">
          {columns.map(column => (
            <li
              key={column.key}
              draggable={!column.fixed}
              onDragStart={() => setDragKey(column.key)}
              onDragEnd={() => setDragKey(null)}
              onDragOver={event => event.preventDefault()}
              onDrop={() => { if (dragKey) moveTo(dragKey, column.key); setDragKey(null); }}
              className={cn(
                'flex items-center gap-2 px-2 py-1.5 transition',
                dragKey === column.key && 'opacity-40',
                !column.fixed && 'cursor-grab active:cursor-grabbing'
              )}
            >
              <GripVertical size={14} className={cn('shrink-0', column.fixed ? 'text-transparent' : 'text-gray-300')} />
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-sm text-gray-800">
                <input
                  type="checkbox"
                  checked={column.visible}
                  disabled={column.fixed}
                  onChange={() => onChange(columns.map(item =>
                    item.key === column.key ? { ...item, visible: !item.visible } : item))}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500/30 disabled:opacity-40"
                />
                <span className="truncate">{column.label}</span>
              </label>
            </li>
          ))}
        </ul>
      </AnchoredPopover>
    </>
  );
}

// ─── Status toggles ───────────────────────────────────────────────────────────

/** Tabs where the highlight slides to whichever one is chosen, rather than blinking between them. */
export function SegmentedTabs<T extends string>({
  items,
  value,
  onChange,
}: {
  items: Array<{ value: T; label: string; count?: number }>;
  value: T;
  onChange: (value: T) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>(`[data-value="${value}"]`);
    if (!active) return;
    setPill({ left: active.offsetLeft, width: active.offsetWidth });
  }, [value, items]);

  return (
    <div ref={listRef} className="relative flex gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1">
      {pill && (
        <span
          aria-hidden="true"
          style={{ transform: `translateX(${pill.left - 4}px)`, width: pill.width }}
          className="pointer-events-none absolute inset-y-1 left-1 rounded-lg bg-white shadow-sm transition-transform duration-200 ease-out"
        />
      )}
      {items.map(item => (
        <button
          key={item.value}
          type="button"
          data-value={item.value}
          onClick={() => onChange(item.value)}
          className={cn(
            'relative z-10 flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors',
            item.value === value ? 'font-medium text-gray-950' : 'text-gray-600 hover:text-gray-900'
          )}
        >
          {item.label}
          {item.count !== undefined && (
            <span className={cn('text-xs', item.value === value ? 'text-gray-500' : 'text-gray-400')}>{item.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

/** Page numbers with ellipses: first, last, and a window around where you are. */
function pageList(current: number, total: number): Array<number | '…'> {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const pages = new Set([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter(page => page >= 1 && page <= total).sort((a, b) => a - b);
  const out: Array<number | '…'> = [];
  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) out.push('…');
    out.push(page);
  });
  return out;
}

export function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPage,
  onPageSize,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
}) {
  if (totalItems === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-3 py-2.5">
      <p className="text-xs text-gray-500">{from}–{to} из {totalItems}</p>

      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <PageButton disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Предыдущая страница">
            <ChevronLeft size={15} />
          </PageButton>
          {pageList(page, totalPages).map((item, index) =>
            item === '…' ? (
              <span key={`gap-${index}`} className="px-1 text-xs text-gray-400">…</span>
            ) : (
              <PageButton key={item} active={item === page} onClick={() => onPage(item)}>
                {item}
              </PageButton>
            )
          )}
          <PageButton disabled={page >= totalPages} onClick={() => onPage(page + 1)} aria-label="Следующая страница">
            <ChevronRight size={15} />
          </PageButton>
        </div>
      )}

      <label className="flex items-center gap-2 text-xs text-gray-500">
        Показывать
        <select
          value={pageSize}
          onChange={event => onPageSize(Number(event.target.value))}
          className="h-8 rounded-lg border border-gray-300 bg-white px-2 text-xs text-gray-800 outline-none focus:border-blue-500"
        >
          {[20, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
        </select>
      </label>
    </div>
  );
}

function PageButton({
  children,
  onClick,
  disabled,
  active,
  ...rest
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
} & { 'aria-label'?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm transition',
        active
          ? 'bg-gray-950 font-medium text-white'
          : 'text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent'
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
