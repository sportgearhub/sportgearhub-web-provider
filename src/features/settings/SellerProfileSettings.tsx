import { useEffect, useState } from 'react';
import { Pencil, Save } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { DetailList, DetailRow } from '../../components/ui/DetailList';
import { ApiError, providerApi } from '../../lib/api-client';
import type { PayoutDetails, SellerProfile } from '../../types';
import { useAuth } from '../../context/useAuth';
import { useProvider } from '../providers/ProviderContext';
import { SellerDetailsFields, SellerKindChoice, emptySellerDraft, sellerDraftError, sellerDraftToInput, type SellerDraft } from '../providers/SellerDetailsFields';
import { kindLabel } from '../providers/providerStatus';
import { SectionPage } from '../../components/layout/SectionPage';

export const taxationLabel = (value: string) => taxationLabels[value] ?? value;
export const vatLabel = (value: string) => vatLabels[value] ?? value;

const taxationLabels: Record<string, string> = {
  usn: 'Упрощённая система налогообложения (УСН)',
  osn: 'Общая система налогообложения (ОСН)',
  psn: 'Патентная система налогообложения (ПСН)',
  ausn: 'Автоматизированная УСН (АУСН)',
  eskhn: 'Единый сельскохозяйственный налог (ЕСХН)',
  npd: 'Налог на профессиональный доход (НПД)',
};

const vatLabels: Record<string, string> = {
  none: 'Не облагается',
  vat5: '5 %',
  vat7: '7 %',
  vat10: '10 %',
  vat20: '20 %',
};

/**
 * «Информация о продавце» — the legal party, as the registry described it, plus the two things the
 * seller decides (taxation system and VAT rate; a самозанятый's name). Kind and ИНН never change.
 */
export function SellerProfileSettings({ onNavigate }: { onNavigate: (path: string) => void }) {
  const provider = useProvider();
  const { user, reloadSession } = useAuth();
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  // Cabinets from before onboarding have no legal party yet; they enter it right here.
  const [missing, setMissing] = useState(false);
  const [draft, setDraft] = useState<SellerDraft>(() => emptySellerDraft(user?.name));
  const [payout, setPayout] = useState<PayoutDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([providerApi.sellerProfile(), providerApi.payout().catch(() => null)])
      .then(([nextProfile, nextPayout]) => {
        if (cancelled) return;
        setProfile(nextProfile);
        setPayout(nextPayout);
      })
      .catch(err => {
        if (cancelled) return;
        if (err instanceof ApiError && err.code === 'provider.seller_profile_required') setMissing(true);
        else setError(err instanceof ApiError ? err.message : 'Не удалось загрузить данные продавца.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [provider.providerId]);

  const createProfile = async () => {
    const problem = sellerDraftError(draft);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const next = await providerApi.updateSellerProfile(sellerDraftToInput(draft));
      setProfile(next);
      setMissing(false);
      setPayout(await providerApi.payout().catch(() => null));
      await reloadSession();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить данные продавца.');
    } finally {
      setSaving(false);
    }
  };

  const director = profile?.business?.director;
  const personName = profile?.person
    ? [profile.person.lastName, profile.person.firstName, profile.person.middleName].filter(Boolean).join(' ')
    : director ? [director.lastName, director.firstName, director.middleName].filter(Boolean).join(' ') : '—';

  return (
    <SectionPage
      title="Информация о продавце"
      description="Юридические данные кабинета — кому платформа перечисляет деньги."
      action={
        profile && (
          <Button type="button" variant="secondary" onClick={() => onNavigate('/settings/seller/edit')}>
            <Pencil size={14} /> Редактировать
          </Button>
        )
      }
      error={error}
    >
      {loading ? (
        <p className="text-sm text-gray-500">Загружаем...</p>
      ) : missing || !profile ? (
        <div className="max-w-xl space-y-5">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-5 text-amber-900">
            <p className="font-semibold">Данные продавца ещё не заполнены.</p>
            <p className="mt-1">Кабинет создан до того, как они стали обязательными. Без формы собственности и ИНН нельзя принять договор и получать выплаты. Заполните их один раз — изменить потом можно будет только через новый кабинет.</p>
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-950">Форма собственности</h2>
            <div className="mt-3">
              <SellerKindChoice value={draft.kind} onChange={kind => setDraft(current => ({ ...current, kind, inn: '' }))} />
            </div>
          </div>
          {draft.kind && (
            <div>
              <h2 className="text-base font-semibold text-gray-950">Данные продавца</h2>
              <div className="mt-3">
                <SellerDetailsFields draft={draft} onChange={setDraft} onLookupError={setError} />
              </div>
            </div>
          )}
          <Button variant="primary" disabled={!draft.kind} loading={saving} onClick={() => void createProfile()}>
            <Save size={14} /> Сохранить данные продавца
          </Button>
        </div>
      ) : (
        <>
          <h2 className="text-base font-semibold text-gray-950">Общая информация</h2>
          <DetailList className="mt-3">
            <DetailRow label="Форма собственности" value={kindLabel(profile.kind)} />
            <DetailRow
              label="Система налогообложения"
              value={profile.business ? taxationLabel(profile.business.taxationSystem) : taxationLabels.npd}
            />
            <DetailRow label="Ставка НДС" value={profile.business ? vatLabel(profile.business.vatRate) : vatLabels.none} />
            <DetailRow label={profile.person ? 'ФИО' : director?.position ?? 'Руководитель'} value={personName} />
            <DetailRow label="Название кабинета" value={provider.displayName} />
            {profile.business && <DetailRow label="Наименование" value={profile.business.legalName} />}
            {profile.business && <DetailRow label="Адрес регистрации" value={profile.business.legalAddress} />}
            {profile.business && <DetailRow label={profile.kind === 'company' ? 'ОГРН' : 'ОГРНИП'} value={profile.business.registrationNumber} />}
            <DetailRow label="ИНН" value={profile.inn} />
            {profile.company && <DetailRow label="КПП" value={profile.company.kpp} />}
          </DetailList>
          <p className="mt-4 max-w-2xl text-sm text-gray-500">
            Форма собственности и ИНН не меняются — для другого юридического лица создайте новый кабинет.
          </p>

          <h2 className="mt-10 text-base font-semibold text-gray-950">Реквизиты</h2>
          <DetailList className="mt-3">
            {payout?.hasDetails ? (
              <>
                <DetailRow label="Платёжный метод" value={payout.method === 'sbp' ? 'СБП по номеру телефона' : 'Банковский счёт'} />
                {payout.method === 'sbp'
                  ? <DetailRow label="Телефон" value={payout.phone} />
                  : <DetailRow label="Расчётный счёт" value={payout.account} />}
                {payout.bik && <DetailRow label="БИК банка" value={payout.bik} />}
                <DetailRow label="Название банка" value={payout.bankName} />
                <DetailRow label="Валюта" value="RUB" />
              </>
            ) : (
              <DetailRow
                label="Платёжный метод"
                value={payout?.method === 'sbp' ? 'СБП по номеру телефона' : 'Банковский счёт'}
                hint="Реквизиты не указаны — без них выплаты не уйдут."
              />
            )}
          </DetailList>
          <button type="button" onClick={() => onNavigate('/settings/payouts')} className="mt-3 text-sm font-medium text-blue-700 hover:underline">
            {payout?.hasDetails ? 'Изменить реквизиты' : 'Указать реквизиты'}
          </button>
        </>
      )}
    </SectionPage>
  );
}
