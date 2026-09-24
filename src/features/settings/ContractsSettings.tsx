import { useEffect, useState } from 'react';
import { ChevronDown, ExternalLink } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { ApiError, providerApi } from '../../lib/api-client';
import type { Agreement, PayoutDetails } from '../../types';
import { AGREEMENT_URL, DOCS_BASE_URL } from '../providers/providerStatus';

const agreementStatus: Record<string, { label: string; variant: 'green' | 'yellow' | 'gray' }> = {
  accepted: { label: 'Ждёт активации', variant: 'yellow' },
  active: { label: 'Активен', variant: 'green' },
  terminated: { label: 'Прекращён', variant: 'gray' },
};

/** «Договоры» — the numbered agreement with the platform and the requisites it pays to. */
export function ContractsSettings() {
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [payout, setPayout] = useState<PayoutDetails | null>(null);
  const [open, setOpen] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([providerApi.agreement().catch(err => { if (err instanceof ApiError && err.status === 404) return null; throw err; }), providerApi.payout().catch(() => null)])
      .then(([nextAgreement, nextPayout]) => {
        if (cancelled) return;
        setAgreement(nextAgreement);
        setPayout(nextPayout);
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Не удалось загрузить договоры.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const status = agreement ? agreementStatus[agreement.status] ?? { label: agreement.status, variant: 'gray' as const } : null;

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-gray-950">Договоры</h1>
      <p className="mt-1 max-w-xl text-sm text-gray-500">
        Все договоры вашего кабинета с платформой. Договор, по которому вы работаете сейчас, отмечен значком «Активен».
      </p>
      {error && <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      {loading ? (
        <p className="mt-6 text-sm text-gray-500">Загружаем...</p>
      ) : agreement && status ? (
        <div className="mt-6 max-w-3xl rounded-lg border">
          <button
            type="button"
            onClick={() => setOpen(current => !current)}
            aria-expanded={open}
            className="flex w-full items-center gap-3 px-4 py-3 text-left"
          >
            <a href={AGREEMENT_URL} target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()} className="text-blue-700" title="Открыть текст договора">
              <ExternalLink size={16} />
            </a>
            <span className="flex-1 text-base font-semibold text-gray-950">
              Договор № {agreement.number} от {formatDate(agreement.acceptedAt)}
            </span>
            <Badge variant={status.variant}>{status.label}</Badge>
            <ChevronDown size={16} className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
          {open && (
            <div className="border-t px-4 pb-4">
              <dl>
                <Row label="Платёжный метод" value={payout ? (payout.method === 'sbp' ? 'СБП по номеру телефона' : 'Банковский счёт') : '—'} />
                {payout?.method === 'sbp' ? (
                  <Row label="Телефон" value={payout.phone ?? 'не указан'} />
                ) : (
                  <Row label="Расчётный счёт" value={payout?.account ?? 'не указан'} />
                )}
                <Row label="БИК банка" value={payout?.bik ?? '—'} />
                <Row label="Название банка" value={payout?.bankName ?? '—'} />
                <Row label="Валюта" value="RUB" />
                {agreement.activatedAt && <Row label="Вступил в силу" value={formatDate(agreement.activatedAt)} />}
              </dl>
            </div>
          )}
        </div>
      ) : (
        <p className="mt-6 text-sm text-gray-500">Договор ещё не принят.</p>
      )}
      <h2 className="mt-10 text-base font-semibold text-gray-950">Условия</h2>
      <ul className="mt-3 space-y-2 text-sm">
        <DocLink href={AGREEMENT_URL} label="Договор для провайдеров проката" />
        <DocLink href={`${DOCS_BASE_URL}/docs/legal/providers/general-terms`} label="Общие условия сотрудничества" />
        <DocLink href={`${DOCS_BASE_URL}/docs/legal/providers/fees`} label="Комиссии и тарифы" />
        <DocLink href={`${DOCS_BASE_URL}/docs/legal/providers/payouts-and-reports`} label="Выплаты и отчётные документы" />
        <DocLink href={`${DOCS_BASE_URL}/docs/legal/providers/changelog`} label="Архив изменений" />
      </ul>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-b border-gray-100 py-2.5 text-sm last:border-0 md:grid-cols-[200px_1fr] md:gap-6">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-gray-900">{value}</dd>
    </div>
  );
}

function DocLink({ href, label }: { href: string; label: string }) {
  return (
    <li>
      <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-blue-700 hover:underline">
        {label} <ExternalLink size={12} />
      </a>
    </li>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
