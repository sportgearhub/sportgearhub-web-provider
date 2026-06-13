import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertCircle, Building2, CreditCard, RefreshCw, Smartphone } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ApiError, payoutContractsApi } from '../../lib/api-client';
import type { PayoutContract, PayoutContractStatus, PayoutMode } from '../../types';

const statusMeta: Record<string, { label: string; variant: 'green' | 'yellow' | 'red' | 'blue' | 'gray' | 'orange' }> = {
  review: { label: 'На проверке', variant: 'yellow' },
  setting_up: { label: 'Настраивается', variant: 'blue' },
  active: { label: 'Активен', variant: 'green' },
  rejected: { label: 'Отклонен', variant: 'red' },
  blocked: { label: 'Заблокирован', variant: 'orange' },
};

const statusDescriptions: Record<string, string> = {
  review: 'Администратор проверяет или дополняет данные.',
  setting_up: 'Администратор регистрирует выплату в T-Bank.',
  active: 'Выплаты зарегистрированы и готовы к маршрутизации.',
  rejected: 'Текущую настройку выплат нельзя принять.',
  blocked: 'Настройка выплат заблокирована административно.',
};

export function PayoutsPage() {
  const [contracts, setContracts] = useState<PayoutContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadContracts = async (quiet = false) => {
    if (quiet) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');

    try {
      setContracts(await payoutContractsApi.list());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить выплаты.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadContracts();
  }, []);

  return (
    <div className="max-w-6xl space-y-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Выплаты</h2>
          <p className="mt-0.5 text-xs text-gray-500">Договоры и статус настройки выплат. Изменения выполняет администратор.</p>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={() => void loadContracts(true)} loading={refreshing}>
          <RefreshCw size={13} />
          Обновить
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <Card>
          <div className="py-8 text-center text-sm text-gray-500">Загружаем выплаты...</div>
        </Card>
      ) : contracts.length === 0 ? (
        <Card>
          <div className="py-8 text-center">
            <p className="text-sm font-medium text-gray-900">Договоры выплат еще не созданы.</p>
            <p className="mt-1 text-xs text-gray-500">После проверки анкеты администратор создаст настройку выплат.</p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4">
          {contracts.map(contract => (
            <PayoutContractCard key={contract.contractId} contract={contract} />
          ))}
        </div>
      )}
    </div>
  );
}

function PayoutContractCard({ contract }: { contract: PayoutContract }) {
  const isSbp = contract.payoutMode === 't_bank_sbp_individual';
  const Icon = isSbp ? Smartphone : Building2;
  const status = statusMeta[contract.status] ?? { label: contract.status, variant: 'gray' as const };

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-4 py-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-blue-100 bg-blue-50 text-blue-700">
            <Icon size={17} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900">{modeLabel(contract.payoutMode)}</h3>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {contract.contractNumber ? `Договор #${contract.contractNumber}` : 'Договор без номера'}
              {contract.startsOn ? ` · c ${formatDate(contract.startsOn)}` : ''}
              {contract.currency ? ` · ${contract.currency}` : ''}
            </p>
          </div>
        </div>
        <p className="max-w-md text-xs leading-5 text-gray-500">{statusDescription(contract.status)}</p>
      </div>

      <div className="space-y-4 px-4 py-4">
        {isSbp ? (
          <SbpDetails contract={contract} />
        ) : (
          <BankDetails contract={contract} />
        )}
      </div>
    </Card>
  );
}

function BankDetails({ contract }: { contract: PayoutContract }) {
  const bank = contract.bankRequisites;

  return (
    <section>
      <SectionTitle icon={<CreditCard size={14} />} title="Банковские реквизиты" />
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <InfoItem label="Банк" value={bank?.bankName} />
        <InfoItem label="БИК" value={bank?.bik} mono />
        <InfoItem label="Расчетный счет" value={bank?.account} mono />
        <InfoItem label="Корреспондентский счет" value={bank?.correspondentAccount} mono />
      </div>
    </section>
  );
}

function SbpDetails({ contract }: { contract: PayoutContract }) {
  const source = contract.sbpPayout;

  return (
    <section>
      <SectionTitle icon={<Smartphone size={14} />} title="СБП выплаты" />
      {source ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <InfoItem label="Телефон" value={readValue(source, 'phone')} mono />
          <InfoItem label="Банк" value={readValue(source, 'displayBankName') || readValue(source, 'bankName')} />
          <InfoItem label="Участник СБП" value={readValue(source, 'sbpMemberId')} mono />
          <InfoItem label="Получатель" value={readValue(source, 'recipientId') || readValue(source, 'paymentRecipientId')} mono />
        </div>
      ) : (
        <p className="mt-3 text-xs text-gray-500">СБП реквизиты пока не указаны.</p>
      )}
    </section>
  );
}

function SectionTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 text-xs font-semibold uppercase text-gray-500">
      {icon}
      <span>{title}</span>
    </div>
  );
}

function InfoItem({ label, value, mono = false }: { label: string; value?: string | number | null; mono?: boolean }) {
  const displayValue = value === null || value === undefined || value === '' ? '—' : String(value);

  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium text-gray-500">{label}</p>
      <p className={`mt-1 break-words text-xs font-medium text-gray-900 ${mono ? 'font-mono' : ''}`}>{displayValue}</p>
    </div>
  );
}

function modeLabel(mode: PayoutMode) {
  if (mode === 't_bank_bank_account') return 'Банковский счет';
  if (mode === 't_bank_sbp_individual') return 'СБП';
  return mode;
}

function statusDescription(status: PayoutContractStatus) {
  return statusDescriptions[status] ?? 'Статус настройки выплат обновляется администратором.';
}

function readValue(source: Record<string, unknown>, key: string) {
  const value = source[key];
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString('ru-RU');
}

