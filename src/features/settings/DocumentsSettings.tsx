import { useEffect, useState } from 'react';
import { ExternalLink, FileText } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { ApiError, providerApi } from '../../lib/api-client';
import type { Agreement } from '../../types';
import { AGREEMENT_URL, DOCS_BASE_URL } from '../providers/providerStatus';

const agreementStatus: Record<string, { label: string; variant: 'green' | 'yellow' | 'gray' }> = {
  accepted: { label: 'принят, ждёт активации', variant: 'yellow' },
  active: { label: 'действует', variant: 'green' },
  terminated: { label: 'прекращён', variant: 'gray' },
};

/** «Документы» — the numbered agreement and the texts it points to on the docs site. */
export function DocumentsSettings() {
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    providerApi.agreement()
      .then(next => {
        if (!cancelled) setAgreement(next);
      })
      .catch(err => {
        if (!cancelled && !(err instanceof ApiError && err.status === 404)) {
          setError(err instanceof ApiError ? err.message : 'Не удалось загрузить документы.');
        }
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
    <div>
      <Card className="rounded-none border-0 p-6 shadow-none">
        <h2 className="text-sm font-semibold text-gray-900">Документы</h2>
        <p className="mt-0.5 text-xs text-gray-500">Договор с платформой и правила, на которые он ссылается.</p>
        {error && <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        {loading ? (
          <p className="mt-4 text-sm text-gray-500">Загружаем...</p>
        ) : agreement && status ? (
          <div className="mt-4 flex items-start gap-3 rounded-md border px-4 py-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-700">
              <FileText size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900">
                Договор № {agreement.number} от {formatDate(agreement.acceptedAt)}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                <Badge variant={status.variant}>{status.label}</Badge>
                {agreement.activatedAt && <span>вступил в силу {formatDate(agreement.activatedAt)}</span>}
              </p>
              <p className="mt-2 text-xs text-gray-600">
                Номер указывается в назначении выплат и в отчётах. Какая редакция действовала на дату принятия — в архиве изменений на сайте документов.
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-gray-500">Договор ещё не принят.</p>
        )}
      </Card>
      <Card className="rounded-none border-0 border-t p-6 shadow-none">
        <h3 className="text-sm font-semibold text-gray-900">Тексты</h3>
        <ul className="mt-3 space-y-2 text-sm">
          <DocLink href={AGREEMENT_URL} label="Договор для провайдеров проката" />
          <DocLink href={`${DOCS_BASE_URL}/docs/legal/providers/general-terms`} label="Общие условия сотрудничества" />
          <DocLink href={`${DOCS_BASE_URL}/docs/legal/providers/regulations/cancellations-and-refunds`} label="Регламент отмен и возвратов" />
          <DocLink href={`${DOCS_BASE_URL}/docs/legal/providers/fees`} label="Комиссии и тарифы" />
          <DocLink href={`${DOCS_BASE_URL}/docs/legal/providers/payouts-and-reports`} label="Выплаты и отчётные документы" />
          <DocLink href={`${DOCS_BASE_URL}/docs/legal/providers/changelog`} label="Архив изменений" />
        </ul>
      </Card>
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
