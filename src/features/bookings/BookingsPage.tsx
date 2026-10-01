import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CalendarCheck, ChevronLeft, ImageOff, Phone } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { SectionPage } from '../../components/layout/SectionPage';
import { SegmentedTabs } from '../../components/ui/SegmentedTabs';
import { Pagination } from '../../components/table/TableControls';
import { ApiError, bookingsApi, mediaUrl } from '../../lib/api-client';
import type { BookingListItem, FulfillmentStage, Pagination as PageInfo } from '../../types';
import { HandoverForm } from './HandoverForm';
import { ReturnForm } from './ReturnForm';
import { CompleteForm } from './CompleteForm';
import { IssueReportForm } from './IssueReportForm';
import { DeclineForm } from './DeclineForm';

/**
 * The tabs the endpoint defines. `all` already excludes cancelled, expired and failed — the seller
 * wants work, not an archive — and the numbers need not sum, because a booking can sit on more
 * than one of these at once.
 */
const TABS = [
  { value: 'all', label: 'Все' },
  { value: 'awaiting_confirmation', label: 'Ждут подтверждения' },
  { value: 'awaiting_payment', label: 'Ждут оплаты' },
  { value: 'upcoming', label: 'Предстоящие' },
  { value: 'handover_today', label: 'Выдача сегодня' },
  { value: 'return_today', label: 'Возврат сегодня' },
  { value: 'active', label: 'На руках' },
  { value: 'completed', label: 'Завершённые' },
  { value: 'cancelled', label: 'Отменённые' },
];

const STATUS_META: Record<string, { label: string; variant: 'green' | 'yellow' | 'blue' | 'gray' | 'red' | 'teal' }> = {
  awaiting_seller_confirmation: { label: 'Ждёт подтверждения', variant: 'yellow' },
  pending: { label: 'Ждёт оплаты', variant: 'yellow' },
  confirmed: { label: 'Оплачено', variant: 'green' },
  completed: { label: 'Завершено', variant: 'gray' },
  cancelled: { label: 'Отменено', variant: 'red' },
  expired: { label: 'Истекло', variant: 'gray' },
  reversed: { label: 'Возврат платежа', variant: 'red' },
  failed: { label: 'Оплата не прошла', variant: 'red' },
};

const STAGE_META: Record<FulfillmentStage, { label: string; variant: 'yellow' | 'blue' | 'teal' | 'green' | 'red' }> = {
  pending_handover: { label: 'Ожидает выдачи', variant: 'yellow' },
  active: { label: 'На руках', variant: 'blue' },
  returned: { label: 'Возвращено', variant: 'teal' },
  completed: { label: 'Выдача закрыта', variant: 'green' },
  issue_reported: { label: 'Есть обращение', variant: 'red' },
};

type Action = 'handover' | 'return' | 'complete' | 'issue' | 'decline';

/**
 * Заказы — the one list of work.
 *
 * There used to be a separate «Выдача» screen reading /sellers/{id}/fulfillment. That endpoint read
 * a table only the first handover writes, so it answered `[]` to every call ever made to it, and
 * was removed on 2026-10-01. Handover and return are tabs here, on rows that already carry the
 * product and the customer.
 */
export function BookingsPage() {
  const [bookings, setBookings] = useState<BookingListItem[]>([]);
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [tab, setTab] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [acting, setActing] = useState<{ booking: BookingListItem; action: Action } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await bookingsApi.list({ tab, page, pageSize });
      setBookings(result.items ?? []);
      setPageInfo(result.pagination ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить заказы.');
    } finally {
      setLoading(false);
    }
  }, [tab, page, pageSize]);

  const loadCounts = useCallback(async () => {
    await bookingsApi.tabCounts()
      .then(result => setCounts(result.counts ?? {}))
      .catch(() => { /* the tabs work without their numbers */ });
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadCounts(); }, [loadCounts]);
  useEffect(() => { setPage(1); }, [tab, pageSize]);

  const refresh = useCallback(() => {
    void load();
    void loadCounts();
  }, [load, loadCounts]);

  const say = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 4000);
  };

  const confirm = async (booking: BookingListItem) => {
    setBusy(booking.bookingId);
    setError('');
    try {
      await bookingsApi.confirm(booking.bookingId);
      // Confirming opens the payment window; it does not complete the booking.
      say('Заявка подтверждена — ждём оплату от клиента.');
      refresh();
    } catch (err) {
      setError(err instanceof ApiError
        ? err.code === 'booking.not_awaiting_confirmation'
          ? 'Заявку уже обработали. Обновите список.'
          : err.message
        : 'Не удалось подтвердить заявку.');
    } finally {
      setBusy(null);
    }
  };

  const tabItems = useMemo(
    () => TABS.map(item => ({ ...item, count: counts[item.value] })),
    [counts]
  );

  if (acting) {
    const { booking, action } = acting;
    const done = (message: string) => () => {
      setActing(null);
      say(message);
      refresh();
    };
    return (
      <SectionPage title={`Бронирование ${booking.bookingNumber}`} error={error}>
        <button
          type="button"
          onClick={() => setActing(null)}
          className="mb-4 flex items-center gap-1.5 text-sm text-gray-500 transition hover:text-gray-900"
        >
          <ChevronLeft size={14} /> Назад к заказам
        </button>
        <div className="max-w-2xl">
          <p className="mb-4 text-sm text-gray-500">
            {booking.customer?.fullName ?? 'Клиент'} · {booking.product.title}
          </p>
          {action === 'handover' && <HandoverForm bookingId={booking.bookingId} onSuccess={done('Выдача записана.')} onCancel={() => setActing(null)} />}
          {action === 'return' && <ReturnForm bookingId={booking.bookingId} onSuccess={done('Возврат записан.')} onCancel={() => setActing(null)} />}
          {action === 'complete' && <CompleteForm bookingId={booking.bookingId} onSuccess={done('Бронирование завершено.')} onCancel={() => setActing(null)} />}
          {action === 'issue' && <IssueReportForm bookingId={booking.bookingId} onSuccess={done('Обращение отправлено.')} onCancel={() => setActing(null)} />}
          {action === 'decline' && <DeclineForm bookingId={booking.bookingId} onSuccess={done('Заявка отклонена.')} onCancel={() => setActing(null)} />}
        </div>
      </SectionPage>
    );
  }

  return (
    <SectionPage
      title="Заказы"
      description={pageInfo ? `${pageInfo.totalItems} всего` : undefined}
      error={error}
    >
      <div className="space-y-3">
        <SegmentedTabs items={tabItems} value={tab} onChange={setTab} />

        {notice && (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">{notice}</p>
        )}

        {loading && <Card><p className="text-sm text-gray-500">Загружаем заказы…</p></Card>}

        {!loading && bookings.length === 0 && (
          <Card>
            <div className="py-8 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                <CalendarCheck size={22} />
              </span>
              <p className="mt-3 text-sm text-gray-600">
                {tab === 'all' ? 'Бронирований пока нет.' : 'В этой вкладке пусто.'}
              </p>
            </div>
          </Card>
        )}

        {!loading && bookings.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <ul className="divide-y divide-gray-100">
              {bookings.map(booking => (
                <BookingRow
                  key={booking.bookingId}
                  booking={booking}
                  busy={busy === booking.bookingId}
                  onConfirm={() => void confirm(booking)}
                  onAction={action => setActing({ booking, action })}
                />
              ))}
            </ul>
            {pageInfo && (
              <Pagination
                page={pageInfo.page}
                totalPages={pageInfo.totalPages}
                totalItems={pageInfo.totalItems}
                pageSize={pageInfo.pageSize}
                onPage={setPage}
                onPageSize={setPageSize}
              />
            )}
          </div>
        )}
      </div>
    </SectionPage>
  );
}

