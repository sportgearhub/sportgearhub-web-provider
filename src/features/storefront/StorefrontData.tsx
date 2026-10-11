import { useRef, useState } from 'react';
import { ImageOff, Pencil, Trash2 } from 'lucide-react';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { CopyValue } from '../../components/ui/CopyValue';
import { Input } from '../../components/ui/Input';
import { Skeleton } from '../../components/ui/Skeleton';
import { ApiError, mediaUrl, profileApi } from '../../lib/api-client';
import { storefrontProviderUrl } from '../providers/providerStatus';
import { ContactsCard } from '../settings/ContactsCard';
import { SettingsCard } from '../../components/layout/SettingsCard';
import { SectionEdit } from '../../components/layout/SettingsCard';
import type { Provider, SellerPhoto } from '../../types';

export type LinkMode = 'slug' | 'id';

/**
 * Данные витрины — the three things a storefront is addressed and recognised by, then everything
 * else about it.
 *
 * Grouped the way the references group them, because they are one subject: the link, the name and
 * the logo are what a customer meets before they have read a word of the description. Each is its
 * own card with its own save, since each is its own call — and a form that saved all three would
 * hold a new logo hostage to a name the seller had not finished typing.
 */
export function StorefrontData({
  profile,
  providerId,
  loading,
  linkMode,
  onLinkMode,
  onProfile,
  onNavigate,
}: {
  profile: Provider | null;
  providerId: string;
  loading: boolean;
  linkMode: LinkMode;
  onLinkMode: (mode: LinkMode) => void;
  onProfile: (patch: Partial<Provider>) => void;
  onNavigate: (path: string) => void;
}) {
  return (
    <div className="space-y-4">
      {/* One block, because the three inside it answer one question: how a customer finds and
          recognises this prokat. */}
      <section className="rounded-2xl bg-gray-50 p-3">
        <h2 className="px-1 pb-2 text-sm font-semibold text-gray-600">Ссылка, название и логотип</h2>

        <div className="space-y-3">
          <LinkCard
            slug={profile?.slug ?? null}
            providerId={providerId}
            loading={loading}
            mode={linkMode}
            onMode={onLinkMode}
            onSaved={slug => onProfile({ slug })}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <NameCard
              name={profile?.displayName ?? null}
              loading={loading}
              onSaved={displayName => onProfile({ displayName })}
            />
            <LogoCard
              photo={profile?.photo ?? null}
              loading={loading}
              onChange={photo => onProfile({ photo })}
            />
          </div>
        </div>
      </section>

      {/* Everything that is read after the customer has arrived. */}
      <SettingsCard
        title="О прокате"
        description="Описание и адрес — то, что клиент читает на странице проката."
        action={!loading && <SectionEdit onClick={() => onNavigate('/settings/shop/edit')} label="Редактировать" />}
      >
        {loading ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <dl className="divide-y divide-gray-100 text-sm">
            <div className="py-2.5">
              <dt className="text-xs text-gray-500">Адрес</dt>
              <dd className="mt-0.5 text-gray-900">{profile?.address || <span className="text-gray-400">Не указан</span>}</dd>
            </div>
            <div className="py-2.5">
              <dt className="text-xs text-gray-500">Описание</dt>
              <dd className="mt-0.5 whitespace-pre-line text-gray-900">
                {profile?.description || <span className="text-gray-400">Не заполнено</span>}
              </dd>
            </div>
          </dl>
        )}
      </SettingsCard>

      <ContactsCard />
    </div>
  );
}

