import { useProvider } from '../../features/providers/ProviderContext';
import { useWorkspace, workspaceMeta, type Workspace } from '../../features/workspace/workspace';
import { cn } from '../../lib/utils';

/**
 * The top of a home screen on a phone.
 *
 * Below `lg` the console draws no bar, so this is the bar: one white block the width of the
 * screen, round along its underside like every other section's. It carries the two things a
 * header carried — which cabinet you are in, and which of the two businesses you are looking at —
 * and the date, because a counter tool is used on a particular day.
 *
 * Both homes use it, which is also what keeps the way back to Прокат on the Впечатления screen.
 */
export function MobileHomeHeader({ className }: { className?: string }) {
  const provider = useProvider();
  const { workspace, setWorkspace } = useWorkspace();
  const today = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className={cn('rounded-b-2xl bg-white px-4 pb-4 pt-4 lg:hidden', className)}>
      <p className="truncate text-lg font-semibold text-gray-950">{provider.displayName}</p>
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
    </div>
  );
}
