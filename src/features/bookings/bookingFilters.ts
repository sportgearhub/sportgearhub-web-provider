import { useSyncExternalStore } from 'react';
import { dayBounds, isoMidnight } from './bookingMeta';

/**
 * What the bookings filter screen chose, kept outside the list.
 *
 * Same reasoning as the catalogue's: the screen that edits these is a route of its own, so the two
 * never share a parent that could hold the value, and a module store with `useSyncExternalStore`
 * is both enough and tear-free. Not in the URL — a seller's working view on one device.
 */
export type Period = 'any' | 'today' | 'tomorrow' | 'week' | 'overdue';

export const PERIODS: { value: Period; label: string; note?: string }[] = [
  { value: 'any', label: 'Любая дата' },
  { value: 'today', label: 'Сегодня' },
  { value: 'tomorrow', label: 'Завтра' },
  { value: 'week', label: 'Ближайшие 7 дней' },
  { value: 'overdue', label: 'Срок вышел', note: 'Возврат должен был состояться' },
];

/**
 * The orderings the endpoint allows. Allowed fields are `booking_id` · `booking_number` ·
 * `status` · `product_id` · `start_at` · `end_at` · `quantity` · `total_price` · `created_at` ·
 * `updated_at`, and descending is a `-` prefix — never `start_at,desc`.
 */
export const SORTS = [
  { value: 'start_at', label: 'Сначала ближайшие' },
  { value: '-start_at', label: 'Сначала поздние' },
  { value: '-created_at', label: 'Сначала новые заявки' },
  { value: '-total_price', label: 'Сначала дорогие' },
  { value: 'total_price', label: 'Сначала дешёвые' },
] as const;

export type BookingFilters = { period: Period; sort: string };

export const EMPTY_BOOKING_FILTERS: BookingFilters = { period: 'any', sort: 'start_at' };

export function countActive(filters: BookingFilters) {
  return filters.period === 'any' ? 0 : 1;
}

/** The chosen filters as RSQL terms. A period is a window on `start_at`, the date a seller plans by. */
export function filtersToRsql(filters: BookingFilters): string[] {
  const today = dayBounds();
  if (filters.period === 'today') return [`start_at=ge=${today.from}`, `start_at=lt=${today.to}`];
  if (filters.period === 'tomorrow') {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const bounds = dayBounds(tomorrow);
    return [`start_at=ge=${bounds.from}`, `start_at=lt=${bounds.to}`];
  }
  if (filters.period === 'week') {
    const end = new Date();
    end.setDate(end.getDate() + 7);
    return [`start_at=ge=${today.from}`, `start_at=lt=${isoMidnight(end)}`];
  }
  // Something that should have come back and has not: the window closed before now.
  if (filters.period === 'overdue') return [`end_at=lt=${new Date().toISOString()}`];
  return [];
}

let current: BookingFilters = EMPTY_BOOKING_FILTERS;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useBookingFilters() {
  return useSyncExternalStore(subscribe, () => current);
}

export function setBookingFilters(next: BookingFilters) {
  current = next;
  listeners.forEach(listener => listener());
}
