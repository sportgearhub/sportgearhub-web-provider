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

/** What the schema says a value must satisfy, said once in words under the field. */
function boundsHint(attribute: EquipmentAttribute) {
  const { minValue, maxValue, minLength, maxLength } = attribute;
  if (minValue != null && maxValue != null) return `От ${minValue} до ${maxValue}`;
  if (minValue != null) return `Не меньше ${minValue}`;
  if (maxValue != null) return `Не больше ${maxValue}`;
  if (minLength != null && maxLength != null) return `От ${minLength} до ${maxLength} символов`;
  if (maxLength != null) return `До ${maxLength} символов`;
  if (minLength != null) return `Не меньше ${minLength} символов`;
  return null;
}

export function isAttributeRequired(attribute: EquipmentAttribute) {
  return attribute.isRequired === true;
}

/** Checks one value against the schema's bounds. Returns a message, or null when it is fine. */
export function attributeError(attribute: EquipmentAttribute, raw: string): string | null {
  const value = raw.trim();
  if (!value) return isAttributeRequired(attribute) ? 'Заполните поле.' : null;

  if (attribute.valueType === 'integer' || attribute.valueType === 'decimal') {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return 'Введите число.';
    if (attribute.valueType === 'integer' && !Number.isInteger(parsed)) return 'Введите целое число.';
    if (attribute.minValue != null && parsed < attribute.minValue) return `Не меньше ${attribute.minValue}.`;
    if (attribute.maxValue != null && parsed > attribute.maxValue) return `Не больше ${attribute.maxValue}.`;
    return null;
  }

  if (attribute.minLength != null && value.length < attribute.minLength) return `Не меньше ${attribute.minLength} символов.`;
  if (attribute.maxLength != null && value.length > attribute.maxLength) return `Не больше ${attribute.maxLength} символов.`;
  return null;
}

/**
 * The category's own fields.
 *
 * One per row, full width. Two to a row halves the space a label has, and these labels carry their
 * unit — «Грузоподъёмность, кг» in a column 180px wide is not a label, it is a puzzle.
 *
 * The schema groups related fields («Габариты и вес»); when it does, the groups are kept, because
 * a flat list of twenty characteristics is a wall.
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

  const sorted = attributes.slice().sort((a, b) => a.sortOrder - b.sortOrder);

  // Preserve the schema's own order of groups rather than imposing an alphabetical one.
  const groups: Array<{ name: string | null; items: EquipmentAttribute[] }> = [];
  sorted.forEach(attribute => {
    const name = attribute.groupName ?? null;
    const last = groups[groups.length - 1];
    if (last && last.name === name) last.items.push(attribute);
    else groups.push({ name, items: [attribute] });
  });

  return (
    <div className="space-y-6">
      {groups.map((group, index) => (
        <div key={group.name ?? `ungrouped-${index}`} className="space-y-4">
          {group.name && (
            <h3 className="text-sm font-medium text-gray-900">{group.name}</h3>
          )}
          {group.items.map(attribute => (
            <ProductAttributeField
              key={attribute.key}
              attribute={attribute}
              value={values[attribute.key] ?? ''}
              error={errors[`attr:${attribute.key}`]}
              onChange={value => onChange(attribute.key, value)}
            />
          ))}
        </div>
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
  const required = isAttributeRequired(attribute);
  const hint = attribute.hint ?? boundsHint(attribute);

  if ((attribute.allowedValues?.length ?? 0) > 0) {
    return (
      <FloatingSelect
        label={label}
        required={required}
        value={value}
        onChange={onChange}
        options={attribute.allowedValues
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map(option => ({ value: option.valueKey, label: option.name }))}
        hint={hint}
        error={error}
      />
    );
  }

  const numeric = attribute.valueType === 'integer' || attribute.valueType === 'decimal';

  return (
    <FloatingInput
      label={label}
      required={required}
      type={inputTypeFor(attribute.valueType)}
      value={value}
      onChange={event => onChange(event.target.value)}
      hint={hint}
      error={error}
      min={numeric && attribute.minValue != null ? attribute.minValue : undefined}
      max={numeric && attribute.maxValue != null ? attribute.maxValue : undefined}
      maxLength={!numeric && attribute.maxLength != null ? attribute.maxLength : undefined}
      step={attribute.valueType === 'integer' ? 1 : undefined}
    />
  );
}
