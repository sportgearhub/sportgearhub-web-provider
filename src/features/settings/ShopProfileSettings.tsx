import { useEffect, useRef, useState } from 'react';
import { ImageOff, Save, X } from 'lucide-react';
import { AddressAutocomplete } from '../../components/ui/AddressAutocomplete';
import { Button } from '../../components/ui/Button';
import { DetailList, DetailRow } from '../../components/ui/DetailList';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { useGoBack } from '../../lib/useGoBack';
import { ApiError, mediaUrl, profileApi } from '../../lib/api-client';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { CopyValue } from '../../components/ui/CopyValue';
import { STOREFRONT_BASE_URL } from '../providers/providerStatus';
import type { Provider, SellerPhoto } from '../../types';
import { useAuth } from '../../context/useAuth';
import { useProvider } from '../providers/ProviderContext';
import { SectionPage } from '../../components/layout/SectionPage';
import { SectionEdit, SettingsCard } from '../../components/layout/SettingsCard';
import { ContactsCard } from './ContactsCard';

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
    <div className="space-y-4 p-6">
      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="max-w-3xl space-y-4">
        <SettingsCard
          title="Витрина проката"
          description="Название, адрес и описание — то, что видят клиенты. Юридические данные живут в разделе «Информация о продавце»."
          action={
            !loading && (
              <SectionEdit onClick={() => onNavigate('/settings/shop/edit')} label="Редактировать профиль проката" />
            )
          }
        >
          {loading ? (
            <p className="text-sm text-gray-500">Загружаем профиль...</p>
          ) : (
            <DetailList>
              <DetailRow label="Название проката" value={profile?.displayName ?? provider.displayName} />
              <DetailRow label="Адрес" value={profile?.address} />
              <DetailRow label="Описание" value={profile?.description} multiline />
            </DetailList>
          )}
        </SettingsCard>

        {/* Its own card and its own endpoint: a photo is chosen, not filled in, and saving it
            with a form of text fields would mean holding an upload hostage to a name change. */}
        <SettingsCard title="Фото проката" description="Клиенты видят его на странице проката. JPEG, PNG или WebP, до 5 МБ.">
          {loading ? (
            <p className="text-sm text-gray-500">Загружаем…</p>
          ) : (
            <ShopPhoto
              photo={profile?.photo ?? null}
              onChange={photo => setProfile(current => (current ? { ...current, photo } : current))}
            />
          )}
        </SettingsCard>

        {/* And its own again: a slug is a published address, and changing it breaks the links
            already handed out — that is not a thing to do in passing while fixing a typo. */}
        <ShopSlugCard
          slug={profile?.slug ?? null}
          loading={loading}
          onSaved={slug => setProfile(current => (current ? { ...current, slug } : current))}
        />

        {/* Eight kinds rather than the two the profile could hold — and the six that were in the
            model all along, reachable from nowhere until the endpoint existed. */}
        <ContactsCard />
      </div>
    </div>
  );
}

/**
 * The cabinet's photo.
 *
 * Its own endpoint, so it is saved the moment it is chosen rather than waiting for a form — and
 * the upload replaces whatever was there, which is why there is no gallery here and no «сделать
 * главной». The URL does not change between photos, so `updatedAt` is hung off it: without that
 * the browser goes on showing the one it already has.
 */
