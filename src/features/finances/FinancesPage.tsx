import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ChevronRight, CreditCard, Wallet } from 'lucide-react';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { providerApi } from '../../lib/api-client';
import type { PayoutDetails } from '../../types';

/**
 * Финансы — what came in, what was taken, and when it is paid out.
 *
 * Mostly a prototype, and it says so at the top. The API has one endpoint about money — where to
 * send it (`/payout`) — and that part below is real. There is no balance, no ledger and no payout
 * history to read, and the booking list row does not carry `total_price` either, so the figures
 * here are seeded rather than summed. Nothing is computed from half a source: a revenue number
 * that is quietly wrong is worse than one labelled as a sample.
 */
const SAMPLE = {
  balance: 18_420,
  period: '1–9 окт',
  sales: 42_600,
  charges: -6_390,
  payout: 36_210,
  upcoming: 12_480,
  transfers: [
    { id: 't1', title: 'Оплата проката', sentAt: '7 окт', paidAt: '9 окт', amount: 14_200, status: 'paid' as const },
    { id: 't2', title: 'Оплата проката', sentAt: '4 окт', paidAt: '6 окт', amount: 9_850, status: 'paid' as const },
    { id: 't3', title: 'Оплата проката', sentAt: '1 окт', paidAt: '3 окт', amount: 12_160, status: 'paid' as const },
    { id: 't4', title: 'Прочие выплаты', sentAt: '—', paidAt: '12 окт', amount: 12_480, status: 'planned' as const },
  ],
};

type Transfer = (typeof SAMPLE.transfers)[number];

const money = (value: number) =>
  `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value)} ₽`;

