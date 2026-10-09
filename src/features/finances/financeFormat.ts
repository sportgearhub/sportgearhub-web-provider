import type { CostSource, HoldReason } from '../../types';

/** Money as a seller reads it. The sign is never dropped: a negative net is the honest number. */
export function money(value: number | null | undefined) {
  if (value == null) return '—';
  const formatted = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(Math.abs(value));
  return `${value < 0 ? '−' : ''}${formatted} ₽`;
}

export function percent(value: number | null | undefined) {
  if (value == null) return '—';
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value)} %`;
}

export function shortDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

/** `YYYY-MM-DD`, which is what the range parameters and a statement's id are. */
export function isoDate(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export const HOLD_REASONS: Record<HoldReason, string> = {
  awaiting_handover: 'Ждёт выдачи',
  post_return_hold: 'Сутки после аренды',
};

export function holdReason(reason: HoldReason) {
  return HOLD_REASONS[reason] ?? reason;
}

/**
 * How much to trust a cost. A total made of one fact and one expectation reads as an expectation,
 * deliberately — half a reconciled register is not a reconciled register.
 */
export const COST_SOURCES: Record<CostSource, { label: string; hint: string }> = {
  register: { label: 'факт', hint: 'Из операционного реестра банка, сверено.' },
  tariff: { label: 'оценка', hint: 'Посчитано по тарифу — реестр за этот период ещё не прочитан.' },
  not_configured: { label: 'без тарифа', hint: 'Стоимость этой услуги не настроена, итог завышен на неё.' },
};

export function costSource(source: CostSource) {
  return COST_SOURCES[source] ?? { label: source, hint: '' };
}

export const COST_NAMES: Record<string, string> = {
  acquiring: 'Приём платежа',
  payout: 'Перевод вам',
  fiscalization: 'Чек покупателю',
};

export function costName(sysName: string) {
  return COST_NAMES[sysName] ?? sysName;
}

export const ACCRUAL_STATES: Record<string, { label: string; variant: 'green' | 'blue' | 'yellow' | 'gray' }> = {
  paid: { label: 'Выплачено', variant: 'green' },
  available: { label: 'К выплате', variant: 'blue' },
  held: { label: 'Удерживается', variant: 'yellow' },
  cancelled: { label: 'Отменено', variant: 'gray' },
};

export function accrualState(state: string) {
  return ACCRUAL_STATES[state] ?? { label: state, variant: 'gray' as const };
}
