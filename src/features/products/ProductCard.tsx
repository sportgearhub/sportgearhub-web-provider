import { Check, ImageOff, MoreHorizontal } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import { mediaUrl } from '../../lib/api-client';
import type { ProductRoutability, ProductSummary } from '../../types';
import { formatPrice, productStatus } from './productStatus';

/**
 * One card in a list of them, on a phone.
 *
 * The photo has the left-hand column to itself and everything written about the card is in one
 * block to its right, so the eye runs down a single edge of text instead of stepping around a
 * picture. The name gets two lines and then an ellipsis: a long one should not push the numbers
 * under it off the bottom.
 *
 * Shared by the catalogue and by a group's own page, because two lists of the same thing that
 * look different are two things to learn.
 */
export function ProductCard({
  product,
  blocked,
  selecting,
  ticked,
  onOpen,
  onToggle,
  onMenu,
}: {
  product: ProductSummary;
  blocked?: ProductRoutability;
  selecting?: boolean;
  ticked?: boolean;
  onOpen: () => void;
  onToggle?: () => void;
  onMenu?: () => void;
}) {
  const meta = productStatus(product.status);

  return (
    <li className={`relative overflow-hidden rounded-xl bg-white ${ticked ? 'ring-2 ring-blue-500' : ''}`}>
      <button
        type="button"
        onClick={() => (selecting ? onToggle?.() : onOpen())}
        className="flex w-full gap-3 p-3 text-left transition active:bg-gray-50"
      >
        <Thumb url={product.mediaPreviewUrl} title={product.title} />
        <span className="min-w-0 flex-1">
          {/* Room kept at the right-hand end for the menu button laid over it. */}
          {/* Room kept at the right-hand end for whatever is laid over that corner. */}
          <span className={`flex flex-wrap items-center gap-1 ${onMenu || selecting ? 'pr-7' : ''}`}>
            <Badge variant={meta.variant} size="xs" tone="strong" shape="square">{meta.label}</Badge>
            {blocked && <Badge variant="orange" size="xs" tone="strong" shape="square">не бронируется</Badge>}
          </span>
          <span className="mt-1.5 line-clamp-2 text-sm font-medium leading-5 text-gray-900">{product.title}</span>
          <span className="mt-0.5 block truncate text-xs text-gray-500">{product.category?.title ?? '—'}</span>
          <span className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
            {product.price != null && (
              <span className="text-sm font-semibold text-gray-900">{formatPrice(product.price)}</span>
            )}
            <span className={product.quantity > 0 ? '' : 'text-amber-700'}>{product.quantity} шт</span>
          </span>
        </span>
      </button>

      {/* The same corner, whichever job the list is doing: the tick while cards are being
          picked, the menu otherwise. The tick is drawn, not a control — the whole card is the
          target, which is the easier thing to hit. */}
      {selecting ? (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-md border-2 transition ${
            ticked ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 bg-white'
          }`}
        >
          {ticked && <Check size={13} strokeWidth={3} />}
        </span>
      ) : onMenu && (
        <button
          type="button"
          onClick={onMenu}
          aria-label="Действия с товаром"
          className="absolute right-1 top-1 rounded-lg p-2 text-gray-400 transition active:bg-gray-100"
        >
          <MoreHorizontal size={17} />
        </button>
      )}
    </li>
  );
}

/** The same card with nothing in it yet, so a list that is loading keeps its shape. */
export function ProductCardSkeleton() {
  return (
    <li className="flex items-center gap-3 rounded-xl bg-white p-3">
      <Skeleton className="h-14 w-14 shrink-0" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3.5 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </li>
  );
}

function Thumb({ url, title }: { url: string | null; title: string }) {
  if (!url) {
    return (
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-300">
        <ImageOff size={18} />
      </span>
    );
  }
  return <img src={mediaUrl(url)} alt={title} className="h-14 w-14 shrink-0 rounded-lg border border-gray-200 object-cover" />;
}
