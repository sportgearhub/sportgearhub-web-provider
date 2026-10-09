import { useEffect, useState } from 'react';
import { Save, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { DetailList, DetailRow } from '../../components/ui/DetailList';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { useGoBack } from '../../lib/useGoBack';
import { ApiError, providerApi } from '../../lib/api-client';
import { sellerRegistry } from '../../types';
import type { SellerProfile } from '../../types';
import { useProvider } from '../providers/ProviderContext';
import { kindLabel, taxationSystemOptions, vatRateOptions } from '../providers/providerStatus';
import { SectionPage } from '../../components/layout/SectionPage';

/**
 * The editable part of «Информация о продавце». Only what a seller may change: the taxation system,
 * the VAT rate, and a самозанятый's own name. Kind, ИНН and everything the registry supplied are
 * shown for context but never editable — those follow a new cabinet, not a form.
 */
export function SellerProfileEdit({ onNavigate }: { onNavigate: (path: string) => void }) {
  // Stepping back pops the entry you came from; navigating to it pushes a second copy, and then
  // «Назад» lands on the editor again.
  const goBack = useGoBack('/settings/seller');
  const provider = useProvider();
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [taxationSystem, setTaxationSystem] = useState('usn');
  const [vatRate, setVatRate] = useState('none');
  const [person, setPerson] = useState({ surname: '', name: '', patronymic: '' });
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
        if (next.kind === 'self_employed') {
          setPerson({
            surname: next.person.surname,
            name: next.person.name,
            patronymic: next.person.patronymic ?? '',
          });
        } else {
          setTaxationSystem(next.taxationSystem);
          setVatRate(next.vatRate);
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

  const registry = profile ? sellerRegistry(profile) : null;

  const save = async () => {
    if (!profile) return;
    if (profile.kind === 'self_employed' && (!person.surname.trim() || !person.name.trim())) {
      setError('Укажите фамилию и имя.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      // The payload is the kind's, not a common shape with optional halves: a самозанятый sends a
      // name, and a registered seller sends how it is taxed — the registry owns the rest.
      await providerApi.updateSellerProfile(
        profile.kind === 'self_employed'
          ? {
            kind: 'self_employed',
            inn: profile.inn,
            person: {
              surname: person.surname.trim(),
              name: person.name.trim(),
              patronymic: person.patronymic.trim() || null,
            },
          }
          : { kind: profile.kind, inn: profile.inn, taxationSystem, vatRate }
      );
      goBack();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить.');
      setSaving(false);
    }
  };

  return (
    <SectionPage
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
            {registry && <DetailRow label="Наименование" value={registry.legalName} />}
          </DetailList>

          <div className="grid gap-4 md:grid-cols-2">
            {registry && (
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
            {profile.kind === 'self_employed' && (
              <>
                <Input label="Фамилия" value={person.surname} onChange={event => setPerson(current => ({ ...current, surname: event.target.value }))} />
                <Input label="Имя" value={person.name} onChange={event => setPerson(current => ({ ...current, name: event.target.value }))} />
                <Input label="Отчество" value={person.patronymic} onChange={event => setPerson(current => ({ ...current, patronymic: event.target.value }))} />
              </>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="primary" loading={saving} onClick={() => void save()}>
              <Save size={14} /> Сохранить
            </Button>
            <Button variant="secondary" disabled={saving} onClick={goBack}>
              <X size={14} /> Отмена
            </Button>
          </div>
        </div>
      )}
    </SectionPage>
  );
}