export function FinancesPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [payout, setPayout] = useState<PayoutDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Transfer | null>(null);

  useEffect(() => {
    let cancelled = false;
    providerApi.payout()
      .then(next => { if (!cancelled) setPayout(next); })
      .catch(() => { /* the card below says it is not set up */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  /** Where money actually goes, in one line — the only real thing on this screen. */
  const destination = useMemo(() => {
    if (!payout?.hasDetails) return null;
    if (payout.method === 'sbp') return payout.phone ? `СБП · ${payout.phone}` : 'СБП';
    const tail = payout.account ? `•••• ${payout.account.slice(-4)}` : null;
    return [payout.bankName, tail].filter(Boolean).join(' · ') || 'Расчётный счёт';
  }, [payout]);

  return (
    <div className="space-y-2 pb-8 sm:space-y-4 sm:px-6">
      <p className="mx-3 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-2.5 text-xs leading-5 text-gray-600 sm:mx-0">
        <span className="font-medium text-gray-800">Прототип.</span> В API пока нет баланса, начислений
        и истории выплат — цифры демонстрационные. Реквизиты выплат внизу настоящие.
      </p>

      {/* The balance, with the way to manage it beside it — the shape the references use. */}
      <section className="flex items-center gap-3 bg-white px-4 py-4 sm:rounded-2xl">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <Wallet size={19} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-medium uppercase tracking-wide text-gray-500">Баланс</span>
          <span className="block text-xl font-semibold text-gray-950">{money(SAMPLE.balance)}</span>
        </span>
        <Button variant="secondary" onClick={() => onNavigate('/settings/payouts')}>Управлять</Button>
      </section>

      <section className="bg-white px-4 py-4 sm:rounded-2xl">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-gray-950">Доходы и расходы</h2>
          <span className="shrink-0 rounded-lg bg-gray-900 px-2.5 py-1 text-xs font-medium text-white">
            {SAMPLE.period}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Figure label="Прокат и возвраты" value={money(SAMPLE.sales)} />
          <Figure label="Комиссия и услуги" value={money(SAMPLE.charges)} negative />
        </div>

        <div className="mt-2 rounded-xl bg-gray-50 px-3 py-2.5">
          <p className="text-xs text-gray-500">Всего к выплате за период</p>
          <p className="mt-0.5 text-lg font-semibold text-gray-950">{money(SAMPLE.payout)}</p>
        </div>
      </section>

      <section className="bg-white px-4 py-4 sm:rounded-2xl">
        <h2 className="text-base font-semibold text-gray-950">Выплаты</h2>

        <div className="mt-3 flex items-center gap-3 rounded-xl border border-gray-200 px-3 py-2.5">
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-gray-500">Ближайшая выплата</span>
            <span className="block text-lg font-semibold text-gray-950">{money(SAMPLE.upcoming)}</span>
          </span>
          <span className="shrink-0 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
            12 окт
          </span>
        </div>

        <ul className="mt-3 space-y-2">
          {SAMPLE.transfers.map(transfer => (
            <li key={transfer.id}>
              <button
                type="button"
                onClick={() => setOpen(transfer)}
                className="w-full rounded-xl border border-gray-200 p-3 text-left transition active:bg-gray-50"
              >
                <span className="flex flex-wrap items-center gap-2">
                  <StatusPill status={transfer.status} />
                  <span className="text-xs text-gray-500">
                    {transfer.status === 'paid' ? `Отправлено ${transfer.sentAt}` : `Выплата ${transfer.paidAt}`}
                  </span>
                </span>
                <span className="mt-1.5 flex items-center gap-3">
                  <span className="min-w-0 flex-1 truncate text-sm text-gray-900">{transfer.title}</span>
                  <span className="shrink-0 text-base font-semibold text-gray-950">{money(transfer.amount)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* The real part. */}
      <section className="bg-white px-4 py-4 sm:rounded-2xl">
        <h2 className="text-base font-semibold text-gray-950">Куда приходят деньги</h2>
        {loading ? (
          <Skeleton className="mt-3 h-10 w-full" />
        ) : (
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
        )}
      </section>

      <BottomSheet
        open={open !== null}
        onClose={() => setOpen(null)}
        title="Детали выплаты"
        center
        footer={
          <Button variant="secondary" className="w-full justify-center" onClick={() => setOpen(null)}>
            Понятно
          </Button>
        }
      >
        {open && (
          <div className="px-5 pb-4 pt-1">
            <StatusPill status={open.status} />
            <div
              className={`mt-3 rounded-xl border px-3 py-3 ${
                open.status === 'paid' ? 'border-emerald-300' : 'border-blue-200'
              }`}
            >
              <div className="flex flex-wrap gap-2">
                {open.status === 'paid' && (
                  <span className="rounded-lg bg-gray-100 px-2 py-1 text-xs text-gray-600">
                    Отправлено {open.sentAt}
                  </span>
                )}
                <span className="rounded-lg bg-gray-100 px-2 py-1 text-xs text-gray-600">
                  Выплата {open.paidAt}
                </span>
              </div>
              <p className="mt-2 text-xl font-semibold text-gray-950">{money(open.amount)}</p>
            </div>

            <dl className="mt-4 divide-y divide-gray-100 text-sm">
              <div className="py-2.5">
                <dt className="text-xs text-gray-500">Тип выплаты</dt>
                <dd className="mt-0.5 text-gray-900">{open.title}</dd>
              </div>
              <div className="py-2.5">
                <dt className="text-xs text-gray-500">Куда</dt>
                <dd className="mt-0.5 text-gray-900">{destination ?? 'Реквизиты не заполнены'}</dd>
              </div>
            </dl>

            <button
              type="button"
              onClick={() => { setOpen(null); onNavigate('/settings/payouts'); }}
              className="mt-2 flex w-full items-center gap-2 rounded-xl bg-gray-50 px-3 py-3 text-left text-sm text-gray-900 transition active:bg-gray-100"
            >
              <span className="min-w-0 flex-1">Выплата не пришла?</span>
              <ArrowRight size={16} className="shrink-0 text-gray-400" />
            </button>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}

function Figure({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <div className="rounded-xl bg-gray-50 px-3 py-2.5">
      <p className="text-xs leading-4 text-gray-500">{label}</p>
      <p className={`mt-0.5 text-base font-semibold ${negative ? 'text-gray-950' : 'text-gray-950'}`}>{value}</p>
    </div>
  );
}

function StatusPill({ status }: { status: 'paid' | 'planned' }) {
  return status === 'paid' ? (
    <span className="rounded-lg bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">Оплачено</span>
  ) : (
    <span className="rounded-lg bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">Запланировано</span>
  );
}
