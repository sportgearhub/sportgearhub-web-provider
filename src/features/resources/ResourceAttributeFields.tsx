import { FieldRow, FloatingInput, FloatingSelect } from '../../components/form';
import type { EquipmentAttribute } from '../../lib/api-client';

function inputTypeFor(valueType: string) {
  if (valueType === 'integer' || valueType === 'decimal') return 'number';
  if (valueType === 'datetime') return 'datetime-local';
  if (valueType === 'date') return 'date';
  return 'text';
}

export function isAttributeVisible(attribute: EquipmentAttribute, values: Record<string, string>) {
  const conditions = attribute.visibleWhen ?? [];
  if (conditions.length === 0) return true;

  return conditions.every(condition => {
    const selectedValue = values[condition.attributeKey];
    return selectedValue ? condition.allowedValueKeys.includes(selectedValue) : false;
  });
}

export function isAttributeRequired(attribute: EquipmentAttribute) {
  return (attribute.requiredOn ?? []).some(scope => scope === 'resource' || scope === 'create');
}

export function attributeLabel(attribute: EquipmentAttribute) {
  const unit = attribute.unitLabel ?? attribute.unit;
  return unit ? `${attribute.label}, ${unit}` : attribute.label;
}

/** The category's own fields, two to a row like Ozon's «Габариты и вес». */
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
    return <p className="px-1 text-sm text-gray-500">У этой категории нет дополнительных характеристик.</p>;
  }

  return (
    <FieldRow>
      {attributes.map(attribute => (
        <ResourceAttributeField
          key={attribute.key}
          attribute={attribute}
          value={values[attribute.key] ?? ''}
          error={errors[attribute.key]}
          onChange={value => onChange(attribute.key, value)}
        />
      ))}
    </FieldRow>
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
  const label = attributeLabel(attribute);
  const required = isAttributeRequired(attribute);

  if ((attribute.allowedValues?.length ?? 0) > 0) {
    return (
      <FloatingSelect
        label={label}
        required={required}
        value={value}
        onChange={event => onChange(event.target.value)}
        options={attribute.allowedValues
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map(option => ({ value: option.valueKey, label: option.label }))}
        hint={attribute.helpText}
        error={error}
      />
    );
  }

  return (
    <FloatingInput
      label={label}
      required={required}
      type={inputTypeFor(attribute.valueType)}
      value={value}
      onChange={event => onChange(event.target.value)}
      hint={attribute.helpText}
      error={error}
    />
  );
}
