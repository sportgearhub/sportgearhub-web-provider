import { useEffect, useMemo, useRef, useState } from 'react';
import { ImageOff, Plus, Search } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { SectionPage } from '../../components/layout/SectionPage';
import {
  ColumnHeader,
  ColumnSettings,
  Pagination,
  type ColumnSetting,
  type SortState,
} from '../../components/table/TableControls';
import { SegmentedTabs } from '../../components/ui/SegmentedTabs';
import { Skeleton } from '../../components/ui/Skeleton';
import { ApiError, mediaUrl, productCategoriesApi, productsApi } from '../../lib/api-client';
import type { Pagination as PageInfo, ProductCategory, ProductRoutability, ProductSummary } from '../../types';
import { formatPrice, productStatus, productStatusMeta } from './productStatus';

/** A value the server understands in RSQL, quoted so spaces and Cyrillic survive the query string. */
const quote = (value: string) => `"${value.replace(/"/g, '\\"')}"`;

/**
 * The columns, in their default order.
 *
 * `field` is the name the endpoint's RSQL profile allows: product_id, title, status, quantity,
 * group_name, booking_approval, category_id, fulfillment_location_id, created_at, updated_at. A
 * column without one cannot be sorted or filtered — an unlisted field is a 400 naming it, not a
 * parameter that quietly does nothing. The category filters by `category_id`, so its options are
 * ids even though the cell shows the title.
 */
const COLUMNS = [
  { key: 'title', label: 'Товар', field: 'title', fixed: true },
  { key: 'category', label: 'Категория', field: 'category_id' },
  { key: 'group', label: 'Группа', field: 'group_name' },
  { key: 'quantity', label: 'Кол-во', field: 'quantity', align: 'right' as const },
  { key: 'price', label: 'Цена', align: 'right' as const },
  { key: 'status', label: 'Статус', field: 'status' },
  { key: 'updated', label: 'Обновлён', field: 'updated_at', align: 'right' as const },
] satisfies Array<{ key: string; label: string; field?: string; align?: 'right'; fixed?: boolean }>;

const STORAGE_KEY = 'sportgearhub.products.columns';
const PAGE_SIZE_KEY = 'sportgearhub.products.pageSize';

/**
 * The slices of the catalogue.
 *
 * `tab` was removed on 2026-10-04 (api 16c62db): anything that is a question about the card's own
 * columns is a filter, and only the two that are not — what is missing something, and what is
 * complete but unpublished — kept endpoints of their own. Those two still take filter, sort and
 * paging, so they compose with everything else on this page.
 */
type Slice = { value: string; label: string; filter?: string; endpoint?: 'needsAttention' | 'readyToPublish' };

