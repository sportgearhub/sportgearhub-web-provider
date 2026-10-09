import { useEffect, useState } from 'react';
import { Check, ChevronDown, Plus, Settings, Store } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { selectProvider } from '../../lib/active-provider';
import { profileApi } from '../../lib/api-client';
import { useProvider } from '../../features/providers/ProviderContext';
import { useWorkspace, workspaceMeta, type Workspace } from '../../features/workspace/workspace';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';

/**
 * Which cabinet you are in, at the top of the screens that are about it.
 *
 * Below `lg` the console draws no bar, so this is the bar: one white block the width of the
 * screen, round along its underside like every other section's. It carries the cabinet — its mark,
 * its name with a chevron to change it, and the line underneath that says how customers reach it —
 * and a way into its settings in the corner. A seller who runs two cabinets switches them from the
 * screen they land on rather than from a menu three taps deep.
 */
export function CabinetHeader({
  onNavigate,
  workspaceToggle = false,
  className,
}: {
  onNavigate: (path: string) => void;
  /** The two businesses this cabinet is used for. On a home screen; not on a list of settings. */
  workspaceToggle?: boolean;
  className?: string;
}) {
  const { providers, user } = useAuth();
  const provider = useProvider();
  const navigate = useNavigate();
  const { workspace, setWorkspace } = useWorkspace();
  const [switching, setSwitching] = useState(false);
  const [contact, setContact] = useState<string | null>(null);

  /**
   * How customers reach this cabinet, which is on the shop's profile rather than on the session.
   * Until it answers — or when nothing is filled in — the account's own number stands in, because
   * a line that is sometimes blank makes the block jump.
   */
  useEffect(() => {
    let cancelled = false;
    profileApi.get()
      .then(profile => {
        if (!cancelled) setContact(profile.contactPhone ?? profile.contactEmail ?? null);
      })
      .catch(() => { /* the fallback below is already right */ });
    return () => { cancelled = true; };
  }, [provider.providerId]);

  const choose = (providerId: string) => {
    setSwitching(false);
    if (providerId === provider.providerId) return;
    selectProvider(providerId);
    // Everything on screen belongs to the old cabinet; a reload is the honest way to replace it.
    navigate(0);
  };

  return (
    // `before:` paints white off the top of the screen. A phone lets you pull a page past its
    // own beginning, and what shows there is whatever is behind it — grey, above a white bar,
    // which looks like the bar has come loose.
    <div
      className={cn(
        'sticky top-0 z-30 rounded-b-2xl bg-white px-4 pb-4 pt-4 shadow-sm lg:hidden',
        'before:pointer-events-none before:absolute before:inset-x-0 before:bottom-full before:h-screen before:bg-white',
        className
      )}
    >
      <div className="flex items-center gap-3">
        {/* The shop's mark. There is no logo in the API yet, so this is the shape it will take:
            its first letter, which is better than an empty square and honest about being one. */}
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-lg font-semibold uppercase text-blue-700">
          {provider.displayName.trim().charAt(0) || <Store size={20} />}
        </span>

        <button
          type="button"
          onClick={() => setSwitching(true)}
          className="-ml-1 min-w-0 flex-1 rounded-lg px-1 py-0.5 text-left transition active:bg-gray-100"
        >
          <span className="flex items-center gap-1">
            <span className="truncate text-base font-semibold text-gray-950">{provider.displayName}</span>
            <ChevronDown size={16} className="shrink-0 text-gray-400" />
          </span>
          <span className="mt-0.5 block truncate text-xs text-gray-500">
            {contact ?? user?.phone ?? user?.email ?? 'Контакты не указаны'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('/settings')}
          aria-label="Настройки"
          className="-mr-2 shrink-0 rounded-lg p-2 text-gray-600 transition active:bg-gray-100"
        >
          <Settings size={20} />
        </button>
      </div>

      {workspaceToggle && (
        <div className="mt-3 flex gap-1 rounded-xl bg-gray-100 p-1">
          {(Object.keys(workspaceMeta) as Workspace[]).map(key => (
            <button
              key={key}
              type="button"
              onClick={() => setWorkspace(key)}
              className={cn(
                'flex-1 rounded-lg px-3 py-1.5 text-sm transition',
                key === workspace ? 'bg-white font-medium text-gray-950 shadow-sm' : 'text-gray-600'
              )}
            >
              {workspaceMeta[key].label}
            </button>
          ))}
        </div>
      )}

      <BottomSheet
        open={switching}
        onClose={() => setSwitching(false)}
        title="Кабинет"
        center
        footer={
          <Button variant="secondary" className="w-full justify-center" onClick={() => setSwitching(false)}>
            Закрыть
          </Button>
        }
      >
        <ul className="divide-y divide-gray-100 border-y border-gray-100">
          {providers.map(item => {
            const current = item.providerId === provider.providerId;
            return (
              <li key={item.providerId}>
                <button
                  type="button"
                  onClick={() => choose(item.providerId)}
                  className="flex w-full items-center gap-3 px-5 py-3 text-left transition active:bg-gray-50"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-sm font-semibold uppercase text-blue-700">
                    {item.displayName.trim().charAt(0) || <Store size={16} />}
                  </span>
                  <span
                    className={cn(
                      'min-w-0 flex-1 truncate text-sm',
                      current ? 'font-medium text-gray-950' : 'text-gray-800'
                    )}
                  >
                    {item.displayName}
                  </span>
                  {current && <Check size={17} className="shrink-0 text-blue-600" />}
                </button>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => { setSwitching(false); navigate('/providers/new'); }}
              className="flex w-full items-center gap-2 px-5 py-3 text-left text-sm font-medium text-blue-700 transition active:bg-gray-50"
            >
              <Plus size={16} /> Добавить кабинет
            </button>
          </li>
        </ul>
      </BottomSheet>
    </div>
  );
}
