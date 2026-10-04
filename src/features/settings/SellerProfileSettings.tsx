import { useEffect, useState } from 'react';
import { Pencil, Save } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { SkeletonDetail } from '../../components/ui/Skeleton';
import { DetailList, DetailRow } from '../../components/ui/DetailList';
import { ApiError, providerApi } from '../../lib/api-client';
import { sellerKpp, sellerPersonName, sellerRegistry } from '../../types';
import type { PayoutDetails, SellerProfile } from '../../types';
import { useAuth } from '../../context/useAuth';
import { useProvider } from '../providers/ProviderContext';
import { SellerDetailsFields, SellerKindChoice, emptySellerDraft, sellerDraftError, sellerDraftToInput, type SellerDraft } from '../providers/SellerDetailsFields';
import { kindLabel } from '../providers/providerStatus';
import { SettingsCard } from '../../components/layout/SettingsCard';

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

  // Which of these exists is decided by the kind, so they are read through the accessors rather
  // than by testing fields that only some kinds have.
  const registry = profile ? sellerRegistry(profile) : null;
  const personName = profile ? sellerPersonName(profile) : '—';

  return (
    <div className="space-y-4 p-6">
      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {loading ? (
        <SkeletonDetail rows={6} />
      ) : missing || !profile ? (
        <div className="max-w-2xl space-y-5">
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
        <div className="max-w-3xl space-y-4">
          <SettingsCard
            title="Юридическое лицо"
            description="Кому платформа перечисляет деньги. Форма собственности и ИНН не меняются — для другого лица нужен новый кабинет."
            action={
              <Button
                type="button"
                variant="secondary"
                size="sm"
                aria-label="Редактировать данные юридического лица"
                onClick={() => onNavigate('/settings/seller/edit')}
              >
                <Pencil size={14} /> Редактировать
              </Button>
            }
          >
            <DetailList>
              <DetailRow label="Форма собственности" value={kindLabel(profile.kind)} />
              <DetailRow
                label="Система налогообложения"
                value={registry ? taxationLabel(registry.taxationSystem) : taxationLabels.npd}
              />
              <DetailRow label="Ставка НДС" value={registry ? vatLabel(registry.vatRate) : vatLabels.none} />
              <DetailRow
                label={profile.kind === 'self_employed' ? 'ФИО' : registry?.director.position ?? 'Руководитель'}
                value={personName}
              />
              {registry && <DetailRow label="Наименование" value={registry.legalName} />}
              {registry && <DetailRow label="Адрес регистрации" value={registry.legalAddress} />}
              {registry && <DetailRow label={profile.kind === 'company' ? 'ОГРН' : 'ОГРНИП'} value={registry.registrationNumber} />}
              <DetailRow label="ИНН" value={profile.inn} />
              {sellerKpp(profile) && <DetailRow label="КПП" value={sellerKpp(profile)} />}
            </DetailList>
          </SettingsCard>

          <SettingsCard
            title="Реквизиты выплат"
            description="Счёт, на который платформа переводит выручку за вычетом комиссии."
            action={
              <Button
                type="button"
                variant="secondary"
                size="sm"
                aria-label={`${payout?.hasDetails ? 'Редактировать' : 'Добавить'} реквизиты выплат`}
                onClick={() => onNavigate('/settings/payouts')}
              >
                <Pencil size={14} /> {payout?.hasDetails ? 'Редактировать' : 'Добавить'}
              </Button>
            }
          >
            {payout?.hasDetails ? (
              <DetailList>
                <DetailRow label="Платёжный метод" value={payout.method === 'sbp' ? 'СБП по номеру телефона' : 'Банковский счёт'} />
                {payout.method === 'sbp'
                  ? <DetailRow label="Телефон" value={payout.phone} />
                  : <DetailRow label="Расчётный счёт" value={payout.account} />}
                {payout.bik && <DetailRow label="БИК банка" value={payout.bik} />}
                <DetailRow label="Название банка" value={payout.bankName} />
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
        </div>
  );
}
