import { useEffect, useState } from 'react';
import { Pencil, Save, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { ApiError, providerApi } from '../../lib/api-client';
import type { PayoutDetails, SellerProfile } from '../../types';
import { useAuth } from '../../context/useAuth';
import { useProvider } from '../providers/ProviderContext';
import { SellerDetailsFields, SellerKindChoice, emptySellerDraft, sellerDraftError, sellerDraftToInput, type SellerDraft } from '../providers/SellerDetailsFields';
import { kindLabel, taxationSystemOptions, vatRateOptions } from '../providers/providerStatus';

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
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [taxationSystem, setTaxationSystem] = useState('usn');
  const [vatRate, setVatRate] = useState('none');
  const [person, setPerson] = useState({ lastName: '', firstName: '', middleName: '' });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([providerApi.sellerProfile(), providerApi.payout().catch(() => null)])
      .then(([nextProfile, nextPayout]) => {
        if (cancelled) return;
        setProfile(nextProfile);
        setPayout(nextPayout);
        if (nextProfile.business) {
          setTaxationSystem(nextProfile.business.taxationSystem);
          setVatRate(nextProfile.business.vatRate);
        }
        if (nextProfile.person) {
          setPerson({ lastName: nextProfile.person.lastName, firstName: nextProfile.person.firstName, middleName: nextProfile.person.middleName ?? '' });
        }
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
      if (next.business) {
        setTaxationSystem(next.business.taxationSystem);
        setVatRate(next.business.vatRate);
      }
      if (next.person) setPerson({ lastName: next.person.lastName, firstName: next.person.firstName, middleName: next.person.middleName ?? '' });
      await reloadSession();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить данные продавца.');
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    setError('');
    try {
      const next = await providerApi.updateSellerProfile({
        kind: profile.kind,
        inn: profile.inn,
        ...(profile.business ? { taxationSystem, vatRate } : {}),
        ...(profile.person ? { person: { lastName: person.lastName.trim(), firstName: person.firstName.trim(), middleName: person.middleName.trim() || null } } : {}),
      });
      setProfile(next);
      setEditing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить.');
    } finally {
      setSaving(false);
    }
  };

  const director = profile?.business?.director;
  const personName = profile?.person
    ? [profile.person.lastName, profile.person.firstName, profile.person.middleName].filter(Boolean).join(' ')
    : director ? [director.lastName, director.firstName, director.middleName].filter(Boolean).join(' ') : '—';

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-950">Информация о продавце</h1>
          <p className="mt-1 text-sm text-gray-500">Юридические данные кабинета — кому платформа перечисляет деньги.</p>
        </div>
        {profile && !editing && (
          <Button type="button" variant="secondary" onClick={() => setEditing(true)}>
            <Pencil size={14} /> Редактировать
          </Button>
        )}
      </div>
      {error && <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      {loading ? (
        <p className="mt-6 text-sm text-gray-500">Загружаем...</p>
      ) : missing || !profile ? (
        <div className="mt-6 max-w-xl space-y-5">
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
          <h2 className="mt-8 text-base font-semibold text-gray-950">Общая информация</h2>
          <dl className="mt-3 max-w-3xl">
            <Row label="Форма собственности" value={kindLabel(profile.kind)} />
            {editing && profile.business ? (
              <>
                <Row label="Система налогообложения">
                  <Select value={taxationSystem} options={taxationSystemOptions} onChange={event => setTaxationSystem(event.target.value)} className="max-w-xs" />
                </Row>
                <Row label="Ставка НДС">
                  <Select value={vatRate} options={vatRateOptions} onChange={event => setVatRate(event.target.value)} className="max-w-xs" />
                </Row>
              </>
            ) : (
              <>
                <Row label="Система налогообложения" value={profile.business ? taxationLabels[profile.business.taxationSystem] ?? profile.business.taxationSystem : taxationLabels.npd} />
                <Row label="Ставка НДС" value={profile.business ? vatLabels[profile.business.vatRate] ?? profile.business.vatRate : vatLabels.none} />
              </>
            )}
            {editing && profile.person ? (
              <Row label="ФИО">
                <div className="grid max-w-xl gap-2 md:grid-cols-3">
                  <Input value={person.lastName} placeholder="Фамилия" onChange={event => setPerson(current => ({ ...current, lastName: event.target.value }))} />
                  <Input value={person.firstName} placeholder="Имя" onChange={event => setPerson(current => ({ ...current, firstName: event.target.value }))} />
                  <Input value={person.middleName} placeholder="Отчество" onChange={event => setPerson(current => ({ ...current, middleName: event.target.value }))} />
                </div>
              </Row>
            ) : (
              <Row label={profile.person ? 'ФИО' : director?.position ?? 'Руководитель'} value={personName} />
            )}
            <Row label="Название кабинета" value={provider.displayName} />
            {profile.business && <Row label="Наименование" value={profile.business.legalName} />}
            {profile.business && <Row label="Адрес регистрации" value={profile.business.legalAddress} />}
            {profile.business && <Row label={profile.kind === 'company' ? 'ОГРН' : 'ОГРНИП'} value={profile.business.registrationNumber} />}
            <Row label="ИНН" value={profile.inn} />
            {profile.company && <Row label="КПП" value={profile.company.kpp} />}
          </dl>
          {editing ? (
            <div className="mt-4 flex gap-2">
              <Button variant="primary" onClick={() => void save()} loading={saving}>
                <Save size={14} /> Сохранить
              </Button>
              <Button variant="secondary" onClick={() => setEditing(false)} disabled={saving}>
                <X size={14} /> Отмена
              </Button>
            </div>
          ) : (
            <p className="mt-4 max-w-2xl text-sm text-gray-500">
              Чтобы изменить форму собственности или ИНН, создайте новый кабинет.
            </p>
          )}

          <h2 className="mt-10 text-base font-semibold text-gray-950">Реквизиты</h2>
          <dl className="mt-3 max-w-3xl">
            {payout?.hasDetails ? (
              <>
                <Row label="Платёжный метод" value={payout.method === 'sbp' ? 'СБП по номеру телефона' : 'Банковский счёт'} />
                {payout.method === 'sbp' ? (
                  <Row label="Телефон" value={payout.phone ?? '—'} />
                ) : (
                  <Row label="Расчётный счёт" value={payout.account ?? '—'} />
                )}
                {payout.bik && <Row label="БИК банка" value={payout.bik} />}
                <Row label="Название банка" value={payout.bankName ?? '—'} />
                <Row label="Валюта" value="RUB" />
              </>
            ) : (
              <Row label="Платёжный метод" value={payout?.method === 'sbp' ? 'СБП по номеру телефона — реквизиты не указаны' : 'Банковский счёт — реквизиты не указаны'} />
            )}
          </dl>
          <button type="button" onClick={() => onNavigate('/settings/payouts')} className="mt-3 text-sm font-medium text-blue-700 hover:underline">
            {payout?.hasDetails ? 'Изменить реквизиты' : 'Указать реквизиты'}
          </button>
        </>
      )}
    </div>
  );
}

function Row({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-b border-gray-100 py-3 text-sm md:grid-cols-[220px_1fr] md:gap-6">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-gray-900">{children ?? value ?? '—'}</dd>
    </div>
  );
}
