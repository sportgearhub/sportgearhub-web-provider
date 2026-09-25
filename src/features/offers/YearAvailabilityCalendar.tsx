import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { OfferAvailabilityBlockedPeriod, OfferAvailabilityWindow } from '../../types';

type DayState = 'open' | 'blocked' | 'closed';

const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const STATE_STYLE: Record<DayState, string> = {
  open: 'bg-emerald-400',
  blocked: 'bg-amber-400',
  closed: 'bg-gray-100',
};

function iso(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function covers(period: { startsOn: string; endsOn: string }, date: string) {
  // ISO dates compare correctly as strings, so no Date objects and no timezone to get wrong.
  return Boolean(period.startsOn) && Boolean(period.endsOn) && period.startsOn <= date && date <= period.endsOn;
}

function hhmm(value: string | null | undefined) {
  return (value ?? '').slice(0, 5);
}

/**
 * A year of availability as one picture: a square per day, grouped by month. Seasons are date
 * ranges that may overlap or leave gaps, and a list of ranges hides both — a calendar shows the
 * gap between two seasons, and the block that eats a week of one, at a glance.
 */
export function YearAvailabilityCalendar({
  windows,
  blockedPeriods,
  initialYear,
}: {
  windows: OfferAvailabilityWindow[];
  blockedPeriods: OfferAvailabilityBlockedPeriod[];
  initialYear?: number;
}) {
  const [year, setYear] = useState(() => initialYear ?? defaultYear(windows));
  const today = new Date().toISOString().slice(0, 10);

  const openDays = useMemo(() => {
    let count = 0;
    for (let month = 0; month < 12; month += 1) {
      for (let day = 1; day <= daysInMonth(year, month); day += 1) {
        if (stateOf(iso(year, month, day), windows, blockedPeriods) === 'open') count += 1;
      }
    }
    return count;
  }, [year, windows, blockedPeriods]);

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Год целиком</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            {openDays > 0 ? `${openDays} ${pluralDays(openDays)} открыто в ${year}` : `В ${year} нет открытых дней`}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setYear(value => value - 1)}
            className="flex h-7 w-7 items-center justify-center rounded-md border text-gray-500 transition hover:bg-gray-50"
            aria-label={`${year - 1} год`}
          >
            <ChevronLeft size={14} />
          </button>
          <span className="w-10 text-center text-sm font-medium text-gray-900">{year}</span>
          <button
            type="button"
            onClick={() => setYear(value => value + 1)}
            className="flex h-7 w-7 items-center justify-center rounded-md border text-gray-500 transition hover:bg-gray-50"
            aria-label={`${year + 1} год`}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {MONTHS.map((name, month) => (
          <Month
            key={name}
            name={name}
            year={year}
            month={month}
            today={today}
            windows={windows}
            blockedPeriods={blockedPeriods}
          />
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gray-100 pt-3 text-xs text-gray-600">
        <Legend state="open" label="Открыто" />
        <Legend state="blocked" label="Закрытый период" />
        <Legend state="closed" label="Вне сезона" />
      </div>
    </div>
  );
}

function Month({
  name,
  year,
  month,
  today,
  windows,
  blockedPeriods,
}: {
  name: string;
  year: number;
  month: number;
  today: string;
  windows: OfferAvailabilityWindow[];
  blockedPeriods: OfferAvailabilityBlockedPeriod[];
}) {
  const total = daysInMonth(year, month);
  // getDay() is Sunday-first; Russian calendars start on Monday.
  const leading = (new Date(year, month, 1).getDay() + 6) % 7;

  return (
    <div>
      <p className="mb-1 text-xs font-medium text-gray-700">{name}</p>
      <div className="grid grid-cols-7 gap-[3px]">
        {WEEKDAYS.map(weekday => (
          <span key={weekday} className="text-center text-[9px] leading-4 text-gray-400">{weekday}</span>
        ))}
        {Array.from({ length: leading }, (_, index) => <span key={`pad-${index}`} />)}
        {Array.from({ length: total }, (_, index) => {
          const day = index + 1;
          const date = iso(year, month, day);
          const state = stateOf(date, windows, blockedPeriods);
          return (
            <span
              key={date}
              title={describe(date, state, windows, blockedPeriods)}
              className={`aspect-square rounded-[2px] ${STATE_STYLE[state]} ${date === today ? 'ring-1 ring-blue-600 ring-offset-1' : ''}`}
            />
          );
        })}
      </div>
    </div>
  );
}

function Legend({ state, label }: { state: DayState; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-3 w-3 rounded-[2px] ${STATE_STYLE[state]}`} />
      {label}
    </span>
  );
}

function stateOf(date: string, windows: OfferAvailabilityWindow[], blockedPeriods: OfferAvailabilityBlockedPeriod[]): DayState {
  // A block wins: it is the exception a seller adds on top of a season.
  if (blockedPeriods.some(period => covers(period, date))) return 'blocked';
  return windows.some(window => covers(window, date)) ? 'open' : 'closed';
}

function describe(
  date: string,
  state: DayState,
  windows: OfferAvailabilityWindow[],
  blockedPeriods: OfferAvailabilityBlockedPeriod[]
) {
  const human = date.split('-').reverse().join('.');
  if (state === 'blocked') {
    const reason = blockedPeriods.find(period => covers(period, date))?.reasonCode;
    return `${human} — закрыто${reason ? ` (${reason})` : ''}`;
  }
  if (state === 'open') {
    const window = windows.find(item => covers(item, date));
    const hours = window ? `${hhmm(window.dailyOpensAt)}–${hhmm(window.dailyClosesAt)}` : '';
    return `${human} — открыто${hours ? `, ${hours}` : ''}`;
  }
  return `${human} — вне сезона`;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

/** Opens on the year the seasons are about, not blindly on the current one. */
function defaultYear(windows: OfferAvailabilityWindow[]) {
  const current = new Date().getFullYear();
  if (windows.some(window => window.startsOn?.startsWith(String(current)) || window.endsOn?.startsWith(String(current)))) {
    return current;
  }
  const first = windows.map(window => window.startsOn).filter(Boolean).sort()[0];
  return first ? Number(first.slice(0, 4)) : current;
}

function pluralDays(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'день';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'дня';
  return 'дней';
}
