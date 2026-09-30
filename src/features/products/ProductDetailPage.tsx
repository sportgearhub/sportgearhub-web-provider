import { useEffect, useState } from 'react';
import { ImageOff, Pencil } from 'lucide-react';
import { ActionMenu } from '../../components/ui/ActionMenu';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { DetailList, DetailRow } from '../../components/ui/DetailList';
import { SectionPage } from '../../components/layout/SectionPage';
import { SettingsCard } from '../../components/layout/SettingsCard';
import { ApiError, productsApi } from '../../lib/api-client';
import type { Product, ProductImage, ProductPolicy, ProductPricingPolicy } from '../../types';
import { formatPrice, productStatus } from './productStatus';

/**
 * One product, one page. The resource/offer split is gone, so there is nothing left to tab
 * between: what the product is, what it costs, what the rules are and what it looks like are all
 * facets of the same card, and on a phone they simply stack.
 */
export function ProductDetailPage({ productId, onNavigate }: { productId: string; onNavigate: (path: string) => void }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [pricing, setPricing] = useState<ProductPricingPolicy | null>(null);
  const [policy, setPolicy] = useState<ProductPolicy | null>(null);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const next = await productsApi.get(productId);
      setProduct(next);
      const [nextPricing, nextPolicy, nextImages] = await Promise.all([
        productsApi.getPricing(productId).catch(() => null),
        productsApi.getPolicy(productId).catch(() => null),
        productsApi.images.list(productId).catch(() => []),
      ]);
      setPricing(nextPricing);
      setPolicy(nextPolicy);
      setImages(nextImages);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 404
        ? 'Товар не найден — возможно, он удалён.'
        : err instanceof ApiError ? err.message : 'Не удалось загрузить товар.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [productId]);

  const run = async (action: () => Promise<Product>) => {
    setBusy(true);
    setError('');
    try {
      setProduct(await action());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось выполнить действие.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="p-6 text-sm text-gray-500">Загружаем товар...</p>;
  if (!product) {
    return (
      <SectionPage title="Товар" error={error} breadcrumb={{ label: 'Каталог', path: '/products' }} onNavigate={onNavigate}>
        <Button variant="secondary" onClick={() => onNavigate('/products')}>К каталогу</Button>
      </SectionPage>
    );
  }

  const meta = productStatus(product.status);
  const canSell = product.status === 'active';

  return (
    <SectionPage
      title={product.title}
      description={meta.hint}
      breadcrumb={{ label: 'Каталог', path: '/products' }}
      onNavigate={onNavigate}
      error={error}
      action={
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={meta.variant}>{meta.label}</Badge>
          <Button
            variant="secondary"
            size="sm"
            aria-label="Редактировать товар"
            onClick={() => onNavigate(`/products/${productId}/edit`)}
          >
            <Pencil size={14} /> Редактировать
          </Button>
          <ActionMenu
            label="Ещё"
            items={[
              product.status === 'draft'
                ? { label: 'Отправить на проверку', onClick: () => void run(() => productsApi.submitForReview(productId)) }
                : canSell
                  ? { label: 'Снять с продажи', onClick: () => void run(() => productsApi.deactivate(productId)) }
                  : { label: 'Вернуть в продажу', onClick: () => void run(() => productsApi.activate(productId)) },
              { label: 'В архив', danger: true, onClick: () => void run(() => productsApi.archive(productId)) },
            ]}
            disabled={busy}
          />
        </div>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="space-y-4">
          <SettingsCard
            title="О товаре"
            description="То, что клиент видит в карточке."
            action={
              <Button variant="secondary" size="sm" aria-label="Редактировать описание товара" onClick={() => onNavigate(`/products/${productId}/edit`)}>
                <Pencil size={13} /> Редактировать
              </Button>
            }
          >
            <DetailList>
              <DetailRow label="Категория" value={product.category?.name ?? product.category?.slug} />
              {product.groupName && <DetailRow label="Группа" value={product.groupName} hint="Карточки одной группы клиент видит как варианты одного товара" />}
              <DetailRow label="Количество" value={`${product.quantity} шт`} hint="Сколько можно сдать одновременно" />
              <DetailRow label="Описание" value={product.description} />
            </DetailList>
          </SettingsCard>

          <SettingsCard
            title="Цена"
            description="Сколько стоит аренда."
            action={
              <Button variant="secondary" size="sm" aria-label="Редактировать цену" onClick={() => onNavigate(`/products/${productId}/edit`)}>
                <Pencil size={13} /> Редактировать
              </Button>
            }
          >
            {pricing?.rentalTiers?.length ? (
              <DetailList>
                {pricing.rentalTiers.map((tier, index) => (
                  <DetailRow
                    key={index}
                    label={tier.label || `До ${tier.upToHours} ч`}
                    value={formatPrice(tier.price) ?? '—'}
                  />
                ))}
              </DetailList>
            ) : pricing?.baseAmount != null ? (
              <DetailList>
                <DetailRow label="Цена" value={formatPrice(pricing.baseAmount) ?? '—'} />
              </DetailList>
            ) : (
              <p className="text-sm text-gray-500">Цена не указана — без неё товар нельзя продавать.</p>
            )}
          </SettingsCard>

          <SettingsCard title="Правила аренды" description="Отмена, залог и запас времени до выдачи.">
            {policy ? (
              <DetailList>
                <DetailRow label="Бронь не позднее" value={policy.leadTimeHours != null ? `${policy.leadTimeHours} ч до начала` : null} />
                <DetailRow label="Отмена" value={policy.isCancellationAllowed ? 'Разрешена' : 'Запрещена'} />
                <DetailRow label="Залог" value={policy.deposit != null ? formatPrice(policy.deposit) : null} />
                <DetailRow label="Неявка" value={policy.noShowChargePercent != null ? `${policy.noShowChargePercent} %` : null} />
              </DetailList>
            ) : (
              <p className="text-sm text-gray-500">Правила не заданы — действуют условия платформы.</p>
            )}
          </SettingsCard>
        </div>

        <SettingsCard title="Фото" description={`${images.length} из 10`}>
          {images.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-gray-200 px-4 py-8 text-center">
              <ImageOff size={20} className="text-gray-300" />
              <p className="text-sm text-gray-500">Фото пока нет. Карточка без фото продаётся хуже.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {images.map(image => (
                <img
                  key={image.imageId}
                  src={image.url}
                  alt={image.originalFileName ?? ''}
                  className="aspect-square w-full rounded-md border border-gray-200 object-cover"
                />
              ))}
            </div>
          )}
        </SettingsCard>
      </div>
    </SectionPage>
  );
}
