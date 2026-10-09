import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronDown, ImageOff, Layers } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import { ApiError, mediaUrl, productsApi } from '../../lib/api-client';
import type { ProductSummary } from '../../types';
import { formatPrice, productStatus } from './productStatus';

type Group = { name: string; items: ProductSummary[] };

/**
 * The catalogue read by group instead of by card.
 *
 * A group is a name several cards share — one bike in three frame sizes — and a seller who sells
 * that way thinks in groups, not in the nine rows they expand into. The grouping is the API's own:
 * `group_name` is a field on the card, so the page sorts by it and collects the runs rather than
 * inventing a hierarchy the server does not have.
 */
export function ProductGroupsPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openName, setOpenName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Ungrouped cards are not wanted here, but RSQL has no "is not null" — the groups are picked
    // out of the page instead. 100 is the server's ceiling for pageSize.
    productsApi.list({ filter: 'status!=archived', sort: 'group_name', page: 1, pageSize: 100 })
      .then(result => { if (!cancelled) setProducts(result.items ?? []); })
      .catch(err => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Не удалось загрузить группы.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const groups = useMemo<Group[]>(() => {
    const byName = new Map<string, ProductSummary[]>();
    products.forEach(product => {
      const name = product.groupName?.trim();
      if (!name) return;
      const bucket = byName.get(name);
      if (bucket) bucket.push(product);
      else byName.set(name, [product]);
    });
    return [...byName.entries()]
      .map(([name, items]) => ({ name, items }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [products]);

  const ungrouped = products.filter(product => !product.groupName?.trim()).length;

  return (
    <div className="px-3 pb-8 pt-3 sm:px-6">
      {/* The way back and the name of the page, for the screens where the console's bar carries
          neither — below `lg` the header is doing that job already. */}
      <div className="hidden lg:mb-4 lg:block">
        <button
          type="button"
          onClick={() => onNavigate('/products')}
          className="mb-2 flex items-center gap-1.5 text-sm text-gray-500 transition hover:text-gray-900"
        >
          <ArrowLeft size={14} /> Каталог
        </button>
        <h1 className="text-xl font-semibold text-gray-950">Группы товаров</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          Карточки с одинаковым названием группы покупатель видит как один товар с выбором.
        </p>
      </div>

      {error && <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {loading && (
        <ul className="space-y-2">
          {Array.from({ length: 4 }, (_, row) => (
            <li key={row} className="rounded-xl bg-white p-4">
              <Skeleton className="h-3.5 w-1/2" />
              <Skeleton className="mt-2 h-3 w-1/4" />
            </li>
          ))}
        </ul>
      )}

      {!loading && groups.length === 0 && (
        <div className="rounded-xl bg-white px-4 py-12 text-center">
          <Layers size={22} className="mx-auto text-gray-300" />
          <p className="mt-2 text-sm text-gray-600">Групп пока нет.</p>
          <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-gray-500">
            Укажите одинаковое название группы в карточках — и покупатель увидит их как один товар с выбором.
          </p>
        </div>
      )}

      {!loading && groups.length > 0 && (
        <ul className="space-y-2">
          {groups.map(group => {
            const open = openName === group.name;
            return (
              <li key={group.name} className="overflow-hidden rounded-xl bg-white">
                <button
                  type="button"
                  onClick={() => setOpenName(open ? null : group.name)}
                  aria-expanded={open}
                  className="flex w-full items-center gap-3 p-3 text-left transition active:bg-gray-50"
                >
                  <span className="flex shrink-0 -space-x-2">
                    {group.items.slice(0, 3).map(item => (
                      <Thumb key={item.productId} url={item.mediaPreviewUrl} title={item.title} />
                    ))}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium leading-5 text-gray-900">{group.name}</span>
                    <span className="mt-0.5 block text-xs text-gray-500">
                      {group.items.length} {plural(group.items.length)}
                    </span>
                  </span>
                  <ChevronDown
                    size={17}
                    className={`shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
                  />
                </button>

                {open && (
                  <ul className="border-t border-gray-100">
                    {group.items.map(item => {
                      const meta = productStatus(item.status);
                      return (
                        <li key={item.productId}>
                          <button
                            type="button"
                            onClick={() => onNavigate(`/products/${item.productId}`)}
                            className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition active:bg-gray-50"
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm text-gray-900">{item.title}</span>
                              <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                                <Badge variant={meta.variant}>{meta.label}</Badge>
                                {item.price != null && <span>{formatPrice(item.price)}</span>}
                                <span>· {item.quantity} шт</span>
                                {item.isGroupFace && <span className="text-blue-700">· главная в группе</span>}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!loading && ungrouped > 0 && (
        <p className="mt-3 px-1 text-xs leading-5 text-gray-500">
          Ещё {ungrouped} {plural(ungrouped)} без группы — они продаются сами по себе.
        </p>
      )}
    </div>
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
      <span className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-white bg-gray-100 text-gray-300 ring-1 ring-gray-200">
        <ImageOff size={14} />
      </span>
    );
  }
  return (
    <img
      src={mediaUrl(url)}
      alt={title}
      className="h-10 w-10 rounded-lg border-2 border-white object-cover ring-1 ring-gray-200"
    />
  );
}
