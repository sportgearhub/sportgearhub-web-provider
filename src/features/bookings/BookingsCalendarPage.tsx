import { BookingsCalendar } from './BookingsCalendar';

/**
 * The month, on its own screen.
 *
 * It used to be the other half of a toggle at the top of the list. A list answers «что мне
 * сделать» and a month answers «что происходит во вторник» — two questions, and on a phone the
 * second is a place you go rather than a tab you lose the first to.
 */
export function BookingsCalendarPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <div className="px-3 pb-8 pt-3 sm:px-6">
      <BookingsCalendar onOpen={bookingId => onNavigate(`/bookings/${bookingId}`)} />
    </div>
  );
}
