import { useEffect, useState } from 'react';
import { AlertTriangle, CreditCard, Plus, Save, Trash2 } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { ApiError, pricingApi } from '../../lib/api-client';
import {
  baseAmountLabel,
  DEFAULT_PRICING_MODE,
  PRICING_MODE_OPTIONS,
  PRICING_STATUS_OPTIONS,
} from '../../lib/pricing-options';
import type { Offer, PricingDiagnostics, PricingPolicy, RentalTier } from '../../types';

type PricingForm = {
  pricingMode: string;
  currency: string;
  baseAmount: string;
  multiDayRate: string;
  status: string;
};

function emptyTier(): RentalTier {
  return { upToHours: 0, price: 0, label: '' };
}

function emptyForm(): PricingForm {
  return { pricingMode: DEFAULT_PRICING_MODE, currency: 'RUB', baseAmount: '', multiDayRate: '', status: 'active' };
}

function policyToForm(policy: PricingPolicy): PricingForm {
  return {
    pricingMode: policy.pricingMode || DEFAULT_PRICING_MODE,
    currency: policy.currency || 'RUB',
    baseAmount: policy.pricingMode === 'rental_tiers' ? '' : String(policy.baseAmount ?? policy.unitRules?.baseAmount ?? ''),
    multiDayRate: policy.multiDayRate != null ? String(policy.multiDayRate) : '',
    status: policy.status || 'active',
  };
}

function validateTiers(tiers: RentalTier[]): string | null {
  if (tiers.length === 0) return 'Режим rental_tiers требует хотя бы одной ступени.';
  for (let i = 0; i < tiers.length; i++) {
    if (tiers[i].upToHours <= 0) return `Ступень ${i + 1}: upToHours должен быть больше нуля.`;
    if (tiers[i].price < 0) return `Ступень ${i + 1}: цена не может быть отрицательной.`;
  }
  for (let i = 1; i < tiers.length; i++) {
    if (tiers[i].upToHours <= tiers[i - 1].upToHours) {
      return 'Ступени должны идти в строго возрастающем порядке upToHours.';
    }
  }
  return null;
}

interface OfferPricingTabProps {
  offer: Offer;
}

