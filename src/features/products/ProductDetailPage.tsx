import { useEffect, useState } from 'react';
import { ExternalLink, Pencil, Send } from 'lucide-react';
import { ActionMenu } from '../../components/ui/ActionMenu';
import { SkeletonDetail } from '../../components/ui/Skeleton';
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
import { submitRefusalMessage } from './productStatus';
import { storefrontProductUrl } from '../providers/providerStatus';
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
type DetailTab = 'about' | 'price' | 'policy' | 'included' | 'preview';

/** The card's parts, as siblings rather than a column to scroll. */
const DETAIL_TABS = [
  { value: 'about' as const, label: 'О товаре' },
  { value: 'price' as const, label: 'Цена' },
  { value: 'policy' as const, label: 'Правила' },
  { value: 'included' as const, label: 'Что входит' },
  { value: 'preview' as const, label: 'Предпросмотр' },
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
      // The card did not change, but what we are showing about it might be stale — a refusal is
      // usually about completeness, and the readiness card is the thing that explains it.
      void load();
    } finally {
      setBusy(false);
    }
  };

  /** Submitting is the one action whose refusal has something useful to say. */
  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      setProduct(await productsApi.submitForReview(productId));
    } catch (err) {
      const reason = await submitRefusalMessage(
        productId,
        err instanceof ApiError ? err.message : 'Не удалось отправить на проверку.',
        id => productsApi.get(id)
      );
      setError(`Карточка не ушла на проверку. ${reason}`);
      void load();
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="p-6"><SkeletonDetail rows={5} /></div>;
  if (!product) {
    return (
      <SectionPage title="Товар" error={error} breadcrumb={{ label: 'Каталог', path: '/products' }} onNavigate={onNavigate}>
        <Button variant="secondary" onClick={() => onNavigate('/products')}>К каталогу</Button>
      </SectionPage>
    );
  }

  const meta = productStatus(product.status);
  /**
   * What a card can do next is its status's business, not a guess from «is it selling».
   *
   * `activate` only works from `paused`. A seller does not put a card back on sale themselves
   * after an administrator sent it back — they fix what was asked and submit again, and approval
   * stays the administrator's. Offering «Вернуть в продажу» from changes_requested was a button
   * whose only outcome was a refusal.
   */
  const canSubmit = product.status === 'draft' || product.status === 'changes_requested' || product.status === 'rejected';
  const canPause = product.status === 'active';
  const canActivate = product.status === 'paused';
  const underReview = product.status === 'pending_review';

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
          {canSubmit && (
            <Button variant="primary" size="sm" loading={busy} onClick={() => void submit()}>
              <Send size={13} /> Отправить на проверку
            </Button>
          )}
          {!underReview && <ActionMenu
            label="Ещё"
            items={[
              ...(canPause ? [{ label: 'Снять с продажи', onClick: () => void run(() => productsApi.deactivate(productId)) }] : []),
              ...(canActivate ? [{ label: 'Вернуть в продажу', onClick: () => void run(() => productsApi.activate(productId)) }] : []),
              // Nothing while an administrator has the card — archiving it underneath them is
              // precisely the kind of move «ничего» is meant to exclude.
              ...(underReview ? [] : [{ label: 'В архив', danger: true, onClick: () => void run(() => productsApi.archive(productId)) }]),
            ]}
            disabled={busy}
          />}
        </div>
      }
    >
      {/* The status, said in words, where it is read before anything else. A card that came back
          from review looks identical to one that was never sent; the difference is what to do next,
          so the page says it. */}
      {(canSubmit || underReview || product.status === 'suspended') && (
        <div
          className={`mb-4 rounded-xl border px-4 py-3 text-sm leading-5 ${
            product.status === 'changes_requested' || product.status === 'rejected'
              ? 'border-amber-200 bg-amber-50 text-amber-900'
              : product.status === 'suspended'
                ? 'border-red-200 bg-red-50 text-red-900'
                : 'border-blue-200 bg-blue-50 text-blue-900'
          }`}
        >
          {(product.status === 'changes_requested' || product.status === 'rejected') && (
            <>
              <p className="font-medium">
                {product.status === 'changes_requested' ? 'Карточку вернули на доработку' : 'Карточку отклонили'}
              </p>
              {/* The administrator's own words. They cannot send a card back without them, so when
                  the status says it came back, this is there. Keyed off the status rather than off
                  `review` being present: it survives resubmission on purpose, so the seller can
                  re-read the ask while fixing it. */}
              {product.review?.message && (
                <p className="mt-1.5 whitespace-pre-line">«{product.review.message}»</p>
              )}
              <p className="mt-1.5 text-xs opacity-80">
                Исправьте и отправьте на проверку снова — вернуть в продажу самостоятельно нельзя.
                {product.review?.decidedAt && (
                  <> Решение от {new Date(product.review.decidedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}.</>
                )}
              </p>
            </>
          )}
          {product.status === 'draft' && (
            <>Черновик виден только вам. Заполните карточку и отправьте на проверку.</>
          )}
          {underReview && <>Карточка у модератора. Пока идёт проверка, её статус менять нельзя.</>}
          {product.status === 'suspended' && (
            <>Карточку остановила платформа. Снять ограничение может только администратор.</>
          )}
        </div>
      )}

      {/* Above the grid, not inside the left column: a row of tabs there pushed the left column's
          first card down by its own height and left the sidebar hanging above it. */}
      <SegmentedTabs items={DETAIL_TABS} value={tab} onChange={setTab} className="mb-4 inline-flex max-w-full" />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="space-y-4">
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

          {tab === 'preview' && (
            <ProductPreview productId={productId} published={product.status === 'active'} />
          )}
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
        primaryLabel={canSubmit ? 'Сохранить и отправить' : undefined}
        onSaved={next => {
          setInfoSections(next);
          setEditingInfo(false);
          // Fixing what was asked and stopping leaves the card exactly where it was. Saving is half
          // the job on a card that is waiting to go back.
          if (canSubmit) void submit();
        }}
      />

      <ProductPolicyDialog
        open={editingPolicy}
        productId={productId}
        policy={policy}
        onClose={() => setEditingPolicy(false)}
        primaryLabel={canSubmit ? 'Сохранить и отправить' : undefined}
        onSaved={next => {
          setPolicy(next);
          setEditingPolicy(false);
          if (canSubmit) void submit();
        }}
      />
    </SectionPage>
  );
}

