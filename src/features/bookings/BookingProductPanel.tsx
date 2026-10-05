import { useEffect, useState } from 'react';
import { ExternalLink, ImageOff, PackageCheck } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { SkeletonDetail } from '../../components/ui/Skeleton';
import { ApiError, mediaUrl, productsApi } from '../../lib/api-client';
import { formatPrice } from '../products/productStatus';
import { infoSectionLabel } from '../products/infoSections';
import type { OfferInfoSection, Product, ProductPolicy } from '../../types';

type Loaded = {
  product: Product | null;
  sections: OfferInfoSection[];
  policy: ProductPolicy | null;
};

/**
 * What the operator needs in their hand, not what the booking happens to carry.
 *
 * A booking says which card was booked and little else. The questions asked across a counter are
 * about the card: what is in the kit, how much deposit to take, how long it is for. Those live on
 * the product, so they are fetched by its id when somebody asks — three calls, made once, only on
 * the booking being dealt with.
 */
export function useBookingProduct(productId: string | null, open: boolean) {
  const [data, setData] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !productId || data) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    void Promise.all([
      productsApi.get(productId),
      productsApi.getInfoSections(productId).catch(() => [] as OfferInfoSection[]),
      productsApi.getPolicy(productId).catch(() => null),
    ])
      .then(([product, sections, policy]) => {
        if (!cancelled) setData({ product, sections: sections ?? [], policy });
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Не удалось загрузить товар.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, productId, data]);

  return { data, loading, error };
}

export function BookingProductPanel({
  productId,
  open,
  onOpenProduct,
}: {
  productId: string;
  open: boolean;
  onOpenProduct?: () => void;
}) {
  const { data, loading, error } = useBookingProduct(productId, open);

  if (loading) return <SkeletonDetail rows={4} />;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data?.product) return null;

  const { product, sections, policy } = data;
  const deposit = policy?.deposit;

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        {product.mediaPreviewUrl ? (
          <img src={mediaUrl(product.mediaPreviewUrl)} alt="" className="h-16 w-16 shrink-0 rounded-lg border border-gray-200 object-cover" />
        ) : (
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-300">
            <ImageOff size={18} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-5 text-gray-900">{product.title}</p>
          <p className="mt-0.5 text-xs text-gray-500">
            {product.category?.title ?? '—'}
            {product.price != null ? ` · ${formatPrice(product.price)}` : ''}
          </p>
          {onOpenProduct && (
            <button type="button" onClick={onOpenProduct} className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline">
              <ExternalLink size={11} /> Открыть карточку
            </button>
          )}
        </div>
      </div>

      {/* The deposit is the number an operator must not get wrong, so it is not buried in a list. */}
      {deposit && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
          <PackageCheck size={16} className="shrink-0 text-amber-700" />
          <p className="text-sm text-amber-900">
            Залог: <span className="font-semibold">
              {deposit.unit === 'percent' ? `${deposit.value} % от суммы` : formatPrice(deposit.value)}
            </span>
          </p>
        </div>
      )}

      {sections.length > 0 ? (
        <div className="space-y-3">
          {sections.map(section => (
            <div key={section.kind}>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{infoSectionLabel(section.kind)}</p>
              <ul className="mt-1 space-y-0.5">
                {section.items.map((item, index) => (
                  <li key={index} className="flex gap-2 text-sm text-gray-800">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gray-300" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500">Состав комплекта не указан в карточке товара.</p>
      )}

      {product.description && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Описание</p>
          <p className="mt-1 whitespace-pre-line text-sm leading-5 text-gray-700">{product.description}</p>
        </div>
      )}

      {policy?.leadTimeHours != null && (
        <p className="text-xs text-gray-500">Бронь не позднее чем за {policy.leadTimeHours} ч до начала.</p>
      )}
    </div>
  );
}

/** The same panel, reachable from a list row without leaving the list. */
export function BookingProductDialog({
  productId,
  productTitle,
  open,
  onClose,
  onOpenProduct,
}: {
  productId: string;
  productTitle: string;
  open: boolean;
  onClose: () => void;
  onOpenProduct?: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="О товаре" size="md">
      <div className="space-y-4">
        <BookingProductPanel productId={productId} open={open} onOpenProduct={onOpenProduct} />
        <div className="flex justify-end border-t border-gray-100 pt-4">
          <Button variant="secondary" onClick={onClose}>Закрыть</Button>
        </div>
      </div>
      <span className="sr-only">{productTitle}</span>
    </Modal>
  );
}
