import { FloatingInput, FloatingSelect } from '../../components/form';
import type { EquipmentAttribute } from '../../lib/api-client';

function inputTypeFor(valueType: string) {
  if (valueType === 'integer' || valueType === 'decimal') return 'number';
  if (valueType === 'datetime') return 'datetime-local';
  if (valueType === 'date') return 'date';
  return 'text';
}

/** «Длина, фут» — the unit belongs in the label, where it is read before the field is filled. */
export function attributeLabel(attribute: EquipmentAttribute) {
  const unit = attribute.unitLabel ?? attribute.unit;
  return unit ? `${attribute.name}, ${unit}` : attribute.name;
}

/**
 * The category's own fields.
 *
 * One per row, full width. Two to a row halves the space a label has, and these labels carry their
 * unit — «Грузоподъёмность, кг» in a column 180px wide is not a label, it is a puzzle.
 */
export function ProductAttributeFields({
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
    return <p className="text-sm text-gray-500">У этой категории нет дополнительных характеристик.</p>;
  }

  return (
    <div className="space-y-4">
      {attributes
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(attribute => (
          <ProductAttributeField
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

function ProductAttributeField({
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

  if ((attribute.allowedValues?.length ?? 0) > 0) {
    return (
      <FloatingSelect
        label={label}
        value={value}
        onChange={onChange}
        options={attribute.allowedValues
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map(option => ({ value: option.valueKey, label: option.name }))}
        hint={attribute.hint}
        error={error}
      />
    );
  }

  return (
    <FloatingInput
      label={label}
      type={inputTypeFor(attribute.valueType)}
      value={value}
      onChange={event => onChange(event.target.value)}
      hint={attribute.hint}
      error={error}
    />
  );
}
