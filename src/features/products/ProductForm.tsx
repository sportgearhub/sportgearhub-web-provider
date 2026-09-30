import { useEffect, useMemo, useState } from 'react';
import {
  ActionBar,
  ChoiceCards,
  FieldRow,
  FloatingInput,
  FloatingTextarea,
  FormPage,
  FormSection,
  PickerRow,
} from '../../components/form';
import { Button } from '../../components/ui/Button';
import { SectionPage } from '../../components/layout/SectionPage';
import { ApiError, locationsApi, productCategoriesApi, productsApi } from '../../lib/api-client';
import { PRICING_MODE_OPTIONS, DEFAULT_PRICING_MODE } from '../../lib/pricing-options';
import type { EquipmentAttribute } from '../../lib/api-client';
import type { ProductCategory, ProviderLocation, RentalTier } from '../../types';
import { ProductAttributeFields } from './ProductAttributeFields';

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
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [locations, setLocations] = useState<ProviderLocation[]>([]);
  const [attributes, setAttributes] = useState<EquipmentAttribute[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

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
    ])
      .then(([nextCategories, nextLocations, product, pricing, productAttributes]) => {
        if (cancelled) return;
        setCategories(nextCategories);
        setLocations(nextLocations);
        if (product) {
          setDraft(current => ({
            ...current,
            title: product.title,
            description: product.description ?? '',
            categorySlug: product.category?.slug ?? '',
            groupName: product.groupName ?? '',
            quantity: String(product.quantity ?? 1),
            fulfillmentLocationId: product.fulfillmentLocationId ?? '',
            attributes: productAttributes?.attributes ?? {},
            pricingMode: pricing?.pricingMode || DEFAULT_PRICING_MODE,
            baseAmount: pricing?.baseAmount != null ? String(pricing.baseAmount) : '',
            tiers: pricing?.rentalTiers?.length ? pricing.rentalTiers : STANDARD_TIERS.map(tier => ({ ...tier })),
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
    () => categories.map(category => ({ value: category.slug, label: category.name })),
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

  const validate = () => {
    const next: Record<string, string> = {};
    if (!draft.title.trim()) next.title = 'Укажите название.';
    if (!draft.categorySlug) next.categorySlug = 'Выберите категорию.';
    if (!(Number(draft.quantity) > 0)) next.quantity = 'Количество должно быть больше нуля.';
    attributes
      .filter(attribute => (attribute.requiredOn ?? []).length > 0)
      .forEach(attribute => {
        if (!draft.attributes[attribute.key]) next[`attr:${attribute.key}`] = 'Заполните поле.';
      });
    if (isTiered && !draft.tiers.some(tier => tier.price > 0)) next.pricing = 'Укажите цену хотя бы для одной ступени.';
    if (!isTiered && !(Number(draft.baseAmount) > 0)) next.pricing = 'Укажите цену.';
    setErrors(next);
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
      };
      const product = productId
        ? await productsApi.patch(productId, body)
        : await productsApi.create({
          ...body,
          category: draft.categorySlug,
          groupName: draft.groupName.trim() || null,
          quantity: Number(draft.quantity),
          attributes: draft.attributes,
        });

      if (productId) await productsApi.putAttributes(product.productId, draft.attributes);
      await productsApi.putPricing(product.productId, {
        pricingMode: draft.pricingMode,
        baseAmount: isTiered ? null : Number(draft.baseAmount),
        rentalTiers: isTiered ? draft.tiers.filter(tier => tier.price > 0) : null,
        status: 'active',
      });
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
              disabled={isEdit}
              hint={isEdit ? 'Категорию нельзя сменить после создания' : 'Определяет, какие характеристики нужно заполнить'}
              searchable
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
            <FieldRow>
              <FloatingInput
                label="Количество"
                required
                type="number"
                min="1"
                value={draft.quantity}
                onChange={event => set('quantity', event.target.value)}
                error={errors.quantity}
                disabled={isEdit}
                hint={isEdit ? 'Меняется отдельно' : undefined}
              />
              <FloatingInput
                label="Группа"
                value={draft.groupName}
                onChange={event => set('groupName', event.target.value)}
                hint="Один размер из линейки — клиент увидит варианты вместе"
                disabled={isEdit}
              />
            </FieldRow>
            <PickerRow
              label="Пункт проката"
              items={locationItems}
              value={draft.fulfillmentLocationId}
              onChange={value => set('fulfillmentLocationId', value)}
              hint="Где клиент получит и вернёт снаряжение"
              emptyText="Пунктов проката пока нет."
            />
          </FormSection>

          {attributes.length > 0 && (
            <FormSection title="Характеристики" description="Клиенты ищут и фильтруют по ним.">
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

          <ActionBar
            left={
              <Button variant="secondary" disabled={saving} onClick={() => onNavigate(productId ? `/products/${productId}` : '/products')}>
                Отмена
              </Button>
            }
            right={
              <Button variant="primary" loading={saving} onClick={() => void save()}>
                {isEdit ? 'Сохранить' : 'Создать товар'}
              </Button>
            }
            error={error}
          />
        </FormPage>
      )}
    </SectionPage>
  );
}