/**
 * The card as a customer meets it, on the storefront.
 *
 * Embedded rather than linked away, because the question being asked is «что видит клиент» and the
 * answer should not cost the seller their place on this page. The storefront may refuse to be
 * framed — that is its right, and the link beside it is the way through when it does; the frame is
 * the convenience, not the only route.
 */
function ProductPreview({ productId, published }: { productId: string; published: boolean }) {
  const url = storefrontProductUrl(productId);

  return (
    <SettingsCard
      title="Предпросмотр"
      description="Карточка на сайте — то, что видит клиент."
      action={
        <Button variant="secondary" size="sm" asChild>
          <a href={url} target="_blank" rel="noreferrer">
            <ExternalLink size={13} /> Открыть на сайте
          </a>
        </Button>
      }
    >
      {!published && (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
          Карточка ещё не в продаже, поэтому на сайте её может не быть. Отправьте её на проверку —
          после публикации здесь появится то же, что увидит клиент.
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
        <iframe
          src={url}
          title="Предпросмотр карточки"
          loading="lazy"
          sandbox="allow-scripts allow-same-origin allow-popups"
          className="h-[70vh] w-full bg-white"
        />
      </div>

      <p className="mt-2 break-all text-xs text-gray-500">{url}</p>
    </SettingsCard>
  );
}
