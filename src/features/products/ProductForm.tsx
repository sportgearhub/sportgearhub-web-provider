import { useEffect, useMemo, useState } from 'react';
import {
  ActionBar,
  ChoiceCards,
  FieldRow,
  FloatingInput,
  FloatingTextarea,
  FormPage,
  FormSection,
  FloatingSelect,
  FormStepper,
  PickerRow,
} from '../../components/form';
import { Button } from '../../components/ui/Button';
import { SectionPage } from '../../components/layout/SectionPage';
import { ApiError, locationsApi, productCategoriesApi, productsApi } from '../../lib/api-client';
import { PRICING_MODE_OPTIONS, DEFAULT_PRICING_MODE } from '../../lib/pricing-options';
import type { EquipmentAttribute } from '../../lib/api-client';
import { toAttributeMap } from '../../types';
import type { ProductCategory, ProductReview, ProductStatus, ProviderLocation, RentalTier } from '../../types';
import { ProductAttributeFields, attributeError } from './ProductAttributeFields';
import { submitRefusalMessage } from './productStatus';
import { ProductImagesSection } from './ProductImagesSection';

type StepKey = 'about' | 'attributes' | 'price' | 'policy' | 'media';

/** Which step a validation error belongs to, so a failed save lands on the field it is about. */
function stepFor(errorKey: string): StepKey {
  if (errorKey.startsWith('attr:')) return 'attributes';
  if (errorKey === 'pricing') return 'price';
  if (errorKey.startsWith('policy')) return 'policy';
  return 'about';
}

const STANDARD_TIERS: RentalTier[] = [
  { upToHours: 1, price: 0, label: '1 час' },
  { upToHours: 4, price: 0, label: 'Полдня' },
  { upToHours: 24, price: 0, label: 'Сутки' },
];

type Draft = {
  title: string;
  description: string;
  categorySlug: string;
  groupName: string;
  quantity: string;
  fulfillmentLocationId: string;
  attributes: Record<string, string>;
  pricingMode: string;
  baseAmount: string;
  tiers: RentalTier[];
  // Условия отмены — a gate on publication, so the card cannot be finished without them.
  leadTimeHours: string;
  cancellationAllowed: boolean;
  noShowChargePercent: string;
  depositUnit: string;
  depositValue: string;
};

const emptyDraft = (): Draft => ({
  title: '',
  description: '',
  categorySlug: '',
  groupName: '',
  quantity: '1',
  fulfillmentLocationId: '',
  attributes: {},
  pricingMode: DEFAULT_PRICING_MODE,
  tiers: STANDARD_TIERS.map(tier => ({ ...tier })),
  baseAmount: '',
  leadTimeHours: '',
  cancellationAllowed: true,
  noShowChargePercent: '',
  depositUnit: 'rub',
  depositValue: '',
});

/**
 * Creating and editing a product. One column, top to bottom, with the actions pinned at the
 * bottom of the screen — the same shape on a phone and on a desktop, because a rental card is
 * routinely added from behind the counter on a phone.
 */
