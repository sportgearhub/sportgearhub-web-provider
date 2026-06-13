import { Input } from '../../components/ui/Input';
import type { EquipmentAttribute, EquipmentAttributeSchema } from '../../lib/api-client';

export const fixedVariantAttributeKeys = new Set(['brand', 'brand_id', 'brand_name', 'model']);

function inputTypeFor(valueType: string) {
  if (valueType === 'integer' || valueType === 'decimal') return 'number';
  if (valueType === 'datetime') return 'datetime-local';
  if (valueType === 'date') return 'date';
  return 'text';
}

function optionsForField(field: EquipmentAttribute | undefined) {
  if (!field?.allowedValues.length) return [{ value: '', label: 'Выберите значение' }];

  return [
    { value: '', label: 'Выберите значение' },
    ...field.allowedValues
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(option => ({ value: option.valueKey, label: option.label })),
  ];
}

export function isVariantAttributeVisible(attribute: EquipmentAttribute, values: Record<string, string>) {
  if (attribute.visibleWhen.length === 0) return true;

  return attribute.visibleWhen.every(condition => {
    const selectedValue = values[condition.attributeKey];
    return selectedValue ? condition.allowedValueKeys.includes(selectedValue) : false;
  });
}

export function visibleVariantAttributes(
  schemaOrAttributes: EquipmentAttributeSchema | EquipmentAttribute[] | null,
  values: Record<string, string>,
  options: { hideFixed?: boolean } = {}
) {
  const attributes = Array.isArray(schemaOrAttributes)
    ? schemaOrAttributes
    : schemaOrAttributes?.attributes ?? [];
  const hideFixed = options.hideFixed ?? true;

  return attributes
    .filter(attribute =>
      (attribute.appliesTo ?? []).includes('variant') &&
      (!hideFixed || !fixedVariantAttributeKeys.has(attribute.key)) &&
      isVariantAttributeVisible(attribute, values)
    )
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function pruneHiddenVariantAttributes(
  schemaOrAttributes: EquipmentAttributeSchema | EquipmentAttribute[] | null,
  values: Record<string, string>,
  options: { hideFixed?: boolean } = {}
) {
  if (!schemaOrAttributes) return values;

  const visibleKeys = new Set(visibleVariantAttributes(schemaOrAttributes, values, options).map(attribute => attribute.key));
  return Object.fromEntries(Object.entries(values).filter(([key]) => visibleKeys.has(key) || fixedVariantAttributeKeys.has(key)));
}

export function VariantAttributeBuilder({
  attributes,
  values,
  errors = {},
  onChange,
}: {
  attributes: EquipmentAttribute[];
  values: Record<string, string>;
  errors?: Record<string, string | undefined>;
  onChange: (key: string, value: string) => void;
}) {
  if (attributes.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-sm text-gray-500">
        Для этой категории нет дополнительных полей модели.
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {attributes.map(attribute => (
        <VariantAttributeField
          key={attribute.key}
          attribute={attribute}
          value={values[attribute.key] ?? ''}
          error={errors[attribute.key]}
          onChange={value => onChange(attribute.key, value)}
        />
      ))}
    </div>
  );
}

function VariantAttributeField({
  attribute,
  value,
  error,
  onChange,
}: {
  attribute: EquipmentAttribute;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const label = attribute.unitLabel
    ? `${attribute.label}, ${attribute.unitLabel}`
    : attribute.unit
      ? `${attribute.label}, ${attribute.unit}`
      : attribute.label;

  if (attribute.allowedValues.length > 0) {
    return (
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">{label}</label>
        <select
          value={value}
          onChange={event => onChange(event.target.value)}
          className={`h-9 w-full rounded-md border bg-white px-3 text-sm text-gray-900 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 ${
            error ? 'border-red-300' : 'border-gray-200'
          }`}
        >
          {optionsForField(attribute).map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <Input
      label={label}
      type={inputTypeFor(attribute.valueType)}
      value={value}
      onChange={event => onChange(event.target.value)}
      error={error}
    />
  );
}