const SLICES: Slice[] = [
  { value: 'all', label: 'Все', filter: 'status!=archived' },
  { value: 'in_sale', label: 'В продаже', filter: 'status==active' },
  { value: 'ready_to_publish', label: 'Готовы к продаже', endpoint: 'readyToPublish' },
  { value: 'needs_attention', label: 'Требуют внимания', endpoint: 'needsAttention' },
  { value: 'pending_review', label: 'На проверке', filter: 'status==pending_review' },
  { value: 'changes_requested', label: 'На доработку', filter: 'status==changes_requested' },
  { value: 'removed_from_sale', label: 'Сняты с продажи', filter: 'status=in=(paused,suspended)' },
  { value: 'archived', label: 'Архив', filter: 'status==archived' },
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
  const [tab, setTab] = useState('all');
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
    const slice = SLICES.find(item => item.value === tab);
    if (slice?.filter) parts.push(slice.filter);
    if (debouncedQuery) parts.push(`title=contains=${quote(debouncedQuery)}`);
    Object.entries(columnFilters).forEach(([key, values]) => {
      if (values.length === 0) return;
      const field = COLUMNS.find(column => column.key === key)?.field;
      if (!field) return;
      // RSQL's `=in=` takes the set in one term, which keeps the OR inside the column.
      parts.push(`${field}=in=(${values.map(quote).join(',')})`);
    });
    return parts.join(';');
  }, [tab, debouncedQuery, columnFilters]);

  // The endpoint's sort syntax is a `-` prefix for descending — `-updated_at` — not Spring Data's
  // `updated_at,desc`, which it rejects without saying which half it disliked.
  const sortParam = useMemo(() => {
    if (!sort) return '';
    const field = COLUMNS.find(column => column.key === sort.key)?.field;
    if (!field) return '';
    return sort.direction === 'desc' ? `-${field}` : field;
  }, [sort]);

  // Any change to what is being asked for starts again from the first page.
  const firstLoad = useRef(true);
  useEffect(() => {
    if (firstLoad.current) { firstLoad.current = false; return; }
    setPage(1);
  }, [tab, filter, sortParam, pageSize]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    const slice = SLICES.find(item => item.value === tab);
    const query = { filter: filter || undefined, sort: sortParam || undefined, page, pageSize };
    const request = slice?.endpoint === 'needsAttention'
      ? productsApi.needsAttention(query)
      : slice?.endpoint === 'readyToPublish'
        ? productsApi.readyToPublish(query)
        : productsApi.list(query);
    request
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
  }, [tab, filter, sortParam, page, pageSize]);

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
    if (key === 'category') return categories.map(category => ({ value: category.categoryId, label: category.name }));
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
      <div className="space-y-3">
        <SegmentedTabs
          items={SLICES.map(item => ({ value: item.value, label: item.label }))}
          value={tab}
          onChange={setTab}
        />

        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Поиск по названию"
              className="h-9 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-base outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 sm:text-sm"
            />
          </div>
          <span className="hidden md:block">
            <ColumnSettings columns={columns} onChange={setColumns} />
          </span>
        </div>

        {/* The frame belongs to the table. On a phone the rows are the cards, so the container
            steps out of the way rather than becoming a card around cards. */}
        <div className="overflow-hidden md:rounded-xl md:border md:border-gray-200 md:bg-white">
          <div className="hidden overflow-x-auto md:block">
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
                {loading && Array.from({ length: 5 }, (_, row) => (
                  <tr key={`skeleton-${row}`} aria-hidden="true">
                    <td className="py-2 pl-3 pr-1"><Skeleton className="h-10 w-10" /></td>
                    {visible.map((setting, column) => (
                      <td key={setting.key} className="px-3 py-2">
                        <Skeleton className={`h-3.5 ${column === 0 ? 'w-48' : 'w-16'}`} />
                      </td>
                    ))}
                  </tr>
                ))}
                {!loading && products.length === 0 && (
                  <tr>
                    <td colSpan={visible.length + 1} className="px-4 py-12 text-center">
                      <p className="text-sm text-gray-600">
                        {filter || tab !== 'all' ? 'Ничего не нашлось. Попробуйте изменить фильтры.' : 'В каталоге пока пусто.'}
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

          {/* Phones get the same rows read downwards: the photo, the title in full, and the two
              numbers that matter under it. Nothing is off the edge and nothing is abbreviated. */}
          {/* Each row is its own card with the status above the name, the way the references
              read: the state is what a seller scans for, and it should not be hunted for under
              the thing it describes. */}
          <ul className="space-y-2 md:hidden">
            {loading && Array.from({ length: 5 }, (_, row) => (
              <li key={`m-skeleton-${row}`} className="flex items-center gap-3 rounded-xl bg-white p-3">
                <Skeleton className="h-14 w-14 shrink-0" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </li>
            ))}
            {!loading && products.length === 0 && (
              <li className="rounded-xl bg-white px-4 py-12 text-center text-sm text-gray-600">
                {filter || tab !== 'all' ? 'Ничего не нашлось. Попробуйте изменить фильтры.' : 'В каталоге пока пусто.'}
              </li>
            )}
            {!loading && products.map(product => {
              const meta = productStatus(product.status);
              return (
                <li key={product.productId} className="overflow-hidden rounded-xl bg-white">
                  <button
                    type="button"
                    onClick={() => onNavigate(`/products/${product.productId}`)}
                    className="w-full p-3 text-left transition active:bg-gray-50"
                  >
                    <span className="flex flex-wrap items-center gap-1.5">
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                      {blocked[product.productId] && <Badge variant="orange">нельзя забронировать</Badge>}
                    </span>
                    <span className="mt-2.5 flex items-start gap-3">
                      <Thumb url={product.mediaPreviewUrl} title={product.title} size="lg" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium leading-5 text-gray-900">{product.title}</span>
                        <span className="mt-1 block text-xs text-gray-500">{product.category?.title ?? '—'}</span>
                      </span>
                    </span>
                    <span className="mt-2.5 flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
                      {product.price != null && (
                        <span className="rounded-lg bg-gray-100 px-2 py-1 text-sm font-medium text-gray-900">
                          {formatPrice(product.price)}
                        </span>
                      )}
                      <span className={product.quantity > 0 ? '' : 'text-amber-700'}>{product.quantity} шт</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {pageInfo && !loading && (
            <div className="mt-2 rounded-xl bg-white md:mt-0 md:rounded-none">
            <Pagination
              page={pageInfo.page}
              totalPages={pageInfo.totalPages}
              totalItems={pageInfo.totalItems}
              pageSize={pageInfo.pageSize}
              onPage={setPage}
              onPageSize={setPageSize}
            />
            </div>
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

function Thumb({ url, title, size = 'sm' }: { url: string | null; title: string; size?: 'sm' | 'lg' }) {
  const box = size === 'lg' ? 'h-14 w-14' : 'h-10 w-10';
  if (!url) {
    return (
      <span className={`flex ${box} shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-300`}>
        <ImageOff size={size === 'lg' ? 18 : 15} />
      </span>
    );
  }
  return <img src={mediaUrl(url)} alt={title} className={`${box} shrink-0 rounded-lg border border-gray-200 object-cover`} />;
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
    case 'group':
      return product.groupName
        ? (
          <span className="text-gray-600">
            {product.groupName}
            {product.groupSize > 1 && <span className="ml-1 text-gray-400">· {product.groupSize}</span>}
          </span>
        )
        : <span className="text-gray-400">—</span>;
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
