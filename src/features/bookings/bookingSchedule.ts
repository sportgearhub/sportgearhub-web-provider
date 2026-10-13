import { useCallback, useEffect, useState } from 'react';
import { ApiError, bookingsApi } from '../../lib/api-client';
import type { BookingListItem } from '../../types';
import { isSameDay, isoMidnight } from './bookingMeta';

/** The API caps a page at 100, which is the ceiling for any window asked for here. */
export const RANGE_PAGE_SIZE = 100;

/** `2026-10-07` — a day in a URL, which has to survive a reload and a shared link. */
export function dayKey(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The other direction, tolerant of nonsense in the address bar: anything unparseable means today. */
export function parseDayKey(key: string | undefined) {
  const match = key?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return new Date();
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

/** Monday of the week a date falls in — this console's weeks start on Monday, like its grid. */
export function weekStart(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

export function addDays(date: Date, days: number) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

/**
 * Everything a rental does on one day: goes out, comes back, or is simply out.
 *
 * A seller's question is «что происходит во вторник», and a three-day hire is happening on all
 * three days — so a booking is counted against every day it touches, not only the day it starts.
 */
export type DayLoad = {
  handovers: BookingListItem[];
  returns: BookingListItem[];
  running: BookingListItem[];
};

export const EMPTY_DAY: DayLoad = { handovers: [], returns: [], running: [] };

export function dayLoad(bookings: BookingListItem[], day: Date): DayLoad {
  const load: DayLoad = { handovers: [], returns: [], running: [] };
  bookings.forEach(booking => {
    const start = new Date(booking.startAt);
    const end = new Date(booking.endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;
    if (isSameDay(start, day)) load.handovers.push(booking);
    else if (isSameDay(end, day)) load.returns.push(booking);
    else if (start < day && end > day) load.running.push(booking);
  });
  const byTime = (field: 'startAt' | 'endAt') => (a: BookingListItem, b: BookingListItem) =>
    new Date(a[field]).getTime() - new Date(b[field]).getTime();
  load.handovers.sort(byTime('startAt'));
  load.returns.sort(byTime('endAt'));
  return load;
}

/** The whole window bucketed by day, so switching day or week costs nothing after one request. */
export function bucketByDay(bookings: BookingListItem[], from: Date, days: number) {
  const map = new Map<string, DayLoad>();
  for (let index = 0; index < days; index += 1) {
    const day = addDays(from, index);
    map.set(dayKey(day), dayLoad(bookings, day));
  }
  return map;
}

export function totalFor(load: DayLoad | undefined) {
  if (!load) return 0;
  return load.handovers.length + load.returns.length + load.running.length;
}

/**
 * Every booking overlapping a window, in one request.
 *
 * Anything that starts before the window ends and ends after it starts overlaps it — which is the
 * filter the endpoint's RSQL profile allows on `start_at` and `end_at`, and the only way to catch
 * a rental that spans the whole window without starting or ending inside it.
 */
export function useBookingsInRange(from: Date, to: Date) {
  const [bookings, setBookings] = useState<BookingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [truncated, setTruncated] = useState(false);
  const fromIso = isoMidnight(from);
  const toIso = isoMidnight(to);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await bookingsApi.list({
        filter: `start_at=lt=${toIso};end_at=ge=${fromIso}`,
        sort: 'start_at',
        pageSize: RANGE_PAGE_SIZE,
      });
      setBookings(result.items ?? []);
      setTruncated((result.pagination?.totalItems ?? 0) > RANGE_PAGE_SIZE);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить расписание.');
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [fromIso, toIso]);

  useEffect(() => { void load(); }, [load]);

  return { bookings, loading, error, truncated, reload: load };
}