function formatWindow(startAt: string, endAt: string) {
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (Number.isNaN(start.getTime())) return '—';
  const sameDay = start.toDateString() === end.toDateString();
  const day = (date: Date) => date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  const time = (date: Date) => date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return sameDay
    ? `${day(start)}, ${time(start)} — ${time(end)}`
    : `${day(start)}, ${time(start)} — ${day(end)}, ${time(end)}`;
}

function BookingRow({
  booking,
  busy,
  onConfirm,
  onAction,
}: {
  booking: BookingListItem;
  busy: boolean;
  onConfirm: () => void;
  onAction: (action: Action) => void;
}) {
  const status = STATUS_META[booking.status] ?? { label: booking.status, variant: 'gray' as const };
  const fulfillment = booking.fulfillment;
  const stage = fulfillment ? STAGE_META[fulfillment.stage] : null;
  const awaiting = booking.status === 'awaiting_seller_confirmation';
  const closed = booking.status === 'cancelled' || booking.status === 'expired' || booking.status === 'failed';

  return (
    <li className="flex flex-wrap items-start gap-3 px-4 py-3">
      {booking.product.mediaPreviewUrl ? (
        <img
          src={mediaUrl(booking.product.mediaPreviewUrl)}
          alt=""
          className="h-12 w-12 shrink-0 rounded-lg border border-gray-200 object-cover"
        />
      ) : (
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-300">
          <ImageOff size={16} />
        </span>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-gray-900">{booking.product.title}</span>
          <Badge variant={status.variant}>{status.label}</Badge>
          {stage && !closed && <Badge variant={stage.variant}>{stage.label}</Badge>}
          {fulfillment?.hasIssue && <Badge variant="red">обращение</Badge>}
        </div>
        <p className="mt-0.5 text-xs text-gray-500">
          №{booking.bookingNumber} · {formatWindow(booking.startAt, booking.endAt)}
          {booking.quantity > 1 ? ` · ${booking.quantity} шт.` : ''}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-gray-600">
          <span>{booking.customer?.fullName ?? 'Клиент'}</span>
          {booking.customer?.phone && (
            <a href={`tel:${booking.customer.phone}`} className="inline-flex items-center gap-1 font-medium text-blue-700 hover:underline">
              <Phone size={11} /> {booking.customer.phone}
            </a>
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {awaiting && (
          <>
            <Button size="sm" variant="primary" loading={busy} onClick={onConfirm}>Подтвердить</Button>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => onAction('decline')}>Отклонить</Button>
          </>
        )}
        {/* The API decides which moves are open; the row only renders its answer. */}
        {fulfillment?.handoverAllowed && (
          <Button size="sm" variant="primary" onClick={() => onAction('handover')}>Выдать</Button>
        )}
        {fulfillment?.returnAllowed && (
          <Button size="sm" variant="secondary" onClick={() => onAction('return')}>Принять возврат</Button>
        )}
        {fulfillment?.completionAllowed && (
          <Button size="sm" variant="primary" onClick={() => onAction('complete')}>Завершить</Button>
        )}
        {!closed && !awaiting && (
          <Button size="sm" variant="ghost" aria-label="Сообщить о проблеме" onClick={() => onAction('issue')}>
            <AlertCircle size={14} />
          </Button>
        )}
      </div>
    </li>
  );
}
