import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CalendarCheck, ChevronLeft, ImageOff, Phone, Search } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { SectionPage } from '../../components/layout/SectionPage';
import { SegmentedTabs } from '../../components/ui/SegmentedTabs';
import { Pagination } from '../../components/table/TableControls';
import { ApiError, bookingsApi, mediaUrl } from '../../lib/api-client';
import type { BookingListItem, Pagination as PageInfo } from '../../types';
import { bookingStatusMeta, dayBounds, fulfillmentStageMeta, formatWindow } from './bookingMeta';
import { CopyValue } from '../../components/ui/CopyValue';
import { HandoverForm } from './HandoverForm';
import { ReturnForm } from './ReturnForm';
import { IssueReportForm } from './IssueReportForm';
import { DeclineForm } from './DeclineForm';
import { BookingsCalendar } from './BookingsCalendar';

/**
 * The slices of the list.
 *
 * `tab` was removed on 2026-10-04 (api 16c62db). Everything that asks about the booking's own
 * columns is a filter — including a day's handovers, where the console supplies the bounds — and
 * the one question a filter cannot reach, what is out on hire right now, kept an endpoint, because
 * it reads the fulfillment row rather than a column.
 */
type Slice = { value: string; label: string; filter?: () => string; endpoint?: 'active' };

const SLICES: Slice[] = [
  { value: 'all', label: 'Все', filter: () => 'status=out=(cancelled,expired,failed)' },
  { value: 'awaiting_confirmation', label: 'Ждут подтверждения', filter: () => 'status==awaiting_seller_confirmation' },
  { value: 'awaiting_payment', label: 'Ждут оплаты', filter: () => 'status==pending' },
  { value: 'handover_today', label: 'Выдача сегодня', filter: () => {
    const { from, to } = dayBounds();
    return `status==confirmed;start_at=ge=${from};start_at=lt=${to}`;
  } },
  { value: 'return_today', label: 'Возврат сегодня', filter: () => {
    const { from, to } = dayBounds();
    return `end_at=ge=${from};end_at=lt=${to}`;
  } },
  { value: 'active', label: 'На руках', endpoint: 'active' },
  { value: 'completed', label: 'Завершённые', filter: () => 'status==completed' },
  { value: 'cancelled', label: 'Отменённые', filter: () => 'status=in=(cancelled,expired,failed)' },
];

type Action = 'handover' | 'return' | 'issue' | 'decline';

/**
 * Заказы — the one list of work.
 *
 * There used to be a separate «Выдача» screen reading /sellers/{id}/fulfillment. That endpoint read
 * a table only the first handover writes, so it answered `[]` to every call ever made to it, and
 * was removed on 2026-10-01. Handover and return are tabs here, on rows that already carry the
 * product and the customer.
 */
