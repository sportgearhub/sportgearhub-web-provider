import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import {
  EMPTY_BOOKING_FILTERS,
  PERIODS,
  SORTS,
  countActive,
  setBookingFilters,
  useBookingFilters,
  type BookingFilters,
} from './bookingFilters';

/**
 * The bookings filters, as a screen.
 *
 * The same shape as the catalogue's, for the same reason: on a phone there are no column headers
 * to hang a menu off, and nothing is applied until the bar at the bottom says so. Only fields the
 * endpoint's RSQL profile allows are offered — `start_at`, `end_at` and the orderings — so there
 * is no control here that produces a 400.
 */
export function BookingFiltersPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const applied = useBookingFilters();
  const [draft, setDraft] = useState<BookingFilters>(applied);
  const active = countActive(draft);

  return (
    <div className="flex min-h-0 flex-1 animate-in flex-col duration-200 slide-in-from-right-4">
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6 pt-3">
        <div className="space-y-3">
          <Section title="Сортировка">
            {SORTS.map(option => (
              <Row
                key={option.value}
                label={option.label}
                chosen={draft.sort === option.value}
                onClick={() => setDraft(current => ({ ...current, sort: option.value }))}
              />
            ))}
          </Section>

          <Section title="Дата выдачи" note="Окно по началу аренды">
            {PERIODS.map(option => (
              <Row
                key={option.value}
                label={option.label}
                note={option.note}
                chosen={draft.period === option.value}
                onClick={() => setDraft(current => ({ ...current, period: option.value }))}
              />
            ))}
          </Section>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-gray-200 bg-white px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => setDraft({ ...EMPTY_BOOKING_FILTERS, sort: draft.sort })}
          disabled={active === 0}
          className="shrink-0 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-600 transition active:bg-gray-100 disabled:text-gray-300"
        >
          Сбросить
        </button>
        <Button
          variant="primary"
          onClick={() => { setBookingFilters(draft); onNavigate('/bookings'); }}
          className="h-11 min-w-0 flex-1 justify-center"
        >
          Применить{active > 0 ? ` · ${active}` : ''}
        </Button>
      </div>
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl bg-white">
      <div className="px-4 pb-1 pt-3">
        <p className="text-sm font-semibold text-gray-950">{title}</p>
        {note && <p className="mt-0.5 text-xs text-gray-500">{note}</p>}
      </div>
      <ul className="divide-y divide-gray-100 border-t border-gray-100">{children}</ul>
    </section>
  );
}

function Row({
  label,
  note,
  chosen,
  onClick,
}: {
  label: string;
  note?: string;
  chosen: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition active:bg-gray-50"
      >
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-sm ${chosen ? 'font-medium text-gray-950' : 'text-gray-800'}`}>
            {label}
          </span>
          {note && <span className="mt-0.5 block truncate text-xs text-gray-500">{note}</span>}
        </span>
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
            chosen ? 'border-blue-600' : 'border-gray-300'
          }`}
        >
          {chosen && <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />}
        </span>
      </button>
    </li>
  );
}
