import { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, Package } from 'lucide-react';
import { Skeleton } from '../../components/ui/Skeleton';
import { isSameDay } from './bookingMeta';
import {
  RANGE_PAGE_SIZE,
  addDays,
  bucketByDay,
  dayKey,
  totalFor,
  useBookingsInRange,
  weekStart,
  type DayLoad,
} from './bookingSchedule';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

type View = 'month' | 'week';

/**
 * The schedule: a month to see the shape of it, a week to see the work in it.
 *
 * Both views answer by day and neither shows a booking — a day's bookings live on the day's own
 * screen, because a cell four days wide cannot hold a name and a time, and because the thing an
 * operator does with Tuesday is open it. What a cell can hold is how much: how many go out, how
 * many come back, how much is already out there.
 */
export function BookingsCalendar({ onOpenDay }: { onOpenDay: (day: Date) => void }) {
  const [view, setView] = useState<View>('month');
  const [anchor, setAnchor] = useState(() => new Date());

  // One request covers the month the anchor falls in, padded to whole weeks: the grid shows days
  // either side of the month, and the week list shows weeks that straddle its edges.
  const month = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = weekStart(month);
  const gridEnd = addDays(gridStart, 42);
  const { bookings, loading, error, truncated } = useBookingsInRange(gridStart, gridEnd);
  const byDay = useMemo(() => bucketByDay(bookings, gridStart, 42), [bookings, gridStart]);

  const today = new Date();
  const monthTotals = useMemo(() => {
    let handovers = 0;
    let returns = 0;
    bookings.forEach(booking => {
      const start = new Date(booking.startAt);
      const end = new Date(booking.endAt);
      if (start.getMonth() === month.getMonth() && start.getFullYear() === month.getFullYear()) handovers += 1;
      if (end.getMonth() === month.getMonth() && end.getFullYear() === month.getFullYear()) returns += 1;
    });
    return { handovers, returns };
  }, [bookings, month]);

  const step = (direction: -1 | 1) => {
    setAnchor(current => view === 'month'
      ? new Date(current.getFullYear(), current.getMonth() + direction, 1)
      : addDays(current, direction * 7));
  };

  const weeks = Array.from({ length: 6 }, (_, index) => addDays(gridStart, index * 7));

  return (
    <div className="space-y-2 sm:space-y-3">
      {/* The month, the way to other months, and the choice of how to look at it — one bar, so
          the two views are one screen with a switch rather than two screens to find. */}
      <section className="rounded-2xl bg-white px-3 py-3 sm:rounded-xl sm:border sm:border-gray-200 sm:px-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={view === 'month' ? 'Предыдущий месяц' : 'Предыдущая неделя'}
            onClick={() => step(-1)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
          >
            <ChevronLeft size={18} />
          </button>
          <p className="min-w-0 flex-1 text-center text-base font-semibold text-gray-950">
            {MONTHS[month.getMonth()]} {month.getFullYear()}
          </p>
          <button
            type="button"
            aria-label={view === 'month' ? 'Следующий месяц' : 'Следующая неделя'}
            onClick={() => step(1)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="mt-2.5 flex items-center gap-2">
          <div className="flex flex-1 rounded-xl bg-gray-100 p-0.5">
            {([['month', 'Месяц'], ['week', 'Недели']] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setView(value)}
                className={`flex-1 rounded-[0.625rem] py-1.5 text-sm font-medium transition ${
                  view === value ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-500'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setAnchor(new Date())}
            className="shrink-0 rounded-xl px-3 py-1.5 text-sm font-medium text-blue-700 transition hover:bg-blue-50"
          >
            Сегодня
          </button>
        </div>

        {/* What the month amounts to, where a glance lands before it goes looking for a day. */}
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gray-100 pt-2.5 text-xs text-gray-600">
          <span className="flex items-center gap-1.5">
            <ArrowUpRight size={13} className="text-blue-600" />
            {monthTotals.handovers} {plural(monthTotals.handovers, 'выдача', 'выдачи', 'выдач')}
          </span>
          <span className="flex items-center gap-1.5">
            <ArrowDownLeft size={13} className="text-emerald-600" />
            {monthTotals.returns} {plural(monthTotals.returns, 'возврат', 'возврата', 'возвратов')}
          </span>
          {loading && <Skeleton className="h-3 w-24" />}
        </div>

        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        {truncated && (
          <p className="mt-2 text-xs text-amber-700">
            В этом месяце больше {RANGE_PAGE_SIZE} бронирований — расписание показывает первые {RANGE_PAGE_SIZE}.
          </p>
        )}
      </section>

      {view === 'month' ? (
        <section className="rounded-2xl bg-white p-2 sm:rounded-xl sm:border sm:border-gray-200 sm:p-3">
          <div className="grid grid-cols-7 gap-1">
            {WEEKDAYS.map(day => (
              <div key={day} className="pb-1 text-center text-[11px] font-medium uppercase text-gray-400">{day}</div>
            ))}
            {Array.from({ length: 42 }, (_, index) => addDays(gridStart, index)).map(day => (
              <DayCell
                key={dayKey(day)}
                day={day}
                load={byDay.get(dayKey(day))}
                inMonth={day.getMonth() === month.getMonth()}
                isToday={isSameDay(day, today)}
                onOpen={() => onOpenDay(day)}
              />
            ))}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gray-100 px-1 pt-2 text-[11px] text-gray-500">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-blue-600" /> выдача</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-emerald-600" /> возврат</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-gray-300" /> на руках</span>
          </div>
        </section>
      ) : (
        /* Weeks as rows, one tap to open one. A month grid says which Tuesday is busy; a week row
           says which week is, and on a phone the week is the unit a shift is planned in. */
        <div className="space-y-2">
          {weeks.map(start => (
            <WeekRow
              key={dayKey(start)}
              start={start}
              byDay={byDay}
              month={month.getMonth()}
              today={today}
              expanded={isSameDay(weekStart(anchor), start)}
              onSelect={() => setAnchor(start)}
              onOpenDay={onOpenDay}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DayCell({
  day,
  load,
  inMonth,
  isToday,
  onOpen,
}: {
  day: Date;
  load: DayLoad | undefined;
  inMonth: boolean;
  isToday: boolean;
  onOpen: () => void;
}) {
  const handovers = load?.handovers.length ?? 0;
  const returns = load?.returns.length ?? 0;
  const running = load?.running.length ?? 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-current={isToday ? 'date' : undefined}
      aria-label={`${day.getDate()} ${MONTHS[day.getMonth()].toLowerCase()}, ${totalFor(load)} бронирований`}
      className={`flex aspect-square flex-col items-center justify-start gap-0.5 rounded-lg pt-1.5 transition ${
        inMonth ? 'hover:bg-gray-100' : 'hover:bg-gray-50'
      } ${isToday ? 'bg-blue-50 ring-1 ring-blue-500' : ''}`}
    >
      <span className={`text-sm leading-4 ${
        isToday ? 'font-semibold text-blue-700' : inMonth ? 'text-gray-900' : 'text-gray-300'
      }`}>
        {day.getDate()}
      </span>
      {/* Counts, not dots: three dots on a Tuesday say «something happens», and the next question
          is always how much. Bars sized by what they mean, numbers once there is room. */}
      <span className="flex w-full flex-col items-center gap-0.5 px-1">
        {handovers > 0 && <Tally count={handovers} className="bg-blue-600" muted={!inMonth} />}
        {returns > 0 && <Tally count={returns} className="bg-emerald-600" muted={!inMonth} />}
        {running > 0 && handovers + returns < 2 && <Tally count={running} className="bg-gray-300" muted={!inMonth} dark />}
      </span>
    </button>
  );
}

function Tally({ count, className, muted, dark }: { count: number; className: string; muted?: boolean; dark?: boolean }) {
  return (
    <span
      className={`flex h-3.5 w-full items-center justify-center rounded-[0.2rem] text-[10px] font-semibold leading-none ${className} ${
        dark ? 'text-gray-700' : 'text-white'
      } ${muted ? 'opacity-40' : ''}`}
    >
      {count}
    </span>
  );
}

function WeekRow({
  start,
  byDay,
  month,
  today,
  expanded,
  onSelect,
  onOpenDay,
}: {
  start: Date;
  byDay: Map<string, DayLoad>;
  month: number;
  today: Date;
  expanded: boolean;
  onSelect: () => void;
  onOpenDay: (day: Date) => void;
}) {
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));
  const end = days[6];
  const totals = days.reduce(
    (sum, day) => {
      const load = byDay.get(dayKey(day));
      return {
        handovers: sum.handovers + (load?.handovers.length ?? 0),
        returns: sum.returns + (load?.returns.length ?? 0),
        running: Math.max(sum.running, load?.running.length ?? 0),
      };
    },
    { handovers: 0, returns: 0, running: 0 }
  );
  const thisWeek = days.some(day => isSameDay(day, today));
  const offMonth = days.every(day => day.getMonth() !== month);
  const label = (date: Date) => date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

  return (
    <section className={`overflow-hidden rounded-2xl bg-white sm:rounded-xl sm:border ${
      expanded ? 'sm:border-blue-300' : 'sm:border-gray-200'
    }`}>
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-gray-50"
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className={`text-sm font-medium ${offMonth ? 'text-gray-400' : 'text-gray-950'}`}>
              {label(start)} — {label(end)}
            </span>
            {thisWeek && (
              <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-blue-700">
                эта неделя
              </span>
            )}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
            <span className="flex items-center gap-1"><ArrowUpRight size={12} className="text-blue-600" />{totals.handovers}</span>
            <span className="flex items-center gap-1"><ArrowDownLeft size={12} className="text-emerald-600" />{totals.returns}</span>
            {totals.running > 0 && (
              <span className="flex items-center gap-1"><Package size={12} className="text-gray-400" />до {totals.running} на руках</span>
            )}
            {totals.handovers + totals.returns === 0 && totals.running === 0 && <span>ничего не запланировано</span>}
          </span>
        </span>
        <ChevronRight size={16} className={`shrink-0 text-gray-400 transition ${expanded ? 'rotate-90' : ''}`} />
      </button>

      {/* The chosen week opens into its days, each one a way to the day's own screen. */}
      {expanded && (
        <ul className="border-t border-gray-100">
          {days.map(day => {
            const load = byDay.get(dayKey(day));
            const empty = totalFor(load) === 0;
            return (
              <li key={dayKey(day)} className="border-b border-gray-50 last:border-0">
                <button
                  type="button"
                  onClick={() => onOpenDay(day)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-gray-50"
                >
                  <span className={`flex h-9 w-11 shrink-0 flex-col items-center justify-center rounded-lg ${
                    isSameDay(day, today) ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-600'
                  }`}>
                    <span className="text-[10px] uppercase leading-none">{WEEKDAYS[(day.getDay() + 6) % 7]}</span>
                    <span className="text-sm font-semibold leading-tight">{day.getDate()}</span>
                  </span>
                  <span className="min-w-0 flex-1 text-sm">
                    {empty ? (
                      <span className="text-gray-400">Ничего не запланировано</span>
                    ) : (
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                        {(load?.handovers.length ?? 0) > 0 && (
                          <span className="text-gray-900">
                            {load?.handovers.length} {plural(load?.handovers.length ?? 0, 'выдача', 'выдачи', 'выдач')}
                          </span>
                        )}
                        {(load?.returns.length ?? 0) > 0 && (
                          <span className="text-gray-900">
                            {load?.returns.length} {plural(load?.returns.length ?? 0, 'возврат', 'возврата', 'возвратов')}
                          </span>
                        )}
                        {(load?.running.length ?? 0) > 0 && (
                          <span className="text-gray-500">{load?.running.length} на руках</span>
                        )}
                      </span>
                    )}
                  </span>
                  <ChevronRight size={15} className="shrink-0 text-gray-300" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Russian counts need three forms, and «1 выдач» is a bug a seller can see. */
function plural(count: number, one: string, few: string, many: string) {
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  const mod10 = count % 10;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}