export function OfferPricingTab({ offer }: OfferPricingTabProps) {
  const [policy, setPolicy] = useState<PricingPolicy | null>(null);
  const [diagnostics, setDiagnostics] = useState<PricingDiagnostics | null>(null);
  const [form, setForm] = useState<PricingForm>(emptyForm());
  const [tiers, setTiers] = useState<RentalTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [policyMissing, setPolicyMissing] = useState(false);
  const [error, setError] = useState('');

  const isRentalTiers = form.pricingMode === 'rental_tiers';

  const loadPricing = async () => {
    setLoading(true);
    setError('');
    setPolicyMissing(false);

    try {
      const nextPolicy = await pricingApi.getOfferPolicy(offer.offerId);
      setPolicy(nextPolicy);
      setForm(policyToForm(nextPolicy));
      setTiers(nextPolicy.rentalTiers ?? []);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setPolicy(null);
        setPolicyMissing(true);
        setForm(emptyForm());
        setTiers([]);
      } else {
        setError(err instanceof ApiError ? `Не удалось загрузить цену: ${err.message}` : 'Не удалось загрузить цену.');
      }
    }

    try {
      const diag = await pricingApi.offerPricingSummaryPreview(offer.offerId).catch(() => null);
      if (diag) setDiagnostics(diag as unknown as PricingDiagnostics);
    } catch {
      // diagnostics are best-effort
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPricing();
  }, [offer.offerId]);

  const savePricing = async () => {
    if (isRentalTiers) {
      const tierError = validateTiers(tiers);
      if (tierError) { setError(tierError); return; }
    } else {
      const parsedAmount = form.baseAmount.trim() === '' ? null : Number(form.baseAmount);
      if (parsedAmount !== null && (!Number.isFinite(parsedAmount) || parsedAmount < 0)) {
        setError('Укажите корректную цену.');
        return;
      }
    }

    setSaving(true);
    setError('');
    try {
      const baseAmount = isRentalTiers ? null : (form.baseAmount.trim() === '' ? null : Number(form.baseAmount));
      const nextPolicy = await pricingApi.putOfferPolicy(offer.offerId, {
        pricingMode: form.pricingMode || 'rental_tiers',
        currency: form.currency || 'RUB',
        baseAmount,
        rentalTiers: isRentalTiers ? tiers : null,
        multiDayRate: isRentalTiers && form.multiDayRate.trim() !== '' ? Number(form.multiDayRate) : null,
        status: form.status || 'active',
      });
      setPolicy(nextPolicy);
      setForm(policyToForm(nextPolicy));
      setTiers(nextPolicy.rentalTiers ?? []);
      setPolicyMissing(false);
    } catch (err) {
      setError(err instanceof ApiError ? `Не удалось сохранить цену: ${err.message}` : 'Не удалось сохранить цену.');
    } finally {
      setSaving(false);
    }
  };

  const patchTier = (index: number, patch: Partial<RentalTier>) => {
    setTiers(current => current.map((tier, i) => (i === index ? { ...tier, ...patch } : tier)));
  };

  if (loading) {
    return <div className="py-12 text-center text-sm text-gray-500">Загружаем цену...</div>;
  }

  return (
    <div className="max-w-3xl space-y-4">
      <Card>
        <CardHeader
          title="Цена предложения"
          subtitle={policyMissing ? 'Цена ещё не настроена. Без неё предложение нельзя опубликовать.' : 'Тарифный план, который применяется при расчёте бронирования.'}
          action={<Badge variant={policy?.status === 'active' ? 'green' : 'yellow'}>{policy?.status === 'active' ? 'Цена включена' : 'Нужно настроить'}</Badge>}
        />

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        <div className="mb-3 flex items-start gap-3 rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white text-blue-700 shadow-sm">
            <CreditCard size={14} />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-900">Цена предложения переопределяет ресурсный тариф</p>
            <p className="mt-0.5 text-xs text-gray-500">Если задана, используется вместо базовой цены позиции инвентаря.</p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_160px_180px]">
          <Select
            label="Способ расчёта"
            value={form.pricingMode}
            options={PRICING_MODE_OPTIONS}
            onChange={e => setForm(f => ({ ...f, pricingMode: e.target.value }))}
          />
          <Input
            label="Валюта"
            value={form.currency}
            onChange={e => setForm(f => ({ ...f, currency: e.target.value.toUpperCase() }))}
            placeholder="RUB"
          />
          <Select
            label="Статус цены"
            value={form.status}
            options={PRICING_STATUS_OPTIONS}
            onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
          />
        </div>

        {!isRentalTiers && (
          <div className="mt-3">
            <Input
              label={baseAmountLabel(form.pricingMode)}
              type="number"
              min="0"
              value={form.baseAmount}
              onChange={e => setForm(f => ({ ...f, baseAmount: e.target.value }))}
              placeholder="500"
            />
          </div>
        )}

        {isRentalTiers && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-700">Тарифные ступени</p>
                <p className="mt-0.5 text-xs text-gray-500">Каждая ступень задаёт цену за аренду до указанного числа часов.</p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setTiers(t => [...t, emptyTier()])}
              >
                <Plus size={13} /> Добавить
              </Button>
            </div>

            {tiers.length === 0 ? (
              <div className="rounded-md border border-dashed border-gray-200 px-3 py-6 text-center text-sm text-gray-500">
                Добавьте хотя бы одну ступень.
              </div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 px-2 text-[11px] font-medium uppercase tracking-wide text-gray-400">
                  <span>До часов</span><span>Цена (RUB)</span><span>Название</span><span />
                </div>
                {tiers.map((tier, index) => (
                  <div key={index} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 rounded-md border border-gray-100 bg-gray-50 p-2">
                    <Input
                      type="number"
                      min="1"
                      value={String(tier.upToHours)}
                      onChange={e => patchTier(index, { upToHours: Number(e.target.value) || 0 })}
                      placeholder="8"
                    />
                    <Input
                      type="number"
                      min="0"
                      value={String(tier.price)}
                      onChange={e => patchTier(index, { price: Number(e.target.value) || 0 })}
                      placeholder="900"
                    />
                    <Input
                      value={tier.label ?? ''}
                      onChange={e => patchTier(index, { label: e.target.value })}
                      placeholder="Полдня"
                    />
                    <div className="flex items-center">
                      <Button size="sm" variant="ghost" onClick={() => setTiers(t => t.filter((_, i) => i !== index))}>
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Input
              label="Цена за сутки сверх ступеней (multiDayRate)"
              type="number"
              min="0"
              value={form.multiDayRate}
              onChange={e => setForm(f => ({ ...f, multiDayRate: e.target.value }))}
              placeholder="1300"
              hint="Применяется при аренде сверх последней ступени. Необязательно."
            />
          </div>
        )}

        <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
          <p className="text-xs text-gray-500">
            Обновлено: {policy?.updatedAt ? new Date(policy.updatedAt).toLocaleString('ru-RU') : 'ещё нет'}
          </p>
          <Button size="sm" variant="primary" onClick={() => void savePricing()} loading={saving}>
            <Save size={13} /> Сохранить цену
          </Button>
        </div>
      </Card>

      {diagnostics && <PricingDiagnosticsCard diagnostics={diagnostics} />}
    </div>
  );
}

function PricingDiagnosticsCard({ diagnostics }: { diagnostics: PricingDiagnostics }) {
  const ready = diagnostics.pricingReady;
  const issues = [...(diagnostics.errors ?? []), ...(diagnostics.warnings ?? [])];

  return (
    <Card>
      <CardHeader
        title="Проверка цены"
        subtitle="Что мешает использовать цену в этом предложении."
        action={<Badge variant={ready ? 'green' : 'yellow'}>{ready ? 'Готово' : 'Нужно исправить'}</Badge>}
      />
      {issues.length > 0 ? (
        <div className="space-y-1 rounded-md border border-amber-200 bg-amber-50 p-3">
          {issues.map(issue => (
            <p key={issue} className="text-xs text-amber-800">{issue}</p>
          ))}
        </div>
      ) : (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          Цена настроена достаточно для публикации.
        </p>
      )}
    </Card>
  );
}
