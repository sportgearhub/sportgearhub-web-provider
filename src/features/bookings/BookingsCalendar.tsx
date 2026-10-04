import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ImageOff } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { SettingsCard } from '../../components/layout/SettingsCard';
import { Skeleton } from '../../components/ui/Skeleton';
import { ApiError, bookingsApi, mediaUrl } from '../../lib/api-client';
import type { BookingListItem } from '../../types';
import { bookingStatusMeta, isoMidnight, isSameDay } from './bookingMeta';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

/** The API caps a page at 100, which is the month's ceiling here. */
const MONTH_PAGE_SIZE = 100;

/** Monday-first grid covering the whole month, padded out to full weeks. */
function monthGrid(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - offset);

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

/**
 * The month a rental runs across, not the day it was booked.
 *
 * A seller's question is «что происходит во вторник», and a three-day hire is happening on all
 * three. Each day is marked for what it is: a handover starting, a return due, or gear simply out.
 */
type DayMark = { handover: number; ret: number; running: number };

export function BookingsCalendar({ onOpen }: { onOpen: (bookingId: string) => void }) {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selected, setSelected] = useState<Date>(() => new Date());
  const [bookings, setBookings] = useState<BookingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [truncated, setTruncated] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const from = isoMidnight(new Date(month.getFullYear(), month.getMonth(), 1));
    const to = isoMidnight(new Date(month.getFullYear(), month.getMonth() + 1, 1));
    try {
      // One request for the month: anything that starts before it ends and ends after it starts
      // overlaps it. Bucketing by day is then free, and changing day costs nothing.
      const result = await bookingsApi.list({
        filter: `start_at=lt=${to};end_at=ge=${from}`,
        sort: 'start_at',
        pageSize: MONTH_PAGE_SIZE,
      });
      setBookings(result.items ?? []);
      setTruncated((result.pagination?.totalItems ?? 0) > MONTH_PAGE_SIZE);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить календарь.');
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { void load(); }, [load]);

  const marks = useMemo(() => {
    const map = new Map<string, DayMark>();
    const key = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const bump = (date: Date, field: keyof DayMark) => {
      const existing = map.get(key(date)) ?? { handover: 0, ret: 0, running: 0 };
      existing[field] += 1;
      map.set(key(date), existing);
    };

    bookings.forEach(booking => {
      const start = new Date(booking.startAt);
      const end = new Date(booking.endAt);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;
      bump(start, 'handover');
      bump(end, 'ret');
      // Every day strictly between the two is gear that is out and not moving.
      const cursor = new Date(start);
      cursor.setHours(0, 0, 0, 0);
      cursor.setDate(cursor.getDate() + 1);
      while (cursor < end && !isSameDay(cursor, end)) {
        bump(cursor, 'running');
        cursor.setDate(cursor.getDate() + 1);
      }
    });
    return { map, key };
  }, [bookings]);

  const onSelectedDay = useMemo(
    () => bookings.filter(booking => {
      const start = new Date(booking.startAt);
      const end = new Date(booking.endAt);
      if (Number.isNaN(start.getTime())) return false;
      const dayStart = new Date(selected);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      return start < dayEnd && end >= dayStart;
    }),
    [bookings, selected]
  );

  const days = monthGrid(month);
  const today = new Date();

  return (
    <div className="space-y-3">
      <SettingsCard
        title={`${MONTHS[month.getMonth()]} ${month.getFullYear()}`}
        description="Выберите день, чтобы увидеть бронирования."
        action={
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Предыдущий месяц"
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              className="rounded-lg p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => { const now = new Date(); setMonth(new Date(now.getFullYear(), now.getMonth(), 1)); setSelected(now); }}
              className="rounded-lg px-2 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-50"
            >
              Сегодня
            </button>
            <button
              type="button"
              aria-label="Следующий месяц"
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
              className="rounded-lg p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map(day => (
            <div key={day} className="pb-1 text-center text-[11px] font-medium uppercase text-gray-400">{day}</div>
          ))}

          {days.map(day => {
            const mark = marks.map.get(marks.key(day));
            const inMonth = day.getMonth() === month.getMonth();
            const isSelected = isSameDay(day, selected);
            const isToday = isSameDay(day, today);
            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => setSelected(day)}
                aria-current={isToday ? 'date' : undefined}
                className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-lg text-sm transition ${
                  isSelected
                    ? 'bg-gray-950 font-medium text-white'
                    : inMonth
                      ? 'text-gray-900 hover:bg-gray-100'
                      : 'text-gray-300 hover:bg-gray-50'
                } ${isToday && !isSelected ? 'ring-1 ring-blue-500' : ''}`}
              >
                {day.getDate()}
                {/* Three marks, three meanings: going out, coming back, and out already. */}
                <span className="flex h-1.5 items-center gap-0.5">
                  {mark?.handover ? <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-blue-600'}`} /> : null}
                  {mark?.ret ? <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-white/70' : 'bg-emerald-600'}`} /> : null}
                  {mark?.running && !mark.handover && !mark.ret
                    ? <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-white/40' : 'bg-gray-300'}`} />
                    : null}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gray-100 pt-3 text-xs text-gray-500">
          <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-blue-600" /> выдача</span>
          <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-600" /> возврат</span>
          <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-gray-300" /> на руках</span>
        </div>

        {loading && <Skeleton className="mt-3 h-3 w-40" />}
        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
        {truncated && (
          <p className="mt-3 text-xs text-amber-700">
            В этом месяце больше {MONTH_PAGE_SIZE} бронирований — календарь показывает первые {MONTH_PAGE_SIZE}.
          </p>
        )}
      </SettingsCard>

      <SettingsCard
        title={selected.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'long' })}
        description={onSelectedDay.length > 0 ? `${onSelectedDay.length} бронирований` : undefined}
      >
        {onSelectedDay.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">В этот день ничего не запланировано.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {onSelectedDay.map(booking => {
              const start = new Date(booking.startAt);
              const end = new Date(booking.endAt);
              const starts = isSameDay(start, selected);
              const ends = isSameDay(end, selected);
              const status = bookingStatusMeta(booking.status);
              const time = (date: Date) => date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
              return (
                <li key={booking.bookingId}>
                  <button
                    type="button"
                    onClick={() => onOpen(booking.bookingId)}
                    className="flex w-full items-start gap-3 py-2.5 text-left transition hover:bg-gray-50"
                  >
                    {booking.product.mediaPreviewUrl ? (
                      <img src={mediaUrl(booking.product.mediaPreviewUrl)} alt="" className="h-10 w-10 shrink-0 rounded-lg border border-gray-200 object-cover" />
                    ) : (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-300">
                        <ImageOff size={15} />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium leading-5 text-gray-900">{booking.product.title}</span>
                      <span className="mt-0.5 block text-xs text-gray-500">
                        {booking.customer?.fullName ?? 'Клиент'} · №{booking.bookingNumber}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5">
                        {starts && <Badge variant="blue">выдача {time(start)}</Badge>}
                        {ends && <Badge variant="green">возврат {time(end)}</Badge>}
                        {!starts && !ends && <Badge variant="gray">на руках</Badge>}
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </SettingsCard>
    </div>
  );
}
