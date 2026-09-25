import { useEffect, useState } from 'react';
import { Save, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { DetailList, DetailRow } from '../../components/ui/DetailList';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { ApiError, providerApi } from '../../lib/api-client';
import type { SellerProfile } from '../../types';
import { useProvider } from '../providers/ProviderContext';
import { kindLabel, taxationSystemOptions, vatRateOptions } from '../providers/providerStatus';
import { SettingsSection } from './SettingsSection';

/**
 * The editable part of «Информация о продавце». Only what a seller may change: the taxation system,
 * the VAT rate, and a самозанятый's own name. Kind, ИНН and everything the registry supplied are
 * shown for context but never editable — those follow a new cabinet, not a form.
 */
export function SellerProfileEdit({ onNavigate }: { onNavigate: (path: string) => void }) {
  const provider = useProvider();
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [taxationSystem, setTaxationSystem] = useState('usn');
  const [vatRate, setVatRate] = useState('none');
  const [person, setPerson] = useState({ lastName: '', firstName: '', middleName: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
  }, [provider.providerId]);

  const save = async () => {
    if (!profile) return;
    if (profile.person && (!person.lastName.trim() || !person.firstName.trim())) {
      setError('Укажите фамилию и имя.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await providerApi.updateSellerProfile({
        kind: profile.kind,
        inn: profile.inn,
        ...(profile.business ? { taxationSystem, vatRate } : {}),
        ...(profile.person
          ? { person: { lastName: person.lastName.trim(), firstName: person.firstName.trim(), middleName: person.middleName.trim() || null } }
          : {}),
      });
      onNavigate('/settings/seller');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить.');
      setSaving(false);
    }
  };

  return (
    <SettingsSection
      title="Редактирование данных продавца"
      breadcrumb={{ label: 'Информация о продавце', path: '/settings/seller' }}
      onNavigate={onNavigate}
      error={error}
    >
      {loading || !profile ? (
        <p className="text-sm text-gray-500">Загружаем...</p>
      ) : (
        <div className="max-w-3xl space-y-6">
          <DetailList>
            <DetailRow label="Форма собственности" value={kindLabel(profile.kind)} hint="Не меняется" />
            <DetailRow label="ИНН" value={profile.inn} hint="Не меняется" />
            {profile.business && <DetailRow label="Наименование" value={profile.business.legalName} />}
          </DetailList>

          <div className="grid gap-4 md:grid-cols-2">
            {profile.business && (
              <>
                <Select
                  label="Система налогообложения"
                  value={taxationSystem}
                  options={taxationSystemOptions}
                  onChange={event => setTaxationSystem(event.target.value)}
                />
                <Select
                  label="Ставка НДС"
                  value={vatRate}
                  options={vatRateOptions}
                  onChange={event => setVatRate(event.target.value)}
                />
              </>
            )}
            {profile.person && (
              <>
                <Input label="Фамилия" value={person.lastName} onChange={event => setPerson(current => ({ ...current, lastName: event.target.value }))} />
                <Input label="Имя" value={person.firstName} onChange={event => setPerson(current => ({ ...current, firstName: event.target.value }))} />
                <Input label="Отчество" value={person.middleName} onChange={event => setPerson(current => ({ ...current, middleName: event.target.value }))} />
              </>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="primary" loading={saving} onClick={() => void save()}>
              <Save size={14} /> Сохранить
            </Button>
            <Button variant="secondary" disabled={saving} onClick={() => onNavigate('/settings/seller')}>
              <X size={14} /> Отмена
            </Button>
          </div>
        </div>
      )}
    </SettingsSection>
  );
}
