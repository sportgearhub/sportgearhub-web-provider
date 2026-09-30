import type { LocationSchedule } from '../../types';

const DAYS = [
  { key: 'monday', short: 'Пн' },
  { key: 'tuesday', short: 'Вт' },
  { key: 'wednesday', short: 'Ср' },
  { key: 'thursday', short: 'Чт' },
  { key: 'friday', short: 'Пт' },
  { key: 'saturday', short: 'Сб' },
  { key: 'sunday', short: 'Вс' },
];

const hhmm = (value: string) => value.slice(0, 5);

/** Round the clock is stored as hours, so it is recognised rather than flagged. */
const isAllDay = (opensAt: string, closesAt: string) =>
  hhmm(opensAt) === '00:00' && hhmm(closesAt) >= '23:59';

type Span = { days: string[]; hours: string };

/**
 * The week as few lines as it honestly needs.
 *
 * Seven rows of «Понедельник 09:00–20:00» is the same sentence written seven times; a point that
 * keeps one set of hours all week should say so once. Consecutive days that agree are folded into
 * a range, and only a day that actually differs gets its own chip.
 */
export function summariseWeek(schedule: LocationSchedule | null): Span[] {
  if (!schedule) return [];

  const byDay = new Map(schedule.workingHours.map(hours => [hours.day.toLowerCase(), hours]));
  const spans: Span[] = [];

  DAYS.forEach(({ key, short }) => {
    const hours = byDay.get(key);
    const label = !hours
      ? 'выходной'
      : isAllDay(hours.opensAt, hours.closesAt)
        ? 'круглосуточно'
        : `${hhmm(hours.opensAt)}–${hhmm(hours.closesAt)}`;

    const last = spans[spans.length - 1];
    if (last && last.hours === label) last.days.push(short);
    else spans.push({ days: [short], hours: label });
  });

  return spans;
}

function spanLabel(span: Span) {
  if (span.days.length === 1) return span.days[0];
  return `${span.days[0]}–${span.days[span.days.length - 1]}`;
}

/**
 * The week on a card: the segmented control's shape, but nothing here is pressable. It is a
 * reading of what is stored, and the button beside it is what changes it.
 */
export function WeekHours({ schedule }: { schedule: LocationSchedule | null }) {
  const spans = summariseWeek(schedule);

  if (spans.length === 0) {
    return <p className="text-xs text-gray-400">Часы работы не заданы</p>;
  }

  // Closed all week is a statement, not seven chips saying nothing.
  if (spans.length === 1 && spans[0].hours === 'выходной') {
    return <p className="text-xs text-gray-400">Часы работы не заданы</p>;
  }

  return (
    <div className="flex flex-wrap gap-1 rounded-xl bg-gray-100 p-1">
      {spans.map(span => {
        const closed = span.hours === 'выходной';
        return (
          <span
            key={span.days.join()}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs ${
              closed ? 'text-gray-400' : 'bg-white text-gray-800 shadow-sm'
            }`}
          >
            <span className="font-medium">{spanLabel(span)}</span>
            <span className={closed ? '' : 'text-gray-500'}>{span.hours}</span>
          </span>
        );
      })}
    </div>
  );
}
