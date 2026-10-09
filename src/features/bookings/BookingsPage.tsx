import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CalendarCheck,
  CalendarDays,
  ChevronsUpDown,
  ExternalLink,
  Info,
  MoreHorizontal,
  Package,
  Phone,
  Ban,
  ScanLine,
  Search,
  SlidersHorizontal,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { CopyValue } from '../../components/ui/CopyValue';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { SegmentedTabs } from '../../components/ui/SegmentedTabs';
import { useToast } from '../../components/ui/Toast';
import { Pagination } from '../../components/table/TableControls';
import { ApiError, bookingsApi, mediaUrl } from '../../lib/api-client';
import { PHONE, useMediaQuery } from '../../lib/useMediaQuery';
import type { BookingListItem, Pagination as PageInfo } from '../../types';
import { bookingStatusMeta, dayBounds, fulfillmentStageMeta, formatWindow, requestClock } from './bookingMeta';
import { countActive, filtersToRsql, useBookingFilters } from './bookingFilters';
import { BookingCard, BookingCardSkeleton, type BookingAction } from './BookingCard';
import { HandoverForm } from './HandoverForm';
import { ReturnForm } from './ReturnForm';
import { IssueReportForm } from './IssueReportForm';
import { DeclineForm } from './DeclineForm';
import { CancelForm } from './CancelForm';
import { BookingProductDialog } from './BookingProductPanel';

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

/** Each slice is either a filter on the list or an endpoint of its own; both take the same query. */
function fetchSlice(slice: Slice | undefined, query: { filter?: string; sort?: string; page: number; pageSize: number }) {
  return slice?.endpoint === 'active' ? bookingsApi.active(query) : bookingsApi.list(query);
}

const SHEET_TITLES: Record<BookingAction, string> = {
  confirm: 'Подтвердить заявку',
  handover: 'Выдача',
  return: 'Возврат',
  issue: 'Сообщить о проблеме',
  decline: 'Отклонить заявку',
  cancel: 'Отменить бронь',
};

/**
 * Заказы — the one list of work.
 *
 * There used to be a separate «Выдача» screen reading /sellers/{id}/fulfillment. That endpoint read
 * a table only the first handover writes, so it answered `[]` to every call ever made to it, and
 * was removed on 2026-10-01. Handover and return happen here, on rows that already carry the
 * product and the customer.
 *
 * Built the way the catalogue is: on a phone, a white bar that stays put with the search in it,
 * shortcuts and the slice as bands across the screen, cards edge to edge, and the next page
 * fetched as the list runs out. The desktop keeps its table of rows with paging.
 */
