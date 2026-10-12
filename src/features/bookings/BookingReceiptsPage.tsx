import { useEffect, useState } from 'react';
import { ExternalLink, Receipt } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { CopyValue } from '../../components/ui/CopyValue';
import { SectionPage } from '../../components/layout/SectionPage';
import { SkeletonDetail } from '../../components/ui/Skeleton';
import { ApiError, bookingsApi } from '../../lib/api-client';
import type { BookingDetail, FiscalReceipt } from '../../types';

/**
 * The fiscal receipts of one booking, on their own screen.
 *
 * They used to sit among the sections of the booking itself, between what to hand over and who is
 * coming for it. Nobody reads a receipt across a counter: it is wanted later, when a customer asks
 * for proof or an accountant asks what was rung up. So the booking links here instead, and here
 * there is room to show the fiscal numbers that make a receipt findable at the OFD.
 */
export function BookingReceiptsPage({ bookingId, onNavigate }: { bookingId: string; onNavigate: (path: string) => void }) {
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    bookingsApi.get(bookingId)
      .then(next => { if (!cancelled) setBooking(next); })
      .catch(err => {
        if (!cancelled) {
          setError(err instanceof ApiError
            ? err.status === 404 ? 'Бронирование не найдено.' : err.message
            : 'Не удалось загрузить чеки.');
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [bookingId]);

  return (
    <SectionPage
      title="Чеки"
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
      ) : booking.receipts.length === 0 ? (
        <p className="rounded-2xl bg-white px-4 py-6 text-center text-sm text-gray-500 sm:rounded-xl sm:border sm:border-gray-200">
          По этой брони чеков пока нет. Чек появляется после оплаты клиентом или после возврата.
        </p>
      ) : (
        <div className="space-y-2 sm:space-y-3">
          {booking.receipts.map(receipt => <ReceiptCard key={receipt.receiptId} receipt={receipt} />)}
          {/* Who issued them, said once at the bottom rather than on every card: the seller is
              not the one fiscalising these, and that is the first question the numbers raise. */}
          <p className="px-4 pt-1 text-xs leading-5 text-gray-500 sm:px-0">
            Чеки пробивает площадка — она принимает оплату от клиента. Фискальные данные нужны, чтобы
            найти чек у оператора фискальных данных.
          </p>
        </div>
      )}
    </SectionPage>
  );
}

function ReceiptCard({ receipt }: { receipt: FiscalReceipt }) {
  const refund = receipt.operation === 'refund';
  const completed = receipt.status === 'completed';

  return (
    <article className="rounded-2xl bg-white p-4 sm:rounded-xl sm:border sm:border-gray-200">
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          refund ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'
        }`}>
          <Receipt size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-medium text-gray-950">{refund ? 'Возврат' : 'Оплата'}</span>
            <Badge variant={completed ? 'green' : 'gray'} size="xs" shape="square">
              {completed ? 'Пробит' : receipt.status}
            </Badge>
          </p>
          <p className="mt-0.5 text-lg font-semibold leading-6 text-gray-950">
            {refund ? '−' : ''}{receipt.total.toLocaleString('ru-RU')} ₽
          </p>
          <p className="mt-0.5 text-xs text-gray-500">{formatMoment(receipt.completedAt ?? receipt.createdAt)}</p>
        </div>
      </div>

      {(receipt.fiscalDocumentNumber || receipt.fiscalSign) && (
        <dl className="mt-3 space-y-1.5 border-t border-gray-100 pt-3 text-xs">
          {receipt.fiscalDocumentNumber && (
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <dt className="text-gray-500">Фискальный документ</dt>
              <dd><CopyValue value={receipt.fiscalDocumentNumber} label="номер документа" className="text-xs" /></dd>
            </div>
          )}
          {receipt.fiscalSign && (
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <dt className="text-gray-500">Фискальный признак</dt>
              <dd><CopyValue value={receipt.fiscalSign} label="фискальный признак" className="text-xs" /></dd>
            </div>
          )}
        </dl>
      )}

      {receipt.ofdReceiptUrl && (
        <a
          href={receipt.ofdReceiptUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-gray-50 py-2.5 text-sm font-medium text-blue-700 transition hover:bg-gray-100"
        >
          <ExternalLink size={14} /> Открыть чек
        </a>
      )}
    </article>
  );
}

function formatMoment(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}