/** The address of the storefront, in either of the two forms the app's route accepts. */
function LinkCard({
  slug,
  providerId,
  loading,
  mode,
  onMode,
  onSaved,
}: {
  slug: string | null;
  providerId: string;
  loading: boolean;
  mode: LinkMode;
  onMode: (mode: LinkMode) => void;
  onSaved: (slug: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const url = storefrontProviderUrl(mode === 'slug' && slug ? slug : providerId);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const next = await profileApi.patch({ slug: value.trim() });
      onSaved(next.slug ?? value.trim());
      setEditing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить адрес.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-950">Ссылка на магазин</h3>

        {/* Both forms work — the app's route takes a slug or the cabinet's id — so this is a
            choice of which to hand out rather than a setting with a wrong answer. */}
        <div className="flex gap-1 rounded-lg bg-gray-100 p-0.5">
          {([['slug', 'Название'], ['id', 'Seller ID']] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => onMode(key)}
              disabled={key === 'slug' && !slug}
              title={key === 'slug' && !slug ? 'Сначала задайте адрес' : undefined}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition disabled:opacity-40 ${
                mode === key ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <Skeleton className="mt-3 h-9 w-full" />
      ) : (
        <div className="mt-3 flex items-center gap-2">
          <span className="min-w-0 flex-1 rounded-lg bg-gray-50 px-3 py-2">
            <CopyValue value={url} label="ссылка на витрину" className="text-xs" />
          </span>
          <button
            type="button"
            onClick={() => { setValue(slug ?? ''); setError(''); setEditing(true); }}
            aria-label={slug ? 'Изменить адрес' : 'Задать адрес'}
            title={slug ? 'Изменить адрес' : 'Задать адрес'}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
          >
            <Pencil size={16} />
          </button>
        </div>
      )}

      <p className="mt-2 text-xs leading-5 text-gray-500">
        Дайте ссылку в соцсетях или на визитке. Можно выбрать вид: с названием или с Seller ID —
        обе ведут на одну страницу.
      </p>

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
            onChange={event => setValue(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            placeholder="prokat-na-lenina"
            hint={storefrontProviderUrl(value || '…').replace(/^https?:\/\//, '')}
          />
          {slug && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs leading-4 text-amber-900">
              Старая ссылка перестанет работать. Если вы уже раздали её клиентам — лучше оставить
              как есть.
            </p>
          )}
        </div>
      </BottomSheet>
    </div>
  );
}

/** The name, which is a field of the profile and saves on its own. */
function NameCard({
  name,
  loading,
  onSaved,
}: {
  name: string | null;
  loading: boolean;
  onSaved: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const next = await profileApi.patch({ displayName: value.trim() });
      onSaved(next.displayName ?? value.trim());
      setEditing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить название.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-950">Название</h3>
        {!loading && (
          <button
            type="button"
            onClick={() => { setValue(name ?? ''); setError(''); setEditing(true); }}
            aria-label="Изменить название"
            title="Изменить название"
            className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
          >
            <Pencil size={16} />
          </button>
        )}
      </div>

      {loading ? <Skeleton className="mt-2 h-5 w-2/3" /> : (
        <p className="mt-1 text-sm text-gray-900">{name || <span className="text-gray-400">Не указано</span>}</p>
      )}

      <p className="mt-2 text-xs leading-5 text-gray-500">
        Под ним прокат виден в каталоге и на странице товара.
      </p>

      <BottomSheet
        open={editing}
        onClose={() => setEditing(false)}
        title="Название проката"
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
            label="Название проката"
            value={value}
            onChange={event => setValue(event.target.value)}
            placeholder="Прокат на Ленина"
          />
        </div>
      </BottomSheet>
    </div>
  );
}

/**
 * The logo, with two icons rather than two buttons.
 *
 * Its own endpoint, so choosing a file saves it: a picture is picked, not filled in, and a form
 * around it would mean an upload waiting on a name change.
 */
function LogoCard({
  photo,
  loading,
  onChange,
}: {
  photo: SellerPhoto | null;
  loading: boolean;
  onChange: (photo: SellerPhoto | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const run = async (action: () => Promise<SellerPhoto | null>) => {
    setBusy(true);
    setError('');
    try {
      onChange(await action());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить фото.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="rounded-xl bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-950">Логотип</h3>
        {!loading && (
          <span className="-mr-1 flex shrink-0 items-center">
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              aria-label={photo ? 'Заменить логотип' : 'Загрузить логотип'}
              title={photo ? 'Заменить' : 'Загрузить'}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 disabled:opacity-40"
            >
              <Pencil size={16} />
            </button>
            {photo && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(async () => { await profileApi.deletePhoto(); return null; })}
                aria-label="Удалить логотип"
                title="Удалить"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
              >
                <Trash2 size={16} />
              </button>
            )}
          </span>
        )}
      </div>

      <div className="mt-1 flex items-center gap-3">
        {loading ? (
          <Skeleton className="h-16 w-16" />
        ) : photo ? (
          <img
            // The URL survives a replacement, so the version is what makes a new photo show.
            src={`${mediaUrl(photo.url)}?v=${encodeURIComponent(photo.updatedAt)}`}
            alt=""
            className="h-16 w-16 shrink-0 rounded-xl border border-gray-200 object-cover"
          />
        ) : (
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 text-gray-300">
            <ImageOff size={20} />
          </span>
        )}
        <p className="min-w-0 text-xs leading-5 text-gray-500">
          Покажем на странице проката и в списке прокатов. JPEG, PNG или WebP, до 5 МБ.
        </p>
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={event => {
          const file = event.target.files?.[0];
          if (file) void run(() => profileApi.uploadPhoto(file));
        }}
      />
    </div>
  );
}