function ShopPhoto({ photo, onChange }: { photo: SellerPhoto | null; onChange: (photo: SellerPhoto | null) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setBusy(true);
    setError('');
    try {
      onChange(await profileApi.uploadPhoto(file));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить фото.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const remove = async () => {
    setBusy(true);
    setError('');
    try {
      await profileApi.deletePhoto();
      onChange(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось удалить фото.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      {photo ? (
        <img
          src={`${mediaUrl(photo.url)}?v=${encodeURIComponent(photo.updatedAt)}`}
          alt=""
          className="h-20 w-20 shrink-0 rounded-2xl border border-gray-200 object-cover"
        />
      ) : (
        <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 text-gray-300">
          <ImageOff size={22} />
        </span>
      )}

      <div className="min-w-0">
        {error && <p className="mb-1 text-xs text-red-600">{error}</p>}

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" loading={busy} onClick={() => inputRef.current?.click()}>
            {photo ? 'Заменить' : 'Загрузить'}
          </Button>
          {photo && (
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => void remove()}>
              Удалить
            </Button>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={event => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
      </div>
    </div>
  );
}

/**
 * The storefront's address for this prokat.
 *
 * Its own card and its own save, because it is not a description: it is the link already printed
 * on somebody's card, and the field warns rather than letting it be retyped in passing. One
 * `PATCH` with one field, so nothing else on the profile is touched by changing it.
 */
function ShopSlugCard({
  slug,
  loading,
  onSaved,
}: {
  slug: string | null;
  loading: boolean;
  onSaved: (slug: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const open = () => {
    setValue(slug ?? '');
    setError('');
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const next = await profileApi.patch({ slug: value.trim() });
      onSaved(next.slug ?? value.trim());
      setEditing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить адрес витрины.');
    } finally {
      setSaving(false);
    }
  };

  const host = STOREFRONT_BASE_URL.replace(/^https?:\/\//, '');

  return (
    <SettingsCard
      title="Адрес витрины"
      description="По этой ссылке клиенты открывают страницу проката."
      action={!loading && <SectionEdit onClick={open} empty={!slug} label="Изменить адрес витрины" />}
    >
      {loading ? (
        <p className="text-sm text-gray-500">Загружаем…</p>
      ) : slug ? (
        <CopyValue value={`${STOREFRONT_BASE_URL}/${slug}`} label="ссылка на витрину" className="text-xs" />
      ) : (
        <p className="text-sm text-gray-500">Не задан — страница проката открывается по длинной ссылке.</p>
      )}

      <BottomSheet
        open={editing}
        onClose={() => setEditing(false)}
        title="Адрес витрины"
        center
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1 justify-center" onClick={() => setEditing(false)}>
              Отмена
            </Button>
            <Button
              variant="primary"
              className="flex-1 justify-center"
              loading={saving}
              disabled={!value.trim()}
              onClick={() => void save()}
            >
              Сохранить
            </Button>
          </div>
        }
      >
        <div className="space-y-3 px-5 pb-4 pt-1">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Input
            label="Адрес витрины"
            value={value}
            // Latin letters, digits and hyphens: it is part of a URL, and anything else would be
            // escaped into something nobody can read back off a business card.
            onChange={event => setValue(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            placeholder="prokat-na-lenina"
            hint={`${host}/${value || '…'}`}
          />
          {slug && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs leading-4 text-amber-900">
              Старая ссылка перестанет работать. Если вы уже раздали её клиентам или напечатали —
              лучше оставить как есть.
            </p>
          )}
        </div>
      </BottomSheet>
    </SettingsCard>
  );
}

/** The editable twin of the view above; saving returns to it. */
export function ShopProfileEdit({ onNavigate }: { onNavigate: (path: string) => void }) {
  const provider = useProvider();
  const { reloadSession } = useAuth();
  const goBack = useGoBack('/settings/shop');
  const [form, setForm] = useState({
    displayName: provider.displayName,
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
        address: form.address.trim() || undefined,
        description: form.description.trim() || undefined,
      });
      // The name shows in the header's cabinet switcher, so the session has to hear about it.
      await reloadSession();
      goBack();
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
        <div className="max-w-2xl space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Название проката"
              value={form.displayName}
              onChange={event => setForm(current => ({ ...current, displayName: event.target.value }))}
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
            <Button variant="secondary" disabled={saving} onClick={goBack}>
              <X size={14} /> Отмена
            </Button>
          </div>
        </div>
      )}
    </SectionPage>
  );
}
