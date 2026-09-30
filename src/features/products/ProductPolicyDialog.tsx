import { useEffect, useState } from 'react';
import { Plus, Save, Trash2, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
import { ApiError, productsApi } from '../../lib/api-client';
import type { ProductCancellationTier, ProductPolicy } from '../../types';

const DEPOSIT_UNITS = [
  { value: 'rub', label: '₽' },
  { value: 'percent', label: '% от суммы' },
];

/** Rules are five short fields and a list; a dialog keeps them next to the product they belong to. */
export function ProductPolicyDialog({
  open,
  productId,
  policy,
  onClose,
  onSaved,
}: {
  open: boolean;
  productId: string;
  policy: ProductPolicy | null;
  onClose: () => void;
  onSaved: (next: ProductPolicy) => void;
}) {
  const [leadTime, setLeadTime] = useState('');
  const [cancellable, setCancellable] = useState(true);
  const [noShow, setNoShow] = useState('');
  const [depositUnit, setDepositUnit] = useState('rub');
  const [depositValue, setDepositValue] = useState('');
  const [tiers, setTiers] = useState<ProductCancellationTier[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setLeadTime(policy?.leadTimeHours != null ? String(policy.leadTimeHours) : '');
    setCancellable(policy?.isCancellationAllowed ?? true);
    setNoShow(policy?.noShowChargePercent != null ? String(policy.noShowChargePercent) : '');
    setDepositUnit(policy?.deposit?.unit ?? 'rub');
    setDepositValue(policy?.deposit?.value != null ? String(policy.deposit.value) : '');
    setTiers(policy?.cancellationTiers ?? []);
    setError('');
  }, [open, policy]);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const next = await productsApi.putPolicy(productId, {
        leadTimeHours: leadTime.trim() === '' ? null : Number(leadTime),
        isCancellationAllowed: cancellable,
        noShowChargePercent: noShow.trim() === '' ? null : Number(noShow),
        deposit: depositValue.trim() === '' ? null : { unit: depositUnit, value: Number(depositValue) },
        cancellationTiers: cancellable && tiers.length > 0 ? tiers : null,
      });
      onSaved(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить правила.');
    } finally {
      setSaving(false);
    }
  };

  const patchTier = (index: number, patch: Partial<ProductCancellationTier>) =>
    setTiers(current => current.map((tier, i) => (i === index ? { ...tier, ...patch } : tier)));

  return (
    <Modal open={open} onClose={onClose} title="Правила аренды" size="md">
      {error && <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Бронь не позднее чем за"
            type="number"
            min="0"
            value={leadTime}
            onChange={event => setLeadTime(event.target.value)}
            hint="Часов до начала аренды. Пусто — без ограничения."
          />
          <Input
            label="Штраф за неявку"
            type="number"
            min="0"
            max="100"
            value={noShow}
            onChange={event => setNoShow(event.target.value)}
            hint="Процент от суммы брони"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
          <Input
            label="Залог"
            type="number"
            min="0"
            value={depositValue}
            onChange={event => setDepositValue(event.target.value)}
            hint="Пусто — залог не берётся"
          />
          <Select
            label="Единица"
            value={depositUnit}
            options={DEPOSIT_UNITS}
            onChange={event => setDepositUnit(event.target.value)}
          />
        </div>

        <div className="rounded-lg border border-gray-200 p-3">
          <label className="flex items-center gap-2 text-sm text-gray-900">
            <input
              type="checkbox"
              checked={cancellable}
              onChange={event => setCancellable(event.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            Разрешить отмену брони
          </label>

          {cancellable && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-gray-500">
                Сколько вернуть клиенту в зависимости от того, за сколько часов он отменил.
              </p>
              {tiers.map((tier, index) => (
                <div key={index} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                  <Input
                    label="Не позднее чем за, ч"
                    type="number"
                    min="0"
                    value={String(tier.thresholdHoursBeforeStart)}
                    onChange={event => patchTier(index, { thresholdHoursBeforeStart: Number(event.target.value) || 0 })}
                  />
                  <Input
                    label="Возврат, %"
                    type="number"
                    min="0"
                    max="100"
                    value={String(tier.refundPercent)}
                    onChange={event => patchTier(index, { refundPercent: Number(event.target.value) || 0 })}
                  />
                  <Button variant="ghost" size="sm" aria-label="Удалить ступень" onClick={() => setTiers(current => current.filter((_, i) => i !== index))}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setTiers(current => [...current, { thresholdHoursBeforeStart: 24, refundPercent: 100 }])}
              >
                <Plus size={13} /> Добавить ступень
              </Button>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
          <Button variant="secondary" disabled={saving} onClick={onClose}><X size={14} /> Отмена</Button>
          <Button variant="primary" loading={saving} onClick={() => void save()}><Save size={14} /> Сохранить</Button>
        </div>
      </div>
    </Modal>
  );
}
