import { useEffect, useMemo, useRef, useState } from 'react';
import { ImageOff, Plus, Search } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { SectionPage } from '../../components/layout/SectionPage';
import {
  ColumnHeader,
  ColumnSettings,
  Pagination,
  SegmentedTabs,
  type ColumnSetting,
  type SortState,
} from '../../components/table/TableControls';
import { ApiError, productCategoriesApi, productsApi } from '../../lib/api-client';
import type { Pagination as PageInfo, ProductCategory, ProductRoutability, ProductSummary } from '../../types';
import { formatPrice, productStatus, productStatusMeta } from './productStatus';

/** A value the server understands in RSQL, quoted so spaces and Cyrillic survive the query string. */
const quote = (value: string) => `"${value.replace(/"/g, '\\"')}"`;

/**
 * The columns, in their default order. `field` is the name the endpoint's RSQL profile knows —
 * title, status, quantity, group_name, category, fulfillment_location_id, created_at, updated_at —
 * and a column without one cannot be sorted or filtered, because the server would reject it.
 * The profile is wider than this table: group name is filterable but is not in the list response,
 * so there is nothing to put in a cell for it.
 */
const COLUMNS = [
  { key: 'title', label: 'Товар', field: 'title', fixed: true },
  { key: 'category', label: 'Категория', field: 'category' },
  { key: 'quantity', label: 'Кол-во', field: 'quantity', align: 'right' as const },
  { key: 'price', label: 'Цена', align: 'right' as const },
  { key: 'status', label: 'Статус', field: 'status' },
  { key: 'updated', label: 'Обновлён', field: 'updated_at', align: 'right' as const },
] satisfies Array<{ key: string; label: string; field?: string; align?: 'right'; fixed?: boolean }>;

const STORAGE_KEY = 'sportgearhub.products.columns';
const PAGE_SIZE_KEY = 'sportgearhub.products.pageSize';

const STATUS_TABS = [
  { value: '', label: 'Все' },
  ...Object.entries(productStatusMeta).map(([value, meta]) => ({ value, label: meta.label })),
];

function loadColumns(): ColumnSetting[] {
  const defaults = COLUMNS.map(column => ({
    key: column.key,
    label: column.label,
    visible: true,
    fixed: 'fixed' in column ? column.fixed : false,
  }));
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as ColumnSetting[] | null;
    if (!Array.isArray(saved)) return defaults;
    // Honour the saved order and visibility, but let new columns appear and dropped ones fall away.
    const known = new Map(defaults.map(column => [column.key, column]));
    const ordered = saved.filter(column => known.has(column.key))
      .map(column => ({ ...known.get(column.key)!, visible: column.visible }));
    const missing = defaults.filter(column => !saved.some(item => item.key === column.key));
    return [...ordered, ...missing];
  } catch {
    return defaults;
  }
}

/**
 * The catalogue.
 *
 * Filtering, ordering and paging are the server's: the endpoint takes RSQL, and a seller with five
 * hundred cards should not download five hundred to look at twenty. Everything the header menus
 * offer is therefore translated into `filter` and `sort` rather than applied to an array here.
 */
