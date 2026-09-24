import { useEffect, useState } from 'react';
import { Building2, Save, UserRound } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { ApiError, providerApi } from '../../lib/api-client';
import type { SellerProfile } from '../../types';
import { kindLabel, taxationSystemOptions, vatRateOptions } from '../providers/providerStatus';

/**
 * «Продавец» — the legal party. Registry facts are shown, not edited; what the seller decides
 * (taxation system, VAT rate, or a самозанятый's name) is the form. Kind and ИНН never change.
 */
export function SellerProfileSettings() {
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [taxationSystem, setTaxationSystem] = useState('usn');
  const [vatRate, setVatRate] = useState('none');
  const [person, setPerson] = useState({ lastName: '', firstName: '', middleName: '' });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    providerApi.sellerProfile()
      .then(next => {
        if (cancelled) return;
        setProfile(next);
        if (next.business) {
          setTaxationSystem(next.business.taxationSystem);
          setVatRate(next.business.vatRate);
        }
        if (next.person) {
          setPerson({ lastName: next.person.lastName, firstName: next.person.firstName, middleName: next.person.middleName ?? '' });
        }
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Не удалось загрузить данные продавца.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const next = await providerApi.updateSellerProfile({
        kind: profile.kind,
        inn: profile.inn,
        ...(profile.business ? { taxationSystem, vatRate } : {}),
        ...(profile.person ? { person: { lastName: person.lastName.trim(), firstName: person.firstName.trim(), middleName: person.middleName.trim() || null } } : {}),
      });
      setProfile(next);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="rounded-none border-0 p-6 shadow-none">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Продавец</h2>
          <p className="mt-0.5 text-xs text-gray-500">Юридическая сторона кабинета — кому платформа перечисляет деньги.</p>
        </div>
        {saved && <Badge variant="green">сохранено</Badge>}
      </div>
      {error && <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      {loading ? (
        <p className="text-sm text-gray-500">Загружаем данные продавца...</p>
      ) : !profile ? (
        <p className="text-sm text-gray-500">Данные продавца не заданы.</p>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-3 text-sm md:grid-cols-2">
            <Fact label="Форма" value={kindLabel(profile.kind)} />
            <Fact label="ИНН" value={profile.inn} />
            {profile.business && (
              <>
                <Fact label="Наименование" value={profile.business.legalName} wide />
                <Fact label={profile.kind === 'company' ? 'ОГРН' : 'ОГРНИП'} value={profile.business.registrationNumber} />
                {profile.company && <Fact label="КПП" value={profile.company.kpp} />}
                <Fact label="Юридический адрес" value={profile.business.legalAddress} wide />
                <Fact
                  label={profile.business.director.position}
                  value={[profile.business.director.lastName, profile.business.director.firstName, profile.business.director.middleName].filter(Boolean).join(' ')}
                  wide
                />
              </>
            )}
          </div>
          <p className="flex items-center gap-1.5 text-xs text-gray-500">
            {profile.business ? <Building2 size={13} /> : <UserRound size={13} />}
            Форма и ИНН заданы при создании кабинета и не меняются. Другая форма бизнеса — другой кабинет.
          </p>
          {profile.business ? (
            <div className="grid gap-3 md:grid-cols-2">
              <Select label="Система налогообложения" value={taxationSystem} options={taxationSystemOptions} onChange={event => setTaxationSystem(event.target.value)} />
              <Select label="Ставка НДС в чеке клиенту" value={vatRate} options={vatRateOptions} onChange={event => setVatRate(event.target.value)} />
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              <Input label="Фамилия" value={person.lastName} onChange={event => setPerson(current => ({ ...current, lastName: event.target.value }))} />
              <Input label="Имя" value={person.firstName} onChange={event => setPerson(current => ({ ...current, firstName: event.target.value }))} />
              <Input label="Отчество" value={person.middleName} onChange={event => setPerson(current => ({ ...current, middleName: event.target.value }))} />
            </div>
          )}
          <Button variant="primary" onClick={() => void save()} loading={saving}>
            <Save size={14} /> Сохранить
          </Button>
        </div>
      )}
    </Card>
  );
}

function Fact({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? 'md:col-span-2' : undefined}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-0.5 text-gray-900">{value || '—'}</p>
    </div>
  );
}
