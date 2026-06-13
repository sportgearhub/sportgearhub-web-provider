import type { Offer } from '../../types';

export function offerTypeLabel(value: string | undefined) {
  if (value === 'rental') return 'Прокат';
  if (value === 'service') return 'Услуга';
  if (value === 'experience') return 'Активность';
  if (value === 'other') return 'Другое';
  return value || 'Предложение';
}

export function bookingFlowLabel(value: string | undefined) {
  if (value === 'direct_checkout') return 'Прямая оплата';
  if (value === 'selection_required') return 'Нужен выбор';
  if (value === 'request_only') return 'По запросу';
  return value || 'Бронирование';
}

export function publishabilityLabel(offer: Offer) {
  const status = offer.publishability?.status;
  if (status === 'publishable') return 'Можно публиковать';
  if (status === 'blocked') return 'Заблокировано';
  return 'Нужно настроить';
}

export function publishabilityTone(offer: Offer) {
  return offer.publishability?.status === 'publishable' ? 'emerald' : 'amber';
}

export function executionLinkLabel(key: string, value: unknown) {
  const labels: Record<string, string> = {
    resourceLinkStatus: 'Позиция',
    availabilityLinkStatus: 'Доступность',
    pricingLinkStatus: 'Цена',
    policyLinkStatus: 'Правила',
    bookingSubjectStatus: 'Бронирование',
  };

  const statuses: Record<string, string> = {
    linked: 'связано',
    linked_projection: 'связано',
    missing: 'нет',
    pending_module: 'ожидает',
  };

  return {
    label: labels[key] ?? key,
    value: statuses[String(value)] ?? String(value ?? '—'),
    ready: String(value).startsWith('linked'),
  };
}

export function executionLinkEntries(offer: Offer) {
  return Object.entries(offer.executionLink ?? {}).map(([key, value]) => executionLinkLabel(key, value));
}
