import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { SectionPage } from '../../components/layout/SectionPage';
import { Button } from '../../components/ui/Button';
import { SkeletonDetail } from '../../components/ui/Skeleton';
import { ApiError, bookingsApi } from '../../lib/api-client';
import { useGoBack } from '../../lib/useGoBack';
import type { BookingDetail } from '../../types';
import { IssueReportForm } from './IssueReportForm';

/**
 * Reporting a problem with one booking, on its own screen.
 *
 * It used to be a sheet behind the three dots, which is where a thing goes when it is rare. This
 * one is not rare and it is not quick: gear comes back broken, a client is two hours late, there
 * is an argument about a scratch — and it gets written down with the client still at the counter.
 * A screen has room for the severity to be read before it is picked, and for the booking it is
 * about to stay visible while somebody types.
 */
export function BookingIssuePage({ bookingId, onNavigate }: { bookingId: string; onNavigate: (path: string) => void }) {
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const goBack = useGoBack(`/bookings/${bookingId}`);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    bookingsApi.get(bookingId)
      .then(next => { if (!cancelled) setBooking(next); })
      .catch(err => {
        if (!cancelled) {
          setError(err instanceof ApiError
            ? err.status === 404 ? 'Бронирование не найдено.' : err.message
            : 'Не удалось загрузить бронирование.');
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [bookingId]);

  return (
    <SectionPage
      title="Сообщить о проблеме"
      description={booking ? `Бронирование №${booking.bookingNumber}` : undefined}
      breadcrumb={{ label: 'Бронирование', path: `/bookings/${bookingId}` }}
      onNavigate={onNavigate}
      error={error}
      bare
    >
      {loading ? (
        <div className="px-3 sm:px-0"><SkeletonDetail rows={3} /></div>
      ) : !booking ? (
        <div className="px-3 sm:px-0">
          <Button variant="secondary" onClick={() => onNavigate('/bookings')}>К заказам</Button>
        </div>
      ) : (
        <div className="space-y-2 sm:space-y-4">
          {/* What the report is about, so nobody describes the wrong booking. */}
          <section className="flex items-start gap-3 rounded-2xl bg-white px-4 py-3.5 sm:rounded-xl sm:border sm:border-gray-200 sm:px-5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <AlertTriangle size={17} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-950">{booking.product.title}</p>
              <p className="mt-0.5 text-xs text-gray-500">
                №{booking.bookingNumber}
                {booking.customer?.fullName ? ` · ${booking.customer.fullName}` : ''}
              </p>
            </div>
          </section>

          <section className="rounded-2xl bg-white py-4 sm:rounded-xl sm:border sm:border-gray-200">
            <IssueReportForm
              bookingId={bookingId}
              onSuccess={() => onNavigate(`/bookings/${bookingId}`)}
              onCancel={goBack}
            />
          </section>

          <p className="px-4 pb-1 text-xs leading-5 text-gray-500 sm:px-0">
            Обращение привязывается к этой брони — площадка видит его вместе с оплатой, выдачей и
            возвратом, поэтому номер брони называть не нужно.
          </p>
        </div>
      )}
    </SectionPage>
  );
}
