import { Check, Circle, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import type { Offer, OfferReadiness, OfferReadinessSection } from '../../types';

type ReadinessTone = 'ready' | 'blocked' | 'pending';

type ReadinessItem = {
  key: string;
  label: string;
  detail: string;
  tone: ReadinessTone;
  actionLabel?: string;
};

function statusOf(offer: Offer, key: string) {
  return String(offer.executionLink?.[key] ?? '');
}

function toneFromStatus(status: string): ReadinessTone {
  const normalized = status.toLowerCase();
  if (normalized === 'ready' || normalized === 'ok') return 'ready';
  if (normalized === 'blocked' || normalized === 'failed') return 'blocked';
  return 'pending';
}

function sectionLabel(section: OfferReadinessSection) {
  if (section.title) return section.title;

  const labels: Record<string, string> = {
    offer_status: 'Статус предложения',
    select_resource: 'Выбор инвентаря',
    active: 'Публикация',
    resource: 'Ресурс выбран',
    category: 'Категория',
    inventory: 'Инвентарь',
    availability: 'Доступность',
    pricing: 'Цена',
    policy: 'Правила проката',
    location: 'Пункт проката',
    payment_route: 'Оплата',
    routability: 'Маршрутизация',
  };

  return labels[section.code] ?? section.code;
}

function readinessItems(readiness: OfferReadiness): ReadinessItem[] {
  return readiness.sections.map(section => ({
    key: section.code,
    label: sectionLabel(section),
    detail: section.message || section.reasonCodes?.join(', ') || 'Требуется проверка.',
    tone: toneFromStatus(section.status),
  }));
}

export function offerReadinessItems(offer: Offer): ReadinessItem[] {
  if (offer.readiness) return readinessItems(offer.readiness);

  const resource = statusOf(offer, 'resourceLinkStatus');
  const availability = statusOf(offer, 'availabilityLinkStatus');
  const pricing = statusOf(offer, 'pricingLinkStatus');
  const policy = statusOf(offer, 'policyLinkStatus');
  const bookingSubject = statusOf(offer, 'bookingSubjectStatus');

  return [
    {
      key: 'resource',
      label: 'Ресурс выбран',
      detail: resource === 'linked' ? 'Позиция каталога связана.' : 'Выберите позицию каталога.',
      tone: resource === 'linked' ? 'ready' : 'blocked',
    },
    {
      key: 'availability',
      label: 'Доступность настроена',
      detail: availability === 'linked' ? 'Клиенты смогут выбрать доступные даты.' : 'Настройте доступность ресурса.',
      tone: availability === 'linked' ? 'ready' : 'blocked',
    },
    {
      key: 'pricing',
      label: 'Цена указана',
      detail: pricing === 'linked_projection' || pricing === 'linked'
        ? 'Цена уже рассчитана для предложения.'
        : 'Добавьте цену предложения.',
      tone: pricing === 'linked_projection' || pricing === 'linked' ? 'ready' : 'blocked',
    },
    {
      key: 'policy',
      label: 'Правила проката',
      detail: policy === 'linked'
        ? 'Правила проката настроены.'
        : 'Правила проката не настроены.',
      tone: policy === 'linked' ? 'ready' : 'blocked',
      actionLabel: policy === 'linked' ? undefined : 'Настроить правила проката',
    },
    {
      key: 'bookingSubject',
      label: 'Маршрутизация бронирования',
      detail: bookingSubject === 'pending_module'
        ? 'Модуль бронирования в подготовке.'
        : bookingSubject === 'linked'
          ? 'Маршрутизация готова.'
          : 'Ожидает настройки.',
      tone: bookingSubject === 'linked' ? 'ready' : 'pending',
    },
  ];
}

export function OfferReadinessChecklist({
  offer,
  compact = false,
  onConfigurePolicy,
}: {
  offer: Offer;
  compact?: boolean;
  onConfigurePolicy?: () => void;
}) {
  const items = offerReadinessItems(offer);
  const visibleItems = compact ? items.filter(item => item.tone !== 'ready').slice(0, 2) : items;
  const blockedCount = items.filter(item => item.tone === 'blocked').length;
  const pendingCount = items.filter(item => item.tone === 'pending').length;
  const readiness = offer.readiness;

  if (compact && visibleItems.length === 0) {
    return <span className="text-xs font-medium text-emerald-700">{readiness?.customerVisibleNow ? 'Видимо клиентам' : 'Готово к аренде'}</span>;
  }

  return (
    <div className={compact ? 'space-y-1' : 'space-y-3'}>
      {!compact && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Готовность предложения</p>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${blockedCount > 0 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
            {blockedCount > 0 ? `Блокеров: ${blockedCount}` : readiness?.customerVisibleNow ? 'Видимо клиентам' : 'Готово к аренде'}
          </span>
          {readiness && !readiness.customerVisibleNow && readiness.bookingSetupReady && (
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700">Настройка готова</span>
          )}
          {pendingCount > 0 && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">В подготовке: {pendingCount}</span>}
        </div>
      )}

      <div className={compact ? 'space-y-1' : 'space-y-2'}>
        {visibleItems.map(item => (
          <div key={item.key} className={compact ? 'flex items-start gap-1.5' : 'flex items-start justify-between gap-3 rounded-md border border-gray-100 bg-white px-3 py-2'}>
            <div className="flex min-w-0 items-start gap-2">
              <ReadinessIcon tone={item.tone} />
              <div className="min-w-0">
                <p className={`text-xs font-medium ${item.tone === 'ready' ? 'text-emerald-700' : item.tone === 'blocked' ? 'text-amber-700' : 'text-gray-600'}`}>
                  {item.label}
                </p>
                {!compact && <p className="text-xs text-gray-500">{item.detail}</p>}
                {compact && <p className="line-clamp-1 text-[11px] text-gray-500">{item.detail}</p>}
              </div>
            </div>
            {!compact && item.actionLabel && onConfigurePolicy && (
              <Button size="sm" variant="secondary" onClick={onConfigurePolicy}>
                {item.actionLabel}
              </Button>
            )}
          </div>
        ))}
      </div>

      {compact && blockedCount > visibleItems.length && (
        <p className="text-[11px] text-gray-500">Еще блокеров: {blockedCount - visibleItems.length}</p>
      )}
    </div>
  );
}

function ReadinessIcon({ tone }: { tone: ReadinessTone }) {
  if (tone === 'ready') return <Check size={13} className="mt-0.5 shrink-0 text-emerald-600" />;
  if (tone === 'blocked') return <X size={13} className="mt-0.5 shrink-0 text-amber-600" />;
  return <Circle size={12} className="mt-0.5 shrink-0 text-gray-400" />;
}
