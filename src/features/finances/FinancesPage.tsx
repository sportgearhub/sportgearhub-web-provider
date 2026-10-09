import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, CreditCard, Receipt, Wallet } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import { ApiError, financeApi, providerApi } from '../../lib/api-client';
import type { BalanceFees, BalancePeriodsPage, BalanceSummary, PayoutDetails } from '../../types';
import { costName, costSource, holdReason, isoDate, money, percent, shortDate } from './financeFormat';

/** The ranges a seller asks about. Both ends are inclusive and the API defaults to thirty days. */
const RANGES = [
  { value: 7, label: '7 дней' },
  { value: 30, label: '30 дней' },
  { value: 90, label: '90 дней' },
] as const;

function rangeFrom(days: number) {
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  return { dateFrom: isoDate(from), dateTo: isoDate(new Date()) };
}

/**
 * Финансы — what is owed, what has moved, and where the customer's money went.
 *
 * Three rules from the finance spec are load-bearing here and worth not undoing:
 *
 * `available_amount` is a promise — the next run sends exactly that, computed by the rule the
 * payout uses — so it is rendered as given and never re-derived from the held list.
 *
 * The platform's costs come out of *our* commission. The seller pays none of them, and their
 * `seller_amount` is unaffected by every one, so they are nested inside the commission as an
 * explanation of it rather than listed as deductions.
 *
 * And an accrual leaves within half an hour of clearing, so «доступно» is usually zero and
 * short-lived. What a seller wants at the top is what is still held and when it frees up.
 */
