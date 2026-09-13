import { Input } from '../../components/ui/Input';
import type { EquipmentAttribute } from '../../lib/api-client';

function inputTypeFor(valueType: string) {
  if (valueType === 'integer' || valueType === 'decimal') return 'number';
  if (valueType === 'datetime') return 'datetime-local';
  if (valueType === 'date') return 'date';
  return 'text';
}

function optionsForField(field: EquipmentAttribute | undefined) {
  if (!field?.allowedValues?.length) return [{ value: '', label: 'Выберите значение' }];

  return [
    { value: '', label: 'Выберите значение' },
    ...field.allowedValues
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(option => ({ value: option.valueKey, label: option.label })),
  ];
}

export function isAttributeVisible(attribute: EquipmentAttribute, values: Record<string, string>) {
  const conditions = attribute.visibleWhen ?? [];
  if (conditions.length === 0) return true;

  return conditions.every(condition => {
    const selectedValue = values[condition.attributeKey];
    return selectedValue ? condition.allowedValueKeys.includes(selectedValue) : false;
  });
}

export function ResourceAttributeBuilder({
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
        <ResourceAttributeField
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

function ResourceAttributeField({
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

  if ((attribute.allowedValues?.length ?? 0) > 0) {
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
