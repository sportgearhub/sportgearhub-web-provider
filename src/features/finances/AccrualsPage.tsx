import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import { ApiError, financeApi } from '../../lib/api-client';
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
export function AccrualsPage() {
  const [items, setItems] = useState<AccrualLine[]>([]);
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);
  const [days, setDays] = useState<number>(30);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const phone = useMediaQuery(PHONE);

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
      <div className="sticky top-14 z-10 flex gap-1 bg-gray-50 px-3 py-3 sm:px-6">
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
          return (
            <li key={`${line.bookingNumber}-${line.accruedAt ?? ''}`} className="bg-white p-3 sm:rounded-xl">
              <div className="flex items-start gap-3">
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
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
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
              </div>
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
      {!loading && !hasMore && items.length > 0 && (
        <p className="py-4 text-center text-xs text-gray-400">Это всё</p>
      )}
    </div>
  );
}
