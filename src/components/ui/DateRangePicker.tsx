import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

const pad = (n: number) => String(n).padStart(2, '0');

/** Date → ISO `yyyy-MM-dd` (local, no timezone shift). */
function toIso(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** ISO `yyyy-MM-dd` → Date at local midnight, or null if blank/invalid. */
function parseIso(value: string): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** ISO `yyyy-MM-dd` → display `dd.MM.yyyy` (empty string passes through). */
export function formatRuDate(value: string): string {
  const date = parseIso(value);
  if (!date) return '';
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
}

/** Monday-first weekday index (0 = Mon … 6 = Sun). */
function mondayIndex(date: Date) {
  return (date.getDay() + 6) % 7;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

type DateRangePickerProps = {
  label?: string;
  startsOn: string;
  endsOn: string;
  onChange: (range: { startsOn: string; endsOn: string }) => void;
  placeholder?: string;
  disabled?: boolean;
};

export function DateRangePicker({
  label,
  startsOn,
  endsOn,
  onChange,
  placeholder = 'Выберите даты',
  disabled = false,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const start = parseIso(startsOn);
  const end = parseIso(endsOn);

  // Month currently shown in the calendar grid.
  const [cursor, setCursor] = useState(() => start ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  const days = useMemo(() => {
    const firstOfMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const lead = mondayIndex(firstOfMonth);
    const gridStart = new Date(firstOfMonth);
    gridStart.setDate(firstOfMonth.getDate() - lead);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      return d;
    });
  }, [cursor]);

  const pickDay = (day: Date) => {
    const iso = toIso(day);
    // No start yet, or a full range already chosen → begin a fresh range.
    if (!start || (start && end)) {
      onChange({ startsOn: iso, endsOn: '' });
      return;
    }
    // Start chosen, picking the end. Swap if the user clicked an earlier day.
    if (day < start) {
      onChange({ startsOn: iso, endsOn: startsOn });
    } else {
      onChange({ startsOn, endsOn: iso });
    }
    setOpen(false);
  };

  const label2 = start && end
    ? `${formatRuDate(startsOn)} — ${formatRuDate(endsOn)}`
    : start
      ? `${formatRuDate(startsOn)} — …`
      : '';

  const inRange = (day: Date) => start && end && day > start && day < end;

  return (
    <div className="relative flex flex-col gap-1.5" onBlur={() => window.setTimeout(() => setOpen(false), 120)}>
      {label && <label className="text-xs font-medium text-foreground">{label}</label>}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(c => !c)}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-left text-sm shadow-sm transition hover:border-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={`truncate ${label2 ? 'text-foreground' : 'text-muted-foreground'}`}>
          {label2 || placeholder}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {label2 && (
            <X
              size={14}
              className="text-gray-300 hover:text-gray-500"
              onClick={e => { e.stopPropagation(); onChange({ startsOn: '', endsOn: '' }); }}
            />
          )}
          <CalendarDays size={15} className="text-gray-400" />
        </span>
      </button>

      {open && !disabled && (
        <div
          role="dialog"
          className="absolute left-0 top-full z-50 mt-1 w-[268px] rounded-lg border border-gray-200 bg-white p-3 shadow-lg"
          onMouseDown={e => e.preventDefault()}
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              className="rounded p-1 text-gray-500 hover:bg-gray-100"
              onClick={() => setCursor(c => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
              aria-label="Предыдущий месяц"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium text-gray-900">
              {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
            </span>
            <button
              type="button"
              className="rounded p-1 text-gray-500 hover:bg-gray-100"
              onClick={() => setCursor(c => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
              aria-label="Следующий месяц"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-0.5 text-center text-[11px] font-medium text-gray-400">
            {WEEKDAYS.map(w => <span key={w}>{w}</span>)}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {days.map((day, i) => {
              const isCurrentMonth = day.getMonth() === cursor.getMonth();
              const isStart = start && sameDay(day, start);
              const isEnd = end && sameDay(day, end);
              const isEdge = isStart || isEnd;
              const between = inRange(day);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => pickDay(day)}
                  className={[
                    'h-8 rounded text-xs transition',
                    isEdge ? 'bg-blue-600 font-semibold text-white hover:bg-blue-600' : '',
                    between ? 'bg-blue-50 text-blue-900' : '',
                    !isEdge && !between ? 'hover:bg-gray-100' : '',
                    isCurrentMonth ? 'text-gray-800' : 'text-gray-300',
                    isEdge ? 'text-white' : '',
                  ].join(' ')}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2">
            <button
              type="button"
              className="text-xs text-gray-500 hover:text-gray-800"
              onClick={() => { onChange({ startsOn: '', endsOn: '' }); }}
            >
              Очистить
            </button>
            <button
              type="button"
              className="text-xs font-medium text-blue-600 hover:text-blue-700"
              onClick={() => setOpen(false)}
            >
              Готово
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
