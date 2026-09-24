import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ImageIcon, Search } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { ActionBar, FieldNote, FieldRow, FloatingInput, FormPage, FormSection, FormStepper, PickerRow, RequiredMark } from '../../components/form';
import { ResourceImageDraftSection, ResourceImagesSection } from './ResourceImagesSection';
import { attributeLabel, isAttributeRequired, isAttributeVisible, ResourceAttributeBuilder } from './ResourceAttributeFields';
import type { Resource } from '../../types';
import { ApiError, equipmentApi, resourcesApi, type EquipmentAttribute, type EquipmentAttributeSchema, type EquipmentBrandSuggestion, type ResourceCategory } from '../../lib/api-client';

/** Brand is a reference attribute whose value is an equipment-brand id; it gets a typeahead instead of a plain field. */
function isBrandAttribute(attribute: EquipmentAttribute) {
  return attribute.key === 'brand' || attribute.key === 'brand_id' ||
    (attribute.valueType === 'reference' && /brand/i.test(attribute.referenceType ?? attribute.key));
}

export type ResourceFormData = {
  title: string;
  categorySlug: string;
  resourceType: string;
  capacityMode: string;
  categoryName?: string;
  imageUrl?: string;
  imageFiles?: File[];
  status?: Resource['status'];
  attributes?: Record<string, string>;
};

interface ResourceFormProps {
  resource?: Resource;
  categories: ResourceCategory[];
  onSubmit: (data: ResourceFormData) => void | Promise<void>;
  onCancel: () => void;
  submitting?: boolean;
  loadingCategories?: boolean;
  /** Error from the save itself, shown next to the primary action. */
  submitError?: string;
}

function textValue(value: unknown) {
  return String(value ?? '').trim();
}

const CREATE_STEPS = ['Информация о позиции', 'Предварительный просмотр'];

/**
 * «Создание позиции» / «Редактирование позиции». One column of sections — information,
 * characteristics, images — and, on creation, a second step that shows the card the way the
 * catalogue will, before the position exists.
 */
