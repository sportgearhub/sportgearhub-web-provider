import type { FulfillmentStage } from '../../types';

type BadgeVariant = 'green' | 'yellow' | 'blue' | 'gray' | 'red' | 'teal';

const STATUS_META: Record<string, { label: string; variant: BadgeVariant }> = {
  awaiting_seller_confirmation: { label: 'Ждёт подтверждения', variant: 'yellow' },
  pending: { label: 'Ждёт оплаты', variant: 'yellow' },
  confirmed: { label: 'Оплачено', variant: 'green' },
  completed: { label: 'Завершено', variant: 'gray' },
  cancelled: { label: 'Отменено', variant: 'red' },
  expired: { label: 'Истекло', variant: 'gray' },
  reversed: { label: 'Возврат платежа', variant: 'red' },
  failed: { label: 'Оплата не прошла', variant: 'red' },
};

const STAGE_META: Record<string, { label: string; variant: BadgeVariant }> = {
  pending_handover: { label: 'Ожидает выдачи', variant: 'yellow' },
  active: { label: 'На руках', variant: 'blue' },
  returned: { label: 'Возвращено', variant: 'teal' },
  completed: { label: 'Выдача закрыта', variant: 'green' },
  issue_reported: { label: 'Есть обращение', variant: 'red' },
};


/** A booking's own status, named for a seller. Unknown values show as themselves rather than blank. */
export function bookingStatusMeta(status: string) {
  return STATUS_META[status] ?? { label: status, variant: 'gray' as BadgeVariant };
}

/** Handover progress. The list calls it `stage`, the detail calls it `status`; same vocabulary. */
export function fulfillmentStageMeta(stage: FulfillmentStage | string | null | undefined) {
  return stage ? STAGE_META[stage] ?? null : null;
}

/** «2 окт., 10:00 — 18:00», collapsing the date when both ends fall on one day. */
export function formatWindow(startAt?: string | null, endAt?: string | null) {
  if (!startAt || !endAt) return null;
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (Number.isNaN(start.getTime())) return null;
  const sameDay = start.toDateString() === end.toDateString();
  const day = (date: Date) => date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  const time = (date: Date) => date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return sameDay
    ? `${day(start)}, ${time(start)} — ${time(end)}`
    : `${day(start)}, ${time(start)} — ${day(end)}, ${time(end)}`;
}

/** Midnight today and midnight tomorrow, with this browser's offset — the bounds a day filter needs. */
/** Midnight local time, as an offset-bearing ISO string the RSQL filter understands. */
export function isoMidnight(date: Date) {
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const pad = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T00:00:00${sign}${pad(offset / 60)}:${pad(offset % 60)}`;
}

/** Midnight today and midnight tomorrow — the bounds a day filter needs. */
export function dayBounds(day = new Date()) {
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { from: isoMidnight(start), to: isoMidnight(end) };
}

/** Same day, in the browser's zone. */
export function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * How long a request has been waiting, and how long is left.
 *
 * A request unanswered for 24 hours expires on its own: the booking becomes `expired`, the item is
 * released, and the customer is told the seller did not answer. Sellers cannot see that clock
 * unless it is on screen, so every waiting request carries it.
 */
export const REQUEST_EXPIRY_HOURS = 24;

export function requestClock(createdAt: string | null | undefined, now = Date.now()) {
  if (!createdAt) return null;
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return null;

  const msLeft = created + REQUEST_EXPIRY_HOURS * 3600_000 - now;
  if (msLeft <= 0) return { expired: true, label: 'Срок ответа истёк', urgent: true };

  const hours = Math.floor(msLeft / 3600_000);
  const minutes = Math.floor((msLeft % 3600_000) / 60_000);
  return {
    expired: false,
    // Under an hour the minutes are the whole message; above it they are noise.
    label: hours > 0 ? `Ответить за ${hours} ч` : `Ответить за ${minutes} мин`,
    urgent: msLeft < 6 * 3600_000,
  };
}
