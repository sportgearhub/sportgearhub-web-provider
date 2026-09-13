import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ResourceImageDraftSection, ResourceImagesSection } from './ResourceImagesSection';
import { isAttributeVisible, ResourceAttributeBuilder } from './ResourceAttributeFields';
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
}

function textValue(value: unknown) {
  return String(value ?? '').trim();
}

export function ResourceForm({
  resource,
  categories,
  onSubmit,
  onCancel,
  submitting = false,
  loadingCategories = false,
}: ResourceFormProps) {
  const isEdit = Boolean(resource);
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
  const categoryOptions = categories.map(category => ({ value: category.slug, label: category.title }));

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

  const handleSubmit = async () => {
    if (submitting || submitInFlightRef.current) return;
    submitInFlightRef.current = true;

    const nextErrors: Record<string, string> = {};
    if (!selectedCategory) nextErrors.category = 'Выберите категорию.';
    if (!textValue(title)) nextErrors.title = 'Укажите название.';
    resourceAttributes
      .filter(attribute => (attribute.requiredOn ?? []).some(scope => scope === 'resource' || scope === 'create'))
      .forEach(attribute => {
        if (!textValue(attributeValues[attribute.key] ?? '')) {
          nextErrors[`attr:${attribute.key}`] = 'Заполните поле.';
        }
      });
    if (Object.keys(nextErrors).length > 0 || !selectedCategory) {
      setErrors(nextErrors);
      submitInFlightRef.current = false;
      return;
    }

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

  return (
    <div className="max-w-2xl space-y-3">
      <Card className="p-3">
        <CardHeader title="Позиция" className="mb-3" />
        <div className="grid gap-3 md:grid-cols-2">
          <FancySelect
            label="Категория"
            options={categoryOptions}
            value={categorySlug}
            onChange={slug => {
              setCategorySlug(slug);
              setErrors(current => ({ ...current, category: '' }));
            }}
            error={errors.category}
            disabled={loadingCategories || categories.length === 0}
          />
          <Input
            label="Название"
            value={title}
            onChange={event => {
              setTitle(event.target.value);
              setErrors(current => ({ ...current, title: '' }));
            }}
            error={errors.title}
            placeholder="Например: Горный велосипед Olympia Blade 29"
          />
        </div>
      </Card>

      {selectedCategory && (schemaLoading || resourceAttributes.length > 0) && (
        <Card className="p-3">
          <CardHeader title="Характеристики" className="mb-3" />
          {schemaLoading ? (
            <p className="text-xs text-gray-500">Загружаем поля категории...</p>
          ) : (
            <div className="space-y-3">
              {(brandAttribute || modelAttribute) && (
                <div className="grid gap-3 md:grid-cols-2">
                  {brandAttribute && (
                    <BrandCombobox
                      label={brandAttribute.label}
                      value={attributeValues[brandAttribute.key] ?? ''}
                      initialLabel={attributeLabels[brandAttribute.key]}
                      categorySlug={selectedCategory?.slug}
                      error={errors[`attr:${brandAttribute.key}`]}
                      onChange={brandId => setAttribute(brandAttribute.key, brandId)}
                    />
                  )}
                  {modelAttribute && (
                    <Input
                      label={modelAttribute.label}
                      value={attributeValues[modelAttribute.key] ?? ''}
                      error={errors[`attr:${modelAttribute.key}`]}
                      onChange={event => setAttribute(modelAttribute.key, event.target.value)}
                    />
                  )}
                </div>
              )}
              {otherAttributes.length > 0 && (
                <ResourceAttributeBuilder
                  attributes={otherAttributes}
                  values={attributeValues}
                  errors={Object.fromEntries(otherAttributes.map(attribute => [attribute.key, errors[`attr:${attribute.key}`]]))}
                  onChange={setAttribute}
                />
              )}
            </div>
          )}
        </Card>
      )}

      {isEdit
        ? resource?.resourceId && <ResourceImagesSection resourceId={resource.resourceId} compact />
        : <ResourceImageDraftSection files={imageFiles} onChange={setImageFiles} disabled={submitting} />}

      <div className="flex gap-2">
        <Button variant="primary" onClick={handleSubmit} loading={submitting}>
          {isEdit ? 'Сохранить изменения' : 'Создать позицию'}
        </Button>
        <Button variant="secondary" onClick={onCancel}>Отмена</Button>
      </div>
    </div>
  );
}

function FancySelect({
  label,
  value,
  options,
  error,
  disabled = false,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  error?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selected = options.find(option => option.value === value);
  const filtered = options.filter(option => option.label.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <label className="mb-1 block text-xs font-medium text-gray-700">{label}</label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(current => !current)}
        className={`flex w-full items-center justify-between rounded-md border bg-white px-3 py-2 text-left text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#9ec5fe] disabled:bg-[#f8fafc] disabled:text-[#94a3b8] ${
          error ? 'border-[#dc3545]' : open ? 'border-[#86b7fe]' : 'border-[#cbd5e1]'
        } ${selected?.value ? 'text-[#1f2d3d]' : 'text-[#8a97a8]'}`}
      >
        <span className="truncate">{selected?.label ?? 'Выберите значение'}</span>
        <ChevronDown size={15} className={`ml-2 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && !disabled && (
        <div className="absolute z-30 mt-1 max-h-64 w-full overflow-hidden rounded-md border border-[#d7e0ea] bg-white shadow-lg">
          {options.length > 7 && (
            <div className="border-b border-gray-100 p-2">
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                autoFocus
                placeholder="Поиск..."
                className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-blue-400"
              />
            </div>
          )}
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.map(option => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onMouseDown={event => event.preventDefault()}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                    setSearch('');
                  }}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors ${
                    isSelected ? 'bg-blue-50 text-blue-800' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected && <Check size={14} className="shrink-0 text-blue-700" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

/**
 * Brand typeahead. Emits the selected (or freshly created) brand's `brandId`
 * via onChange; keeps its own display text. Used for reference brand attributes.
 */
function BrandCombobox({
  label,
  value,
  initialLabel,
  categorySlug,
  error,
  onChange,
}: {
  label: string;
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
      <label className="mb-1 block text-xs font-medium text-gray-700">{label}</label>
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={query}
          onFocus={() => setOpen(true)}
          onChange={event => {
            setQuery(event.target.value);
            setOpen(true);
            if (value) onChange(''); // typing invalidates the previously resolved brand
          }}
          placeholder="Начните вводить бренд..."
          className={`w-full rounded-md border bg-white px-9 py-2 text-sm text-gray-900 outline-none transition focus:border-[#86b7fe] focus:ring-2 focus:ring-[#9ec5fe] ${error ? 'border-[#dc3545]' : 'border-[#cbd5e1]'}`}
        />
      </div>
      {value && !open && <p className="mt-1 text-xs text-emerald-700">Бренд выбран.</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      {open && trimmed.length >= 2 && (
        <div className="absolute z-40 mt-1 max-h-64 w-full overflow-auto rounded-md border border-[#d7e0ea] bg-white py-1 shadow-lg">
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
    </div>
  );
}
