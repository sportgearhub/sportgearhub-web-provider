import { useState } from 'react';
import { Check, ChevronDown, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { selectProvider } from '../../lib/active-provider';
import { useProvider } from '../../features/providers/ProviderContext';
import { useWorkspace, workspaceMeta, type Workspace } from '../../features/workspace/workspace';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';

/**
 * The top of a home screen on a phone.
 *
 * Below `lg` the console draws no bar, so this is the bar: one white block the width of the
 * screen, round along its underside like every other section's. The cabinet's name is in the
 * middle of it with a chevron, the way a phone names where you are and offers to move you — a
 * seller who runs two businesses from two cabinets changes them from here, not from a menu three
 * taps deep. Under it the date, and the two businesses this cabinet is used for.
 *
 * Both homes use it, which is also what keeps the way back to Прокат on the Впечатления screen.
 */
export function MobileHomeHeader({ className }: { className?: string }) {
  const { providers } = useAuth();
  const provider = useProvider();
  const navigate = useNavigate();
  const { workspace, setWorkspace } = useWorkspace();
  const [switching, setSwitching] = useState(false);
  const today = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });

  const choose = (providerId: string) => {
    setSwitching(false);
    if (providerId === provider.providerId) return;
    selectProvider(providerId);
    // Everything on screen belongs to the old cabinet; a reload is the honest way to replace it.
    navigate(0);
  };

  return (
    <div className={cn('rounded-b-2xl bg-white px-4 pb-4 pt-4 text-center lg:hidden', className)}>
      <button
        type="button"
        onClick={() => setSwitching(true)}
        className="mx-auto flex max-w-full items-center gap-1 rounded-lg px-2 py-0.5 transition active:bg-gray-100"
      >
        <span className="truncate text-lg font-semibold text-gray-950">{provider.displayName}</span>
        <ChevronDown size={17} className="shrink-0 text-gray-400" />
      </button>
      <p className="mt-0.5 text-sm text-gray-500">{today}</p>

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