export function BookingsPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [bookings, setBookings] = useState<BookingListItem[]>([]);
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);
  const [tab, setTab] = useState('all');
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [acting, setActing] = useState<{ booking: BookingListItem; action: Action } | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const slice = SLICES.find(item => item.value === tab);
      const parts = [slice?.filter?.(), debouncedQuery ? `booking_number=contains="${debouncedQuery}"` : '']
        .filter(Boolean);
      const request = { filter: parts.join(';') || undefined, page, pageSize };
      const result = slice?.endpoint === 'active'
        ? await bookingsApi.active(request)
        : await bookingsApi.list(request);
      setBookings(result.items ?? []);
      setPageInfo(result.pagination ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить заказы.');
    } finally {
      setLoading(false);
    }
  }, [tab, page, pageSize, debouncedQuery]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPage(1); }, [tab, pageSize, debouncedQuery]);

  const refresh = useCallback(() => { void load(); }, [load]);

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

  const tabItems = useMemo(() => SLICES.map(item => ({ value: item.value, label: item.label })), []);

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
          {action === 'return' && <ReturnForm bookingId={booking.bookingId} onSuccess={done('Возврат принят — аренда завершена.')} onCancel={() => setActing(null)} />}
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
        {/* The same bookings, asked about differently: a list answers «что мне сделать», a month
            answers «что происходит во вторник». */}
        <SegmentedTabs
          className="inline-flex"
          items={[{ value: 'list', label: 'Список' }, { value: 'calendar', label: 'Календарь' }]}
          value={view}
          onChange={setView}
        />

        {view === 'calendar' && <BookingsCalendar onOpen={bookingId => onNavigate(`/bookings/${bookingId}`)} />}

        {view === 'list' && <>
        <SegmentedTabs items={tabItems} value={tab} onChange={setTab} />

        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Номер бронирования"
            inputMode="search"
            className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-base outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 sm:h-9 sm:text-sm"
          />
        </div>

        {notice && (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">{notice}</p>
        )}

        {loading && (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <SkeletonRows rows={4} />
          </div>
        )}

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
          <div className="overflow-hidden md:rounded-xl md:border md:border-gray-200 md:bg-white">
            <ul className="space-y-2 md:space-y-0 md:divide-y md:divide-gray-100">
              {bookings.map(booking => (
                <BookingRow
                  key={booking.bookingId}
                  booking={booking}
                  busy={busy === booking.bookingId}
                  onOpen={() => onNavigate(`/bookings/${booking.bookingId}`)}
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
        </>}
      </div>
    </SectionPage>
  );
}

function BookingRow({
  booking,
  busy,
  onOpen,
  onConfirm,
  onAction,
}: {
  booking: BookingListItem;
  busy: boolean;
  onOpen: () => void;
  onConfirm: () => void;
  onAction: (action: Action) => void;
}) {
  const status = bookingStatusMeta(booking.status);
  const fulfillment = booking.fulfillment;
  const stage = fulfillmentStageMeta(fulfillment?.stage);
  const awaiting = booking.status === 'awaiting_seller_confirmation';
  const closed = booking.status === 'cancelled' || booking.status === 'expired' || booking.status === 'failed';

  return (
    <li
      onClick={onOpen}
      className="cursor-pointer rounded-xl bg-white p-3 transition hover:bg-blue-50/40 md:flex md:flex-wrap md:items-start md:gap-3 md:rounded-none md:px-4 md:py-3"
    >
      <span className="mb-2 flex flex-wrap items-center gap-1.5 md:hidden">
        <Badge variant={status.variant}>{status.label}</Badge>
        {stage && !closed && <Badge variant={stage.variant}>{stage.label}</Badge>}
        {fulfillment?.hasIssue && <Badge variant="red">обращение</Badge>}
      </span>
      <span className="flex items-start gap-3 md:contents">
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
          <span className="hidden flex-wrap items-center gap-2 md:flex">
            <Badge variant={status.variant}>{status.label}</Badge>
            {stage && !closed && <Badge variant={stage.variant}>{stage.label}</Badge>}
            {fulfillment?.hasIssue && <Badge variant="red">обращение</Badge>}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-gray-500">
          №{booking.bookingNumber} · {formatWindow(booking.startAt, booking.endAt)}
          {booking.quantity > 1 ? ` · ${booking.quantity} шт.` : ''}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-gray-600">
          <span>{booking.customer?.fullName ?? 'Клиент'}</span>
          {booking.customer?.phone && (
            <CopyValue value={booking.customer.phone} label="Телефон клиента" icon={<Phone size={11} />} />
          )}
        </p>
      </div>

      </span>

      <div className="mt-2.5 flex flex-wrap items-center gap-2 md:mt-0" onClick={event => event.stopPropagation()}>
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
        {!closed && !awaiting && (
          <Button size="sm" variant="ghost" aria-label="Сообщить о проблеме" onClick={() => onAction('issue')}>
            <AlertCircle size={14} />
          </Button>
        )}
      </div>
    </li>
  );
}