export function FinancesPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [balance, setBalance] = useState<BalanceSummary | null>(null);
  const [periods, setPeriods] = useState<BalancePeriodsPage | null>(null);
  const [fees, setFees] = useState<BalanceFees | null>(null);
  const [payout, setPayout] = useState<PayoutDetails | null>(null);
  const [days, setDays] = useState<number>(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [costsOpen, setCostsOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    financeApi.balance()
      .then(next => { if (!cancelled) setBalance(next); })
      .catch(err => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Не удалось загрузить баланс.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    providerApi.payout()
      .then(next => { if (!cancelled) setPayout(next); })
      .catch(() => { /* the card below says the requisites are missing */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const range = rangeFrom(days);
    void Promise.all([
      financeApi.periods({ ...range, page: 1, pageSize: 12 }).catch(() => null),
      financeApi.fees(range).catch(() => null),
    ]).then(([nextPeriods, nextFees]) => {
      if (cancelled) return;
      setPeriods(nextPeriods);
      setFees(nextFees);
    });
    return () => { cancelled = true; };
  }, [days]);

  /** Where money actually goes, in one line. */
  const destination = useMemo(() => {
    if (!payout?.hasDetails) return null;
    if (payout.method === 'sbp') return payout.phone ? `СБП · ${payout.phone}` : 'СБП';
    const tail = payout.account ? `•••• ${payout.account.slice(-4)}` : null;
    return [payout.bankName, tail].filter(Boolean).join(' · ') || 'Расчётный счёт';
  }, [payout]);

  const commission = fees?.platformCommission;

  return (
    /* A phone reads this as one column of bands. A desktop puts the money on the left and the
       standing facts — where it goes, when the next one leaves — in a rail beside it, which is
       what the references do and what stops a wide screen rendering one narrow column of cards. */
    <div className="pb-10 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-4">
      {/* Two real columns rather than `display: contents` on a phone: a box that is not rendered
          cannot carry the gaps between its children, so `space-y` landed on nothing and every
          section ran into the next one. */}
      <div className="space-y-2 sm:space-y-4">
      {error && (
        <p className="mx-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 sm:mx-0">
          {error}
        </p>
      )}

      {/* What is still the seller's and not yet sent. The big number is the held amount, because
          «доступно» empties within half an hour of an accrual clearing and would read as zero. */}
      <section className="bg-white px-4 py-4 sm:rounded-2xl">
        {loading ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <Wallet size={19} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-medium uppercase tracking-wide text-gray-500">
                  Удерживается
                </span>
                <span className="block text-2xl font-semibold text-gray-950">
                  {money(balance?.heldAmount ?? 0)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => onNavigate('/settings/payouts')}
                className="shrink-0 rounded-xl bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition active:bg-blue-100"
              >
                Управлять
              </button>
            </div>

            <p className="mt-1 text-xs text-gray-500">
              {balance?.nextReleaseAt
                ? `Ближайшее освобождение ${shortDate(balance.nextReleaseAt)}`
                : 'Освобождается через сутки после аренды'}
            </p>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <Figure
                label="К выплате"
                value={money(balance?.availableAmount ?? 0)}
                hint="Уйдёт следующим переводом"
              />
              <Figure label="Выплачено" value={money(balance?.paidOutAmount ?? 0)} hint="За всё время" />
            </div>
          </>
        )}
      </section>

      {/* Why each hold exists. A balance that says only «held» earns a support ticket per booking. */}
      {balance && balance.held.length > 0 && (
        <section className="bg-white px-4 py-4 sm:rounded-2xl">
          <h2 className="text-base font-semibold text-gray-950">Удержания</h2>
          <ul className="mt-2 divide-y divide-gray-100">
            {balance.held.map(hold => (
              <li key={hold.bookingNumber} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-gray-900">№{hold.bookingNumber}</span>
                  <span className="mt-0.5 block text-xs text-gray-500">
                    {holdReason(hold.reason)}
                    {/* `releases_at` is null when the gear has not been collected: there is nothing
                        to count from, which is information rather than a missing date. */}
                    {' · '}
                    {hold.releasesAt ? `до ${shortDate(hold.releasesAt)}` : 'после аренды'}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold text-gray-950">{money(hold.sellerAmount)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* The range applies to both sections below it. */}
      <section className="bg-white px-4 py-4 sm:rounded-2xl">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-gray-950">Движение средств</h2>
          <div className="flex shrink-0 gap-1">
            {RANGES.map(range => (
              <button
                key={range.value}
                type="button"
                onClick={() => setDays(range.value)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  days === range.value ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>

        {periods ? (
          <>
            {/* The identity is meant to be checkable on screen: начало + начислено + выплачено =
                конец, with выплачено negative. The two movements are the figures; the two states
                are the box under them, which is the shape the references use. */}
            <div className="mt-3 rounded-2xl border border-gray-200 p-3">
              <div className="grid grid-cols-2 gap-2">
                <Figure label="Начислено" value={money(periods.totals.accruedAmount)} />
                <Figure label="Выплачено" value={money(periods.totals.paidAmount)} />
              </div>
              <div className="mt-2 flex items-end justify-between gap-3 px-1">
                <span>
                  <span className="block text-xs text-gray-500">На конец периода</span>
                  <span className="block text-xl font-semibold text-gray-950">
                    {money(periods.totals.endAmount)}
                  </span>
                </span>
                <span className="pb-1 text-xs text-gray-400">
                  было {money(periods.totals.startAmount)}
                </span>
              </div>
            </div>

            {periods.items.length > 0 && (
              <ul className="mt-3 space-y-2">
                {periods.items.map(period => (
                  <li key={period.end}>
                    <button
                      type="button"
                      onClick={() => onNavigate(`/finances/statements/${period.end.slice(0, 10)}`)}
                      className="flex w-full items-center gap-3 rounded-xl bg-gray-50 px-3 py-2.5 text-left transition active:bg-gray-100"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-gray-900">
                          {shortDate(period.begin)} — {shortDate(period.end)}
                        </span>
                        <span className="mt-0.5 block text-xs text-gray-500">
                          Начислено {money(period.accruedAmount)} · выплачено {money(period.paidAmount)}
                        </span>
                      </span>
                      <ChevronRight size={16} className="shrink-0 text-gray-400" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <button
              type="button"
              onClick={() => onNavigate('/finances/accruals')}
              className="mt-3 flex w-full items-center gap-2 rounded-xl bg-gray-50 px-3 py-2.5 text-sm text-gray-900 transition active:bg-gray-100"
            >
              <Receipt size={16} className="shrink-0 text-gray-400" />
              <span className="min-w-0 flex-1 text-left">Детализация начислений</span>
              <ChevronRight size={16} className="shrink-0 text-gray-400" />
            </button>
          </>
        ) : (
          <Skeleton className="mt-3 h-24 w-full" />
        )}
      </section>

      {/* Where the customer's money went: a list that opens, rather than a figure and a sheet.
          The platform's own costs are the rows inside the commission — nested, because they come
          out of it and the seller pays none of them. */}
      <section className="bg-white px-4 py-4 sm:rounded-2xl">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-gray-950">Комиссия платформы</h2>

        </div>

        {fees && commission ? (
          <>
            <dl className="mt-3 divide-y divide-gray-100 text-sm">
              <Line label="Клиенты заплатили" value={money(fees.grossAmount)} />
              <Line
                label="Ваша выручка"
                value={money(fees.sellerAmount)}
                share={percent(fees.sellerPercent)}
                strong
              />

              <div className="py-2.5">
                <button
                  type="button"
                  onClick={() => setCostsOpen(open => !open)}
                  aria-expanded={costsOpen}
                  className="flex w-full items-center gap-3 text-left"
                >
                  <ChevronDown
                    size={16}
                    className={`shrink-0 text-gray-400 transition-transform ${costsOpen ? '' : '-rotate-90'}`}
                  />
                  <span className="min-w-0 flex-1 text-gray-700">Комиссия площадки</span>
                  <span className="shrink-0 text-right">
                    <span className="block text-gray-900">{money(commission.amount)}</span>
                    <span className="block text-[11px] text-gray-400">{percent(commission.percent)}</span>
                  </span>
                </button>

                {costsOpen && (
                  <div className="ml-2 mt-1 border-l-2 border-gray-100 pl-4">
                    {/* Inside the commission, never beside the seller's revenue: these come out of
                        the platform's share and the seller's amount is unaffected by every one.
                        The nesting is what says so — the paragraph that used to say it in words
                        was noise on a screen whose figures already read correctly. */}
                    <p className="pb-1 pt-0.5 text-xs text-gray-500">В том числе:</p>
                    <dl className="divide-y divide-gray-100 text-sm">
                      {commission.platformCosts.map(cost => {
                        const source = costSource(cost.source);
                        return (
                          <div key={cost.sysName} className="flex items-center gap-2 py-2">
                            <dt className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-gray-700">
                              {costName(cost.sysName)}
                              <Badge
                                variant={cost.source === 'register' ? 'green' : cost.source === 'tariff' ? 'blue' : 'orange'}
                                size="xs"
                                tone="strong"
                                shape="square"
                              >
                                {source.label}
                              </Badge>
                            </dt>
                            <dd className="shrink-0 text-right">
                              <span className="block text-gray-900">{money(cost.amount)}</span>
                              <span className="block text-[11px] text-gray-400">{percent(cost.percent)}</span>
                            </dd>
                          </div>
                        );
                      })}
                      {/* `net_amount` — what is left of the commission once the platform has paid
                          those — is not here. It is the platform's own margin, not the seller's
                          business, and on a small hire it is negative, which turns a screen about
                          the seller's money into a screen about ours. The costs explain where the
                          commission goes; the remainder explains nothing the seller asked. */}
                    </dl>
                  </div>
                )}
              </div>
            </dl>

            {/* The figures above are the whole period; the bookings behind them are a page. */}
            <button
              type="button"
              onClick={() => onNavigate('/finances/accruals')}
              className="mt-2 flex w-full items-center gap-2 rounded-xl bg-gray-50 px-3 py-2.5 text-sm text-gray-900 transition active:bg-gray-100"
            >
              <span className="min-w-0 flex-1 text-left">Детализация начислений</span>
              <ChevronRight size={16} className="shrink-0 text-gray-400" />
            </button>
          </>
        ) : (
          <Skeleton className="mt-3 h-20 w-full" />
        )}
      </section>

      </div>

      {/* The rail. On a phone these simply follow the rest. */}
      <div className="mt-2 space-y-2 sm:mt-4 sm:space-y-4 lg:mt-0">
      {/* The requisites, which are a console concern rather than a finance one. */}
      <section className="bg-white px-4 py-4 sm:rounded-2xl">
        <h2 className="text-base font-semibold text-gray-950">Реквизиты выплат</h2>
        <button
          type="button"
          onClick={() => onNavigate('/settings/payouts')}
          className="mt-3 flex w-full items-center gap-3 rounded-xl bg-gray-50 px-3 py-3 text-left transition active:bg-gray-100"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-gray-500">
            <CreditCard size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-gray-950">
              {destination ?? 'Реквизиты не заполнены'}
            </span>
            <span className="block text-xs text-gray-500">
              {destination
                ? payout?.registered ? 'Подключено к эквайрингу' : 'Ожидает подключения к эквайрингу'
                : 'Без них платформа не сможет перевести деньги'}
            </span>
          </span>
          <ChevronRight size={16} className="shrink-0 text-gray-400" />
        </button>
      </section>

      {/* The lines behind every figure on this screen, from the rail as well as from the
          breakdown — it is the same page and the seller may be looking at either. */}
      <section className="hidden bg-white px-4 py-4 lg:block lg:rounded-2xl">
        <button
          type="button"
          onClick={() => onNavigate('/finances/accruals')}
          className="flex w-full items-center gap-2 rounded-xl bg-gray-50 px-3 py-2.5 text-sm text-gray-900 transition hover:bg-gray-100"
        >
          <Receipt size={16} className="shrink-0 text-gray-400" />
          <span className="min-w-0 flex-1 text-left">Детализация начислений</span>
          <ChevronRight size={16} className="shrink-0 text-gray-400" />
        </button>
      </section>
      </div>
    </div>
  );
}

function Figure({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-gray-50 px-3 py-2.5">
      <p className="text-xs leading-4 text-gray-500">{label}</p>
      <p className="mt-0.5 text-base font-semibold text-gray-950">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] leading-4 text-gray-400">{hint}</p>}
    </div>
  );
}

function Line({
  label,
  value,
  share,
  strong,
}: {
  label: string;
  value: string;
  /** The same figure as a share of what the customer paid, under the amount. */
  share?: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <dt className="min-w-0 flex-1 text-gray-500">{label}</dt>
      <dd className="shrink-0 text-right">
        <span className={strong ? 'block font-semibold text-gray-950' : 'block text-gray-900'}>{value}</span>
        {share && <span className="block text-[11px] text-gray-400">{share}</span>}
      </dd>
    </div>
  );
}