export function ProductsPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [blocked, setBlocked] = useState<Record<string, ProductRoutability>>({});

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [statusTab, setStatusTab] = useState('');
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [sort, setSort] = useState<SortState>({ key: 'updated', direction: 'desc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => Number(localStorage.getItem(PAGE_SIZE_KEY)) || 20);
  const [columns, setColumns] = useState<ColumnSetting[]>(loadColumns);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(columns)); }, [columns]);
  useEffect(() => { localStorage.setItem(PAGE_SIZE_KEY, String(pageSize)); }, [pageSize]);

  // Typing should not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const filter = useMemo(() => {
    const parts: string[] = [];
    if (debouncedQuery) parts.push(`title=contains=${quote(debouncedQuery)}`);
    if (statusTab) parts.push(`status==${statusTab}`);
    Object.entries(columnFilters).forEach(([key, values]) => {
      if (values.length === 0) return;
      const field = COLUMNS.find(column => column.key === key)?.field;
      if (!field) return;
      // RSQL's `=in=` takes the set in one term, which keeps the OR inside the column.
      parts.push(`${field}=in=(${values.map(quote).join(',')})`);
    });
    return parts.join(';');
  }, [debouncedQuery, statusTab, columnFilters]);

  const sortParam = useMemo(() => {
    if (!sort) return '';
    const field = COLUMNS.find(column => column.key === sort.key)?.field;
    return field ? `${field},${sort.direction}` : '';
  }, [sort]);

  // Any change to what is being asked for starts again from the first page.
  const firstLoad = useRef(true);
  useEffect(() => {
    if (firstLoad.current) { firstLoad.current = false; return; }
    setPage(1);
  }, [filter, sortParam, pageSize]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    productsApi.list({ filter: filter || undefined, sort: sortParam || undefined, page, pageSize })
      .then(result => {
        if (cancelled) return;
        setProducts(result.items ?? []);
        setPageInfo(result.pagination ?? null);
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Не удалось загрузить каталог.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filter, sortParam, page, pageSize]);

  useEffect(() => {
    let cancelled = false;
    productCategoriesApi.list()
      .then(next => { if (!cancelled) setCategories(next); })
      .catch(() => { /* the column filter simply has nothing to offer */ });

    // One call answers "which of these can actually be booked" for the whole catalogue.
    productsApi.allRoutability()
      .then(all => {
        if (cancelled) return;
        setBlocked(Object.fromEntries(all.filter(item => !item.routable).map(item => [item.productId, item])));
      })
      .catch(() => { /* the list is still useful without it */ });
    return () => { cancelled = true; };
  }, []);

  const filterOptionsFor = (key: string) => {
    if (key === 'status') return Object.entries(productStatusMeta).map(([value, meta]) => ({ value, label: meta.label }));
    if (key === 'category') return categories.map(category => ({ value: category.slug, label: category.name }));
    return undefined;
  };

  const visible = columns.filter(column => column.visible);
  const columnByKey = new Map(COLUMNS.map(column => [column.key, column]));

  const headerFor = (setting: ColumnSetting) => {
    const column = columnByKey.get(setting.key);
    if (!column) return null;
    const options = filterOptionsFor(setting.key);
    return (
      <ColumnHeader
        label={column.label}
        align={'align' in column ? column.align : 'left'}
        sortable={Boolean(column.field)}
        sortState={sort?.key === setting.key ? sort : null}
        onSort={direction => setSort(direction ? { key: setting.key, direction } : null)}
        filterOptions={options}
        filterValues={columnFilters[setting.key]}
        onFilterChange={values => setColumnFilters(current => ({ ...current, [setting.key]: values }))}
        hideable={!setting.fixed}
        onHide={() => setColumns(current => current.map(item =>
          item.key === setting.key ? { ...item, visible: false } : item))}
      />
    );
  };

  return (
    <SectionPage
      title="Каталог"
      description={pageInfo ? `${pageInfo.totalItems} ${plural(pageInfo.totalItems)}` : undefined}
      error={error}
      action={
        <Button variant="primary" onClick={() => onNavigate('/products/new')}>
          <Plus size={15} /> Добавить
        </Button>
      }
    >
      <div className="space-y-3 px-6 pb-6">
        <SegmentedTabs items={STATUS_TABS} value={statusTab} onChange={setStatusTab} />

        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Поиск по названию"
              className="h-9 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
            />
          </div>
          <ColumnSettings columns={columns} onChange={setColumns} />
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b border-gray-200 bg-gray-50/80">
                <tr>
                  <th className="w-14" />
                  {visible.map(setting => (
                    <th key={setting.key} className="text-left font-normal">{headerFor(setting)}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading && (
                  <tr><td colSpan={visible.length + 1} className="px-4 py-10 text-center text-sm text-gray-500">Загружаем каталог…</td></tr>
                )}
                {!loading && products.length === 0 && (
                  <tr>
                    <td colSpan={visible.length + 1} className="px-4 py-12 text-center">
                      <p className="text-sm text-gray-600">
                        {filter ? 'Ничего не нашлось. Попробуйте изменить фильтры.' : 'В каталоге пока пусто.'}
                      </p>
                    </td>
                  </tr>
                )}
                {!loading && products.map(product => (
                  <tr
                    key={product.productId}
                    onClick={() => onNavigate(`/products/${product.productId}`)}
                    className="cursor-pointer transition hover:bg-blue-50/40"
                  >
                    <td className="py-2 pl-3 pr-1">
                      <Thumb url={product.mediaPreviewUrl} title={product.title} />
                    </td>
                    {visible.map(setting => (
                      <td
                        key={setting.key}
                        className={`px-3 py-2 ${columnByKey.get(setting.key) && 'align' in columnByKey.get(setting.key)! ? 'text-right' : ''}`}
                      >
                        <Cell column={setting.key} product={product} blocked={blocked[product.productId]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pageInfo && !loading && (
            <Pagination
              page={pageInfo.page}
              totalPages={pageInfo.totalPages}
              totalItems={pageInfo.totalItems}
              pageSize={pageInfo.pageSize}
              onPage={setPage}
              onPageSize={setPageSize}
            />
          )}
        </div>
      </div>
    </SectionPage>
  );
}

function plural(count: number) {
  const tail = count % 100;
  if (tail >= 11 && tail <= 14) return 'товаров';
  switch (count % 10) {
    case 1: return 'товар';
    case 2:
    case 3:
    case 4: return 'товара';
    default: return 'товаров';
  }
}

function Thumb({ url, title }: { url: string | null; title: string }) {
  if (!url) {
    return (
      <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-300">
        <ImageOff size={15} />
      </span>
    );
  }
  return <img src={url} alt={title} className="h-10 w-10 rounded-lg border border-gray-200 object-cover" />;
}

function Cell({
  column,
  product,
  blocked,
}: {
  column: string;
  product: ProductSummary;
  blocked?: ProductRoutability;
}) {
  switch (column) {
    case 'title':
      return <span className="font-medium text-gray-900">{product.title}</span>;
    case 'category':
      return <span className="text-gray-600">{product.category?.title ?? '—'}</span>;
    case 'quantity':
      return <span className={product.quantity > 0 ? 'text-gray-900' : 'text-amber-700'}>{product.quantity}</span>;
    case 'price':
      return <span className="text-gray-900">{formatPrice(product.price) ?? '—'}</span>;
    case 'status': {
      const meta = productStatus(product.status);
      return (
        <span className="flex flex-wrap items-center gap-1.5">
          <Badge variant={meta.variant}>{meta.label}</Badge>
          {blocked && <Badge variant="orange">нельзя забронировать</Badge>}
        </span>
      );
    }
    case 'updated':
      return (
        <span className="text-gray-500">
          {new Date(product.updatedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
        </span>
      );
    default:
      return null;
  }
}
