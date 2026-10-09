import { useEffect, useMemo, useState } from 'react';
import { Archive, Check } from 'lucide-react';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { TaskHeaderCard } from '../../components/layout/TaskHeaderCard';
import { useToast } from '../../components/ui/Toast';
import { ApiError, productsApi } from '../../lib/api-client';
import type { ProductSummary } from '../../types';
import { ProductCard, ProductCardSkeleton } from './ProductCard';
import { filtersToRsql, useCatalogueFilters } from './catalogueFilters';

/** One page of cards is what can honestly be offered as «выбрать все». */
const LIMIT = 100;

/**
 * Picking several cards, as a screen rather than a mode.
 *
 * A list you tap to open and a list you tap to tick are two different lists, and a mode that
 * silently swaps one for the other is how a seller archives the card they meant to read. So this
 * is somewhere you go: nothing on it but cards and their ticks, a bar at the top saying how many
 * of how many, and one at the bottom with the thing to do to them.
 *
 * The filters chosen on the catalogue apply here too — what you were looking at is what you came
 * to pick from.
 */
export function ProductSelectPage({
  onNavigate,
  pick,
}: {
  onNavigate: (path: string) => void;
  /** A card ticked on arrival, for when this was opened from that card's own menu. */
  pick?: string;
}) {
  const chosen = useCatalogueFilters();
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string[]>(pick ? [pick] : []);
  const [confirming, setConfirming] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const toast = useToast();

  const filter = useMemo(
    () => ['status!=archived', ...filtersToRsql(chosen)].join(';'),
    [chosen]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    productsApi.list({ filter, sort: chosen.sort, page: 1, pageSize: LIMIT })
      .then(result => {
        if (cancelled) return;
        setProducts(result.items ?? []);
        setTotal(result.pagination?.totalItems ?? (result.items ?? []).length);
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Не удалось загрузить товары.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filter, chosen.sort]);

  const toggle = (productId: string) =>
    setSelected(current => current.includes(productId)
      ? current.filter(item => item !== productId)
      : [...current, productId]);

  const allTicked = products.length > 0 && selected.length === products.length;
  const toggleAll = () => setSelected(allTicked ? [] : products.map(product => product.productId));

  /**
   * Archiving several cards.
   *
   * There is no bulk endpoint, so this is the single one called once per card — and each is
   * allowed to fail on its own, because the API refuses some states (a card on review cannot be
   * archived) and a seller who ticked eight should hear which went rather than nothing at all.
   */
  const archive = async () => {
    setArchiving(true);
    const results = await Promise.allSettled(selected.map(id => productsApi.archive(id)));
    const failed = results.filter(result => result.status === 'rejected').length;
    const done = results.length - failed;
    setArchiving(false);
    setConfirming(false);

    if (failed === 0) {
      toast.show(`В архив: ${done} ${plural(done)}.`, 'success');
      onNavigate('/products');
      return;
    }
    // Something stayed behind, so the page stays too, with the cards that failed still on it.
    setSelected(current => current.filter((_, index) => results[index]?.status === 'rejected'));
    setProducts(current => current.filter(product => {
      const index = selected.indexOf(product.productId);
      return index === -1 || results[index]?.status === 'rejected';
    }));
    toast.show(failed === results.length
      ? 'Не удалось отправить в архив. Товары на проверке архивировать нельзя.'
      : `В архив: ${done} из ${results.length}. Остальные в статусе, из которого архивировать нельзя.`);
  };

  return (
    <>
      <TaskHeaderCard
        title="Выбор товаров"
        description="Отметьте, что отправить в архив"
        onBack={() => onNavigate('/products')}
        action={
          <button
            type="button"
            onClick={toggleAll}
            disabled={products.length === 0}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition active:bg-gray-100 disabled:opacity-50"
          >
            <span className="text-xs tabular-nums text-gray-500">
              {selected.length} из {products.length}
            </span>
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition ${
                allTicked ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300'
              }`}
            >
              {allTicked && <Check size={13} strokeWidth={3} />}
            </span>
          </button>
        }
      />

      <div className="px-3 pb-28 pt-3 sm:px-6">
        {error && <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <ul className="space-y-2">
          {loading && Array.from({ length: 5 }, (_, row) => <ProductCardSkeleton key={row} />)}
          {!loading && products.length === 0 && (
            <li className="rounded-xl bg-white px-4 py-12 text-center text-sm text-gray-600">
              Выбирать пока нечего.
            </li>
          )}
          {!loading && products.map(product => (
            <ProductCard
              key={product.productId}
              product={product}
              selecting
              ticked={selected.includes(product.productId)}
              onOpen={() => toggle(product.productId)}
              onToggle={() => toggle(product.productId)}
            />
          ))}
        </ul>

        {!loading && total > products.length && (
          <p className="pt-3 text-center text-xs text-gray-500">
            Показаны первые {products.length} из {total}. Уточните фильтры, чтобы выбрать остальные.
          </p>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Button
          variant="danger"
          disabled={selected.length === 0}
          onClick={() => setConfirming(true)}
          className="h-11 w-full justify-center"
        >
          <Archive size={16} /> В архив{selected.length > 0 ? ` · ${selected.length}` : ''}
        </Button>
      </div>

      <BottomSheet
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`В архив: ${selected.length} ${plural(selected.length)}?`}
        center
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1 justify-center" onClick={() => setConfirming(false)}>
              Отмена
            </Button>
            <Button variant="danger" className="flex-1 justify-center" loading={archiving} onClick={() => void archive()}>
              В архив
            </Button>
          </div>
        }
      >
        <p className="px-5 pb-4 pt-1 text-sm leading-6 text-gray-700">
          Товары из архива не продаются и не видны покупателям. Вернуть их можно из вкладки «Архив».
          Карточки на проверке архивировать нельзя — они останутся как есть.
        </p>
      </BottomSheet>

      {toast.node}
    </>
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
