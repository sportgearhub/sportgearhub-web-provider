import { Save } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import type { ResourceAllocation } from '../../types';

export const ALLOCATION_MODE_OPTIONS = [
  { value: 'dedicated_units', label: 'По конкретным единицам' },
  { value: 'shared_inventory', label: 'Общим количеством' },
];

export type AllocationForm = {
  allocationMode: string;
  baseQuantity: string;
  maxPerBooking: string;
  maxConcurrent: string;
  sharedPoolCode: string;
};

export function emptyAllocationForm(): AllocationForm {
  return {
    allocationMode: 'dedicated_units',
    baseQuantity: '',
    maxPerBooking: '',
    maxConcurrent: '',
    sharedPoolCode: '',
  };
}

export function allocationToForm(allocation: ResourceAllocation): AllocationForm {
  const rules = allocation.allocationRules;
  return {
    allocationMode: allocation.allocationMode || 'dedicated_units',
    baseQuantity: allocation.baseQuantity === null || allocation.baseQuantity === undefined ? '' : String(allocation.baseQuantity),
    maxPerBooking: rules?.maxPerBooking ? String(rules.maxPerBooking) : '',
    maxConcurrent: rules?.maxConcurrent ? String(rules.maxConcurrent) : '',
    sharedPoolCode: rules?.sharedPoolCode ?? '',
  };
}

interface AllocationCardProps {
  form: AllocationForm;
  saving: boolean;
  error?: string;
  onChange: (value: AllocationForm) => void;
  onSave: () => void;
}

export function AllocationCard({ form, saving, error, onChange, onSave }: AllocationCardProps) {
  const sharedInventory = form.allocationMode === 'shared_inventory';

  return (
    <div className="border-b border-gray-200 px-6 py-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Правила выдачи</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            {sharedInventory
              ? 'Свободные места считаются от указанного количества.'
              : 'Свободные места считаются по готовым единицам из списка ниже.'}
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={onSave} loading={saving}>
          <Save size={13} /> Сохранить
        </Button>
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <div className="mt-3 grid gap-3 md:grid-cols-4">
        <Select
          label="Как считать наличие"
          value={form.allocationMode}
          options={ALLOCATION_MODE_OPTIONS}
          onChange={event => onChange({ ...form, allocationMode: event.target.value })}
        />
        {sharedInventory && (
          <Input
            label="Всего в наличии"
            type="number"
            min="0"
            value={form.baseQuantity}
            onChange={event => onChange({ ...form, baseQuantity: event.target.value })}
            placeholder="10"
          />
        )}
        <Input
          label="Максимум в одной брони"
          type="number"
          min="1"
          value={form.maxPerBooking}
          onChange={event => onChange({ ...form, maxPerBooking: event.target.value })}
          placeholder="Без ограничения"
        />
        <Input
          label="Максимум одновременно"
          type="number"
          min="1"
          value={form.maxConcurrent}
          onChange={event => onChange({ ...form, maxConcurrent: event.target.value })}
          placeholder="Без ограничения"
        />
      </div>
    </div>
  );
}
