import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, CreditCard, Info, Receipt, Wallet } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
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
    <div className="space-y-2 pb-8 sm:space-y-4 sm:px-6">
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
          <h2 className="text-base font-semibold text-gray-950">Что удерживается</h2>
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
          <h2 className="text-base font-semibold text-gray-950">Движение</h2>
          <div className="flex shrink-0 gap-1 rounded-xl bg-gray-100 p-1">
            {RANGES.map(range => (
              <button
                key={range.value}
                type="button"
                onClick={() => setDays(range.value)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  days === range.value ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-600'
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
                конец, with выплачено negative. Held sits beside the sum, not inside it. */}
            <dl className="mt-3 divide-y divide-gray-100 text-sm">
              <Line label="На начало" value={money(periods.totals.startAmount)} />
              <Line label="Начислено" value={money(periods.totals.accruedAmount)} />
              <Line label="Выплачено" value={money(periods.totals.paidAmount)} />
              <Line label="На конец" value={money(periods.totals.endAmount)} strong />
            </dl>

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
              <span className="min-w-0 flex-1 text-left">Все начисления</span>
              <ChevronRight size={16} className="shrink-0 text-gray-400" />
            </button>
          </>
        ) : (
          <Skeleton className="mt-3 h-24 w-full" />
        )}
      </section>

      {/* Where the customer's money went. */}
      <section className="bg-white px-4 py-4 sm:rounded-2xl">
        <h2 className="text-base font-semibold text-gray-950">Куда ушли деньги</h2>
        {fees && commission ? (
          <>
            <dl className="mt-3 divide-y divide-gray-100 text-sm">
              <Line label="Клиенты заплатили" value={money(fees.grossAmount)} />
              <Line
                label={`Ваша выручка · ${percent(fees.sellerPercent)}`}
                value={money(fees.sellerAmount)}
                strong
              />
              <Line
                label={`Комиссия площадки · ${percent(commission.percent)}`}
                value={money(commission.amount)}
              />
            </dl>

            {/* Nested, because these come out of our commission and the seller pays none of them.
                Listed in their column, we would be telling them we took money we did not take. */}
            <button
              type="button"
              onClick={() => setCostsOpen(true)}
              className="mt-2 flex w-full items-start gap-2 rounded-xl bg-blue-50 px-3 py-2.5 text-left transition active:bg-blue-100"
            >
              <Info size={15} className="mt-0.5 shrink-0 text-blue-700" />
              <span className="min-w-0 flex-1 text-xs leading-5 text-blue-900">
                Из комиссии площадка платит банку и оператору чеков {money(commission.platformCostsAmount)} —
                это не ваши расходы. Подробнее
              </span>
            </button>
          </>
        ) : (
          <Skeleton className="mt-3 h-20 w-full" />
        )}
      </section>

      {/* The requisites, which are a console concern rather than a finance one. */}
      <section className="bg-white px-4 py-4 sm:rounded-2xl">
        <h2 className="text-base font-semibold text-gray-950">Куда приходят деньги</h2>
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

      <BottomSheet
        open={costsOpen}
        onClose={() => setCostsOpen(false)}
        title="Расходы площадки"
        center
        footer={
          <Button variant="secondary" className="w-full justify-center" onClick={() => setCostsOpen(false)}>
            Закрыть
          </Button>
        }
      >
        {commission && (
          <div className="px-5 pb-4 pt-1">
            <p className="text-sm leading-5 text-gray-600">
              Эти расходы площадка платит из своей комиссии: приём платежа, перевод вам и чек
              покупателю. На вашу выручку они не влияют.
            </p>

            <dl className="mt-3 divide-y divide-gray-100 text-sm">
              {commission.platformCosts.map(cost => {
                const source = costSource(cost.source);
                return (
                  <div key={cost.sysName} className="flex items-start gap-3 py-2.5">
                    <dt className="min-w-0 flex-1">
                      <span className="block text-gray-900">{costName(cost.sysName)}</span>
                      <span className="mt-0.5 flex items-center gap-1.5">
                        <Badge
                          variant={cost.source === 'register' ? 'green' : cost.source === 'tariff' ? 'blue' : 'orange'}
                          size="xs"
                          tone="strong"
                          shape="square"
                        >
                          {source.label}
                        </Badge>
                        <span className="text-xs text-gray-500">{percent(cost.percent)}</span>
                      </span>
                    </dt>
                    <dd className="shrink-0 text-gray-900">{money(cost.amount)}</dd>
                  </div>
                );
              })}
              <div className="flex items-center gap-3 py-2.5">
                <dt className="min-w-0 flex-1 text-gray-500">Всего расходов</dt>
                <dd className="shrink-0 text-gray-900">{money(commission.platformCostsAmount)}</dd>
              </div>
              {/* It can be negative, and the sign shows: on a small hire the bank's floor for
                  taking a payment exceeds the commission. */}
              <div className="flex items-center gap-3 py-2.5">
                <dt className="min-w-0 flex-1 font-medium text-gray-950">
                  Остаётся площадке · {percent(commission.netPercent)}
                </dt>
                <dd
                  className={`shrink-0 font-semibold ${
                    commission.netAmount < 0 ? 'text-red-600' : 'text-gray-950'
                  }`}
                >
                  {money(commission.netAmount)}
                </dd>
              </div>
            </dl>

            <p className="mt-3 text-xs leading-5 text-gray-500">
              {commission.platformCosts.some(cost => cost.source !== 'register')
                ? 'Часть сумм посчитана по тарифу — банковский реестр за этот период ещё не прочитан.'
                : 'Все суммы сверены с реестром банка.'}
              {' '}Полностью возвращённые брони в расчёт не входят.
            </p>
          </div>
        )}
      </BottomSheet>
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

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <dt className="min-w-0 flex-1 text-gray-500">{label}</dt>
      <dd className={strong ? 'shrink-0 font-semibold text-gray-950' : 'shrink-0 text-gray-900'}>{value}</dd>
    </div>
  );
}
