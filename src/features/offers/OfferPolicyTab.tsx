import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import { FancySelect } from '../../components/ui/FancySelect';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { ApiError, policyApi } from '../../lib/api-client';
import type { Offer, OfferCancellationTier, OfferPolicy, OfferPolicyInput, PolicyDeposit } from '../../types';

interface OfferPolicyTabProps {
  offer: Offer;
}

type DepositUnit = 'none' | 'percentage' | 'fixed_amount';

interface PolicyForm {
  isCancellationAllowed: boolean;
  cancellationTiers: OfferCancellationTier[];
  leadTimeHours: string;
  noShowChargePercent: string;
  depositUnit: DepositUnit;
  depositValue: string;
  depositCurrency: string;
}

function depositToForm(deposit: OfferPolicy['deposit']): Pick<PolicyForm, 'depositUnit' | 'depositValue' | 'depositCurrency'> {
  if (!deposit || deposit.unit === 'none') return { depositUnit: 'none', depositValue: '', depositCurrency: 'RUB' };
  if (deposit.unit === 'percentage') return { depositUnit: 'percentage', depositValue: String(deposit.value), depositCurrency: 'RUB' };
  return { depositUnit: 'fixed_amount', depositValue: String(deposit.value), depositCurrency: deposit.currency || 'RUB' };
}

function policyToForm(policy: OfferPolicy | null): PolicyForm {
  return {
    isCancellationAllowed: policy?.isCancellationAllowed ?? true,
    cancellationTiers: policy?.cancellationTiers ?? [],
    leadTimeHours: policy?.leadTimeHours != null ? String(policy.leadTimeHours) : '',
    noShowChargePercent: policy?.noShowChargePercent != null ? String(policy.noShowChargePercent) : '',
    ...depositToForm(policy?.deposit),
  };
}

function toNumberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildDeposit(form: PolicyForm): PolicyDeposit {
  if (form.depositUnit === 'percentage') return { unit: 'percentage', value: Number(form.depositValue) || 0 };
  if (form.depositUnit === 'fixed_amount') return { unit: 'fixed_amount', value: Number(form.depositValue) || 0, currency: form.depositCurrency || 'RUB' };
  return { unit: 'none' };
}

