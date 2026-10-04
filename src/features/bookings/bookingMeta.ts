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
export function dayBounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const iso = (date: Date) => {
    const offset = -date.getTimezoneOffset();
    const sign = offset >= 0 ? '+' : '-';
    const pad = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T00:00:00${sign}${pad(offset / 60)}:${pad(offset % 60)}`;
  };
  return { from: iso(start), to: iso(end) };
}

