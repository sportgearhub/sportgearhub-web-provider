import { useEffect, useMemo, useState } from 'react';
import { ImageOff, Plus, Search } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { SectionPage } from '../../components/layout/SectionPage';
import { ApiError, productsApi } from '../../lib/api-client';
import type { ProductSummary } from '../../types';
import { formatPrice, productStatus, productStatusFilterOptions } from './productStatus';

/**
 * The catalogue. One row per product — a rental card is a product now, not a resource with offers
 * hanging off it. Rows are cards on a phone and a table from `md` up: the same data, read the way
 * each screen can actually show it.
 */
export function ProductsPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    productsApi.list()
      .then(next => { if (!cancelled) setProducts(next); })
      .catch(err => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Не удалось загрузить каталог.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const shown = useMemo(() => products.filter(product => {
    const matchesStatus = !status || product.status === status;
    const haystack = `${product.title} ${product.category?.name ?? ''}`.toLowerCase();
    return matchesStatus && (!query || haystack.includes(query.toLowerCase()));
  }), [products, query, status]);

  return (
    <SectionPage
      title="Каталог"
      description={loading ? undefined : `${shown.length} из ${products.length}`}
      error={error}
      action={
        <Button variant="primary" onClick={() => onNavigate('/products/new')}>
          <Plus size={15} /> Добавить
        </Button>
      }
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Поиск по каталогу"
            className="pl-9"
          />
        </div>
        <Select
          value={status}
          options={productStatusFilterOptions}
          onChange={event => setStatus(event.target.value)}
          className="sm:w-52"
        />
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-gray-500">Загружаем каталог...</p>
      ) : shown.length === 0 ? (
        <EmptyCatalogue hasProducts={products.length > 0} onCreate={() => onNavigate('/products/new')} />
      ) : (
        <>
          {/* Phone: one card per product, the whole card tappable. */}
          <ul className="mt-4 space-y-2 md:hidden">
            {shown.map(product => (
              <li key={product.productId}>
                <button
                  type="button"
                  onClick={() => onNavigate(`/products/${product.productId}`)}
                  className="flex w-full items-center gap-3 rounded-lg border border-gray-200 p-3 text-left transition active:bg-gray-50"
                >
                  <Thumb url={product.mediaPreviewUrl} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-gray-950">{product.title}</span>
                    <span className="mt-0.5 block truncate text-xs text-gray-500">
                      {product.category?.name ?? '—'} · {product.quantity} шт
                    </span>
                    <span className="mt-1.5 flex items-center gap-2">
                      <Badge variant={productStatus(product.status).variant}>{productStatus(product.status).label}</Badge>
                      <span className="text-xs font-medium text-gray-900">{formatPrice(product.price) ?? 'Цены нет'}</span>
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-4 hidden overflow-x-auto rounded-lg border border-gray-200 md:block">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="w-16 px-3 py-2" />
                  <th className="px-3 py-2 font-medium">Товар</th>
                  <th className="w-44 px-3 py-2 font-medium">Категория</th>
                  <th className="w-24 px-3 py-2 text-right font-medium">Кол-во</th>
                  <th className="w-32 px-3 py-2 text-right font-medium">Цена</th>
                  <th className="w-40 px-3 py-2 font-medium">Статус</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(product => (
                  <tr
                    key={product.productId}
                    onClick={() => onNavigate(`/products/${product.productId}`)}
                    className="cursor-pointer border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
                  >
                    <td className="px-3 py-2"><Thumb url={product.mediaPreviewUrl} /></td>
                    <td className="px-3 py-2"><span className="block truncate font-medium text-gray-950">{product.title}</span></td>
                    <td className="px-3 py-2 text-gray-600">{product.category?.name ?? '—'}</td>
                    <td className="px-3 py-2 text-right text-gray-900">{product.quantity}</td>
                    <td className="px-3 py-2 text-right text-gray-900">{formatPrice(product.price) ?? '—'}</td>
                    <td className="px-3 py-2">
                      <Badge variant={productStatus(product.status).variant}>{productStatus(product.status).label}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </SectionPage>
  );
}

function Thumb({ url }: { url: string | null }) {
  if (!url) {
    return (
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-dashed border-gray-200 text-gray-300">
        <ImageOff size={16} />
      </span>
    );
  }
  return <img src={url} alt="" className="h-12 w-12 shrink-0 rounded-md border border-gray-200 object-cover" />;
}

function EmptyCatalogue({ hasProducts, onCreate }: { hasProducts: boolean; onCreate: () => void }) {
  return (
    <div className="mt-6 rounded-lg border border-dashed border-gray-200 px-6 py-12 text-center">
      <p className="text-sm font-medium text-gray-950">
        {hasProducts ? 'Ничего не найдено' : 'В каталоге пока пусто'}
      </p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">
        {hasProducts
          ? 'Попробуйте изменить поиск или снять фильтр по статусу.'
          : 'Добавьте первый товар — снаряжение, которое вы сдаёте в прокат.'}
      </p>
      {!hasProducts && (
        <Button className="mt-4" variant="primary" onClick={onCreate}>
          <Plus size={15} /> Добавить товар
        </Button>
      )}
    </div>
  );
}
