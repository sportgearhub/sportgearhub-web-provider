import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, ImageOff, Package } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { SectionPage } from '../../components/layout/SectionPage';
import { Skeleton } from '../../components/ui/Skeleton';
import { mediaUrl } from '../../lib/api-client';
import type { BookingListItem } from '../../types';
import { bookingStatusMeta, isSameDay } from './bookingMeta';
import { addDays, dayKey, dayLoad, parseDayKey, useBookingsInRange, type DayLoad } from './bookingSchedule';

/**
 * One day of work.
 *
 * The calendar says how much happens on Tuesday; this says what. Ordered the way the day is
 * worked — what goes out, what comes back, what is already out there — and timed, because the
 * question at nine in the morning is what is first and the question at six is what is still
 * missing. The day is in the address, so it survives a reload and can be sent to whoever opens
 * tomorrow.
 */
export function BookingDayPage({ day: key, onNavigate }: { day: string; onNavigate: (path: string) => void }) {
  const day = parseDayKey(key);
  const { bookings, loading, error } = useBookingsInRange(day, addDays(day, 1));
  const load = dayLoad(bookings, day);
  const today = isSameDay(day, new Date());
  const total = load.handovers.length + load.returns.length + load.running.length;

  return (
    <SectionPage
      title={day.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'long' })}
      breadcrumb={{ label: 'Расписание', path: '/bookings/calendar' }}
      onNavigate={onNavigate}
      error={error}
      bare
    >
      <div className="space-y-2 sm:space-y-4">
        {/* Yesterday and tomorrow, where a thumb already is: a day screen is read in a sequence,
            and going back to the month to step one day forward is the long way round. */}
        <section className="flex items-center gap-2 rounded-2xl bg-white px-2 py-2 sm:rounded-xl sm:border sm:border-gray-200">
          <button
            type="button"
            onClick={() => onNavigate(`/bookings/day/${dayKey(addDays(day, -1))}`)}
            className="flex h-9 shrink-0 items-center gap-1 rounded-lg px-2 text-sm text-gray-600 transition hover:bg-gray-100"
          >
            <ChevronLeft size={16} /> {addDays(day, -1).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
          </button>
          <p className="min-w-0 flex-1 text-center text-sm font-medium text-gray-950">
            {today ? 'Сегодня' : day.toLocaleDateString('ru-RU', { weekday: 'long' })}
          </p>
          <button
            type="button"
            onClick={() => onNavigate(`/bookings/day/${dayKey(addDays(day, 1))}`)}
            className="flex h-9 shrink-0 items-center gap-1 rounded-lg px-2 text-sm text-gray-600 transition hover:bg-gray-100"
          >
            {addDays(day, 1).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} <ChevronRight size={16} />
          </button>
        </section>

        {loading ? (
          <div className="space-y-2 px-3 sm:px-0">
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
          </div>
        ) : total === 0 ? (
          <p className="rounded-2xl bg-white px-4 py-8 text-center text-sm text-gray-500 sm:rounded-xl sm:border sm:border-gray-200">
            В этот день ничего не запланировано.
          </p>
        ) : (
          <>
            <Summary load={load} />
            <Group
              title="Выдачи"
              icon={<ArrowUpRight size={15} className="text-blue-600" />}
              note="По времени начала аренды."
              bookings={load.handovers}
              moment="start"
              onOpen={onNavigate}
            />
            <Group
              title="Возвраты"
              icon={<ArrowDownLeft size={15} className="text-emerald-600" />}
              note="По времени, к которому снаряжение ждут обратно."
              bookings={load.returns}
              moment="end"
              onOpen={onNavigate}
            />
            <Group
              title="На руках"
              icon={<Package size={15} className="text-gray-400" />}
              note="Аренда идёт, в этот день ничего делать не нужно."
              bookings={load.running}
              moment="window"
              onOpen={onNavigate}
            />
          </>
        )}
      </div>
    </SectionPage>
  );
}

function Summary({ load }: { load: DayLoad }) {
  const cells = [
    { label: 'выдать', value: load.handovers.length, className: 'text-blue-700' },
    { label: 'принять', value: load.returns.length, className: 'text-emerald-700' },
    { label: 'на руках', value: load.running.length, className: 'text-gray-700' },
  ];
  return (
    <section className="grid grid-cols-3 gap-2 rounded-2xl bg-white px-2 py-3 sm:rounded-xl sm:border sm:border-gray-200">
      {cells.map(cell => (
        <div key={cell.label} className="text-center">
          <p className={`text-xl font-semibold leading-6 ${cell.className}`}>{cell.value}</p>
          <p className="text-xs text-gray-500">{cell.label}</p>
        </div>
      ))}
    </section>
  );
}

function Group({
  title,
  icon,
  note,
  bookings,
  moment,
  onOpen,
}: {
  title: string;
  icon: React.ReactNode;
  note: string;
  bookings: BookingListItem[];
  /** Which end of the rental this group is about — that is the time worth printing. */
  moment: 'start' | 'end' | 'window';
  onOpen: (path: string) => void;
}) {
  if (bookings.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-2xl bg-white sm:rounded-xl sm:border sm:border-gray-200">
      <header className="border-b border-gray-100 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-950">
          {icon} {title}
          <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">{bookings.length}</span>
        </h2>
        <p className="mt-0.5 text-xs text-gray-500">{note}</p>
      </header>
      <ul className="divide-y divide-gray-50">
        {bookings.map(booking => (
          <li key={booking.bookingId}>
            <button
              type="button"
              onClick={() => onOpen(`/bookings/${booking.bookingId}`)}
              className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-gray-50 active:bg-gray-50"
            >
              <span className="w-11 shrink-0 pt-0.5 text-sm font-semibold tabular-nums text-gray-950">
                {moment === 'window' ? '—' : time(moment === 'start' ? booking.startAt : booking.endAt)}
              </span>
              {booking.product.mediaPreviewUrl ? (
                <img
                  src={mediaUrl(booking.product.mediaPreviewUrl)}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-lg border border-gray-200 object-cover"
                />
              ) : (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-300">
                  <ImageOff size={15} />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium leading-5 text-gray-950">{booking.product.title}</span>
                <span className="mt-0.5 block truncate text-xs text-gray-500">
                  {booking.customer?.fullName ?? 'Клиент'} · №{booking.bookingNumber}
                  {booking.quantity > 1 ? ` · ${booking.quantity} шт` : ''}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-1">
                  <Badge variant={bookingStatusMeta(booking.status).variant} size="xs" tone="strong" shape="square">
                    {bookingStatusMeta(booking.status).label}
                  </Badge>
                  {booking.fulfillment?.hasIssue && (
                    <Badge variant="red" size="xs" tone="strong" shape="square">есть обращение</Badge>
                  )}
                  {moment === 'window' && (
                    <span className="text-xs text-gray-400">
                      до {new Date(booking.endAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                </span>
              </span>
              <ChevronRight size={16} className="mt-1 shrink-0 text-gray-300" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function time(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}