export function ResourceForm({
  resource,
  categories,
  onSubmit,
  onCancel,
  submitting = false,
  loadingCategories = false,
  submitError,
}: ResourceFormProps) {
  const isEdit = Boolean(resource);
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState(resource?.title || '');
  const [categorySlug, setCategorySlug] = useState('');
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const submitInFlightRef = useRef(false);

  // Attribute schema + current values (values are sent inline on create, via PUT on edit).
  const [schema, setSchema] = useState<EquipmentAttributeSchema | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [attributeValues, setAttributeValues] = useState<Record<string, string>>({});
  // Display labels for reference attributes (e.g. brand id → canonical name).
  const [attributeLabels, setAttributeLabels] = useState<Record<string, string>>({});

  const selectedCategory = categories.find(category => category.slug === categorySlug);

  // Preselect the category for an existing resource once categories load.
  useEffect(() => {
    if (!resource || categorySlug || categories.length === 0) return;
    const matchingCategory =
      categories.find(category => category.slug === resource.category?.slug) ??
      categories.find(category =>
        category.resourceType === resource.resourceType &&
        category.capacityMode === resource.capacityMode
      );
    if (matchingCategory) setCategorySlug(matchingCategory.slug);
  }, [categories, categorySlug, resource]);

  // Load the attribute schema for the chosen category (both create and edit).
  useEffect(() => {
    if (!selectedCategory) { setSchema(null); return; }
    let cancelled = false;
    setSchemaLoading(true);
    setSchema(null);
    if (!isEdit) setAttributeValues({});
    equipmentApi.resourceCategoryAttributes(selectedCategory.resourceType, selectedCategory.slug)
      .then(next => { if (!cancelled) setSchema(next); })
      .catch(err => { if (!cancelled && !(err instanceof ApiError && err.status === 404)) setSchema(null); })
      .finally(() => { if (!cancelled) setSchemaLoading(false); });
    return () => { cancelled = true; };
  }, [isEdit, selectedCategory?.slug, selectedCategory?.resourceType]);

  // Load existing attribute values for an edited resource.
  useEffect(() => {
    if (!isEdit || !resource?.resourceId) return;
    let cancelled = false;
    resourcesApi.getAttributes(resource.resourceId)
      .then(result => {
        if (cancelled) return;
        const values: Record<string, string> = {};
        const labels: Record<string, string> = {};
        result.attributes.forEach(item => {
          values[item.key] = item.value;
          if (item.displayValue) labels[item.key] = item.displayValue;
        });
        setAttributeValues(values);
        setAttributeLabels(labels);
      })
      .catch(() => { /* no attributes yet */ });
    return () => { cancelled = true; };
  }, [isEdit, resource?.resourceId]);

  // Resource-scoped attributes, respecting visibleWhen conditions.
  const resourceAttributes = useMemo(
    () => (schema?.attributes ?? [])
      .filter(attribute => isAttributeVisible(attribute, attributeValues))
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder),
    [schema, attributeValues]
  );
  const brandAttribute = resourceAttributes.find(isBrandAttribute);
  const modelAttribute = resourceAttributes.find(attribute => attribute.key === 'model' && (attribute.allowedValues?.length ?? 0) === 0);
  const otherAttributes = resourceAttributes.filter(attribute => !isBrandAttribute(attribute) && attribute !== modelAttribute);

  const setAttribute = (key: string, value: string) => {
    setAttributeValues(current => ({ ...current, [key]: value }));
    setErrors(current => ({ ...current, [`attr:${key}`]: '' }));
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!selectedCategory) nextErrors.category = 'Выберите категорию.';
    if (!textValue(title)) nextErrors.title = 'Укажите название.';
    resourceAttributes.filter(isAttributeRequired).forEach(attribute => {
      if (!textValue(attributeValues[attribute.key] ?? '')) nextErrors[`attr:${attribute.key}`] = 'Заполните поле.';
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      window.setTimeout(() => document.querySelector('[aria-invalid="true"]')?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 0);
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (submitting || submitInFlightRef.current || !selectedCategory) return;
    submitInFlightRef.current = true;

    const attributes = Object.fromEntries(
      resourceAttributes
        .map(attribute => [attribute.key, textValue(attributeValues[attribute.key] ?? '')] as const)
        .filter(([, value]) => value !== '')
    );

    try {
      await onSubmit({
        title: title.trim(),
        categorySlug: selectedCategory.slug,
        resourceType: selectedCategory.resourceType,
        capacityMode: selectedCategory.capacityMode,
        categoryName: selectedCategory.title,
        imageFiles: isEdit ? undefined : imageFiles,
        status: isEdit ? resource?.status : 'draft',
        attributes: schema ? attributes : undefined,
      });
    } finally {
      submitInFlightRef.current = false;
    }
  };

  const goToPreview = () => {
    if (!validate()) return;
    setStep(1);
    window.scrollTo({ top: 0 });
  };

  const attributeSummary = resourceAttributes
    .filter(attribute => textValue(attributeValues[attribute.key] ?? '') !== '')
    .map(attribute => {
      const raw = attributeValues[attribute.key];
      const option = attribute.allowedValues?.find(item => item.valueKey === raw);
      return { label: attributeLabel(attribute), value: attributeLabels[attribute.key] ?? option?.label ?? raw };
    });

  if (!isEdit && step === 1) {
    return (
      <FormPage>
        <FormStepper steps={CREATE_STEPS} current={1} onSelect={setStep} />
        <FormSection title="Так позицию увидят в каталоге" description="Проверьте карточку. Изменить что-то можно, вернувшись на шаг назад.">
          <ResourcePreviewCard
            title={title.trim()}
            category={selectedCategory?.title ?? ''}
            imageFile={imageFiles[0]}
            imageCount={imageFiles.length}
            attributes={attributeSummary}
          />
        </FormSection>
        <ActionBar
          error={submitError}
          left={
            <>
              <Button variant="secondary" onClick={() => setStep(0)} disabled={submitting}>Назад</Button>
              <Button variant="ghost" onClick={onCancel} disabled={submitting}>Отмена</Button>
            </>
          }
          right={<Button variant="primary" onClick={() => void handleSubmit()} loading={submitting}>Завершить создание</Button>}
        />
      </FormPage>
    );
  }

  return (
    <FormPage>
      {!isEdit && <FormStepper steps={CREATE_STEPS} current={0} />}

      <FormSection title="Информация о позиции">
        <PickerRow
          label="Категория"
          required
          items={categories.map(category => ({ value: category.slug, label: category.title }))}
          value={categorySlug}
          loading={loadingCategories}
          disabled={categories.length === 0}
          onChange={slug => {
            setCategorySlug(slug);
            setErrors(current => ({ ...current, category: '' }));
          }}
          error={errors.category}
          hint={isEdit ? 'Смена категории меняет набор характеристик.' : undefined}
          emptyText="Категории не загрузились."
        />
        <FloatingInput
          label="Название"
          required
          value={title}
          onChange={event => {
            setTitle(event.target.value);
            setErrors(current => ({ ...current, title: '' }));
          }}
          error={errors.title}
          hint="Так позицию увидят клиенты. Например: Горный велосипед Olympia Blade 29"
          maxLength={160}
        />
      </FormSection>

      {selectedCategory && (
        <FormSection title="Характеристики" description={schemaLoading ? 'Загружаем поля категории…' : undefined}>
          {!schemaLoading && (
            <>
              {(brandAttribute || modelAttribute) && (
                <FieldRow>
                  {brandAttribute && (
                    <BrandCombobox
                      label={brandAttribute.label}
                      required={isAttributeRequired(brandAttribute)}
                      value={attributeValues[brandAttribute.key] ?? ''}
                      initialLabel={attributeLabels[brandAttribute.key]}
                      categorySlug={selectedCategory.slug}
                      error={errors[`attr:${brandAttribute.key}`]}
                      onChange={brandId => setAttribute(brandAttribute.key, brandId)}
                    />
                  )}
                  {modelAttribute && (
                    <FloatingInput
                      label={modelAttribute.label}
                      required={isAttributeRequired(modelAttribute)}
                      value={attributeValues[modelAttribute.key] ?? ''}
                      error={errors[`attr:${modelAttribute.key}`]}
                      onChange={event => setAttribute(modelAttribute.key, event.target.value)}
                    />
                  )}
                </FieldRow>
              )}
              <ResourceAttributeBuilder
                attributes={otherAttributes}
                values={attributeValues}
                errors={Object.fromEntries(otherAttributes.map(attribute => [attribute.key, errors[`attr:${attribute.key}`]]))}
                onChange={setAttribute}
              />
            </>
          )}
        </FormSection>
      )}

      <FormSection title="Изображения" description="Первое фото — главное, оно показывается в каталоге. До 10 фото: JPEG, PNG или WebP.">
        {isEdit
          ? resource?.resourceId && <ResourceImagesSection resourceId={resource.resourceId} compact />
          : <ResourceImageDraftSection files={imageFiles} onChange={setImageFiles} disabled={submitting} />}
      </FormSection>

      <ActionBar
        error={isEdit ? submitError : undefined}
        left={<Button variant="secondary" onClick={onCancel} disabled={submitting}>Отмена</Button>}
        right={
          isEdit
            ? <Button variant="primary" onClick={() => { if (validate()) void handleSubmit(); }} loading={submitting}>Сохранить</Button>
            : <Button variant="primary" onClick={goToPreview}>Далее</Button>
        }
      />
    </FormPage>
  );
}

