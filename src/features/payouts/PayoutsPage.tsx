import { useEffect, useState } from 'react';
import { CheckCircle2, Pencil, Save } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { DetailList, DetailRow } from '../../components/ui/DetailList';
import { SectionPage } from '../../components/layout/SectionPage';
import { SettingsCard } from '../../components/layout/SettingsCard';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { RuPhoneInput } from '../../components/ui/RuPhoneInput';
import { Select } from '../../components/ui/Select';
import { ApiError, paymentReferenceApi, providerApi, publicSuggestionsApi, type SbpMemberReference } from '../../lib/api-client';
import type { PayoutDetails } from '../../types';

function statusBadge(details: PayoutDetails) {
  if (details.registered) return <Badge variant="green">банк подключён</Badge>;
  if (details.hasDetails) return <Badge variant="yellow">ждёт подключения банка</Badge>;
  return <Badge variant="gray">реквизиты не заполнены</Badge>;
}

/**
 * «Реквизиты выплат» — the method is never chosen, the seller kind dictates it: СБП to a phone for
 * a самозанятый, a bank account for ИП and organisations. The page shows what is on file; changing
 * it is a short, self-contained task, so it happens in a dialog rather than in a form that is
 * always open and editable by accident.
 */
export function PayoutsPage() {
  const [details, setDetails] = useState<PayoutDetails | null>(null);
  const [banks, setBanks] = useState<SbpMemberReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    providerApi.payout()
      .then(async next => {
        if (cancelled) return;
        setDetails(next);
        if (next.method === 'sbp') {
          const reference = await paymentReferenceApi.sbpMembers().catch(() => null);
          if (!cancelled && reference) setBanks(reference.items);
        }
      })
      .catch(err => {
        if (cancelled) return;
        setError(err instanceof ApiError && err.status === 404
          ? 'Сначала заполните данные продавца — способ выплаты зависит от формы бизнеса.'
          : err instanceof ApiError ? err.message : 'Не удалось загрузить выплаты.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const isSbp = details?.method === 'sbp';

  return (
    <SectionPage
      title="Реквизиты выплат"
      description="Счёт, на который платформа переводит выручку. Подключение в банке выполняет платформа после проверки кабинета."
      error={error}
      action={details ? statusBadge(details) : undefined}
    >
      {loading ? (
        <p className="text-sm text-gray-500">Загружаем выплаты...</p>
      ) : details && (
        <div className="max-w-3xl">
          <SettingsCard
            title={isSbp ? 'СБП по номеру телефона' : 'Расчётный счёт'}
            description={
              isSbp
                ? 'Самозанятым платформа переводит деньги по СБП на номер телефона.'
                : 'ИП и организациям платформа переводит деньги на расчётный счёт.'
            }
            action={
              <Button
                type="button"
                variant="secondary"
                size="sm"
                aria-label={`${details.hasDetails ? 'Редактировать' : 'Добавить'} реквизиты выплат`}
                onClick={() => setEditing(true)}
              >
                <Pencil size={13} /> {details.hasDetails ? 'Редактировать' : 'Добавить'}
              </Button>
            }
          >
            {details.hasDetails ? (
              <DetailList>
                {details.beneficiaryName && <DetailRow label="Получатель" value={details.beneficiaryName} />}
                {isSbp ? (
                  <>
                    <DetailRow label="Телефон" value={details.phone} />
                    <DetailRow label="Банк получателя" value={details.bankName} />
                  </>
                ) : (
                  <>
                    <DetailRow label="Расчётный счёт" value={details.account} />
                    <DetailRow label="БИК" value={details.bik} />
                    <DetailRow label="Банк" value={details.bankName} />
                    <DetailRow label="Корреспондентский счёт" value={details.correspondentAccount} />
                  </>
                )}
                <DetailRow label="Валюта" value="RUB" />
              </DetailList>
            ) : (
              <p className="text-sm text-gray-500">
                Реквизиты не указаны — до этого выплаты не уйдут, даже когда заказы начнут приходить.
              </p>
            )}
          </SettingsCard>
        </div>
      )}

      {details && (
        <PayoutRequisitesDialog
          open={editing}
          details={details}
          banks={banks}
          onClose={() => setEditing(false)}
          onSaved={next => {
            setDetails(next);
            setEditing(false);
          }}
        />
      )}
    </SectionPage>
  );
}

function PayoutRequisitesDialog({
  open,
  details,
  banks,
  onClose,
  onSaved,
}: {
  open: boolean;
  details: PayoutDetails;
  banks: SbpMemberReference[];
  onClose: () => void;
  onSaved: (next: PayoutDetails) => void;
}) {
  const isSbp = details.method === 'sbp';
  const [phone, setPhone] = useState((details.phone ?? '').replace(/^\+7/, ''));
  const [sbpMemberId, setSbpMemberId] = useState(details.sbpMemberId ?? '');
  const [account, setAccount] = useState(details.account ?? '');
  const [bik, setBik] = useState(details.bik ?? '');
  const [bankName, setBankName] = useState(details.bankName ?? '');
  const [correspondentAccount, setCorrespondentAccount] = useState(details.correspondentAccount ?? '');
  const [bikLookup, setBikLookup] = useState<'idle' | 'loading' | 'missing'>('idle');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Reopening after a cancel should show what is on file, not the abandoned draft.
  useEffect(() => {
    if (!open) return;
    setPhone((details.phone ?? '').replace(/^\+7/, ''));
    setSbpMemberId(details.sbpMemberId ?? '');
    setAccount(details.account ?? '');
    setBik(details.bik ?? '');
    setBankName(details.bankName ?? '');
    setCorrespondentAccount(details.correspondentAccount ?? '');
    setError('');
    setBikLookup('idle');
  }, [open, details]);

  const lookupBank = async () => {
    const digits = bik.replace(/\D/g, '');
    if (digits.length !== 9) return;
    setBikLookup('loading');
    try {
      const bank = await publicSuggestionsApi.lookupRuBank(digits);
      setBankName(bank.paymentName ?? bank.value);
      if (bank.correspondentAccount) setCorrespondentAccount(bank.correspondentAccount);
      setBikLookup('idle');
    } catch {
      setBikLookup('missing');
    }
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const next = await providerApi.updatePayout(isSbp
        ? { method: 'sbp', phone: `+7${phone.replace(/\D/g, '')}`, sbpMemberId, bankName: banks.find(item => item.sbpMemberId === sbpMemberId)?.displayBankName }
        : { method: 'bank_account', account: account.replace(/\D/g, ''), bik: bik.replace(/\D/g, ''), bankName, correspondentAccount: correspondentAccount.replace(/\D/g, '') || undefined });
      onSaved(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить реквизиты.');
    } finally {
      setSaving(false);
    }
  };

  const ready = isSbp ? phone.replace(/\D/g, '').length === 10 && Boolean(sbpMemberId) : account.replace(/\D/g, '').length === 20 && bik.replace(/\D/g, '').length === 9;

  return (
    <Modal open={open} onClose={onClose} title={details.hasDetails ? 'Редактирование реквизитов' : 'Добавление реквизитов'} size="md">
      <p className="text-sm leading-5 text-gray-500">
        {isSbp
          ? 'Деньги уходят по СБП на этот номер в выбранный банк.'
          : 'Деньги уходят на этот счёт. БИК подставит название банка и корреспондентский счёт.'}
      </p>

      {error && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-4 space-y-4">
        {isSbp ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <RuPhoneInput label="Телефон, привязанный к СБП" value={phone} onChange={setPhone} />
            <Select
              label="Банк получателя"
              value={sbpMemberId}
              options={[{ value: '', label: 'Выберите банк' }, ...banks.map(item => ({ value: item.sbpMemberId, label: item.displayBankName }))]}
              onChange={event => setSbpMemberId(event.target.value)}
            />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Расчётный счёт (20 цифр)" inputMode="numeric" value={account} onChange={event => setAccount(event.target.value.replace(/[^\d\s]/g, ''))} />
            <Input
              label="БИК"
              inputMode="numeric"
              value={bik}
              onChange={event => {
                setBik(event.target.value.replace(/\D/g, ''));
                setBikLookup('idle');
              }}
              onBlur={() => void lookupBank()}
            />
            <Input label="Банк" value={bankName} onChange={event => setBankName(event.target.value)} />
            <Input label="Корреспондентский счёт" inputMode="numeric" value={correspondentAccount} onChange={event => setCorrespondentAccount(event.target.value.replace(/\D/g, ''))} />
            {bikLookup === 'loading' && <p className="text-xs text-blue-700 sm:col-span-2">Ищем банк по БИК...</p>}
            {bikLookup === 'missing' && <p className="text-xs text-amber-700 sm:col-span-2">Банк по этому БИК не найден — укажите название вручную.</p>}
          </div>
        )}

        <p className="flex items-start gap-1.5 text-xs leading-5 text-gray-500">
          <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-gray-400" />
          Подключение в банке выполняет платформа после проверки кабинета.
        </p>

        <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Отмена</Button>
          <Button type="button" variant="primary" loading={saving} disabled={!ready} onClick={() => void save()}>
            <Save size={14} /> Сохранить реквизиты
          </Button>
        </div>
      </div>
    </Modal>
  );
}
