import { useEffect, useState } from 'react';
import { CreditCard as Edit2, AlertTriangle, CheckCircle, X } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ApiError, offerAvailabilityApi, offersApi, policyApi } from '../../lib/api-client';
import type { Offer, OfferAvailability, OfferInfoSection, OfferPolicy, OfferReadiness, OfferRoutability, OfferStatus } from '../../types';
import { infoSectionLabel } from './infoSections';
import { OfferReadinessChecklist } from './OfferReadinessChecklist';
import { offerBookingSetupReady, offerCustomerVisible } from './offerReadiness';
import { offerIsSellerControlled, offerStatusBadge as statusBadge } from './offerStatus';
import {
  bookingFlowLabel,
  offerTypeLabel,
  publishabilityLabel,
} from './offerDisplay';



interface OfferDetailProps {
  offer: Offer;
  onBack?: () => void;
  onEdit: () => void;
  onStatusChange: (s: OfferStatus) => void;
  onConfigurePolicy?: () => void;
  onOpenAvailability?: () => void;
  onOpenPolicy?: () => void;
}

export function OfferDetail({ offer, onBack, onEdit, onStatusChange, onConfigurePolicy, onOpenAvailability, onOpenPolicy }: OfferDetailProps) {
  const sb = statusBadge[offer.status];
  const [readiness, setReadiness] = useState<OfferReadiness | undefined>(offer.readiness);
  const [routability, setRoutability] = useState<OfferRoutability | null>(null);
  const [infoSections, setInfoSections] = useState<OfferInfoSection[]>([]);
  const [availability, setAvailability] = useState<OfferAvailability | null>(null);
  const [policy, setPolicy] = useState<OfferPolicy | null>(null);
  const [diagnosticsError, setDiagnosticsError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setDiagnosticsError('');

    Promise.all([
      offersApi.getRoutability(offer.offerId).catch(err => {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }),
      offersApi.getReadiness(offer.offerId).catch(err => {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }),
    ])
      .then(([nextRoutability, nextReadiness]) => {
        if (cancelled) return;
        if (nextRoutability) setRoutability(nextRoutability);
        if (nextReadiness) setReadiness(nextReadiness);
      })
      .catch(err => {
        if (!cancelled) setDiagnosticsError(err instanceof ApiError ? err.message : 'Не удалось загрузить готовность и маршрутизацию.');
      });

    return () => {
      cancelled = true;
    };
  }, [offer.offerId]);

  useEffect(() => {
    let cancelled = false;
    offersApi.getInfoSections(offer.offerId)
      .then(next => { if (!cancelled) setInfoSections(next.sections ?? []); })
      .catch(() => { if (!cancelled) setInfoSections([]); });
    offerAvailabilityApi.get(offer.offerId)
      .then(next => { if (!cancelled) setAvailability(next); })
      .catch(() => { if (!cancelled) setAvailability(null); });
    policyApi.getOfferPolicy(offer.offerId)
      .then(next => { if (!cancelled) setPolicy(next); })
      .catch(() => { if (!cancelled) setPolicy(null); });
    return () => { cancelled = true; };
  }, [offer.offerId]);

  const offerWithReadiness = { ...offer, readiness };


  return (
    <div>
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-3">
        <div className="flex min-w-0 items-center gap-3">
          {onBack && (
            <button type="button" onClick={onBack} className="mr-1 text-xs text-gray-500 hover:text-gray-800 shrink-0">
              ← Назад
            </button>
          )}
          {offer.mediaPreviewUrl ? (
            <img src={offer.mediaPreviewUrl} alt="" className="h-8 w-8 shrink-0 rounded border border-gray-200 object-cover" />
          ) : (
            <span className="h-8 w-8 shrink-0 rounded border border-dashed border-gray-200 bg-gray-50" />
          )}
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-gray-900">{offer.title}</h3>
            <p className="truncate text-xs text-gray-500">
              {offerTypeLabel(offer.offerType)} · {bookingFlowLabel(offer.bookingFlowType)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={sb.variant}>{sb.label}</Badge>
          {onOpenAvailability && (
            <Button size="sm" variant="secondary" onClick={onOpenAvailability}>Доступность</Button>
          )}
          {onOpenPolicy && (
            <Button size="sm" variant="secondary" onClick={onOpenPolicy}>Правила</Button>
          )}
          <Button size="sm" variant="secondary" onClick={onEdit}>
            <Edit2 size={13} /> Редактировать
          </Button>
          {offerIsSellerControlled(offer) && (offer.status === 'active' ? (
            <Button size="sm" variant="ghost" onClick={() => onStatusChange('paused')}>Снять с публикации</Button>
          ) : (
            <Button size="sm" variant="primary" onClick={() => onStatusChange('active')} disabled={!offerBookingSetupReady(offerWithReadiness)}>
              Опубликовать
            </Button>
          ))}
        </div>
      </div>

      {/* Status banners */}
      {!offerBookingSetupReady(offerWithReadiness) && (
        <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-6 py-2 text-xs text-amber-800">
          <AlertTriangle size={13} className="shrink-0" />
          {offer.publishability?.reason || offer.publishabilityIssues?.[0] || 'Есть блокеры публикации.'}
        </div>
      )}
      {offerBookingSetupReady(offerWithReadiness) && (
        <div className="flex items-center gap-2 border-b border-emerald-200 bg-emerald-50 px-6 py-2 text-xs text-emerald-800">
          <CheckCircle size={13} className="shrink-0" />
          {offerCustomerVisible(offerWithReadiness) ? 'Предложение видно клиентам и готово к аренде.' : 'Настройка бронирования готова.'}
        </div>
      )}

      {/* Main content — two columns split by dividers */}
      <div className="grid xl:grid-cols-[1fr_320px]">
        {/* Left column */}
        <div className="min-w-0 divide-y divide-gray-100">
          <section className="px-6 py-4">
            {diagnosticsError && (
              <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">{diagnosticsError}</p>
            )}
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-700">Детали предложения</h3>
            <div className="space-y-2">
              <Row label="Инвентарь" value={offer.resourceTitle || offer.primaryResourceId} />
              {typeof offer.basePrice === 'number' && (
                <Row label="Цена" value={`${offer.basePrice.toLocaleString()} ${offer.currency ?? 'RUB'}`} />
              )}
              <Row label="Публикация" value={publishabilityLabel(offer)} />
              <Row label="Маршрутизация" value={routability?.routable ? 'Готова' : routability ? 'Есть блокеры' : 'Не проверена'} />
            </div>
          </section>

          <section className="px-6 py-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-700">Доступность</h3>
              {onOpenAvailability && (
                <Button size="sm" variant="ghost" onClick={onOpenAvailability}>Изменить</Button>
              )}
            </div>
            {availabilityConfigured(availability) ? (
              <div className="space-y-2">
                <Row label="Часовой пояс" value={availability!.timezone || '—'} />
                <Row label="Шаг слота" value={availability!.slotIntervalMinutes ? `${availability!.slotIntervalMinutes} мин` : '—'} />
                <Row label="Окна работы" value={String(availability!.availabilityWindows.length)} />
                <Row label="Закрытые периоды" value={String(availability!.blockedPeriods.length)} />
                <Row label="Приём броней" value={availability!.status === 'active' ? 'Включён' : 'Выключен'} />
              </div>
            ) : (
              <p className="text-xs text-gray-500">Не настроена.</p>
            )}
          </section>

          <section className="px-6 py-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-700">Правила</h3>
              {onOpenPolicy && (
                <Button size="sm" variant="ghost" onClick={onOpenPolicy}>Изменить</Button>
              )}
            </div>
            {policy ? (
              <div className="space-y-2">
                <Row label="Отмена" value={policy.isCancellationAllowed === false ? 'Запрещена' : 'Разрешена'} />
                <Row label="Ступени возврата" value={String(policy.cancellationTiers?.length ?? 0)} />
                <Row label="Депозит" value={depositLabel(policy.deposit)} />
                <Row label="Мин. уведомление" value={policy.leadTimeHours != null ? `${policy.leadTimeHours} ч` : '—'} />
                <Row label="Штраф за неявку" value={policy.noShowChargePercent != null ? `${policy.noShowChargePercent}%` : '—'} />
              </div>
            ) : (
              <p className="text-xs text-gray-500">Не настроены.</p>
            )}
          </section>


          {offer.description && (
            <section className="px-6 py-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-700">Описание</h3>
              <p className="text-sm text-gray-700">{offer.description}</p>
            </section>
          )}

          {infoSections.some(section => section.items.length > 0) && (
            <section className="px-6 py-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-700">Информация для клиента</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {infoSections.filter(section => section.items.length > 0).map(section => {
                  const excluded = section.kind === 'excluded';
                  return (
                    <div key={section.kind}>
                      <p className={`mb-1.5 text-xs font-medium ${excluded ? 'text-gray-500' : 'text-emerald-700'}`}>
                        {infoSectionLabel(section.kind)}
                      </p>
                      <ul className="space-y-1">
                        {section.items.map((item, i) => (
                          <li key={i} className={`flex items-start gap-1.5 text-sm ${excluded ? 'text-gray-500' : 'text-gray-700'}`}>
                            {excluded
                              ? <X size={13} className="mt-0.5 shrink-0 text-gray-400" />
                              : <CheckCircle size={13} className="mt-0.5 shrink-0 text-emerald-600" />}
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* Right column */}
        <div className="divide-y divide-gray-100 border-gray-100 xl:border-l">
          <section className="px-6 py-4">
            <OfferReadinessChecklist offer={offerWithReadiness} onConfigurePolicy={onConfigurePolicy} />
          </section>

          <section className="px-6 py-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-700">История</h3>
            <div className="space-y-1.5">
              <Row label="Создан" value={offer.createdAt ? new Date(offer.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'} />
              <Row label="Обновлен" value={new Date(offer.updatedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}


function availabilityConfigured(availability: OfferAvailability | null): boolean {
  if (!availability || availability.status === 'not_configured') return false;
  return availability.availabilityWindows.length > 0 || availability.blockedPeriods.length > 0 || availability.status === 'active';
}

function depositLabel(deposit: OfferPolicy['deposit']): string {
  if (!deposit || deposit.unit === 'none') return 'Нет';
  if (deposit.unit === 'percentage') return `${deposit.value}% от суммы`;
  return `${deposit.value.toLocaleString()} ${deposit.currency}`;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs font-medium text-gray-900">{value}</span>
    </div>
  );
}