function ResourcePreviewCard({
  title,
  category,
  imageFile,
  imageCount,
  attributes,
}: {
  title: string;
  category: string;
  imageFile?: File;
  imageCount: number;
  attributes: Array<{ label: string; value: string }>;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!imageFile) { setUrl(null); return; }
    const next = URL.createObjectURL(imageFile);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [imageFile]);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="flex aspect-[4/3] items-center justify-center bg-gray-100">
        {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : (
          <div className="flex flex-col items-center gap-1 text-gray-400">
            <ImageIcon size={28} />
            <span className="text-xs">Без фото</span>
          </div>
        )}
      </div>
      <div className="p-4">
        <p className="text-xs uppercase tracking-wide text-gray-500">{category}</p>
        <h3 className="mt-1 text-lg font-semibold text-gray-950">{title || 'Без названия'}</h3>
        {imageCount > 1 && <p className="mt-1 text-xs text-gray-500">Фото: {imageCount}</p>}
        {attributes.length > 0 && (
          <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
            {attributes.map(item => (
              <div key={item.label} className="flex justify-between gap-3 border-b border-gray-100 py-1">
                <dt className="text-gray-500">{item.label}</dt>
                <dd className="text-right font-medium text-gray-900">{item.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}

/**
 * Brand typeahead. Emits the selected (or freshly created) brand's `brandId`
 * via onChange; keeps its own display text. Used for reference brand attributes.
 */
function BrandCombobox({
  label,
  required,
  value,
  initialLabel,
  categorySlug,
  error,
  onChange,
}: {
  label: string;
  required?: boolean;
  value: string;
  initialLabel?: string;
  categorySlug?: string;
  error?: string;
  onChange: (brandId: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const seededRef = useRef(false);

  // Seed the visible text once from the resolved brand label (edit flow).
  useEffect(() => {
    if (seededRef.current) return;
    if (value && initialLabel) {
      setQuery(initialLabel);
      seededRef.current = true;
    }
  }, [value, initialLabel]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [suggestions, setSuggestions] = useState<EquipmentBrandSuggestion[]>([]);
  const trimmed = query.trim();

  useEffect(() => {
    if (!open || trimmed.length < 2) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      equipmentApi.brandSuggestions(trimmed, categorySlug)
        .then(result => { if (!cancelled) setSuggestions(result.items); })
        .catch(() => { if (!cancelled) setSuggestions([]); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [trimmed, categorySlug, open]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [open]);

  const selectBrand = (brand: EquipmentBrandSuggestion) => {
    onChange(brand.brandId);
    setQuery(brand.canonicalName);
    setOpen(false);
  };

  const createBrand = async () => {
    if (!trimmed || creating) return;
    setCreating(true);
    try {
      const result = await equipmentApi.createBrand({ name: trimmed, category: categorySlug ?? null });
      onChange(result.brand.brandId);
      setQuery(result.brand.canonicalName);
      setOpen(false);
    } finally {
      setCreating(false);
    }
  };

  const exactMatch = suggestions.some(item => item.canonicalName.toLowerCase() === trimmed.toLowerCase());
  const canCreate = trimmed.length >= 2 && !exactMatch && !loading;

  return (
    <div ref={rootRef} className="relative">
      <FloatingInput
        label={label}
        required={required}
        value={query}
        onFocus={() => setOpen(true)}
        onChange={event => {
          setQuery(event.target.value);
          setOpen(true);
          if (value) onChange(''); // typing invalidates the previously resolved brand
        }}
        error={error}
        suffix={value ? <Check size={16} className="text-emerald-600" /> : <Search size={15} />}
        autoComplete="off"
      />
      {open && trimmed.length >= 2 && (
        <div className="absolute left-0 right-0 top-[58px] z-40 max-h-64 overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {loading && <div className="px-3 py-2 text-xs text-gray-500">Ищем бренды...</div>}
          {!loading && suggestions.map(brand => (
            <button
              key={brand.brandId}
              type="button"
              onMouseDown={event => event.preventDefault()}
              onClick={() => selectBrand(brand)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-blue-50"
            >
              <span className="truncate font-medium text-gray-900">{brand.canonicalName}</span>
              <span className="text-[11px] text-gray-500">{Math.round(brand.confidence * 100)}%</span>
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              onMouseDown={event => event.preventDefault()}
              onClick={() => void createBrand()}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-blue-800 transition-colors hover:bg-blue-50"
            >
              <Check size={14} /> {creating ? 'Создаём...' : `Создать бренд «${trimmed}»`}
            </button>
          )}
        </div>
      )}
      {!error && !value && trimmed.length >= 2 && !open && (
        <FieldNote hint={<>Выберите бренд из списка или создайте новый.<RequiredMark /></>} />
      )}
    </div>
  );
}
