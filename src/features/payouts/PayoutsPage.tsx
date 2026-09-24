import { useEffect, useState } from 'react';
import { AlertCircle, Building2, CheckCircle2, Save, Smartphone } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { RuPhoneInput } from '../../components/ui/RuPhoneInput';
import { Select } from '../../components/ui/Select';
import { ApiError, paymentReferenceApi, providerApi, publicSuggestionsApi, type SbpMemberReference } from '../../lib/api-client';
import type { PayoutDetails } from '../../types';

/**
 * «Выплаты» — the method is never chosen, the seller kind dictates it: СБП to a phone for a
 * самозанятый, a bank account for ИП and organisations. The seller types the requisites; an admin
 * registers them with the bank after review.
 */
export function PayoutsPage() {
  const [details, setDetails] = useState<PayoutDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [phone, setPhone] = useState('');
  const [sbpMemberId, setSbpMemberId] = useState('');
  const [banks, setBanks] = useState<SbpMemberReference[]>([]);
  const [account, setAccount] = useState('');
  const [bik, setBik] = useState('');
  const [bankName, setBankName] = useState('');
  const [correspondentAccount, setCorrespondentAccount] = useState('');
  const [bikLookup, setBikLookup] = useState<'idle' | 'loading' | 'missing'>('idle');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    providerApi.payout()
      .then(async next => {
        if (cancelled) return;
        setDetails(next);
        setPhone((next.phone ?? '').replace(/^\+7/, ''));
        setSbpMemberId(next.sbpMemberId ?? '');
        setAccount(next.account ?? '');
        setBik(next.bik ?? '');
        setBankName(next.bankName ?? '');
        setCorrespondentAccount(next.correspondentAccount ?? '');
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
    if (!details) return;
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const next = await providerApi.updatePayout(details.method === 'sbp'
        ? { method: 'sbp', phone: `+7${phone.replace(/\D/g, '')}`, sbpMemberId, bankName: banks.find(item => item.sbpMemberId === sbpMemberId)?.displayBankName }
        : { method: 'bank_account', account: account.replace(/\D/g, ''), bik: bik.replace(/\D/g, ''), bankName, correspondentAccount: correspondentAccount.replace(/\D/g, '') || undefined });
      setDetails(next);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить реквизиты.');
    } finally {
      setSaving(false);
    }
  };

  const isSbp = details?.method === 'sbp';

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Выплаты</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            {isSbp ? 'Самозанятым платформа переводит деньги по СБП на номер телефона.' : 'ИП и организациям платформа переводит деньги на расчётный счёт.'}
          </p>
        </div>
        {details && (
          details.registered
            ? <Badge variant="green">банк подключён</Badge>
            : details.hasDetails
              ? <Badge variant="yellow">ждёт подключения банка</Badge>
              : <Badge variant="gray">реквизиты не заполнены</Badge>
        )}
      </div>
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {loading ? (
        <Card><div className="py-8 text-center text-sm text-gray-500">Загружаем выплаты...</div></Card>
      ) : details && (
        <Card className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
            {isSbp ? <Smartphone size={16} className="text-blue-600" /> : <Building2 size={16} className="text-blue-600" />}
            {isSbp ? 'СБП по номеру телефона' : 'Расчётный счёт'}
            {details.beneficiaryName && <span className="text-xs font-normal text-gray-500">· получатель {details.beneficiaryName}</span>}
          </div>
          {isSbp ? (
            <div className="grid gap-3 md:grid-cols-2">
              <RuPhoneInput label="Телефон, привязанный к СБП" value={phone} onChange={setPhone} />
              <Select
                label="Банк получателя"
                value={sbpMemberId}
                options={[{ value: '', label: 'Выберите банк' }, ...banks.map(item => ({ value: item.sbpMemberId, label: item.displayBankName }))]}
                onChange={event => setSbpMemberId(event.target.value)}
              />
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
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
              {bikLookup === 'missing' && <p className="text-xs text-amber-700 md:col-span-2">Банк по этому БИК не найден — укажите название вручную.</p>}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" onClick={() => void save()} loading={saving}>
              <Save size={14} /> Сохранить реквизиты
            </Button>
            {saved && <span className="flex items-center gap-1 text-xs text-emerald-700"><CheckCircle2 size={13} /> сохранено</span>}
          </div>
          <p className="text-xs text-gray-500">
            После проверки кабинета администратор подключает выплаты в банке. До этого деньги за оказанные услуги накапливаются.
          </p>
        </Card>
      )}
    </div>
  );
}
