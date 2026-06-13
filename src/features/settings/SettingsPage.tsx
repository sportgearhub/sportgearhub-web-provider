import { useEffect, useState } from 'react';
import { Building2, Globe2, MapPin, Plus, Save, Trash2, UserRound, UsersRound } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { useAuth } from '../../context/useAuth';
import { addressesApi, ApiError, profileApi, providerMembersApi, storefrontApi } from '../../lib/api-client';
import type { RuAddressSuggestion } from '../../lib/api-client';
import type { Provider, ProviderInvitation, ProviderMember, ProviderMemberRoleOption, StorefrontEditSession, StorefrontSettings } from '../../types';
import { LocationsPage } from '../locations/LocationsPage';

type SettingsTab = 'shop' | 'storefront' | 'locations' | 'account' | 'employees';
type StorefrontTab = 'settings' | 'live';

interface SettingsPageProps {
  tab: SettingsTab;
  onNavigate: (path: string) => void;
}

const tabs: { id: SettingsTab; label: string; path: string; icon: typeof Building2 }[] = [
  { id: 'account', label: 'Аккаунт', path: '/settings/account', icon: UserRound },
  { id: 'employees', label: 'Сотрудники', path: '/settings/employees', icon: UsersRound },
  { id: 'locations', label: 'Локации', path: '/settings/locations', icon: MapPin },
];

const reservedProviderSlugs = new Set([
  'www',
  'api',
  'admin',
  'app',
  'crm',
  'support',
  'mail',
]);

