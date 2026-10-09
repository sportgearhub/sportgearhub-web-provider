import { ChevronRight, type LucideIcon } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { settingsGroups } from './menuGroups';

/**
 * Настройки — everything about the cabinet and the account, as one list.
 *
 * Reached from the gear in the cabinet's bar, and the same rows are in Меню. That duplication is
 * deliberate: the gear is where a phone puts settings, and Меню is where this console puts
 * everything, and a person looking in either place should find them.
 */
export function SettingsListPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { user, signOut } = useAuth();

  return (
    <div className="space-y-4 px-3 pb-24 pt-3">
      <Group title="Аккаунт">
        <Row
          label={user?.name ?? 'Аккаунт'}
          note={user?.phone ?? user?.email ?? undefined}
          onClick={() => onNavigate('/settings/account')}
        />
      </Group>

      {settingsGroups.map(group => (
        <Group key={group.title} title={group.title}>
          {group.items.map((item, index) => (
            <Row
              key={item.path}
              icon={item.icon}
              label={item.label}
              divider={index > 0}
              onClick={() => onNavigate(item.path)}
            />
          ))}
        </Group>
      ))}

      <button
        type="button"
        onClick={() => void signOut()}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3.5 text-sm font-medium text-red-600 transition active:bg-red-50"
      >
        Выйти
      </button>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="px-4 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-500">{title}</p>
      <div className="overflow-hidden rounded-2xl bg-white">{children}</div>
    </section>
  );
}

function Row({
  icon: Icon,
  label,
  note,
  divider,
  onClick,
}: {
  icon?: LucideIcon;
  label: string;
  note?: string;
  divider?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-3 py-1 text-left text-sm text-gray-900 transition active:bg-gray-50"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-600">
        {Icon ? <Icon size={18} /> : <span className="text-sm font-semibold uppercase">{label.charAt(0)}</span>}
      </span>
      <span className={`flex min-w-0 flex-1 items-center gap-3 py-3 ${divider ? 'border-t border-gray-100' : ''}`}>
        <span className="min-w-0 flex-1">
          <span className="block truncate">{label}</span>
          {note && <span className="mt-0.5 block truncate text-xs text-gray-500">{note}</span>}
        </span>
        <ChevronRight size={16} className="shrink-0 text-gray-400" />
      </span>
    </button>
  );
}
