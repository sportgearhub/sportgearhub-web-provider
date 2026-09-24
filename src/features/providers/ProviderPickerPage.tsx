import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight, Mountain, Plus, UserRound } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FocusFrame } from '../../components/layout/FocusFrame';
import { useAuth } from '../../context/useAuth';
import { ApiError } from '../../lib/api-client';
import { lastProviderId, rememberProvider } from '../../lib/active-provider';
import { kindLabel, roleLabel, statusMeta } from './providerStatus';

/**
 * «Выберите кабинет» — the first screen after sign-in. Zero cabinets and nothing waiting: straight
 * to creation. Exactly one and nothing waiting: straight in. Otherwise the list, invitations on top
 * (they are what a person came for when someone sent them here), last-used cabinet preselected.
 */
export function ProviderPickerPage() {
  const { user, providers, pendingInvitations, acceptInvitation, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const deniedProviderId = (location.state as { deniedProviderId?: string } | null)?.deniedProviderId;
  const [accepting, setAccepting] = useState<string | null>(null);
  const [error, setError] = useState('');
  const remembered = lastProviderId();
  const [selected, setSelected] = useState<string>(() =>
    providers.some(item => item.providerId === remembered) ? remembered! : providers[0]?.providerId ?? '');

  useEffect(() => {
    if (!providers.some(item => item.providerId === selected)) setSelected(providers[0]?.providerId ?? '');
  }, [providers, selected]);

  if (providers.length === 0 && pendingInvitations.length === 0) return <Navigate to="/new" replace />;
  if (providers.length === 1 && pendingInvitations.length === 0 && !deniedProviderId) {
    return <Navigate to={`/providers/${providers[0].providerId}`} replace />;
  }

  const enter = (providerId: string) => {
    rememberProvider(providerId);
    navigate(`/providers/${providerId}`);
  };

  const accept = async (invitationId: string, providerId: string) => {
    setAccepting(invitationId);
    setError('');
    try {
      await acceptInvitation(invitationId);
      enter(providerId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось принять приглашение.');
    } finally {
      setAccepting(null);
    }
  };

  return (
    <FocusFrame>
      <div className="flex items-center justify-center gap-2 text-foreground">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
          <Mountain size={16} />
        </span>
        <span className="text-base font-semibold">Sportgearhub · Кабинет</span>
      </div>
      <Card className="space-y-4 p-6">
        <h1 className="text-center text-xl font-semibold text-gray-950">Выберите кабинет</h1>
        <div className="flex items-center gap-3 rounded-md bg-gray-50 px-3 py-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-200 text-gray-600">
            <UserRound size={16} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-900">{user?.name}</p>
            <p className="truncate text-xs text-gray-500">{user?.phone}</p>
          </div>
        </div>
        {deniedProviderId && (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            У вас нет доступа к этому кабинету. Выберите один из ваших.
          </p>
        )}
        {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        {pendingInvitations.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Приглашения</p>
            {pendingInvitations.map(invitation => (
              <div key={invitation.invitationId} className="flex items-center justify-between gap-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">«{invitation.providerDisplayName}»</p>
                  <p className="text-xs text-gray-600">приглашает вас как {roleLabel(invitation.role)}</p>
                </div>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  loading={accepting === invitation.invitationId}
                  onClick={() => void accept(invitation.invitationId, invitation.providerId)}
                >
                  Принять
                </Button>
              </div>
            ))}
          </div>
        )}
        {providers.length > 0 && (
          <div className="space-y-2">
            {pendingInvitations.length > 0 && (
              <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Ваши кабинеты</p>
            )}
            {providers.map(provider => {
              const meta = statusMeta(provider.status);
              const active = provider.providerId === selected;
              return (
                <button
                  key={provider.providerId}
                  type="button"
                  onClick={() => setSelected(provider.providerId)}
                  onDoubleClick={() => enter(provider.providerId)}
                  className={`flex w-full items-center gap-3 rounded-md border px-3 py-3 text-left transition ${
                    active ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-200'
                  }`}
                >
                  <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${active ? 'border-blue-700' : 'border-gray-300'}`}>
                    {active && <span className="h-2 w-2 rounded-full bg-blue-700" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-gray-950">{provider.displayName}</span>
                    <span className="block text-xs text-gray-500">
                      {kindLabel(provider.kind)} · {roleLabel(provider.role)}
                    </span>
                  </span>
                  {provider.status !== 'active' && <Badge variant={meta.variant}>{meta.label}</Badge>}
                </button>
              );
            })}
          </div>
        )}
        <button
          type="button"
          onClick={() => navigate('/new')}
          className="flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-800"
        >
          <Plus size={14} /> Добавить кабинет
        </button>
        <div className="flex items-center justify-between gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={() => void signOut()}>
            Выйти
          </Button>
          {providers.length > 0 && (
            <Button type="button" variant="primary" disabled={!selected} onClick={() => enter(selected)}>
              Далее <ChevronRight size={14} />
            </Button>
          )}
        </div>
      </Card>
    </FocusFrame>
  );
}
