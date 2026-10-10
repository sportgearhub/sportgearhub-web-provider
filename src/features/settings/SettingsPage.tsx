import { useEffect, useState } from 'react';
import { EmailAttachDialog } from './EmailAttachDialog';
import { Plus, Trash2 } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
import { useAuth } from '../../context/useAuth';
import { ApiError, providerMembersApi } from '../../lib/api-client';
import type { ProviderInvitation, ProviderMember, ProviderMemberRoleOption } from '../../types';
import { LocationsPage } from '../locations/LocationsPage';
import { PayoutsPage } from '../payouts/PayoutsPage';
import { SellerProfileSettings } from './SellerProfileSettings';
import { SellerProfileEdit } from './SellerProfileEdit';
import { ShopProfileEdit, ShopProfileView } from './ShopProfileSettings';
import { ContractsSettings } from './ContractsSettings';
import { useProvider } from '../providers/ProviderContext';
import { SectionEdit, SettingsCard } from '../../components/layout/SettingsCard';
import { DetailList, DetailRow } from '../../components/ui/DetailList';
import { RuPhoneInput } from '../../components/ui/RuPhoneInput';

export type SettingsTab =
  | 'shop'
  | 'shop-edit'
  | 'seller'
  | 'seller-edit'
  | 'locations'
  | 'account'
  | 'employees'
  | 'payouts'
  | 'contracts';

interface SettingsPageProps {
  tab: SettingsTab;
  onNavigate: (path: string) => void;
}

/**
 * A settings section, on its own.
 *
 * There was a list of the sections down the left of every one of them — a second navigation beside
 * the one in the header, which carries the same list and is on screen anyway. Two lists of the
 * same links disagree the week one of them gains an entry, and this one already had: «Реквизиты»
 * where the rest of the console says «Реквизиты выплат», and no Финансы at all.
 */
/** What each section is called, where the sidebar used to say it. */
const SECTION_TITLES: Record<SettingsTab, string> = {
  shop: 'Профиль проката',
  'shop-edit': 'Редактирование профиля',
  seller: 'Информация о продавце',
  'seller-edit': 'Данные продавца',
  locations: 'Пункты проката',
  employees: 'Сотрудники',
  payouts: 'Реквизиты выплат',
  contracts: 'Договоры',
  account: 'Аккаунт',
};

export function SettingsPage({ tab, onNavigate }: SettingsPageProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      {/* The name of the section, which the list down the left used to carry. On a phone the bar
          at the top says it already — and an edit screen draws its own heading with the way back
          to what it edits, so this one would be the same words twice down the same page. */}
      <div className={`px-6 pt-6 ${tab.endsWith('-edit') ? 'hidden' : 'hidden lg:block'}`}>
        {/* Not a link: there is no settings index on a desktop — every section is reachable from
            the menu in the header, which is why the list beside them could go. */}
        <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Настройки</p>
        <h1 className="mt-0.5 text-xl font-semibold text-gray-950">{SECTION_TITLES[tab]}</h1>
      </div>
      <div className="min-h-0 min-w-0 flex-1 bg-white">
        {tab === 'shop' && <ShopProfileView onNavigate={onNavigate} />}
        {tab === 'shop-edit' && <ShopProfileEdit onNavigate={onNavigate} />}
        {tab === 'seller' && <SellerProfileSettings onNavigate={onNavigate} />}
        {tab === 'seller-edit' && <SellerProfileEdit onNavigate={onNavigate} />}
        {tab === 'contracts' && <ContractsSettings />}
        {tab === 'locations' && <LocationsPage embedded />}
        {tab === 'employees' && <EmployeesSettings />}
        {tab === 'payouts' && <PayoutsPage />}
        {tab === 'account' && <AccountSettings />}
      </div>
    </div>
  );
}