export function OfferPolicyTab({ offer }: OfferPolicyTabProps) {
  const [form, setForm] = useState<PolicyForm>(policyToForm(null));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [missing, setMissing] = useState(false);

  const load = async (cancelled = false) => {
    setLoading(true);
    setError('');
    setMissing(false);
    try {
      const policy = await policyApi.getOfferPolicy(offer.offerId);
      if (!cancelled) setForm(policyToForm(policy));
    } catch (err) {
      if (cancelled) return;
      if (err instanceof ApiError && err.status === 404) {
        setMissing(true);
        setForm(policyToForm(null));
      } else {
        setError(err instanceof ApiError ? err.message : 'Не удалось загрузить правила предложения.');
      }
    } finally {
      if (!cancelled) setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    void load(cancelled);
    return () => { cancelled = true; };
  }, [offer.offerId]);

  const patch = (next: Partial<PolicyForm>) => setForm(current => ({ ...current, ...next }));

  const patchTier = (index: number, next: Partial<OfferCancellationTier>) =>
    setForm(current => ({
      ...current,
      cancellationTiers: current.cancellationTiers.map((tier, i) => (i === index ? { ...tier, ...next } : tier)),
    }));

  const validate = (): string | null => {
    const thresholds = new Set<number>();
    for (const tier of form.cancellationTiers) {
      if (tier.thresholdHoursBeforeStart < 0) return 'Порог отмены (часы) не может быть отрицательным.';
      if (tier.refundPercent < 0 || tier.refundPercent > 100) return 'Процент возврата должен быть в диапазоне 0–100.';
      if (thresholds.has(tier.thresholdHoursBeforeStart)) return 'Пороги отмены должны быть уникальными.';
      thresholds.add(tier.thresholdHoursBeforeStart);
    }
    if (form.depositUnit === 'percentage' && (Number(form.depositValue) < 0 || Number(form.depositValue) > 100)) {
      return 'Процент депозита должен быть в диапазоне 0–100.';
    }
    return null;
  };

  const save = async () => {
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    setSaving(true);
    setError('');
    try {
      const payload: OfferPolicyInput = {
        isCancellationAllowed: form.isCancellationAllowed,
        // Full-replace: always send the explicit list (empty array clears tiers).
        cancellationTiers: form.cancellationTiers.map(tier => ({
          thresholdHoursBeforeStart: Number(tier.thresholdHoursBeforeStart) || 0,
          refundPercent: Number(tier.refundPercent) || 0,
        })),
        leadTimeHours: toNumberOrNull(form.leadTimeHours),
        noShowChargePercent: toNumberOrNull(form.noShowChargePercent),
        deposit: buildDeposit(form),
      };
      const saved = await policyApi.putOfferPolicy(offer.offerId, payload);
      setForm(policyToForm(saved));
      setMissing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить правила предложения.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-sm text-gray-500">Загружаем правила...</div>;
  }

  return (
    <div className="w-full max-w-2xl space-y-4 px-6 py-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Правила предложения</h3>
          <p className="mt-0.5 text-xs text-gray-500">Отмены, депозит и операционные условия. Требуется для публикации.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => void load()}><RefreshCw size={13} /> Обновить</Button>
          <Button size="sm" variant="primary" loading={saving} onClick={() => void save()}><Save size={13} /> Сохранить</Button>
        </div>
      </div>

      {missing && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          <AlertTriangle size={14} /> Правила ещё не настроены. Задайте условия и нажмите «Сохранить».
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      <Card>
        <CardHeader title="Отмена бронирования" subtitle="Условия возврата при отмене клиентом." />
        <PolicyToggle
          label="Отмена разрешена"
          checked={form.isCancellationAllowed}
          onChange={value => patch({ isCancellationAllowed: value })}
        />
        {form.isCancellationAllowed && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-700">Ступени возврата</p>
              <Button size="sm" variant="secondary" onClick={() => patch({ cancellationTiers: [...form.cancellationTiers, { thresholdHoursBeforeStart: 24, refundPercent: 100 }] })}>
                <Plus size={12} /> Добавить
              </Button>
            </div>
            {form.cancellationTiers.length === 0 ? (
              <button
                type="button"
                onClick={() => patch({ cancellationTiers: [{ thresholdHoursBeforeStart: 24, refundPercent: 100 }] })}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-5 text-xs font-medium text-gray-500 transition hover:border-blue-300 hover:bg-blue-50/40 hover:text-blue-700"
              >
                <Plus size={14} /> Добавить условие возврата
              </button>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_1fr_auto] gap-2 px-1 text-[11px] font-medium uppercase tracking-wide text-gray-400">
                  <span>За сколько часов до старта</span><span>Возврат, %</span><span />
                </div>
                {form.cancellationTiers.map((tier, index) => (
                  <div key={index} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 rounded-md border border-gray-100 bg-gray-50 p-2">
                    <HoursSelect value={tier.thresholdHoursBeforeStart} onChange={hours => patchTier(index, { thresholdHoursBeforeStart: hours })} />
                    <PercentSelect value={tier.refundPercent} onChange={percent => patchTier(index, { refundPercent: percent })} />
                    <Button size="sm" variant="ghost" onClick={() => patch({ cancellationTiers: form.cancellationTiers.filter((_, i) => i !== index) })}>
                      <Trash2 size={13} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div className="max-w-[200px]">
              <PercentSelect
                label="Штраф за неявку"
                value={Number(form.noShowChargePercent) || 0}
                onChange={percent => patch({ noShowChargePercent: String(percent) })}
              />
            </div>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Депозит" subtitle="Сумма блокировки или залога." />
        <div className="grid gap-3 md:grid-cols-[1fr_140px_120px]">
          <Select
            label="Тип депозита"
            value={form.depositUnit}
            options={[
              { value: 'none', label: 'Без депозита' },
              { value: 'percentage', label: 'Процент от суммы' },
              { value: 'fixed_amount', label: 'Фиксированная сумма' },
            ]}
            onChange={e => patch({ depositUnit: e.target.value as DepositUnit })}
          />
          {form.depositUnit === 'percentage' && (
            <PercentSelect
              label="Процент"
              value={Number(form.depositValue) || 0}
              onChange={percent => patch({ depositValue: String(percent) })}
            />
          )}
          {form.depositUnit === 'fixed_amount' && (
            <Input
              label="Сумма"
              type="number"
              min="0"
              value={form.depositValue}
              onChange={e => patch({ depositValue: e.target.value })}
            />
          )}
          {form.depositUnit === 'fixed_amount' && (
            <Input label="Валюта" value={form.depositCurrency} onChange={e => patch({ depositCurrency: e.target.value.toUpperCase() })} placeholder="RUB" />
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Операционные условия" />
        <div className="max-w-[240px]">
          <Input label="Мин. уведомление до старта (ч)" type="number" min="0" value={form.leadTimeHours} onChange={e => patch({ leadTimeHours: e.target.value })} />
        </div>
      </Card>
    </div>
  );
}

const PERCENT_OPTIONS = Array.from({ length: 21 }, (_, i) => {
  const v = 100 - i * 5;
  return { value: String(v), label: `${v}%` };
});

function PercentSelect({ value, onChange, label }: { value: number; onChange: (value: number) => void; label?: string }) {
  const options = PERCENT_OPTIONS.some(o => o.value === String(value))
    ? PERCENT_OPTIONS
    : [{ value: String(value), label: `${value}%` }, ...PERCENT_OPTIONS];
  return (
    <FancySelect label={label} value={String(value)} options={options} onChange={next => onChange(Number(next))} />
  );
}

const HOUR_PRESETS = [1, 2, 3, 6, 12, 24, 48, 72, 120, 168];

function dayWord(days: number) {
  const mod10 = days % 10;
  const mod100 = days % 100;
  if (mod10 === 1 && mod100 !== 11) return 'день';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'дня';
  return 'дней';
}

function hoursLabel(hours: number) {
  if (hours > 0 && hours % 24 === 0) {
    const days = hours / 24;
    return `${days} ${dayWord(days)} · ${hours} ч`;
  }
  return `${hours} ч`;
}

/** Trigger button + popover that combines preset selection with a manual hours input. */
function HoursSelect({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(current => !current)}
        className={`flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-left text-sm shadow-sm transition hover:border-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${open ? 'border-blue-300' : 'border-input'}`}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="truncate text-foreground">{hoursLabel(value)}</span>
        <ChevronDown size={15} className={`shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 rounded-md border border-gray-200 bg-white shadow-lg">
          <div className="max-h-48 overflow-auto p-1">
            {HOUR_PRESETS.map(hours => {
              const isSelected = hours === value;
              return (
                <button
                  key={hours}
                  type="button"
                  onClick={() => { onChange(hours); setOpen(false); }}
                  className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition ${isSelected ? 'bg-blue-50 font-medium text-blue-900' : 'text-gray-800 hover:bg-gray-50'}`}
                >
                  <span>{hoursLabel(hours)}</span>
                  {isSelected && <Check size={14} className="shrink-0 text-blue-700" />}
                </button>
              );
            })}
          </div>
          <div className="border-t border-gray-100 p-2">
            <label className="mb-1 block text-[11px] font-medium text-gray-500">Указать вручную (часы)</label>
            <Input
              type="number"
              min="0"
              value={String(value)}
              onChange={e => onChange(Number(e.target.value) || 0)}
              placeholder="часы"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function PolicyToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex min-h-9 items-center justify-between gap-3 rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
      <span className="min-w-0 text-xs text-gray-700">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${checked ? 'border-blue-600 bg-blue-600' : 'border-gray-300 bg-gray-200'}`}
      >
        <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </label>
  );
}
