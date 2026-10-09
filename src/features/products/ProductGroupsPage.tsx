import { useEffect, useMemo, useState } from 'react';
import { Archive, ArrowLeft, ChevronRight, ImageOff, Layers, MoreHorizontal, Pencil, Plus, type LucideIcon } from 'lucide-react';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { TaskHeaderCard } from '../../components/layout/TaskHeaderCard';
import { ProductCard, ProductCardSkeleton } from './ProductCard';
import { Skeleton } from '../../components/ui/Skeleton';
import { ApiError, mediaUrl, productsApi } from '../../lib/api-client';
import type { ProductSummary } from '../../types';

type Group = { name: string; items: ProductSummary[] };

/** A value the server understands in RSQL, quoted so spaces and Cyrillic survive the query. */
const quote = (value: string) => `"${value.replace(/"/g, '\\"')}"`;

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
            return (
              <li key={group.name} className="overflow-hidden rounded-xl bg-white">
                <button
                  type="button"
                  onClick={() => onNavigate(`/products/groups/${encodeURIComponent(group.name)}`)}
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
                  <ChevronRight size={17} className="shrink-0 text-gray-400" />
                </button>

              </li>
            );
          })}
        </ul>
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

/**
 * One group's own page.
 *
 * The group name is the bar's title, the cards are the content, and the corner has a menu for
 * the group itself. There is no group endpoint — a group is cards that share a `group_name` — so
 * this is the ordinary list filtered by that name, and everything the menu offers beyond looking
 * is marked as the prototype it is.
 */
export function ProductGroupPage({ groupName, onNavigate }: { groupName: string; onNavigate: (path: string) => void }) {
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    productsApi.list({ filter: `group_name==${quote(groupName)}`, sort: 'title', page: 1, pageSize: 100 })
      .then(result => { if (!cancelled) setProducts(result.items ?? []); })
      .catch(err => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Не удалось загрузить группу.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [groupName]);

  return (
    <>
      <TaskHeaderCard
        title={groupName}
        onBack={() => onNavigate('/products/groups')}
        action={
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Действия с группой"
            className="rounded-lg p-2 text-gray-600 transition active:bg-gray-100"
          >
            <MoreHorizontal size={20} />
          </button>
        }
      />

      {/* The desktop keeps its own way back, since the bar above is a phone's. */}
      <div className="hidden px-6 pt-6 lg:block">
        <button
          type="button"
          onClick={() => onNavigate('/products/groups')}
          className="mb-2 flex items-center gap-1.5 text-sm text-gray-500 transition hover:text-gray-900"
        >
          <ArrowLeft size={14} /> Группы товаров
        </button>
        <h1 className="text-xl font-semibold text-gray-950">{groupName}</h1>
      </div>

      <div className="px-3 pb-8 pt-3 sm:px-6">
        {error && <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <ul className="space-y-2">
          {loading && Array.from({ length: 3 }, (_, row) => <ProductCardSkeleton key={row} />)}
          {!loading && products.length === 0 && (
            <li className="rounded-xl bg-white px-4 py-12 text-center text-sm text-gray-600">
              В этой группе больше нет товаров.
            </li>
          )}
          {!loading && products.map(product => (
            <ProductCard
              key={product.productId}
              product={product}
              onOpen={() => onNavigate(`/products/${product.productId}`)}
            />
          ))}
        </ul>
      </div>

      <BottomSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={groupName}
        center
        footer={
          <Button variant="secondary" className="w-full justify-center" onClick={() => setMenuOpen(false)}>
            Закрыть
          </Button>
        }
      >
        <ul className="divide-y divide-gray-100 border-y border-gray-100">
          <GroupMenuRow
            icon={Plus}
            title="Добавить товар в группу"
            note={`Новая карточка с названием группы «${groupName}».`}
            onClick={() => { setMenuOpen(false); onNavigate('/products/new'); }}
          />
          <GroupMenuRow
            icon={Pencil}
            title="Переименовать группу"
            note="Прототип: в API нет групповой операции — пока название меняется в каждой карточке."
            disabled
          />
          <GroupMenuRow
            icon={Archive}
            title="Снять всю группу с продажи"
            note="Прототип: массовых действий над группой в API пока нет."
            disabled
          />
        </ul>
      </BottomSheet>
    </>
  );
}

function GroupMenuRow({
  icon: Icon,
  title,
  note,
  onClick,
  disabled,
}: {
  icon: LucideIcon;
  title: string;
  note: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="flex w-full items-center gap-3 px-5 py-3 text-left transition active:bg-gray-50 disabled:opacity-60"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
          <Icon size={19} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-gray-950">{title}</span>
          <span className="mt-0.5 block text-xs leading-4 text-gray-500">{note}</span>
        </span>
      </button>
    </li>
  );
}
