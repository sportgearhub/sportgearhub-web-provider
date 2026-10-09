import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronsUpDown, ImageOff, Layers, Plus, Search, type LucideIcon } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
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

  // The status sheet: what is chosen in it is not applied until «Применить», so a phone can be
  // scrolled through the list of states without the page reloading under each tap.
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pendingTab, setPendingTab] = useState('all');
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(columns)); }, [columns]);
  useEffect(() => { localStorage.setItem(PAGE_SIZE_KEY, String(pageSize)); }, [pageSize]);

  // Typing should not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Everything being asked for except the slice — the search box and the column menus. Kept apart
  // so the same terms can be counted against every status, not only the one on screen.
  const extraFilter = useMemo(() => {
    const parts: string[] = [];
    if (debouncedQuery) parts.push(`title=contains=${quote(debouncedQuery)}`);
    Object.entries(columnFilters).forEach(([key, values]) => {
      if (values.length === 0) return;
      const field = COLUMNS.find(column => column.key === key)?.field;
      if (!field) return;
      // RSQL's `=in=` takes the set in one term, which keeps the OR inside the column.
      parts.push(`${field}=in=(${values.map(quote).join(',')})`);
    });
    return parts.join(';');
  }, [debouncedQuery, columnFilters]);

  const filter = useMemo(() => {
    const slice = SLICES.find(item => item.value === tab);
    return [slice?.filter, extraFilter].filter(Boolean).join(';');
  }, [tab, extraFilter]);

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
    fetchSlice(slice, { filter: filter || undefined, sort: sortParam || undefined, page, pageSize })
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

  /**
   * How many cards are in each status.
   *
   * There is no counts endpoint — `tab-counts` went away with `tab` — so each status is asked for
   * one row and only its `total_items` is read. Eight small requests, made when the sheet opens
   * rather than on every visit to the page, and a status whose request fails simply shows no
   * number instead of a wrong one.
   */
  useEffect(() => {
    if (!sheetOpen) return;
    let cancelled = false;
    void Promise.all(SLICES.map(slice => {
      const query = {
        filter: [slice.filter, extraFilter].filter(Boolean).join(';') || undefined,
        page: 1,
        pageSize: 1,
      };
      return fetchSlice(slice, query)
        .then(result => [slice.value, result.pagination?.totalItems ?? null] as const)
        .catch(() => [slice.value, null] as const);
    })).then(entries => {
      if (cancelled) return;
      setCounts(Object.fromEntries(entries.filter((entry): entry is readonly [string, number] => entry[1] != null)));
    });
    return () => { cancelled = true; };
  }, [sheetOpen, extraFilter]);

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

  const slice = SLICES.find(item => item.value === tab) ?? SLICES[0];
  const totalForTab = counts[tab] ?? pageInfo?.totalItems ?? null;

  const searchField = (
    <div className="relative min-w-0 flex-1">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        value={query}
        onChange={event => setQuery(event.target.value)}
        placeholder="Поиск по названию"
        // No outline on a phone: the field sits on the white of the header, and a filled shape
        // is already a box to type in. The desktop keeps its border, where it sits on a page.
        className="h-10 w-full rounded-xl bg-gray-100 pl-9 pr-3 text-base text-gray-900 outline-none transition placeholder:text-gray-500 md:h-9 md:rounded-lg md:border md:border-gray-300 md:bg-white md:text-sm md:focus:border-blue-500 md:focus:ring-2 md:focus:ring-blue-500/15"
      />
    </div>
  );

  return (
    <>
      {/* On a phone this block is the header — the console's own bar is not drawn here. The name
          and the search box stay put while the list moves under them, because searching a long
          catalogue from the bottom of it should not mean scrolling back up first. */}
      <div className="md:hidden">
        <div className="sticky top-0 z-20 rounded-b-2xl bg-white px-4 pb-3 pt-4">
          <div className="flex items-baseline justify-between gap-3">
            <h1 className="text-xl font-semibold text-gray-950">Каталог</h1>
            {pageInfo && (
              <span className="shrink-0 text-xs text-gray-500">
                {pageInfo.totalItems} {plural(pageInfo.totalItems)}
              </span>
            )}
          </div>
          <div className="mt-3 flex">{searchField}</div>
        </div>

        {/* Its own card, touching the list it filters. Eight statuses do not fit across a phone,
            and a strip that scrolls sideways hides most of them; one row saying which is on, how
            many are in it and that there are others reads at a glance. */}
        <div className="px-3 pt-3">
          <button
            type="button"
            onClick={() => { setPendingTab(tab); setSheetOpen(true); }}
            className="flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3 text-left transition active:bg-gray-50"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-gray-900">{slice.label}</span>
              <span className="mt-0.5 block text-xs text-gray-500">Выберите статус продуктов</span>
            </span>
            {totalForTab != null && <Count value={totalForTab} />}
            <ChevronsUpDown size={16} className="shrink-0 text-gray-400" />
          </button>
        </div>

        {/* The other places this screen leads, as tiles rather than rows: squares read as things
            to tap, and a row of them has room for the next one. */}
        <div className="flex gap-2 overflow-x-auto px-3 pt-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <FeatureTile
            icon={Layers}
            label="Группы товаров"
            onClick={() => onNavigate('/products/groups')}
          />
        </div>
      </div>

      {/* The desktop keeps the heading, the strip of slices and the column settings. */}
      <div className="hidden px-6 pt-6 md:block">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-950">Каталог</h1>
            {pageInfo && (
              <p className="mt-1 text-sm text-gray-500">{pageInfo.totalItems} {plural(pageInfo.totalItems)}</p>
            )}
          </div>
          <Button variant="primary" onClick={() => onNavigate('/products/new')}>
            <Plus size={15} /> Добавить
          </Button>
        </div>

        <div className="mt-4 space-y-3">
          <SegmentedTabs
            items={SLICES.map(item => ({ value: item.value, label: item.label }))}
            value={tab}
            onChange={setTab}
          />
          <div className="flex items-center gap-2">
            {searchField}
            <ColumnSettings columns={columns} onChange={setColumns} />
          </div>
        </div>
      </div>

      {error && (
        <p className="mx-3 mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 md:mx-6">
          {error}
        </p>
      )}

      {/* Room at the end for the floating button, so it never covers the last row. */}
      <div className="px-3 pb-24 pt-3 md:px-6 md:pb-6">
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

      {/* «Добавить» within a thumb's reach, over the list rather than above it, where the
          references put the one action a catalogue screen is for. */}
      <button
        type="button"
        onClick={() => onNavigate('/products/new')}
        className="fixed bottom-[calc(4rem+0.75rem+env(safe-area-inset-bottom))] right-4 z-40 flex items-center gap-1.5 rounded-full bg-blue-600 py-3 pl-4 pr-5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition active:bg-blue-700 md:hidden"
      >
        <Plus size={18} /> Добавить
      </button>

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Статус товаров"
        center
        footer={
          <Button
            variant="primary"
            className="w-full justify-center"
            onClick={() => { setTab(pendingTab); setSheetOpen(false); }}
          >
            Применить
          </Button>
        }
      >
        <ul className="divide-y divide-gray-100 border-y border-gray-100">
          {SLICES.map(item => {
            const chosen = item.value === pendingTab;
            return (
              <li key={item.value}>
                <button
                  type="button"
                  onClick={() => setPendingTab(item.value)}
                  className="flex w-full items-center gap-3 px-5 py-2.5 text-left transition active:bg-gray-50"
                >
                  <span className={`min-w-0 flex-1 text-sm ${chosen ? 'font-medium text-gray-950' : 'text-gray-800'}`}>
                    {item.label}
                  </span>
                  {counts[item.value] != null && <Count value={counts[item.value]} />}
                  {/* The mark of a single choice, where a single choice is marked. */}
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
                      chosen ? 'border-blue-600' : 'border-gray-300'
                    }`}
                  >
                    {chosen && <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </BottomSheet>
    </>
  );
}

/** A count beside a label: grey, pill-shaped, never competing with the label it belongs to. */
function Count({ value }: { value: number }) {
  return (
    <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium tabular-nums text-gray-600">
      {value}
    </span>
  );
}

function FeatureTile({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-24 w-24 shrink-0 flex-col items-center justify-center gap-2 rounded-2xl bg-white px-2 text-center transition active:bg-gray-50"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
        <Icon size={18} />
      </span>
      <span className="text-[11px] font-medium leading-tight text-gray-800">{label}</span>
    </button>
  );
}

/** Each slice is either a filter on the list or an endpoint of its own; both take the same query. */
function fetchSlice(slice: Slice | undefined, query: { filter?: string; sort?: string; page: number; pageSize: number }) {
  if (slice?.endpoint === 'needsAttention') return productsApi.needsAttention(query);
  if (slice?.endpoint === 'readyToPublish') return productsApi.readyToPublish(query);
  return productsApi.list(query);
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