export function ProductForm({
  productId,
  onNavigate,
}: {
  productId?: string;
  onNavigate: (path: string) => void;
}) {
  const isEdit = Boolean(productId);
  const [status, setStatus] = useState<ProductStatus>('draft');
  const [review, setReview] = useState<ProductReview | null>(null);
  /**
   * Which cards are waiting to be handed over. A rejected one is in the same position as one sent
   * back for changes: fixed, then submitted again. An active or paused card is simply being
   * edited, and one already with a moderator must not be resubmitted underneath them.
   */
  const shouldSubmit = status === 'draft' || status === 'changes_requested' || status === 'rejected';
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [locations, setLocations] = useState<ProviderLocation[]>([]);
  const [attributes, setAttributes] = useState<EquipmentAttribute[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft(current => ({ ...current, [key]: value }));
    setErrors(current => ({ ...current, [key]: '' }));
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      productCategoriesApi.list().catch(() => [] as ProductCategory[]),
      locationsApi.list().catch(() => [] as ProviderLocation[]),
      productId ? productsApi.get(productId) : Promise.resolve(null),
      productId ? productsApi.getPricing(productId).catch(() => null) : Promise.resolve(null),
      productId ? productsApi.getAttributes(productId).catch(() => null) : Promise.resolve(null),
      // A card with no cancellation terms yet answers 404; that is «не задано», not a failure.
      productId ? productsApi.getPolicy(productId).catch(() => null) : Promise.resolve(null),
    ])
      .then(([nextCategories, nextLocations, product, pricing, productAttributes, policy]) => {
        if (cancelled) return;
        setCategories(nextCategories);
        setLocations(nextLocations);
        if (product) {
          setStatus(product.status);
          setReview(product.review ?? null);
          setDraft(current => ({
            ...current,
            title: product.title,
            description: product.description ?? '',
            categorySlug: product.category?.slug ?? '',
            groupName: product.groupName ?? '',
            quantity: String(product.quantity ?? 1),
            fulfillmentLocationId: product.fulfillmentLocationId ?? '',
            // The endpoint reads back an array of values; the form and the save both want a map.
            // Note `?? {}` would not have caught this: `T[] | {}` reduces to `{}`, which is
            // assignable to Record<string, string>, so the wrong shape typechecked happily.
            attributes: toAttributeMap(productAttributes?.attributes),
            pricingMode: pricing?.pricingMode || DEFAULT_PRICING_MODE,
            baseAmount: pricing?.baseAmount != null ? String(pricing.baseAmount) : '',
            tiers: pricing?.rentalTiers?.length ? pricing.rentalTiers : STANDARD_TIERS.map(tier => ({ ...tier })),
            leadTimeHours: policy?.leadTimeHours != null ? String(policy.leadTimeHours) : '',
            cancellationAllowed: policy?.isCancellationAllowed ?? true,
            noShowChargePercent: policy?.noShowChargePercent != null ? String(policy.noShowChargePercent) : '',
            depositUnit: policy?.deposit?.unit ?? 'rub',
            depositValue: policy?.deposit?.value != null ? String(policy.deposit.value) : '',
          }));
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [productId]);

  // A category decides which attributes a product has, so the schema follows the pick.
  useEffect(() => {
    if (!draft.categorySlug) { setAttributes([]); return; }
    let cancelled = false;
    productCategoriesApi.attributes(draft.categorySlug)
      .then(schema => { if (!cancelled) setAttributes(schema.attributes ?? []); })
      .catch(() => { if (!cancelled) setAttributes([]); });
    return () => { cancelled = true; };
  }, [draft.categorySlug]);

  const categoryItems = useMemo(
    () => categories.map(category => ({
      value: category.slug,
      label: category.name,
      description: (category.activities ?? []).map(activity => activity.name).join(' · ') || null,
    })),
    [categories]
  );
  const locationItems = useMemo(
    () => locations.map(location => ({
      value: location.fulfillmentLocationId || location.locationId,
      label: location.name,
      description: location.address,
    })),
    [locations]
  );
  const isTiered = draft.pricingMode === 'rental_tiers';

  // The form is long enough that all of it at once buries the price under the characteristics.
  // Photos need a product to belong to, so that step exists only once there is one.
  const steps = useMemo(() => {
    const list: Array<{ key: StepKey; label: string }> = [{ key: 'about', label: 'О товаре' }];
    if (attributes.length > 0) list.push({ key: 'attributes', label: 'Характеристики' });
    list.push({ key: 'price', label: 'Цена' });
    list.push({ key: 'policy', label: 'Правила' });
    if (productId) list.push({ key: 'media', label: 'Фото' });
    return list;
  }, [attributes.length, productId]);

  const stepIndex = Math.min(step, steps.length - 1);
  const currentStep = steps[stepIndex]?.key ?? 'about';

  // Green means the step has what it needs, not that it has been walked past.
  const isStepComplete = (key: StepKey) => {
    if (key === 'about') return Boolean(draft.title.trim() && draft.categorySlug && Number(draft.quantity) > 0);
    if (key === 'attributes') return attributes.every(attribute => !attributeError(attribute, draft.attributes[attribute.key] ?? ''));
    if (key === 'price') return isTiered ? draft.tiers.some(tier => tier.price > 0) : Number(draft.baseAmount) > 0;
    // Публикация требует условий отмены; «запрещена» is an answer, so the step is done either way.
    if (key === 'policy') return !draft.cancellationAllowed || draft.leadTimeHours.trim() !== '';
    return false;
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!draft.title.trim()) next.title = 'Укажите название.';
    if (!draft.categorySlug) next.categorySlug = 'Выберите категорию.';
    if (!(Number(draft.quantity) > 0)) next.quantity = 'Количество должно быть больше нуля.';
    attributes.forEach(attribute => {
      const message = attributeError(attribute, draft.attributes[attribute.key] ?? '');
      if (message) next[`attr:${attribute.key}`] = message;
    });
    if (isTiered && !draft.tiers.some(tier => tier.price > 0)) next.pricing = 'Укажите цену хотя бы для одной ступени.';
    if (!isTiered && !(Number(draft.baseAmount) > 0)) next.pricing = 'Укажите цену.';
    setErrors(next);
    const firstBad = Object.keys(next)[0];
    if (firstBad) {
      const target = steps.findIndex(item => item.key === stepFor(firstBad));
      if (target >= 0) setStep(target);
    }
    return Object.keys(next).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    setError('');
    try {
      const body = {
        title: draft.title.trim(),
        description: draft.description.trim() || null,
        fulfillmentLocationId: draft.fulfillmentLocationId || null,
        category: draft.categorySlug,
        // PATCH reads null as «leave alone»; an empty string is the one way to clear a group.
        groupName: draft.groupName.trim(),
        quantity: Number(draft.quantity),
        attributes: draft.attributes,
      };
      // Create and patch take the same fields now, so there is one body rather than two shapes.
      const product = productId
        ? await productsApi.patch(productId, body)
        : await productsApi.create(body);
      await productsApi.putPricing(product.productId, {
        pricingMode: draft.pricingMode,
        baseAmount: isTiered ? null : Number(draft.baseAmount),
        rentalTiers: isTiered ? draft.tiers.filter(tier => tier.price > 0) : null,
        status: 'active',
      });

      await productsApi.putPolicy(product.productId, {
        leadTimeHours: draft.leadTimeHours.trim() === '' ? null : Number(draft.leadTimeHours),
        isCancellationAllowed: draft.cancellationAllowed,
        noShowChargePercent: draft.noShowChargePercent.trim() === '' ? null : Number(draft.noShowChargePercent),
        deposit: draft.depositValue.trim() === ''
          ? null
          : { unit: draft.depositUnit, value: Number(draft.depositValue) },
      });

      // The API never promotes a draft on its own. Without this call a finished card stays a draft
      // nobody is looking at — which is exactly what was happening.
      if (shouldSubmit) {
        try {
          await productsApi.submitForReview(product.productId);
        } catch (err) {
          const reason = await submitRefusalMessage(
            product.productId,
            err instanceof ApiError ? err.message : 'Попробуйте ещё раз.',
            id => productsApi.get(id)
          );
          setSaving(false);
          // Saved but not sent: both halves matter, and leaving either one out is how a seller
          // ends up re-entering work that was kept, or believing a card went that did not.
          setError(`Изменения сохранены, но карточка не ушла на проверку. ${reason}`);
          return;
        }
      }

      onNavigate(`/products/${product.productId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить товар.');
      setSaving(false);
    }
  };

  const patchTier = (index: number, patch: Partial<RentalTier>) =>
    set('tiers', draft.tiers.map((tier, i) => (i === index ? { ...tier, ...patch } : tier)));

  return (
    <SectionPage
      title={isEdit ? 'Редактирование товара' : 'Новый товар'}
      breadcrumb={{ label: 'Каталог', path: productId ? `/products/${productId}` : '/products' }}
      onNavigate={onNavigate}
      error={error}
    >
      {loading ? (
        <p className="text-sm text-gray-500">Загружаем...</p>
      ) : (
        <FormPage>
          {/* The ask, kept in front of the person answering it. The API keeps the last decided
              review visible through resubmission for exactly this: fixing a card while the
              objection is on another screen is how half of it gets missed. */}
          {(status === 'changes_requested' || status === 'rejected') && review?.message && (
            <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm font-medium text-amber-900">Что просили исправить</p>
              <p className="mt-1 whitespace-pre-line text-sm leading-5 text-amber-900">«{review.message}»</p>
            </div>
          )}

          <FormStepper
            steps={steps.map(item => ({
              label: item.label,
              done: isStepComplete(item.key),
              invalid: Object.keys(errors).some(key => errors[key] && stepFor(key) === item.key),
            }))}
            current={stepIndex}
            onSelect={setStep}
          />

          {currentStep === 'about' && (
          <>
          <FormSection title="О товаре" description="Как клиент увидит карточку в каталоге.">
            <FloatingInput
              label="Название"
              required
              value={draft.title}
              onChange={event => set('title', event.target.value)}
              error={errors.title}
              hint="Например: Горный велосипед Olympia Blade 29"
            />
            <PickerRow
              label="Категория"
              required
              items={categoryItems}
              value={draft.categorySlug}
              onChange={value => set('categorySlug', value)}
              error={errors.categorySlug}
              hint="Определяет, какие характеристики нужно заполнить"
              searchable
            />
            <FloatingInput
              label="Группа"
              value={draft.groupName}
              onChange={event => set('groupName', event.target.value)}
              hint="Один размер из линейки — клиент увидит варианты вместе"
            />
            <FloatingTextarea
              label="Описание"
              rows={4}
              value={draft.description}
              onChange={event => set('description', event.target.value)}
              hint="Что входит в комплект и на что обратить внимание. Необязательно."
            />
          </FormSection>

          <FormSection title="Наличие" description="Сколько единиц вы сдаёте и откуда их забирают.">
            <FloatingInput
              label="Количество"
              required
              type="number"
              min="1"
              value={draft.quantity}
              onChange={event => set('quantity', event.target.value)}
              error={errors.quantity}
              hint="Сколько можно сдать одновременно"
            />
            <PickerRow
              label="Пункт проката"
              items={locationItems}
              value={draft.fulfillmentLocationId}
              onChange={value => set('fulfillmentLocationId', value)}
              hint="Где клиент получит и вернёт снаряжение"
              emptyText="Пунктов проката пока нет."
            />
          </FormSection>
          </>
          )}

          {currentStep === 'attributes' && (
            <FormSection title="Характеристики" description="Клиенты ищут и фильтруют по ним. Незаполненное просто не покажем.">
              <ProductAttributeFields
                attributes={attributes}
                values={draft.attributes}
                errors={errors}
                onChange={(key, value) => {
                  set('attributes', { ...draft.attributes, [key]: value });
                  setErrors(current => ({ ...current, [`attr:${key}`]: '' }));
                }}
              />
            </FormSection>
          )}

          {currentStep === 'price' && (
          <FormSection title="Цена" description="Используется при расчёте стоимости брони.">
            <ChoiceCards
              options={PRICING_MODE_OPTIONS.map(option => ({ value: option.value, title: option.label }))}
              value={draft.pricingMode}
              onChange={value => set('pricingMode', value)}
            />
            {isTiered ? (
              <div className="space-y-2">
                {draft.tiers.map((tier, index) => (
                  <FieldRow key={index}>
                    <FloatingInput
                      label={tier.label || `До ${tier.upToHours} ч`}
                      type="number"
                      min="0"
                      value={String(tier.price || '')}
                      onChange={event => patchTier(index, { price: Number(event.target.value) || 0 })}
                      suffix="₽"
                    />
                    <FloatingInput
                      label="До скольких часов"
                      type="number"
                      min="1"
                      value={String(tier.upToHours)}
                      onChange={event => patchTier(index, { upToHours: Number(event.target.value) || 1 })}
                    />
                  </FieldRow>
                ))}
                {errors.pricing && <p className="px-1 text-xs text-red-600">{errors.pricing}</p>}
              </div>
            ) : (
              <FloatingInput
                label="Цена"
                type="number"
                min="0"
                value={draft.baseAmount}
                onChange={event => set('baseAmount', event.target.value)}
                error={errors.pricing}
                suffix="₽"
              />
            )}
          </FormSection>
          )}

          {currentStep === 'policy' && (
            <FormSection
              title="Правила аренды"
              description="Условия отмены обязательны для публикации: без них карточку не примут на проверку."
            >
              <FieldRow>
                <FloatingInput
                  label="Бронь не позднее чем за, ч"
                  type="number"
                  min="0"
                  value={draft.leadTimeHours}
                  onChange={event => set('leadTimeHours', event.target.value)}
                  hint="За сколько часов до начала клиент ещё может забронировать. Пусто — без ограничения."
                />
                <FloatingInput
                  label="Штраф за неявку, %"
                  type="number"
                  min="0"
                  max="100"
                  value={draft.noShowChargePercent}
                  onChange={event => set('noShowChargePercent', event.target.value)}
                  hint="Сколько удержать, если клиент не пришёл."
                />
              </FieldRow>

              <FieldRow className="sm:grid-cols-[1fr_12rem]">
                <FloatingInput
                  label="Залог"
                  type="number"
                  min="0"
                  value={draft.depositValue}
                  onChange={event => set('depositValue', event.target.value)}
                  hint="Пусто — залог не берётся."
                />
                <FloatingSelect
                  label="Единица залога"
                  value={draft.depositUnit}
                  options={[
                    { value: 'rub', label: '₽' },
                    { value: 'percent', label: '% от суммы' },
                  ]}
                  onChange={value => set('depositUnit', value)}
                />
              </FieldRow>

              <ChoiceCards
                options={[
                  { value: 'yes', title: 'Отмена разрешена', description: 'Клиент может отменить бронь сам.' },
                  { value: 'no', title: 'Отмена запрещена', description: 'Бронь нельзя отменить после оплаты.' },
                ]}
                value={draft.cancellationAllowed ? 'yes' : 'no'}
                onChange={(value: string) => set('cancellationAllowed', value === 'yes')}
              />
              {errors.policy && <p className="px-1 text-xs text-red-600">{errors.policy}</p>}
            </FormSection>
          )}

          {currentStep === 'media' && productId && (
            <FormSection title="Фото" description="Первое фото — главное: его видно в каталоге и в списках.">
              <ProductImagesSection productId={productId} />
            </FormSection>
          )}

          <ActionBar
            left={
              <>
                <Button variant="ghost" disabled={saving} onClick={() => onNavigate(productId ? `/products/${productId}` : '/products')}>
                  Отмена
                </Button>
                {stepIndex > 0 && (
                  <Button variant="secondary" disabled={saving} onClick={() => setStep(stepIndex - 1)}>
                    Назад
                  </Button>
                )}
                {stepIndex < steps.length - 1 && (
                  <Button variant="secondary" disabled={saving} onClick={() => setStep(stepIndex + 1)}>
                    Далее
                  </Button>
                )}
              </>
            }
            right={
              // The button says what the click does. «Сохранить» on a draft was true and useless:
              // it saved a card that then sat where nobody was looking at it.
              <Button variant="primary" loading={saving} onClick={() => void save()}>
                {shouldSubmit ? 'Отправить на проверку' : 'Сохранить'}
              </Button>
            }
            error={error}
          />
        </FormPage>
      )}
    </SectionPage>
  );
}