export function BookingsPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [bookings, setBookings] = useState<BookingListItem[]>([]);
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);
  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [pendingTab, setPendingTab] = useState('all');
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [menuOpen, setMenuOpen] = useState(false);
  const [cardMenu, setCardMenu] = useState<BookingListItem | null>(null);
  const [acting, setActing] = useState<{ booking: BookingListItem; action: BookingAction } | null>(null);
  const [peek, setPeek] = useState<BookingListItem | null>(null);

  const phone = useMediaQuery(PHONE);
  const chosen = useBookingFilters();
  const toast = useToast();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Everything being asked for except the slice, so the same terms can be counted against each.
  const extraFilter = useMemo(() => {
    const parts = [...filtersToRsql(chosen)];
    if (debouncedQuery) parts.push(`booking_number=contains="${debouncedQuery}"`);
    return parts.join(';');
  }, [chosen, debouncedQuery]);

  const filter = useMemo(() => {
    const slice = SLICES.find(item => item.value === tab);
    return [slice?.filter?.(), extraFilter].filter(Boolean).join(';');
  }, [tab, extraFilter]);

  useEffect(() => { setPage(1); }, [tab, extraFilter, pageSize, chosen.sort]);

  useEffect(() => {
    let cancelled = false;
    const append = phone && page > 1;
    if (append) setLoadingMore(true); else setLoading(true);
    setError('');
    const slice = SLICES.find(item => item.value === tab);
    fetchSlice(slice, { filter: filter || undefined, sort: chosen.sort, page, pageSize })
      .then(result => {
        if (cancelled) return;
        const next = result.items ?? [];
        // By id rather than by concatenation: a booking confirmed from this list moves between
        // slices, and the same row arriving twice would render twice.
        setBookings(current => {
          if (!append) return next;
          const seen = new Set(current.map(item => item.bookingId));
          return [...current, ...next.filter(item => !seen.has(item.bookingId))];
        });
        setPageInfo(result.pagination ?? null);
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Не удалось загрузить заказы.');
      })
      .finally(() => { if (!cancelled) { setLoading(false); setLoadingMore(false); } });
    return () => { cancelled = true; };
  }, [tab, filter, chosen.sort, page, pageSize, phone, reloadKey]);

  const refresh = useCallback(() => { setPage(1); setReloadKey(key => key + 1); }, []);

  /** The end of the list, as a thing to notice. */
  const sentinelRef = useRef<HTMLDivElement>(null);
  const hasMore = Boolean(pageInfo && pageInfo.page < pageInfo.totalPages);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!phone || !node || !hasMore || loading || loadingMore) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) setPage(current => current + 1);
    }, { rootMargin: '400px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [phone, hasMore, loading, loadingMore, bookings.length]);

  /**
   * How many bookings are in each slice.
   *
   * No counts endpoint exists, so each slice is asked for one row and only its `total_items` is
   * read — eight small requests, made when the sheet opens rather than on every visit, and a
   * slice whose request fails shows no number instead of a wrong one.
   */
  useEffect(() => {
    if (!sheetOpen) return;
    let cancelled = false;
    void Promise.all(SLICES.map(slice => {
      const query = {
        filter: [slice.filter?.(), extraFilter].filter(Boolean).join(';') || undefined,
        page: 1,
        pageSize: 1,
      };
      return fetchSlice(slice, query)
        .then(result => [slice.value, result.pagination?.totalItems ?? null] as const)
        .catch(() => [slice.value, null] as const);
    })).then(entries => {
      if (cancelled) return;
      setCounts(Object.fromEntries(entries.filter((entry): entry is readonly [string, number] => entry[1] != null)));
    });
    return () => { cancelled = true; };
  }, [sheetOpen, extraFilter]);

  const confirm = async (booking: BookingListItem) => {
    setBusy(booking.bookingId);
    try {
      await bookingsApi.confirm(booking.bookingId);
      // Confirming opens the payment window; it does not complete the booking.
      toast.show('Заявка подтверждена — ждём оплату от клиента.', 'success');
      refresh();
    } catch (err) {
      toast.show(err instanceof ApiError
        ? err.code === 'booking.not_awaiting_confirmation'
          ? 'Заявку уже обработали. Обновите список.'
          : err.message
        : 'Не удалось подтвердить заявку.');
    } finally {
      setBusy(null);
    }
  };

  const act = (booking: BookingListItem, action: BookingAction) => {
    if (action === 'confirm') { void confirm(booking); return; }
    setActing({ booking, action });
  };

  const slice = SLICES.find(item => item.value === tab) ?? SLICES[0];
  const totalForTab = counts[tab] ?? pageInfo?.totalItems ?? null;
  const activeFilters = countActive(chosen);

  const searchField = (
    <div className="relative min-w-0 flex-1">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        value={query}
        onChange={event => setQuery(event.target.value)}
        placeholder="Номер бронирования"
        inputMode="search"
        className="h-10 w-full rounded-xl bg-gray-100 pl-9 pr-3 text-base text-gray-900 outline-none transition placeholder:text-gray-500 md:h-9 md:rounded-lg md:border md:border-gray-300 md:bg-white md:text-sm md:focus:border-blue-500 md:focus:ring-2 md:focus:ring-blue-500/15"
      />
    </div>
  );

  const done = (message: string) => {
    setActing(null);
    toast.show(message, 'success');
    refresh();
  };

  return (
    <>
      {/* One wrapper: a sticky element sticks only as far as its parent goes. */}
      <div>
        <div className="sticky top-0 z-20 rounded-b-2xl bg-white px-4 pb-3 pt-4 before:pointer-events-none before:absolute before:inset-x-0 before:bottom-full before:h-screen before:bg-white md:hidden">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-xl font-semibold text-gray-950">Заказы</h1>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Ещё"
              className="-mr-2 shrink-0 rounded-lg p-2 text-gray-600 transition active:bg-gray-100"
            >
              <MoreHorizontal size={20} strokeWidth={2.5} />
            </button>
          </div>
          <div className="mt-3 flex items-center gap-1">
            {searchField}
            <button
              type="button"
              onClick={() => onNavigate('/bookings/filters')}
              aria-label="Фильтры"
              className="relative -mr-2 shrink-0 rounded-lg p-2 text-gray-600 transition active:bg-gray-100"
            >
              <SlidersHorizontal size={20} />
              {activeFilters > 0 && (
                <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-semibold text-white">
                  {activeFilters}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* The bottom of the same white block: where else this screen goes. */}
        <div className="-mt-4 rounded-b-2xl bg-white pb-2.5 pt-4 md:hidden">
          <div className="flex gap-2 overflow-x-auto px-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <FeatureTile icon={CalendarDays} label="Календарь" onClick={() => onNavigate('/bookings/calendar')} />
            <FeatureTile icon={ScanLine} label="Сканер" onClick={() => onNavigate('/scan')} />
          </div>
        </div>

        {/* Then the slice, its own band across the screen, touching the list it filters. */}
        <div className="mt-2 md:hidden">
          <button
            type="button"
            onClick={() => { setPendingTab(tab); setSheetOpen(true); }}
            className="flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3 text-left transition active:bg-gray-50"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-gray-900">{slice.label}</span>
              <span className="mt-0.5 block text-xs text-gray-500">Выберите статус заказов</span>
            </span>
            {totalForTab != null && <Count value={totalForTab} />}
            <ChevronsUpDown size={16} className="shrink-0 text-gray-400" />
          </button>
        </div>

        {/* The desktop keeps its heading, its strip of slices and the calendar beside them. */}
        <div className="hidden px-6 pt-6 md:block">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-gray-950">Заказы</h1>
              {pageInfo && <p className="mt-1 text-sm text-gray-500">{pageInfo.totalItems} всего</p>}
            </div>
            <Button variant="secondary" onClick={() => onNavigate('/bookings/calendar')}>
              <CalendarDays size={15} /> Календарь
            </Button>
          </div>

          <div className="mt-4 space-y-3">
            <SegmentedTabs
              items={SLICES.map(item => ({ value: item.value, label: item.label }))}
              value={tab}
              onChange={setTab}
            />
            <div className="flex items-center gap-2">
              {searchField}
              <Button variant="secondary" onClick={() => onNavigate('/bookings/filters')}>
                <SlidersHorizontal size={15} /> Фильтры{activeFilters > 0 ? ` · ${activeFilters}` : ''}
              </Button>
            </div>
          </div>
        </div>

        {error && (
          <p className="mx-3 mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 md:mx-6">
            {error}
          </p>
        )}

        <div className="pb-6 pt-2 md:px-6 md:pt-3">
          {/* Phones get cards edge to edge; the desktop keeps rows in a framed table. */}
          <ul className="space-y-1 md:hidden">
            {loading && Array.from({ length: 4 }, (_, row) => <BookingCardSkeleton key={row} />)}
            {!loading && bookings.length === 0 && <Empty tab={tab} />}
            {!loading && bookings.map(booking => (
              <BookingCard
                key={booking.bookingId}
                booking={booking}
                busy={busy === booking.bookingId}
                onOpen={() => onNavigate(`/bookings/${booking.bookingId}`)}
                onMenu={() => setCardMenu(booking)}
                onAction={action => act(booking, action)}
              />
            ))}
            {loadingMore && Array.from({ length: 2 }, (_, row) => <BookingCardSkeleton key={`more-${row}`} />)}
          </ul>

          <div ref={sentinelRef} aria-hidden="true" className="h-1 md:hidden" />
          {!loading && !hasMore && bookings.length > 0 && (
            <p className="py-4 text-center text-xs text-gray-400 md:hidden">Это всё</p>
          )}

          <div className="hidden md:block">
            {loading && (
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                <SkeletonRows rows={4} />
              </div>
            )}
            {!loading && bookings.length === 0 && <Empty tab={tab} />}
            {!loading && bookings.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                <ul className="divide-y divide-gray-100">
                  {bookings.map(booking => (
                    <BookingRow
                      key={booking.bookingId}
                      booking={booking}
                      busy={busy === booking.bookingId}
                      onOpen={() => onNavigate(`/bookings/${booking.bookingId}`)}
                      onPeek={() => setPeek(booking)}
                      onAction={action => act(booking, action)}
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
        </div>
      </div>

      {/* What the whole list can do. */}
      <BottomSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title="Ещё"
        center
        footer={
          <Button variant="secondary" className="w-full justify-center" onClick={() => setMenuOpen(false)}>
            Закрыть
          </Button>
        }
      >
        <ul className="divide-y divide-gray-100 border-y border-gray-100">
          <MenuRow
            icon={ScanLine}
            title="Сканер пропуска"
            note="Прочитать QR клиента и открыть его бронирование."
            onClick={() => { setMenuOpen(false); onNavigate('/scan'); }}
          />
          <MenuRow
            icon={CalendarDays}
            title="Календарь"
            note="Месяц целиком: что происходит в какой день."
            onClick={() => { setMenuOpen(false); onNavigate('/bookings/calendar'); }}
          />
        </ul>
      </BottomSheet>

      {/* What can be done to one booking. */}
      <BottomSheet
        open={cardMenu !== null}
        onClose={() => setCardMenu(null)}
        title={cardMenu ? `№${cardMenu.bookingNumber}` : ''}
        center
        footer={
          <Button variant="secondary" className="w-full justify-center" onClick={() => setCardMenu(null)}>
            Закрыть
          </Button>
        }
      >
        {cardMenu && (
          <ul className="divide-y divide-gray-100 border-y border-gray-100">
            <MenuRow
              icon={ExternalLink}
              title="Открыть бронирование"
              note="Клиент, окно аренды, выдача и возврат."
              onClick={() => { const row = cardMenu; setCardMenu(null); onNavigate(`/bookings/${row.bookingId}`); }}
            />
            <MenuRow
              icon={Package}
              title="Что входит"
              note="Состав комплекта и залог по карточке товара."
              onClick={() => { setPeek(cardMenu); setCardMenu(null); }}
            />
            {cardMenu.status === 'awaiting_seller_confirmation' && (
              <MenuRow
                icon={XCircle}
                title="Отклонить заявку"
                note="Снаряжение освободится, клиент получит уведомление."
                onClick={() => { const row = cardMenu; setCardMenu(null); setActing({ booking: row, action: 'decline' }); }}
              />
            )}
            {cardMenu.status !== 'cancelled' && cardMenu.status !== 'expired' && cardMenu.status !== 'failed'
              && cardMenu.status !== 'awaiting_seller_confirmation' && (
              <MenuRow
                icon={AlertCircle}
                title="Сообщить о проблеме"
                note="Поломка, опоздание, спор — зафиксировать по этой брони."
                onClick={() => { const row = cardMenu; setCardMenu(null); setActing({ booking: row, action: 'issue' }); }}
              />
            )}
            {/* Declining answers a request; this undoes a booking that was paid for. Offered while
                it is still live — which includes a rental already handed over, because that is
                exactly when gear breaks. */}
            {(cardMenu.status === 'pending' || cardMenu.status === 'confirmed') && (
              <MenuRow
                icon={Ban}
                title="Отменить бронь"
                note="Если выдать не получится. Клиенту вернётся вся сумма."
                onClick={() => { const row = cardMenu; setCardMenu(null); setActing({ booking: row, action: 'cancel' }); }}
              />
            )}
          </ul>
        )}
      </BottomSheet>

      {/* The slice, chosen and then applied. */}
      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Статус заказов"
        center
        footer={
          <Button
            variant="primary"
            className="w-full justify-center"
            onClick={() => { setTab(pendingTab); setSheetOpen(false); }}
          >
            Применить
          </Button>
        }
      >
        <ul className="divide-y divide-gray-100 border-y border-gray-100">
          {SLICES.map(item => {
            const picked = item.value === pendingTab;
            return (
              <li key={item.value}>
                <button
                  type="button"
                  onClick={() => setPendingTab(item.value)}
                  className="flex w-full items-center gap-3 px-5 py-2.5 text-left transition active:bg-gray-50"
                >
                  <span className={`min-w-0 flex-1 text-sm ${picked ? 'font-medium text-gray-950' : 'text-gray-800'}`}>
                    {item.label}
                  </span>
                  {counts[item.value] != null && <Count value={counts[item.value]} />}
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
                      picked ? 'border-blue-600' : 'border-gray-300'
                    }`}
                  >
                    {picked && <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </BottomSheet>

      {/* Handover, return, decline and issue: one sheet, the form inside it. Each is a command
          with its own fields, and none of them is worth losing your place in the list for. */}
      <BottomSheet
        open={acting !== null}
        onClose={() => setActing(null)}
        title={acting ? SHEET_TITLES[acting.action] : ''}
        center
      >
        {acting && (
          <>
            <p className="px-5 pb-2 text-xs text-gray-500">
              №{acting.booking.bookingNumber} · {acting.booking.product.title}
            </p>
            {acting.action === 'handover' && (
              <HandoverForm bookingId={acting.booking.bookingId} onSuccess={() => done('Выдача записана.')} onCancel={() => setActing(null)} />
            )}
            {acting.action === 'return' && (
              <ReturnForm bookingId={acting.booking.bookingId} onSuccess={() => done('Возврат принят — аренда завершена.')} onCancel={() => setActing(null)} />
            )}
            {acting.action === 'issue' && (
              <IssueReportForm bookingId={acting.booking.bookingId} onSuccess={() => done('Обращение отправлено.')} onCancel={() => setActing(null)} />
            )}
            {acting.action === 'decline' && (
              <DeclineForm bookingId={acting.booking.bookingId} onSuccess={() => done('Заявка отклонена.')} onCancel={() => setActing(null)} />
            )}
            {acting.action === 'cancel' && (
              <CancelForm bookingId={acting.booking.bookingId} onSuccess={() => done('Бронь отменена, клиенту вернутся деньги.')} onCancel={() => setActing(null)} />
            )}
          </>
        )}
      </BottomSheet>

      {peek && (
        <BookingProductDialog
          open
          productId={peek.product.productId}
          productTitle={peek.product.title}
          onClose={() => setPeek(null)}
          onOpenProduct={() => onNavigate(`/products/${peek.product.productId}`)}
        />
      )}

      {toast.node}
    </>
  );
}

function Empty({ tab }: { tab: string }) {
  return (
    <Card>
      <div className="py-8 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
          <CalendarCheck size={22} />
        </span>
        <p className="mt-3 text-sm text-gray-600">
          {tab === 'all' ? 'Бронирований пока нет.' : 'В этой выборке пусто.'}
        </p>
      </div>
    </Card>
  );
}

/** A count beside a label: grey, pill-shaped, never competing with the label it belongs to. */
function Count({ value }: { value: number }) {
  return (
    <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium tabular-nums text-gray-600">
      {value}
    </span>
  );
}

function FeatureTile({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-[5.5rem] w-[5.5rem] shrink-0 flex-col items-center justify-center gap-2 rounded-2xl bg-gray-50 px-2 text-center transition active:bg-gray-100"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
        <Icon size={22} />
      </span>
      <span className="text-[11px] font-medium leading-tight text-gray-800">{label}</span>
    </button>
  );
}

function MenuRow({
  icon: Icon,
  title,
  note,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  note: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 px-5 py-3 text-left transition active:bg-gray-50"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
          <Icon size={19} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-gray-950">{title}</span>
          <span className="mt-0.5 block text-xs leading-4 text-gray-500">{note}</span>
        </span>
      </button>
    </li>
  );
}

/** The desktop row: everything across one line, with the moves that are open at its end. */
function BookingRow({
  booking,
  busy,
  onOpen,
  onPeek,
  onAction,
}: {
  booking: BookingListItem;
  busy: boolean;
  onOpen: () => void;
  onPeek: () => void;
  onAction: (action: BookingAction) => void;
}) {
  const status = bookingStatusMeta(booking.status);
  const fulfillment = booking.fulfillment;
  const stage = fulfillmentStageMeta(fulfillment?.stage);
  const awaiting = booking.status === 'awaiting_seller_confirmation';
  const closed = booking.status === 'cancelled' || booking.status === 'expired' || booking.status === 'failed';
  const clock = awaiting ? requestClock(booking.createdAt) : null;

  return (
    <li
      onClick={onOpen}
      className="flex cursor-pointer flex-wrap items-start gap-3 px-4 py-3 transition hover:bg-blue-50/40"
    >
      {booking.product.mediaPreviewUrl ? (
        <img
          src={mediaUrl(booking.product.mediaPreviewUrl)}
          alt=""
          className="h-12 w-12 shrink-0 rounded-lg border border-gray-200 object-cover"
        />
      ) : (
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-300">
          <CalendarCheck size={16} />
        </span>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-gray-900">{booking.product.title}</span>
          {/* What is in the kit, without losing your place in the list. */}
          <button
            type="button"
            onClick={event => { event.stopPropagation(); onPeek(); }}
            aria-label={`Что входит — ${booking.product.title}`}
            className="rounded-lg p-0.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
          >
            <Info size={14} />
          </button>
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
          {clock && (
            <span className={clock.urgent ? 'font-medium text-red-600' : 'font-medium text-amber-700'}>
              {clock.label}
            </span>
          )}
          {booking.customer?.phone && (
            <CopyValue value={booking.customer.phone} label="Телефон клиента" icon={<Phone size={11} />} />
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2" onClick={event => event.stopPropagation()}>
        {awaiting && (
          <>
            <Button size="sm" variant="primary" loading={busy} onClick={() => onAction('confirm')}>Подтвердить</Button>
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
