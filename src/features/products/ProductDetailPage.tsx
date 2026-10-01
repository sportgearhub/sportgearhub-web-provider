import { useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';
import { ActionMenu } from '../../components/ui/ActionMenu';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { DetailList, DetailRow } from '../../components/ui/DetailList';
import { SectionPage } from '../../components/layout/SectionPage';
import { SettingsCard } from '../../components/layout/SettingsCard';
import { ApiError, productsApi } from '../../lib/api-client';
import { ProductImagesSection } from './ProductImagesSection';
import { ProductQuoteCalculator } from './ProductQuoteCalculator';
import { ProductReadinessCard } from './ProductReadinessCard';
import { ProductPolicyDialog } from './ProductPolicyDialog';
import { ProductInfoSectionsDialog } from './ProductInfoSectionsDialog';
import { SegmentedTabs } from '../../components/ui/SegmentedTabs';
import { infoSectionLabel } from './infoSections';
import type {
  OfferInfoSection,
  Product,
  ProductPolicy,
  ProductPricingPolicy,
  ProductPricingSummary,
} from '../../types';
import { formatPrice, productStatus } from './productStatus';

/**
 * One product, one page. The resource/offer split is gone, so there is nothing left to tab
 * between: what the product is, what it costs, what the rules are and what it looks like are all
 * facets of the same card, and on a phone they simply stack.
 */
type DetailTab = 'about' | 'price' | 'policy' | 'included';

/** The card's parts, as siblings rather than a column to scroll. */
const DETAIL_TABS = [
  { value: 'about' as const, label: 'О товаре' },
  { value: 'price' as const, label: 'Цена' },
  { value: 'policy' as const, label: 'Правила' },
  { value: 'included' as const, label: 'Что входит' },
];

export function ProductDetailPage({ productId, onNavigate }: { productId: string; onNavigate: (path: string) => void }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [pricing, setPricing] = useState<ProductPricingPolicy | null>(null);
  const [policy, setPolicy] = useState<ProductPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(false);
  const [editingInfo, setEditingInfo] = useState(false);
  const [tab, setTab] = useState<DetailTab>('about');
  const [infoSections, setInfoSections] = useState<OfferInfoSection[]>([]);
  const [priceSummary, setPriceSummary] = useState<ProductPricingSummary | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const next = await productsApi.get(productId);
      setProduct(next);
      const [nextPricing, nextPolicy, nextInfo, nextSummary] = await Promise.all([
        productsApi.getPricing(productId).catch(() => null),
        productsApi.getPolicy(productId).catch(() => null),
        productsApi.getInfoSections(productId).catch(() => null),
        productsApi.pricingSummary(productId).catch(() => null),
      ]);
      setPricing(nextPricing);
      setPolicy(nextPolicy);
      setInfoSections(nextInfo ?? []);
      setPriceSummary(nextSummary);
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
          <Badge variant={meta.variant} size="md">{meta.label}</Badge>
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
          <SegmentedTabs items={DETAIL_TABS} value={tab} onChange={setTab} className="inline-flex max-w-full" />

          {tab === 'about' && <SettingsCard
            title="О товаре"
            description="То, что клиент видит в карточке."
          >
            <DetailList>
              <DetailRow label="Категория" value={product.category?.title ?? product.category?.slug} />
              <DetailRow
                label="Группа"
                value={product.groupName}
                hint="Карточки одной группы клиент видит как варианты одного товара"
              />
              <DetailRow label="Количество" value={`${product.quantity} шт`} hint="Сколько можно сдать одновременно" />
              <DetailRow label="Описание" value={product.description} multiline />
            </DetailList>
          </SettingsCard>}

          {tab === 'price' && <SettingsCard
            title="Цена"
            description="Сколько стоит аренда."
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

            {priceSummary?.displayAmount != null && (
              <p className="mt-3 border-t border-gray-100 pt-3 text-sm text-gray-600">
                В каталоге клиент увидит:{' '}
                <span className="font-medium text-gray-950">
                  {formatPrice(priceSummary.displayAmount)}
                  {priceSummary.displayUnit ? ` / ${priceSummary.displayUnit}` : ''}
                </span>
                {priceSummary.note ? ` · ${priceSummary.note}` : ''}
              </p>
            )}

            {pricing && <div className="mt-3"><ProductQuoteCalculator productId={productId} /></div>}
          </SettingsCard>}

          {tab === 'policy' && <SettingsCard
            title="Правила аренды"
            description="Отмена, залог и запас времени до выдачи."
            action={
              <Button variant="secondary" size="sm" aria-label="Редактировать правила аренды" onClick={() => setEditingPolicy(true)}>
                <Pencil size={13} /> {policy ? 'Редактировать' : 'Добавить'}
              </Button>
            }
          >
            {policy ? (
              <DetailList>
                <DetailRow label="Бронь не позднее" value={policy.leadTimeHours != null ? `${policy.leadTimeHours} ч до начала` : null} />
                <DetailRow label="Отмена" value={policy.isCancellationAllowed ? 'Разрешена' : 'Запрещена'} />
                <DetailRow
                  label="Залог"
                  value={policy.deposit ? (policy.deposit.unit === 'percent' ? `${policy.deposit.value} % от суммы` : formatPrice(policy.deposit.value)) : null}
                />
                <DetailRow label="Неявка" value={policy.noShowChargePercent != null ? `${policy.noShowChargePercent} %` : null} />
              </DetailList>
            ) : (
              <p className="text-sm text-gray-500">Правила не заданы — действуют условия платформы.</p>
            )}
          </SettingsCard>}

          {tab === 'included' && <SettingsCard
            title="Что входит"
            description="Комплект, что взять с собой и что нужно знать заранее."
            action={
              <Button variant="secondary" size="sm" aria-label="Редактировать состав комплекта" onClick={() => setEditingInfo(true)}>
                <Pencil size={13} /> {infoSections.length > 0 ? 'Редактировать' : 'Добавить'}
              </Button>
            }
          >
            {infoSections.length === 0 ? (
              <p className="text-sm text-gray-500">Ничего не указано. Клиенты чаще спрашивают именно об этом.</p>
            ) : (
              <div className="space-y-3">
                {infoSections.map(section => (
                  <div key={section.kind}>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{infoSectionLabel(section.kind)}</p>
                    <ul className="mt-1 list-inside list-disc text-sm text-gray-900">
                      {section.items.map((item, index) => <li key={index}>{item}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </SettingsCard>}
        </div>

        <div className="space-y-4">
          <ProductReadinessCard sections={product.sections ?? []} />
          <ProductImagesSection productId={productId} />
        </div>
      </div>

      <ProductInfoSectionsDialog
        open={editingInfo}
        productId={productId}
        sections={infoSections}
        onClose={() => setEditingInfo(false)}
        onSaved={next => {
          setInfoSections(next);
          setEditingInfo(false);
        }}
      />

      <ProductPolicyDialog
        open={editingPolicy}
        productId={productId}
        policy={policy}
        onClose={() => setEditingPolicy(false)}
        onSaved={next => {
          setPolicy(next);
          setEditingPolicy(false);
        }}
      />
    </SectionPage>
  );
}
