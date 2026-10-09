import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import { ApiError, financeApi } from '../../lib/api-client';
import type { AccrualTypeInfo, SellerStatement } from '../../types';
import { accrualState, money, shortDate } from './financeFormat';

/**
 * One closed week, as a document.
 *
 * Its totals are read from the closed period rather than summed from the lines, which is why
 * `linesAccruedAmount` is a separate figure: a difference means something was accrued whose
 * booking is not in this period, and that is worth saying rather than rounding away.
 *
 * Each line's `state` is **as it stood when the week closed**, not as it stands now — a statement
 * for last week that describes today is not a statement.
 */
export function StatementPage({ periodEnd, onNavigate }: { periodEnd: string; onNavigate: (path: string) => void }) {
  const [statement, setStatement] = useState<SellerStatement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [types, setTypes] = useState<AccrualTypeInfo[]>([]);

  useEffect(() => {
    let cancelled = false;
    financeApi.accrualTypes()
      .then(next => { if (!cancelled) setTypes(next); })
      .catch(() => { /* an unknown type still renders, as itself */ });
    return () => { cancelled = true; };
  }, []);

  const typeTitle = (sysName?: string) =>
    (sysName ? types.find(item => item.sysName === sysName)?.title ?? sysName : null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    financeApi.statement(periodEnd)
      .then(next => { if (!cancelled) setStatement(next); })
      .catch(err => {
        if (!cancelled) {
          setError(err instanceof ApiError && err.status === 404
            ? 'За эту неделю выписки нет.'
            : err instanceof ApiError ? err.message : 'Не удалось загрузить выписку.');
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [periodEnd]);

  const mismatch = statement && Math.abs(statement.linesAccruedAmount - statement.accruedAmount) > 0.005;

  return (
    <div className="space-y-2 pb-8 sm:space-y-4 sm:px-6">
      {error && (
        <p className="mx-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 sm:mx-0">
          {error}
        </p>
      )}

      {loading && <Skeleton className="mx-3 h-32 sm:mx-0" />}

      {statement && (
        <>
          <section className="bg-white px-4 py-4 sm:rounded-2xl">
            <p className="text-sm text-gray-500">
              {shortDate(statement.periodBegin)} — {shortDate(statement.periodEnd)}
            </p>
            {/* The arithmetic is meant to be checkable: начало + начислено + выплачено = конец,
                with выплачено negative. Held sits beside it rather than inside. */}
            <dl className="mt-2 divide-y divide-gray-100 text-sm">
              <Line label="На начало" value={money(statement.startAmount)} />
              <Line label="Начислено" value={money(statement.accruedAmount)} />
              <Line label="Выплачено" value={money(statement.paidAmount)} />
              <Line label="На конец" value={money(statement.endAmount)} strong />
              {statement.heldAmount !== 0 && (
                <Line label="Из них удерживалось" value={money(statement.heldAmount)} />
              )}
            </dl>

            {mismatch && (
              <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                Сумма по броням ({money(statement.linesAccruedAmount)}) отличается от начисленного за
                период. Напишите нам — это стоит проверить.
              </p>
            )}
          </section>

          <section className="bg-white px-4 py-4 sm:rounded-2xl">
            <h2 className="text-base font-semibold text-gray-950">Брони за неделю</h2>
            {statement.lines.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500">За эту неделю начислений не было.</p>
            ) : (
              <ul className="mt-2 divide-y divide-gray-100">
                {statement.lines.map(line => {
                  const state = accrualState(line.state);
                  // A booking can have more than one line here — the rental and the refund that
                  // reversed part of it — so the key is the pair, not the number.
                  const key = `${line.bookingNumber}-${line.accrualType ?? ''}`;
                  const open = openKey === key;
                  return (
                    <li key={key}>
                      <button
                        type="button"
                        onClick={() => setOpenKey(open ? null : key)}
                        aria-expanded={open}
                        className="w-full py-3 text-left"
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
                            <span className="block text-sm font-semibold text-gray-950">
                              {money(line.sellerAmount)}
                            </span>
                            <span className="mt-0.5 block text-[11px] text-gray-400">
                              из {money(line.grossAmount)}
                            </span>
                          </span>
                          <ChevronDown
                            size={16}
                            className={`mt-0.5 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
                          />
                        </span>
                        <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {/* A refunded booking is a line of its own rather than an edit of the
                              rental's — a week that has closed goes on agreeing with the rows it
                              was computed from. */}
                          {line.accrualType && line.accrualType !== 'rental' && (
                            <Badge variant="gray" size="xs" tone="strong" shape="square">
                              {typeTitle(line.accrualType)}
                            </Badge>
                          )}
                          <Badge variant={state.variant} size="xs" tone="strong" shape="square">
                            {state.label}
                          </Badge>
                          {/* A cancelled booking stays in the statement with nothing owed: the seller
                              saw that booking, and a line that silently vanishes reads as money lost. */}
                          {line.refundedAmount > 0 && (
                            <span className="text-xs text-gray-500">вернули {money(line.refundedAmount)}</span>
                          )}
                        </span>
                      </button>

                      {open && (
                        <dl className="mb-3 rounded-xl bg-gray-50 p-3 text-sm">
                          <Row label="Клиент заплатил" value={money(line.grossAmount)} />
                          <Row label="Комиссия площадки" value={money(-line.commissionAmount)} />
                          {line.refundedAmount > 0 && (
                            <Row label="Возвращено клиенту" value={money(line.refundedAmount)} />
                          )}
                          <Row label="Вам" value={money(line.sellerAmount)} strong />
                          <Row
                            label="Аренда"
                            value={`${shortDate(line.rentalStartAt)} — ${shortDate(line.rentalEndAt)}`}
                          />
                          {/* As of the week's close, not as of now — that is what a statement is. */}
                          <Row label="Статус на конец недели" value={state.label} />
                        </dl>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <button
            type="button"
            onClick={() => onNavigate('/finances/accruals')}
            className="mx-3 text-sm font-medium text-blue-700 sm:mx-0"
          >
            Начисления за любой период →
          </button>
        </>
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

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <dt className="min-w-0 flex-1 text-gray-500">{label}</dt>
      <dd className={strong ? 'shrink-0 font-semibold text-gray-950' : 'shrink-0 text-gray-900'}>{value}</dd>
    </div>
  );
}
