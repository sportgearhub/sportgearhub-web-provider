import { ChevronRight, LogOut } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { CabinetHeader } from '../../components/layout/CabinetHeader';
import { useWorkspace } from '../workspace/workspace';
import { homeShortcuts, settingsGroups } from './menuGroups';
import { cn } from '../../lib/utils';

export function MenuPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { signOut } = useAuth();
  // Which shortcuts to show: the work differs between the two businesses even though the cabinet
  // and its settings do not.
  const { workspace } = useWorkspace();

  return (
    <div className="space-y-4 px-3 pb-24">
      {/* The cabinet is the header here, as it is on the home screens: its mark, its name with a
          way to change it, how customers reach it, and its settings in the corner. */}
      <CabinetHeader onNavigate={onNavigate} className="-mx-3" />

      {/* Joined to the bar, the way the catalogue's are: no gap and the same white, so the row
          reads as the bottom of the header rather than a card with an edge of its own. */}
      <section className="-mx-3 -mt-4 rounded-b-2xl bg-white px-3 pb-3 pt-4">
        <div className="grid grid-cols-3 gap-2">
          {homeShortcuts[workspace].map(item => (
            <button
              key={item.path}
              type="button"
              onClick={() => onNavigate(item.path)}
              className="flex flex-col items-center gap-2 rounded-2xl bg-gray-50 px-2 py-3 text-center transition active:bg-gray-100"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                <item.icon size={24} />
              </span>
              <span className="text-xs font-medium text-gray-800">{item.label}</span>
            </button>
          ))}
        </div>
      </section>

      {settingsGroups.map(group => (
        <section key={group.title}>
          <p className="px-4 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-500">{group.title}</p>
          {/* Rows the way a phone draws them: the glyph in a tinted square so the column of them
              reads as a column, and the rule between two rows starting where the words do rather
              than cutting across the icons. */}
          <div className="overflow-hidden rounded-2xl bg-white">
            {group.items.map((item, index) => (
              <button
                key={item.path}
                type="button"
                onClick={() => onNavigate(item.path)}
                className="flex w-full items-center gap-3 px-3 py-1 text-left text-sm text-gray-900 transition active:bg-gray-50"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-600">
                  <item.icon size={18} />
                </span>
                <span
                  className={cn(
                    'flex min-w-0 flex-1 items-center gap-3 py-3',
                    index > 0 && 'border-t border-gray-100'
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  <ChevronRight size={16} className="shrink-0 text-gray-400" />
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}

      <button
        type="button"
        onClick={() => void signOut()}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3.5 text-sm font-medium text-red-600 transition active:bg-red-50"
      >
        <LogOut size={16} /> Выйти
      </button>

    </div>
  );
}
