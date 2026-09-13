import { useEffect, useState } from 'react';
import { AlertTriangle, CreditCard, Plus, Save, Trash2 } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { ApiError, offersApi, pricingApi } from '../../lib/api-client';
import {
  baseAmountLabel,
  DEFAULT_PRICING_MODE,
  PRICING_MODE_OPTIONS,
  PRICING_STATUS_OPTIONS,
} from '../../lib/pricing-options';
import type { Offer, PricingDiagnostics, PricingPolicy, RentalTier, Resource } from '../../types';

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

interface ResourcePricingTabProps {
  resource: Resource;
}

export function ResourcePricingTab({ resource }: ResourcePricingTabProps) {
  // Pricing is configured per offer — the resource itself only exposes read-only diagnostics.
  const [offers, setOffers] = useState<Offer[]>([]);
  const [selectedOfferId, setSelectedOfferId] = useState('');
  const [policy, setPolicy] = useState<PricingPolicy | null>(null);
  const [diagnostics, setDiagnostics] = useState<PricingDiagnostics | null>(null);
  const [form, setForm] = useState<PricingForm>(emptyPricingForm());
  const [tiers, setTiers] = useState<RentalTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [policyMissing, setPolicyMissing] = useState(false);
  const [error, setError] = useState('');

  const isRentalTiers = form.pricingMode === 'rental_tiers';

  const loadOfferPolicy = async (offerId: string) => {
    setError('');
    setPolicyMissing(false);
    try {
      const nextPolicy = await pricingApi.getOfferPolicy(offerId);
      setPolicy(nextPolicy);
      setForm(policyToForm(nextPolicy));
      setTiers(nextPolicy.rentalTiers ?? []);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setPolicy(null);
        setPolicyMissing(true);
        setForm(emptyPricingForm());
        setTiers([]);
      } else {
        setError(err instanceof ApiError ? `Не удалось загрузить цену: ${err.message}` : 'Не удалось загрузить цену.');
      }
    }
  };

  const loadPricing = async () => {
    setLoading(true);
    setError('');
    setPolicyMissing(false);

    try {
      const allOffers = await offersApi.list();
      const resourceOffers = allOffers.filter(
        offer => offer.primaryResourceId === resource.resourceId || offer.resourceId === resource.resourceId
      );
      setOffers(resourceOffers);

      const firstOfferId = resourceOffers[0]?.offerId ?? '';
      setSelectedOfferId(firstOfferId);
      if (firstOfferId) await loadOfferPolicy(firstOfferId);
    } catch (err) {
      setError(err instanceof ApiError ? `Не удалось загрузить предложения: ${err.message}` : 'Не удалось загрузить предложения.');
    }

    try {
      setDiagnostics(await pricingApi.getResourceDiagnostics(resource.resourceId));
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) {
        setError(err instanceof ApiError ? `Не удалось проверить цену: ${err.message}` : 'Не удалось проверить цену.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPricing();
  }, [resource.resourceId]);

  const handleOfferChange = async (offerId: string) => {
    setSelectedOfferId(offerId);
    await loadOfferPolicy(offerId);
  };

  const savePricing = async () => {
    if (!selectedOfferId) {
      setError('Сначала создайте предложение для этой позиции.');
      return;
    }
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
      const nextPolicy = await pricingApi.putOfferPolicy(selectedOfferId, {
        pricingMode: form.pricingMode || DEFAULT_PRICING_MODE,
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
      setDiagnostics(await pricingApi.getResourceDiagnostics(resource.resourceId).catch(() => null));
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

  const ready = diagnostics?.pricingReady;
  const issues = [...(diagnostics?.errors ?? []), ...(diagnostics?.warnings ?? [])];

  if (offers.length === 0) {
    return (
      <Card>
        <p className="text-sm font-semibold text-gray-900">Нет предложений</p>
        <p className="mt-1 text-xs leading-5 text-gray-500">
          Цена задаётся в предложении. Создайте предложение для этой позиции, чтобы настроить тариф.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
      <Card>
        <CardHeader
          title="Цена"
          subtitle={policyMissing ? 'Цена ещё не настроена. Без неё предложение нельзя опубликовать.' : 'Тариф выбранного предложения.'}
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
            <p className="text-xs font-medium text-gray-900">Расчёт стоимости проката</p>
            <p className="mt-0.5 text-xs text-gray-500">Тариф применяется к выбранному предложению этой позиции.</p>
          </div>
        </div>

        {offers.length > 1 && (
          <div className="mb-3">
            <Select
              label="Предложение"
              value={selectedOfferId}
              options={offers.map(offer => ({ value: offer.offerId, label: offer.title }))}
              onChange={e => void handleOfferChange(e.target.value)}
            />
          </div>
        )}

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

      <Card>
        <CardHeader
          title="Проверка цены"
          subtitle="Что мешает использовать цену в предложениях."
          action={<Badge variant={ready ? 'green' : 'yellow'}>{ready ? 'Готово' : 'Нужно исправить'}</Badge>}
        />
        {issues.length > 0 ? (
          <div className="space-y-1 rounded-md border border-amber-200 bg-amber-50 p-3">
            {issues.map(issue => (
              <p key={issue} className="text-xs text-amber-800">{pricingIssueLabel(issue)}</p>
            ))}
          </div>
        ) : (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            Цена настроена достаточно для публикации.
          </p>
        )}
        {diagnostics?.checkedAt && (
          <p className="mt-3 text-xs text-gray-500">Проверено: {new Date(diagnostics.checkedAt).toLocaleString('ru-RU')}</p>
        )}
        <PublishabilityImpact impact={diagnostics?.publishabilityImpact} />
      </Card>
    </div>
  );
}

function emptyPricingForm(): PricingForm {
  return {
    pricingMode: DEFAULT_PRICING_MODE,
    currency: 'RUB',
    baseAmount: '',
    multiDayRate: '',
    status: 'active',
  };
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

function pricingIssueLabel(issue: string) {
  if (issue === 'pricing_policy_missing') return 'Настройте цену для этой позиции.';
  if (issue === 'pricing_policy_inactive') return 'Включите цену, чтобы предложения можно было публиковать.';
  if (issue === 'pricing_currency_missing') return 'Укажите валюту.';
  if (issue === 'pricing_base_amount_missing') return 'Укажите базовую цену.';
  if (issue === 'pricing_adjustments_not_configured') return 'Дополнительные правила цены не настроены.';
  return issue;
}

function PublishabilityImpact({ impact }: { impact: PricingDiagnostics['publishabilityImpact'] }) {
  if (!impact) return null;

  if (Array.isArray(impact)) {
    const visibleItems = impact.filter(item => item.value);
    if (visibleItems.length === 0) return null;
    return (
      <div className="mt-3 space-y-1 border-t border-gray-100 pt-3">
        {visibleItems.map(item => (
          <p key={item.key} className="text-xs text-gray-500">{item.value}</p>
        ))}
      </div>
    );
  }

  if ('reason' in impact && typeof impact.reason === 'string' && impact.reason) {
    return <p className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-500">{impact.reason}</p>;
  }

  return null;
}
