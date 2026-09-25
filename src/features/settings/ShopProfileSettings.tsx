import { useEffect, useState } from 'react';
import { Pencil, Save, X } from 'lucide-react';
import { AddressAutocomplete } from '../../components/ui/AddressAutocomplete';
import { Button } from '../../components/ui/Button';
import { DetailList, DetailRow } from '../../components/ui/DetailList';
import { Input } from '../../components/ui/Input';
import { RuPhoneInput } from '../../components/ui/RuPhoneInput';
import { Textarea } from '../../components/ui/Textarea';
import { ApiError, profileApi } from '../../lib/api-client';
import type { Provider } from '../../types';
import { useAuth } from '../../context/useAuth';
import { useProvider } from '../providers/ProviderContext';
import { SectionPage } from '../../components/layout/SectionPage';

/** What the shop looks like to a customer. Read here, changed on /settings/shop/edit. */
export function ShopProfileView({ onNavigate }: { onNavigate: (path: string) => void }) {
  const provider = useProvider();
  const [profile, setProfile] = useState<Provider | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    profileApi.get()
      .then(next => {
        if (!cancelled) setProfile(next);
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Не удалось загрузить профиль проката.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [provider.providerId]);

  return (
    <SectionPage
      title="Профиль проката"
      description="Название, контакты и описание — то, что видят клиенты. Юридические данные в разделе «Информация о продавце»."
      action={
        !loading && (
          <Button type="button" variant="secondary" onClick={() => onNavigate('/settings/shop/edit')}>
            <Pencil size={14} /> Редактировать
          </Button>
        )
      }
      error={error}
    >
      {loading ? (
        <p className="text-sm text-gray-500">Загружаем профиль...</p>
      ) : (
        <DetailList>
          <DetailRow label="Название проката" value={profile?.displayName ?? provider.displayName} />
          <DetailRow label="Email" value={profile?.contactEmail} />
          <DetailRow label="Телефон" value={profile?.contactPhone} />
          <DetailRow label="Адрес" value={profile?.address} />
          <DetailRow label="Описание" value={profile?.description} />
        </DetailList>
      )}
    </SectionPage>
  );
}

/** The editable twin of the view above; saving returns to it. */
export function ShopProfileEdit({ onNavigate }: { onNavigate: (path: string) => void }) {
  const provider = useProvider();
  const { reloadSession } = useAuth();
  const [form, setForm] = useState({
    displayName: provider.displayName,
    contactEmail: '',
    contactPhone: '',
    address: '',
    description: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    profileApi.get()
      .then(next => {
        if (cancelled) return;
        setForm({
          displayName: next.displayName ?? provider.displayName,
          contactEmail: next.contactEmail ?? '',
          // The input takes the local ten digits; the API stores +7…
          contactPhone: (next.contactPhone ?? '').replace(/^\+7/, ''),
          address: next.address ?? '',
          description: next.description ?? '',
        });
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Не удалось загрузить профиль проката.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [provider.providerId, provider.displayName]);

  const save = async () => {
    const displayName = form.displayName.trim();
    if (!displayName) {
      setError('Укажите название проката.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await profileApi.patch({
        displayName,
        contactEmail: form.contactEmail.trim() || undefined,
        contactPhone: form.contactPhone.trim() ? `+7${form.contactPhone.replace(/\D/g, '')}` : undefined,
        address: form.address.trim() || undefined,
        description: form.description.trim() || undefined,
      });
      // The name shows in the header's cabinet switcher, so the session has to hear about it.
      await reloadSession();
      onNavigate('/settings/shop');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить профиль.');
      setSaving(false);
    }
  };

  return (
    <SectionPage
      title="Редактирование профиля"
      description="Изменения увидят клиенты после сохранения."
      breadcrumb={{ label: 'Профиль проката', path: '/settings/shop' }}
      onNavigate={onNavigate}
      error={error}
    >
      {loading ? (
        <p className="text-sm text-gray-500">Загружаем профиль...</p>
      ) : (
        <div className="max-w-3xl space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Название проката"
              value={form.displayName}
              onChange={event => setForm(current => ({ ...current, displayName: event.target.value }))}
            />
            <Input
              label="Email"
              type="email"
              value={form.contactEmail}
              onChange={event => setForm(current => ({ ...current, contactEmail: event.target.value }))}
            />
            <RuPhoneInput
              label="Телефон"
              value={form.contactPhone}
              onChange={value => setForm(current => ({ ...current, contactPhone: value }))}
            />
            <AddressAutocomplete
              label="Адрес"
              value={form.address}
              onChange={value => setForm(current => ({ ...current, address: value }))}
            />
          </div>
          <Textarea
            label="Описание"
            rows={4}
            value={form.description}
            onChange={event => setForm(current => ({ ...current, description: event.target.value }))}
            placeholder="Коротко о прокате, условиях выдачи и особенностях магазина..."
          />
          <div className="flex gap-2 pt-1">
            <Button variant="primary" onClick={() => void save()} loading={saving}>
              <Save size={14} /> Сохранить
            </Button>
            <Button variant="secondary" disabled={saving} onClick={() => onNavigate('/settings/shop')}>
              <X size={14} /> Отмена
            </Button>
          </div>
        </div>
      )}
    </SectionPage>
  );
}
