import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';
import { Skeleton } from '../../components/ui/Skeleton';
import { ApiError, bookingsApi, financeApi } from '../../lib/api-client';
import { PHONE, useMediaQuery } from '../../lib/useMediaQuery';
import type { AccrualLine, Pagination as PageInfo } from '../../types';
import { accrualState, isoDate, money, shortDate } from './financeFormat';

/** The ranges a seller asks about, as RSQL on `created_at`. */
const RANGES = [
  { value: 7, label: '7 дней' },
  { value: 30, label: '30 дней' },
  { value: 90, label: '90 дней' },
] as const;

/**
 * Every accrual, over any range.
 *
 * A statement cannot take a date range — its totals come from a checkpoint — but its lines can, and
 * this is them. There are no totals here for the same reason from the other side: an opening
 * balance is a recorded fact of a closed week, and computing one for an arbitrary range would mean
 * recomputing a balance from history. Totals over a range come from the periods on Финансы.
 *
 * `state` here is as of now, where a statement's is as of that week's close. A line can read
 * «удерживается» in a statement for ever and «выплачено» here, and both are correct.
 */
export function AccrualsPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [items, setItems] = useState<AccrualLine[]>([]);
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);
  const [days, setDays] = useState<number>(30);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const phone = useMediaQuery(PHONE);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const toast = useToast();

  const openBooking = async (key: string, bookingNumber: string) => {
    setOpening(key);
    try {
      const found = await bookingsApi.list({ filter: `booking_number=="${bookingNumber}"`, pageSize: 1 });
      const booking = found.items?.[0];
      if (booking) onNavigate(`/bookings/${booking.bookingId}`);
      else toast.show('Бронирование не найдено — возможно, оно архивировано.');
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : 'Не удалось открыть бронирование.');
    } finally {
      setOpening(null);
    }
  };

  const filter = useMemo(() => {
    const from = new Date();
    from.setDate(from.getDate() - (days - 1));
    return `created_at=ge=${isoDate(from)}`;
  }, [days]);

  useEffect(() => { setPage(1); }, [filter]);

  useEffect(() => {
    let cancelled = false;
    const append = page > 1;
    if (append) setLoadingMore(true); else setLoading(true);
    setError('');
    financeApi.accruals({ filter, sort: '-created_at', page, pageSize: 20 })
      .then(result => {
        if (cancelled) return;
        const next = result.items ?? [];
        setItems(current => {
          if (!append) return next;
          const seen = new Set(current.map(item => item.bookingNumber));
          return [...current, ...next.filter(item => !seen.has(item.bookingNumber))];
        });
        setPageInfo(result.pagination ?? null);
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Не удалось загрузить начисления.');
      })
      .finally(() => { if (!cancelled) { setLoading(false); setLoadingMore(false); } });
    return () => { cancelled = true; };
  }, [filter, page]);

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
  }, [phone, hasMore, loading, loadingMore, items.length]);

  return (
    <div className="pb-8">
      {/* `top-0`, because the bar above this screen is drawn outside the scrolling area — at
          `top-14` the list scrolled through a 56-pixel band above this one and the first row read
          as cut off. The hairline is so rows passing under it look covered rather than clipped. */}
      <div className="sticky top-0 z-10 flex gap-1 border-b border-gray-200/70 bg-gray-50 px-3 py-3 sm:px-6">
        {RANGES.map(range => (
          <button
            key={range.value}
            type="button"
            onClick={() => setDays(range.value)}
            className={`rounded-xl px-3 py-1.5 text-sm font-medium transition ${
              days === range.value ? 'bg-gray-900 text-white' : 'bg-white text-gray-700'
            }`}
          >
            {range.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="mx-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 sm:mx-6">
          {error}
        </p>
      )}

      <ul className="space-y-1 px-0 sm:px-6">
        {loading && Array.from({ length: 5 }, (_, row) => (
          <li key={row} className="bg-white p-3 sm:rounded-xl">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="mt-2 h-3 w-1/3" />
          </li>
        ))}

        {!loading && items.length === 0 && (
          <li className="bg-white px-4 py-12 text-center text-sm text-gray-600 sm:rounded-xl">
            За выбранный период начислений нет.
          </li>
        )}

        {!loading && items.map(line => {
          const state = accrualState(line.state);
          const key = `${line.bookingNumber}-${line.accruedAt ?? ''}`;
          const open = openKey === key;
          return (
            <li key={key} className="bg-white sm:rounded-xl">
              {/* The row says what was earned; opening it says how that number was arrived at,
                  which is three subtractions nobody should have to do in their head. */}
              <button
                type="button"
                onClick={() => setOpenKey(open ? null : key)}
                aria-expanded={open}
                className="w-full p-3 text-left transition active:bg-gray-50"
              >
                <span className="flex items-start gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-sm font-medium leading-5 text-gray-900">
                      {line.productTitle}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-gray-500">
                      №{line.bookingNumber} · {shortDate(line.rentalStartAt)}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-semibold text-gray-950">{money(line.sellerAmount)}</span>
                    <span className="mt-0.5 block text-[11px] text-gray-400">из {money(line.grossAmount)}</span>
                  </span>
                  <ChevronDown
                    size={16}
                    className={`mt-0.5 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
                  />
                </span>
                <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Badge variant={state.variant} size="xs" tone="strong" shape="square">{state.label}</Badge>
                  {/* Held with no release date means the gear has not been collected yet. */}
                  {line.state === 'held' && (
                    <span className="text-xs text-gray-500">
                      {line.releasesAt ? `до ${shortDate(line.releasesAt)}` : 'после аренды'}
                    </span>
                  )}
                  {line.paidAt && <span className="text-xs text-gray-500">выплачено {shortDate(line.paidAt)}</span>}
                  {line.refundedAmount > 0 && (
                    <span className="text-xs text-gray-500">возврат {money(line.refundedAmount)}</span>
                  )}
                </span>
              </button>

              {open && (
                <div className="px-3 pb-3">
                  <dl className="rounded-xl bg-gray-50 p-3 text-sm">
                    <Row label="Клиент заплатил" value={money(line.grossAmount)} />
                    <Row label="Комиссия площадки" value={money(-line.commissionAmount)} />
                    {line.refundedAmount > 0 && <Row label="Возвращено клиенту" value={money(-line.refundedAmount)} />}
                    <Row label="Вам" value={money(line.sellerAmount)} strong />
                    <Row label="Аренда" value={`${shortDate(line.rentalStartAt)} — ${shortDate(line.rentalEndAt)}`} />
                    {line.accruedAt && <Row label="Начислено" value={shortDate(line.accruedAt) ?? '—'} />}
                    <Row
                      label={line.paidAt ? 'Выплачено' : 'Освободится'}
                      value={
                        line.paidAt
                          ? shortDate(line.paidAt) ?? '—'
                          : line.releasesAt ? shortDate(line.releasesAt) ?? '—' : 'после аренды'
                      }
                    />
                  </dl>

                  {/* The accrual carries the booking's number but not its id, so the booking is
                      found the way the scanner finds one — by the number the customer can show. */}
                  <button
                    type="button"
                    disabled={opening === key}
                    onClick={() => void openBooking(key, line.bookingNumber)}
                    className="mt-2 flex w-full items-center gap-2 rounded-xl bg-gray-50 px-3 py-2.5 text-sm text-gray-900 transition active:bg-gray-100 disabled:opacity-60"
                  >
                    <span className="min-w-0 flex-1 text-left">
                      {opening === key ? 'Ищем бронирование…' : 'Открыть бронирование'}
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-gray-400" />
                  </button>
                </div>
              )}
            </li>
          );
        })}

        {loadingMore && Array.from({ length: 2 }, (_, row) => (
          <li key={`more-${row}`} className="bg-white p-3 sm:rounded-xl">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="mt-2 h-3 w-1/3" />
          </li>
        ))}
      </ul>

      <div ref={sentinelRef} aria-hidden="true" className="h-1" />
      {toast.node}
      {!loading && !hasMore && items.length > 0 && (
        <p className="py-4 text-center text-xs text-gray-400">Это всё</p>
      )}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center gap-3 border-b border-gray-200/70 py-1.5 last:border-b-0">
      <dt className="min-w-0 flex-1 text-gray-500">{label}</dt>
      <dd className={strong ? 'shrink-0 font-semibold text-gray-950' : 'shrink-0 text-gray-900'}>{value}</dd>
    </div>
  );
}