export function SettingsPage({ tab, onNavigate }: SettingsPageProps) {
  const showSettingsTabs = tab !== 'shop' && tab !== 'storefront';

  return (
    <div className="flex min-h-full flex-col bg-white">
      {showSettingsTabs && (
        <div className="shrink-0 border-b border-gray-200 bg-white px-6">
          <div className="flex flex-wrap gap-2">
            {tabs.map(item => {
              const Icon = item.icon;
              const active = item.id === tab;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.path)}
                  className={`flex h-10 items-center gap-2 border-b-2 px-3 text-sm font-medium transition ${
                    active
                      ? 'border-blue-600 text-blue-700'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-900'
                  }`}
                >
                  <Icon size={15} />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 bg-white">
        {tab === 'shop' && <ShopProfileSettings />}
        {tab === 'storefront' && <StorefrontSettingsPage />}
        {tab === 'locations' && <LocationsPage embedded />}
        {tab === 'employees' && <EmployeesSettings />}
        {tab === 'account' && <AccountSettings />}
      </div>
    </div>
  );
}

function ShopProfileSettings() {
  const { activeMembership } = useAuth();
  const [form, setForm] = useState({
    displayName: activeMembership?.displayName ?? '',
    legalName: '',
    contactEmail: '',
    contactPhone: '',
    city: '',
    addressLine: '',
    description: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState<RuAddressSuggestion[]>([]);
  const [addressSuggestionsOpen, setAddressSuggestionsOpen] = useState(false);
  const [addressSuggestionsLoading, setAddressSuggestionsLoading] = useState(false);
  const [addressSuggestError, setAddressSuggestError] = useState('');
  const [addressFocused, setAddressFocused] = useState(false);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError('');
    profileApi.get()
      .then(nextProfile => {
        if (cancelled) return;
        setForm({
          displayName: nextProfile.displayName ?? activeMembership?.displayName ?? '',
          legalName: nextProfile.legalName ?? '',
          contactEmail: nextProfile.contactEmail ?? '',
          contactPhone: nextProfile.contactPhone ?? '',
          city: nextProfile.city ?? '',
          addressLine: nextProfile.addressLine ?? '',
          description: nextProfile.description ?? '',
        });
      })
      .catch(err => {
        if (!cancelled) {
          setError(err instanceof ApiError ? `Профиль магазина пока недоступен: ${err.message}` : 'Профиль магазина пока недоступен.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeMembership?.displayName]);

  useEffect(() => {
    const query = form.addressLine.trim();

    if (!addressFocused || query.length < 3) {
      setAddressSuggestions([]);
      setAddressSuggestionsOpen(false);
      setAddressSuggestError('');
      setAddressSuggestionsLoading(false);
      return;
    }

    let cancelled = false;
    setAddressSuggestionsLoading(true);

    const timer = window.setTimeout(async () => {
      try {
        const response = await addressesApi.ruSuggestions(query, 7);
        if (cancelled) return;
        setAddressSuggestions(response.suggestions);
        setAddressSuggestError('');
        setAddressSuggestionsOpen(true);
      } catch (err) {
        if (cancelled) return;
        setAddressSuggestions([]);
        setAddressSuggestError(err instanceof ApiError ? err.message : 'Не удалось загрузить адреса.');
        setAddressSuggestionsOpen(true);
      } finally {
        if (!cancelled) setAddressSuggestionsLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [addressFocused, form.addressLine]);

  const save = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await profileApi.patch({
        displayName: form.displayName.trim(),
        legalName: form.legalName.trim() || undefined,
        contactEmail: form.contactEmail.trim() || undefined,
        contactPhone: form.contactPhone.trim() || undefined,
        city: form.city.trim() || undefined,
        addressLine: form.addressLine.trim() || undefined,
        description: form.description.trim() || undefined,
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? `Не удалось сохранить профиль: ${err.message}` : 'Не удалось сохранить профиль.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="rounded-none border-0 p-6 shadow-none">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Основная информация</h2>
          <p className="mt-0.5 text-xs text-gray-500">Название, контакты и описание текущего магазина.</p>
        </div>
        {saved && <Badge variant="green">сохранено</Badge>}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Загружаем профиль магазина...</p>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="Название магазина"
              value={form.displayName}
              onChange={event => setForm(current => ({ ...current, displayName: event.target.value }))}
            />
            <Input
              label="Юридическое название"
              value={form.legalName}
              onChange={event => setForm(current => ({ ...current, legalName: event.target.value }))}
            />
            <Input
              label="Email"
              type="email"
              value={form.contactEmail}
              onChange={event => setForm(current => ({ ...current, contactEmail: event.target.value }))}
            />
            <Input
              label="Телефон"
              value={form.contactPhone}
              onChange={event => setForm(current => ({ ...current, contactPhone: event.target.value }))}
            />
            <Input
              label="Город"
              value={form.city}
              onChange={event => setForm(current => ({ ...current, city: event.target.value }))}
            />
            <div className="relative">
              <Input
                label="Адрес"
                value={form.addressLine}
                onChange={event => {
                  setForm(current => ({ ...current, addressLine: event.target.value }));
                  setAddressFocused(true);
                  setAddressSuggestionsOpen(true);
                }}
                onFocus={() => {
                  setAddressFocused(true);
                  if (addressSuggestions.length > 0 || addressSuggestError) setAddressSuggestionsOpen(true);
                }}
                onBlur={() => {
                  setAddressFocused(false);
                  setAddressSuggestionsOpen(false);
                }}
              />
              {addressSuggestionsOpen && (addressSuggestionsLoading || addressSuggestions.length > 0 || addressSuggestError) && (
                <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                  {addressSuggestionsLoading && <div className="px-3 py-2 text-xs text-gray-500">Ищем адрес...</div>}
                  {!addressSuggestionsLoading && addressSuggestError && <div className="px-3 py-2 text-xs text-red-600">{addressSuggestError}</div>}
                  {!addressSuggestionsLoading && !addressSuggestError && addressSuggestions.map(suggestion => (
                    <button
                      key={`${suggestion.fiasId ?? suggestion.value}-${suggestion.unrestrictedValue}`}
                      type="button"
                      onMouseDown={event => event.preventDefault()}
                      onClick={() => {
                        setForm(current => ({
                          ...current,
                          addressLine: suggestion.value,
                          city: current.city || suggestion.city || suggestion.settlement || '',
                        }));
                        setAddressSuggestions([]);
                        setAddressSuggestionsOpen(false);
                        setAddressSuggestError('');
                      }}
                      className="w-full px-3 py-2 text-left transition hover:bg-blue-50"
                    >
                      <span className="block truncate text-sm font-medium text-gray-900">{suggestion.value}</span>
                      {suggestion.unrestrictedValue && suggestion.unrestrictedValue !== suggestion.value && (
                        <span className="mt-0.5 block truncate text-[11px] text-gray-500">{suggestion.unrestrictedValue}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <Textarea
            label="Описание"
            rows={4}
            value={form.description}
            onChange={event => setForm(current => ({ ...current, description: event.target.value }))}
            placeholder="Коротко о прокате, условиях выдачи и особенностях магазина..."
          />
          <Button variant="primary" onClick={() => void save()} loading={saving}>
            <Save size={14} /> Сохранить
          </Button>
        </div>
      )}
    </Card>
  );
}

function StorefrontSettingsPage() {
  const [activeTab, setActiveTab] = useState<StorefrontTab>('settings');
  const [profile, setProfile] = useState<Provider | null>(null);
  const [storefront, setStorefront] = useState<StorefrontSettings | null>(null);
  const [editSession, setEditSession] = useState<StorefrontEditSession | null>(null);
  const [form, setForm] = useState({
    slug: '',
    enabled: false,
    publicName: '',
    description: '',
    primaryColor: '',
    accentColor: '',
    phone: '',
    email: '',
    telegram: '',
    whatsapp: '',
    seoTitle: '',
    seoDescription: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [slugError, setSlugError] = useState('');
  const [colorError, setColorError] = useState('');

  const normalizedSlug = form.slug.trim().toLowerCase();
  const publicUrl = storefront?.host ? `https://${storefront.host}` : normalizedSlug ? `https://${normalizedSlug}.sportgearhub.ru` : '';

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [nextProfile, nextStorefront] = await Promise.all([
        profileApi.get(),
        storefrontApi.get(),
      ]);
      setProfile(nextProfile);
      setStorefront(nextStorefront);
      const storefrontPhone = readStorefrontContact(nextStorefront, 'phone');
      const storefrontEmail = readStorefrontContact(nextStorefront, 'email');
      setForm({
        slug: nextStorefront.provider?.slug ?? nextProfile.slug ?? nextStorefront.slug ?? '',
        enabled: nextStorefront.enabled === true,
        publicName: nextStorefront.publicName ?? nextProfile.displayName ?? '',
        description: nextStorefront.description ?? '',
        primaryColor: nextStorefront.theme?.primaryColor ?? '',
        accentColor: nextStorefront.theme?.accentColor ?? '',
        phone: storefrontPhone || nextProfile.contactPhone || '',
        email: storefrontEmail || nextProfile.contactEmail || '',
        telegram: readStorefrontContact(nextStorefront, 'telegram'),
        whatsapp: readStorefrontContact(nextStorefront, 'whatsapp'),
        seoTitle: nextStorefront.seo?.title ?? nextStorefront.publicName ?? nextProfile.displayName ?? '',
        seoDescription: nextStorefront.seo?.description ?? '',
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить настройки сайта.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const validateSlug = () => {
    if (!normalizedSlug) return form.enabled ? 'Укажите slug перед включением сайта.' : '';
    if (normalizedSlug.length < 3 || normalizedSlug.length > 48) return 'Slug должен быть от 3 до 48 символов.';
    if (!/^[a-z0-9-]+$/.test(normalizedSlug)) return 'Используйте латинские буквы, цифры и дефисы.';
    if (normalizedSlug.startsWith('-') || normalizedSlug.endsWith('-')) return 'Slug не может начинаться или заканчиваться дефисом.';
    if (normalizedSlug.includes('--')) return 'Slug не может содержать два дефиса подряд.';
    if (reservedProviderSlugs.has(normalizedSlug)) return 'Этот slug зарезервирован.';
    return '';
  };

  const validateColors = () => {
    const hexColor = /^#[0-9a-fA-F]{6}$/;
    if (form.primaryColor && !hexColor.test(form.primaryColor)) return 'Основной цвет должен быть в формате #RRGGBB.';
    if (form.accentColor && !hexColor.test(form.accentColor)) return 'Акцентный цвет должен быть в формате #RRGGBB.';
    return '';
  };

  const save = async () => {
    const nextSlugError = validateSlug();
    const nextColorError = validateColors();
    if (nextSlugError || nextColorError) {
      setSlugError(nextSlugError);
      setColorError(nextColorError);
      return;
    }

    setSaving(true);
    setSaved(false);
    setError('');
    setSlugError('');
    setColorError('');
    try {
      const slugChanged = normalizedSlug !== (profile?.slug ?? '');
      if (slugChanged) {
        await profileApi.patch({ slug: normalizedSlug });
      }

      const nextStorefront = await storefrontApi.patch({
        enabled: form.enabled,
        publicName: form.publicName.trim() || null,
        description: form.description.trim() || null,
        theme: {
          primaryColor: form.primaryColor.trim() || null,
          accentColor: form.accentColor.trim() || null,
        },
        contacts: buildStorefrontContacts(form),
        seo: {
          title: form.seoTitle.trim() || null,
          description: form.seoDescription.trim() || null,
        },
      });

      setStorefront(nextStorefront);
      setProfile(current => current ? { ...current, slug: normalizedSlug } : current);
      setEditSession(null);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить сайт.');
    } finally {
      setSaving(false);
    }
  };

  const createEditSession = async (force = false) => {
    if ((!force && editSession) || sessionLoading) return;

    const nextSlugError = validateSlug();
    if (nextSlugError || !normalizedSlug) {
      setSlugError(nextSlugError || 'Укажите slug перед запуском live-редактора.');
      setActiveTab('settings');
      return;
    }

    setSessionLoading(true);
    setError('');
    setSlugError('');
    try {
      const slugChanged = normalizedSlug !== (profile?.slug ?? '');
      if (slugChanged) {
        await profileApi.patch({ slug: normalizedSlug });
        setProfile(current => current ? { ...current, slug: normalizedSlug } : current);
      }
      const nextSession = await storefrontApi.createEditSession();
      setEditSession(nextSession);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось открыть live-редактор.');
    } finally {
      setSessionLoading(false);
    }
  };

  useEffect(() => {
    if (loading || activeTab !== 'live' || editSession || sessionLoading) return;
    void createEditSession();
  }, [activeTab, editSession, loading, sessionLoading]);

  useEffect(() => {
    if (activeTab !== 'live' || !editSession?.expiresAt) return;

    const expiresAt = new Date(editSession.expiresAt).getTime();
    const refreshInMs = Number.isNaN(expiresAt)
      ? 10 * 60 * 1000
      : Math.max(0, expiresAt - Date.now() - 60 * 1000);
    const timeoutId = window.setTimeout(() => {
      void createEditSession(true);
    }, refreshInMs);

    return () => window.clearTimeout(timeoutId);
  }, [activeTab, editSession?.expiresAt]);

  return (
    <Card className="rounded-none border-0 p-0 shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-6">
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`border-b-2 px-3 py-2 text-sm font-medium transition ${
              activeTab === 'settings' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            Настройки
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('live')}
            className={`border-b-2 px-3 py-2 text-sm font-medium transition ${
              activeTab === 'live' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            Live
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 pb-2">
          {saved && activeTab === 'settings' && <Badge variant="green">сохранено</Badge>}
          {storefront && <Badge variant={form.enabled ? 'green' : 'gray'}>{form.enabled ? 'включен' : 'выключен'}</Badge>}
          {activeTab === 'live' && editSession && (
            <a href={editSession.previewUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-blue-700 hover:text-blue-800">
              Открыть в новой вкладке
            </a>
          )}
          {activeTab === 'settings' && (
            <Button type="button" variant="primary" onClick={() => void save()} loading={saving} disabled={loading}>
              <Save size={14} /> Сохранить
            </Button>
          )}
        </div>
      </div>

      {error && <p className="mx-6 mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

      {loading ? (
        <p className="p-6 text-sm text-gray-500">Загружаем настройки сайта...</p>
      ) : activeTab === 'settings' ? (
        <div className="space-y-5 p-6">
          {publicUrl && (
            <a href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800">
              <Globe2 size={13} /> {publicUrl}
            </a>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="Slug"
              value={form.slug}
              onChange={event => {
                setSlugError('');
                setForm(current => ({ ...current, slug: event.target.value.trim().toLowerCase() }));
              }}
              error={slugError}
              placeholder="megaprokat-ufa"
              hint={publicUrl || 'Латиница, цифры и дефисы.'}
            />
            <label className="flex min-h-9 items-center justify-between gap-3 rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
              <span className="min-w-0 text-xs text-gray-600">Включить сайт</span>
              <button
                type="button"
                role="switch"
                aria-checked={form.enabled}
                onClick={() => {
                  setSlugError('');
                  setForm(current => ({ ...current, enabled: !current.enabled }));
                }}
                className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${
                  form.enabled ? 'border-blue-600 bg-blue-600' : 'border-gray-300 bg-gray-200'
                }`}
              >
                <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${form.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </label>
            <Input label="Публичное название" value={form.publicName} onChange={event => setForm(current => ({ ...current, publicName: event.target.value }))} />
            <Input label="Телефон" value={form.phone} onChange={event => setForm(current => ({ ...current, phone: event.target.value }))} />
            <Input label="Email" type="email" value={form.email} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} />
            <Input label="Telegram" value={form.telegram} onChange={event => setForm(current => ({ ...current, telegram: event.target.value }))} placeholder="megaprokat_ufa" />
            <Input label="WhatsApp" value={form.whatsapp} onChange={event => setForm(current => ({ ...current, whatsapp: event.target.value }))} placeholder="+79990000000" />
          </div>

          <Textarea label="Описание сайта" rows={3} value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} />

          <div className="grid gap-3 md:grid-cols-2">
            <Input label="Основной цвет" value={form.primaryColor} onChange={event => {
              setColorError('');
              setForm(current => ({ ...current, primaryColor: event.target.value }));
            }} placeholder="#0f766e" error={colorError && colorError.includes('Основной') ? colorError : undefined} />
            <Input label="Акцентный цвет" value={form.accentColor} onChange={event => {
              setColorError('');
              setForm(current => ({ ...current, accentColor: event.target.value }));
            }} placeholder="#f59e0b" error={colorError && colorError.includes('Акцентный') ? colorError : undefined} />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Input label="SEO title" value={form.seoTitle} onChange={event => setForm(current => ({ ...current, seoTitle: event.target.value }))} />
            <Input label="SEO description" value={form.seoDescription} onChange={event => setForm(current => ({ ...current, seoDescription: event.target.value }))} />
          </div>
        </div>
      ) : (
        <div>
          {!editSession ? (
            <div className="border-y border-gray-100 px-6 py-8">
              <p className="text-sm font-medium text-gray-900">
                {sessionLoading ? 'Открываем live-редактор...' : 'Live-редактор недоступен.'}
              </p>
              {slugError && <p className="mt-1 text-xs text-red-700">{slugError}</p>}
            </div>
          ) : (
            <iframe
              src={editSession.previewUrl}
              title="Live-редактор онлайн магазина"
              className="block h-[calc(100vh-105px)] min-h-[720px] w-full border-0 bg-white"
            />
          )}
        </div>
      )}
    </Card>
  );
}

function readStorefrontContact(storefront: StorefrontSettings, type: string) {
  return storefront.contacts?.find(contact => contact.type === type)?.value ?? '';
}

function buildStorefrontContacts(form: {
  phone: string;
  email: string;
  telegram: string;
  whatsapp: string;
}) {
  return [
    { type: 'phone', value: form.phone.trim(), isPrimary: true },
    { type: 'email', value: form.email.trim(), isPrimary: true },
    { type: 'telegram', value: form.telegram.trim(), isPrimary: true },
    { type: 'whatsapp', value: form.whatsapp.trim(), isPrimary: false },
  ].filter(contact => contact.value);
}

function EmployeesSettings() {
  const { user, activeMembership } = useAuth();
  const [view, setView] = useState<'staff' | 'invites'>('staff');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [members, setMembers] = useState<ProviderMember[]>([]);
  const [invitations, setInvitations] = useState<ProviderInvitation[]>([]);
  const [roleOptions, setRoleOptions] = useState<ProviderMemberRoleOption[]>([]);
  const [form, setForm] = useState({ email: '', role: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [pageError, setPageError] = useState('');
  const [inviteError, setInviteError] = useState('');
  const providerId = activeMembership?.providerId ?? '';
  const isSelfOwner = (member: ProviderMember) => member.userId === user?.id && isOwnerRole(member.role);

  const loadMembers = async () => {
    if (!providerId) {
      setLoading(false);
      setPageError('Не найден активный магазин.');
      return;
    }

    setLoading(true);
    setPageError('');
    try {
      const [nextOptions, nextMembers, nextInvitations] = await Promise.all([
        providerMembersApi.options(providerId),
        providerMembersApi.listMembers(providerId),
        providerMembersApi.listInvitations(providerId),
      ]);
      setRoleOptions(nextOptions.roles);
      setMembers(nextMembers);
      setInvitations(nextInvitations);
      setForm(current => current.role ? current : { ...current, role: nextOptions.roles[0]?.value ?? '' });
    } catch (err) {
      setPageError(err instanceof ApiError ? err.message : 'Не удалось загрузить сотрудников.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMembers();
  }, [providerId]);

  const addMember = async () => {
    if (!form.email.trim()) {
      setInviteError('Укажите email сотрудника.');
      return;
    }
    if (!form.role) {
      setInviteError('Выберите роль сотрудника.');
      return;
    }

    setSaving(true);
    setInviteError('');
    try {
      await providerMembersApi.invite(providerId, {
        email: form.email.trim(),
        role: form.role,
      });
      const nextInvitations = await providerMembersApi.listInvitations(providerId);
      setInvitations(nextInvitations);
      setForm({ email: '', role: roleOptions[0]?.value ?? '' });
      setInviteOpen(false);
      setView('invites');
    } catch (err) {
      setInviteError(err instanceof ApiError ? err.message : 'Не удалось отправить приглашение.');
    } finally {
      setSaving(false);
    }
  };

  const changeRole = async (member: ProviderMember, role: string) => {
    if (role === member.role) return;
    if (isSelfOwner(member)) {
      setPageError('Нельзя изменить собственную роль владельца.');
      return;
    }

    setUpdatingMemberId(member.membershipId);
    setPageError('');
    try {
      const updated = await providerMembersApi.updateRole(providerId, member.membershipId, role);
      setMembers(current => current.map(item => item.membershipId === updated.membershipId ? updated : item));
    } catch (err) {
      setPageError(err instanceof ApiError ? err.message : 'Не удалось изменить роль.');
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const removeMember = async (member: ProviderMember) => {
    if (isSelfOwner(member)) {
      setPageError('Нельзя удалить собственный доступ владельца.');
      return;
    }

    if (!window.confirm(`Удалить доступ для ${member.email ?? memberName(member)}?`)) return;

    setUpdatingMemberId(member.membershipId);
    setPageError('');
    try {
      await providerMembersApi.remove(providerId, member.membershipId);
      setMembers(current => current.filter(item => item.membershipId !== member.membershipId));
    } catch (err) {
      setPageError(err instanceof ApiError ? err.message : 'Не удалось удалить доступ.');
    } finally {
      setUpdatingMemberId(null);
    }
  };

  return (
    <>
      <Card className="rounded-none border-0 p-6 shadow-none">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-gray-900">Сотрудники</h2>
            <p className="mt-0.5 text-xs text-gray-500">Доступы команды к кабинету магазина.</p>
          </div>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => {
              setInviteError('');
              setInviteOpen(true);
            }}
            disabled={!providerId || roleOptions.length === 0}
          >
            <Plus size={14} /> Пригласить
          </Button>
        </div>

        <div className="mb-4 inline-flex rounded-md border bg-gray-50 p-0.5">
          <button
            type="button"
            onClick={() => setView('staff')}
            className={`h-8 rounded px-3 text-xs font-medium transition ${
              view === 'staff' ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Список сотрудников
          </button>
          <button
            type="button"
            onClick={() => setView('invites')}
            className={`h-8 rounded px-3 text-xs font-medium transition ${
              view === 'invites' ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            История приглашений
          </button>
        </div>

        {pageError && <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{pageError}</p>}

        {loading ? (
          <div className="py-8 text-center text-sm text-gray-500">Загружаем сотрудников...</div>
        ) : view === 'staff' ? (
          <div className="overflow-hidden border-y border-gray-100">
            <table className="w-full table-fixed text-left text-sm">
              <thead className="bg-gray-50 text-xs font-medium text-gray-500">
                <tr>
                  <th className="w-[38%] px-3 py-2">Сотрудник</th>
                  <th className="w-[34%] px-3 py-2">Email</th>
                  <th className="w-[180px] px-3 py-2">Роль</th>
                  <th className="w-14 px-3 py-2 text-right"> </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {members.map(member => {
                  const owner = isOwnerRole(member.role);
                  const memberBusy = updatingMemberId === member.membershipId;

                  return (
                    <tr key={member.membershipId} className="align-middle">
                      <td className="min-w-0 px-3 py-3">
                        <p className="truncate font-medium text-gray-900">{memberName(member)}</p>
                      </td>
                      <td className="min-w-0 px-3 py-3">
                        <p className="truncate text-gray-600">{member.email ?? 'email не указан'}</p>
                      </td>
                      <td className="px-3 py-3">
                        {owner ? (
                          <Badge variant="gray">{roleLabel(member.role, roleOptions)}</Badge>
                        ) : (
                          <Select
                            aria-label="Роль сотрудника"
                            value={member.role}
                            options={roleOptions}
                            disabled={memberBusy}
                            className="w-full"
                            onChange={event => void changeRole(member, event.target.value)}
                          />
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {!owner && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="icon"
                            disabled={memberBusy}
                            onClick={() => void removeMember(member)}
                            title="Удалить доступ"
                          >
                            <Trash2 size={14} />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {members.length === 0 && (
              <div className="py-8 text-center text-sm text-gray-500">Сотрудников пока нет.</div>
            )}
          </div>
        ) : (
          <div className="overflow-hidden border-y border-gray-100">
            <table className="w-full table-fixed text-left text-sm">
              <thead className="bg-gray-50 text-xs font-medium text-gray-500">
                <tr>
                  <th className="w-[30%] px-3 py-2">Email</th>
                  <th className="w-[160px] px-3 py-2">Роль</th>
                  <th className="w-[140px] px-3 py-2">Статус</th>
                  <th className="w-[24%] px-3 py-2">Пригласил</th>
                  <th className="w-[180px] px-3 py-2">Срок</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invitations.map(invitation => (
                  <tr key={invitation.invitationId} className="align-middle">
                    <td className="min-w-0 px-3 py-3">
                      <p className="truncate font-medium text-gray-900">{invitation.email}</p>
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant="gray">{roleLabel(invitation.role, roleOptions)}</Badge>
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant={invitationStatusVariant(invitation.status)}>
                        {invitationStatusLabel(invitation.status)}
                      </Badge>
                    </td>
                    <td className="min-w-0 px-3 py-3">
                      <p className="truncate text-gray-600">{invitation.invitedByName || invitation.invitedByEmail || '—'}</p>
                      <p className="mt-0.5 text-xs text-gray-500">{formatDate(invitation.sentAt)}</p>
                    </td>
                    <td className="px-3 py-3 text-gray-600">
                      {invitation.status === 'pending' ? formatDate(invitation.expiresAt) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {invitations.length === 0 && (
              <div className="py-8 text-center text-sm text-gray-500">Приглашений пока нет.</div>
            )}
          </div>
        )}
      </Card>

      <Modal
        open={inviteOpen}
        onClose={() => {
          setInviteOpen(false);
          setInviteError('');
        }}
        title="Пригласить сотрудника"
        size="sm"
      >
        <div className="space-y-3">
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={event => {
              setInviteError('');
              setForm(current => ({ ...current, email: event.target.value }));
            }}
            placeholder="ivan@example.com"
          />
          <Select
            label="Роль"
            value={form.role}
            options={roleOptions}
            onChange={event => {
              setInviteError('');
              setForm(current => ({ ...current, role: event.target.value }));
            }}
          />
          {inviteError && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{inviteError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setInviteOpen(false)}>
              Отмена
            </Button>
            <Button type="button" variant="primary" onClick={() => void addMember()} loading={saving} disabled={!form.role}>
              <Plus size={14} /> Отправить приглашение
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function AccountSettings() {
  const { user } = useAuth();

  return (
    <div>
      <Card className="rounded-none border-0 p-6 shadow-none">
        <h2 className="text-sm font-semibold text-gray-900">Аккаунт</h2>
        <div className="mt-4 space-y-3 text-sm">
          <InfoRow label="Имя" value={user?.name ?? '—'} />
          <InfoRow label="Email" value={user?.email ?? '—'} />
          <InfoRow label="Роли" value={user?.roles?.join(', ') || user?.role || '—'} />
          <InfoRow label="Email подтвержден" value={user?.emailVerified === false ? 'Нет' : 'Да'} />
        </div>
      </Card>
    </div>
  );
}

function roleLabel(role: string, options: ProviderMemberRoleOption[]) {
  return options.find(option => option.value === role)?.label ?? role;
}

function isOwnerRole(role: string) {
  return role.toLowerCase() === 'owner';
}

function memberName(member: ProviderMember) {
  const fullName = [member.name, member.surname].filter(Boolean).join(' ').trim();
  return fullName || member.email || member.userId;
}

function invitationStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: 'ожидает',
    accepted: 'принято',
    expired: 'истекло',
  };

  return labels[status.toLowerCase()] ?? status;
}

function invitationStatusVariant(status: string): 'green' | 'yellow' | 'red' | 'gray' {
  const normalized = status.toLowerCase();
  if (normalized === 'accepted') return 'green';
  if (normalized === 'expired') return 'red';
  if (normalized === 'pending') return 'yellow';
  return 'gray';
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-2 last:border-0 last:pb-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="min-w-0 text-right text-xs font-medium text-gray-900 break-words">{value}</span>
    </div>
  );
}