function EmployeesSettings() {
  const { user } = useAuth();
  const provider = useProvider();
  const [view, setView] = useState<'staff' | 'invites'>('staff');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [members, setMembers] = useState<ProviderMember[]>([]);
  const [invitations, setInvitations] = useState<ProviderInvitation[]>([]);
  const [roleOptions, setRoleOptions] = useState<ProviderMemberRoleOption[]>([]);
  const [form, setForm] = useState({ phone: '', role: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [pageError, setPageError] = useState('');
  const [inviteError, setInviteError] = useState('');
  const providerId = provider.providerId;
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
        providerMembersApi.options(),
        providerMembersApi.listMembers(),
        providerMembersApi.listInvitations(),
      ]);
      const roles = nextOptions.roles ?? [];
      setRoleOptions(roles);
      setMembers(nextMembers ?? []);
      setInvitations(nextInvitations ?? []);
      setForm(current => current.role ? current : { ...current, role: roles[0]?.value ?? '' });
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
    if (form.phone.replace(/\D/g, '').length !== 10) {
      setInviteError('Укажите номер телефона сотрудника.');
      return;
    }
    if (!form.role) {
      setInviteError('Выберите роль сотрудника.');
      return;
    }

    setSaving(true);
    setInviteError('');
    try {
      await providerMembersApi.invite({
        phone: `+7${form.phone.replace(/\D/g, '')}`,
        role: form.role,
      });
      const nextInvitations = await providerMembersApi.listInvitations();
      setInvitations(nextInvitations);
      setForm({ phone: '', role: roleOptions[0]?.value ?? '' });
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
      const updated = await providerMembersApi.updateRole(member.membershipId, role);
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

    if (!window.confirm(`Удалить доступ для ${memberName(member)}?`)) return;

    setUpdatingMemberId(member.membershipId);
    setPageError('');
    try {
      await providerMembersApi.remove(member.membershipId);
      setMembers(current => current.filter(item => item.membershipId !== member.membershipId));
    } catch (err) {
      setPageError(err instanceof ApiError ? err.message : 'Не удалось удалить доступ.');
    } finally {
      setUpdatingMemberId(null);
    }
  };

  return (
    <div className="space-y-4 p-6">
      {pageError && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{pageError}</p>}
      <div className="max-w-4xl">
      <SettingsCard
        title="Доступы к кабинету"
        description="Кто может входить в кабинет и что им разрешено. Приглашение уходит на номер телефона."
        action={
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => {
              setInviteError('');
              setInviteOpen(true);
            }}
            disabled={roleOptions.length === 0}
          >
            <Plus size={14} /> Пригласить
          </Button>
        }
      >
        <div className="mb-4 inline-flex rounded-lg border bg-gray-50 p-0.5">
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

        {loading ? (
          <SkeletonRows rows={3} />
        ) : view === 'staff' ? (
          <div className="-mx-5 overflow-x-auto border-y border-gray-100">
            <table className="w-full min-w-[560px] table-fixed text-left text-sm">
              <thead className="bg-gray-50 text-xs font-medium text-gray-500">
                <tr>
                  <th className="w-[38%] px-3 py-2">Сотрудник</th>
                  <th className="w-[34%] px-3 py-2">Телефон</th>
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
                        <p className="truncate text-gray-600">{member.email ?? '—'}</p>
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
          <div className="-mx-5 overflow-x-auto border-y border-gray-100">
            <table className="w-full min-w-[560px] table-fixed text-left text-sm">
              <thead className="bg-gray-50 text-xs font-medium text-gray-500">
                <tr>
                  <th className="w-[30%] px-3 py-2">Телефон</th>
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
                      <p className="truncate font-medium text-gray-900">{invitation.phone}</p>
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
                      <p className="truncate text-gray-600">{invitation.invitedByName || invitation.invitedByPhone || '—'}</p>
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
      </SettingsCard>

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
          <RuPhoneInput
            label="Телефон сотрудника"
            value={form.phone}
            onChange={value => {
              setInviteError('');
              setForm(current => ({ ...current, phone: value }));
            }}
          />
          <p className="text-xs text-gray-500">Сотрудник войдёт по этому номеру и увидит приглашение на первом экране. Ссылок и писем нет.</p>
          <Select
            label="Роль"
            value={form.role}
            options={roleOptions}
            onChange={event => {
              setInviteError('');
              setForm(current => ({ ...current, role: event.target.value }));
            }}
          />
          {inviteError && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{inviteError}</p>}
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
      </div>
    </div>
  );
}

function AccountSettings() {
  const { user } = useAuth();
  const [emailOpen, setEmailOpen] = useState(false);

  const email = user?.email ?? '';

  return (
    <div className="p-6">
      <div className="max-w-3xl">
        <SettingsCard title="Ваши данные" description="Учётная запись, под которой вы вошли в кабинет.">
          <DetailList>
            <DetailRow label="Имя" value={user?.name} />
            <DetailRow label="Телефон" value={user?.phone} hint="По нему выполняется вход" />
            <DetailRow label="Почта" hint="Сюда приходят счета, акты и письма о заказах и выплатах">
              {/* No «подтверждена» beside it. An address only gets here by being confirmed with a
                  code, so the badge said the same thing for every address that could be shown. */}
              <div className="flex items-center gap-2">
                {email
                  ? <span className="min-w-0 flex-1 truncate text-gray-900">{email}</span>
                  : <span className="min-w-0 flex-1 text-gray-400">Не указана</span>}
                <SectionEdit
                  onClick={() => setEmailOpen(true)}
                  empty={!email}
                  label="Изменить почту аккаунта"
                />
              </div>
            </DetailRow>
          </DetailList>
        </SettingsCard>
      </div>
      <EmailAttachDialog open={emailOpen} onClose={() => setEmailOpen(false)} />
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

