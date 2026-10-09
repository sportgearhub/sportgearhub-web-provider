import { useState } from 'react';
import {
  Building2,
  ChevronRight,
  CreditCard,
  FileText,
  LogOut,
  MapPin,
  Package,
  Repeat,
  CalendarDays,
  ScanLine,
  Sparkles,
  Store,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { useProvider } from '../providers/ProviderContext';
import { CabinetSwitchDialog } from '../providers/CabinetSwitchDialog';
import { useWorkspace, workspaceMeta, type Workspace } from '../workspace/workspace';
import { cn } from '../../lib/utils';

type Row = { label: string; path: string; icon: LucideIcon };

const groups: { title: string; items: Row[] }[] = [
  {
    title: 'Управление кабинетом',
    items: [
      { label: 'Профиль проката', path: '/settings/shop', icon: Store },
      { label: 'Пункты проката', path: '/settings/locations', icon: MapPin },
      { label: 'Сотрудники', path: '/settings/employees', icon: Users },
    ],
  },
  {
    title: 'Реквизиты и договор',
    items: [
      { label: 'Информация о продавце', path: '/settings/seller', icon: Building2 },
      { label: 'Реквизиты выплат', path: '/settings/payouts', icon: CreditCard },
      { label: 'Договоры', path: '/settings/contracts', icon: FileText },
    ],
  },
  {
    title: 'Учётная запись',
    items: [{ label: 'Аккаунт', path: '/settings/account', icon: UserRound }],
  },
];

/** Shortcuts to the things done most, as tiles rather than another list to read. */
const shortcutsByWorkspace: Record<Workspace, Row[]> = {
  rental: [
    { label: 'Сканер', path: '/scan', icon: ScanLine },
    { label: 'Каталог', path: '/products', icon: Package },
    { label: 'Выплаты', path: '/settings/payouts', icon: Wallet },
  ],
  experience: [
    { label: 'Впечатления', path: '/x/experiences', icon: Sparkles },
    { label: 'Расписание', path: '/x/schedule', icon: CalendarDays },
    { label: 'Выплаты', path: '/settings/payouts', icon: Wallet },
  ],
};

/**
 * Меню — everything that is not one of the four sections.
 *
 * It replaced a dropdown sheet hanging off the navigation bar. A sheet is for a short, reversible
 * choice; this is a destination with a dozen places in it, and on a phone those want a page with
 * room, not a panel covering the one underneath. The sections it leads to are pages too, each with
 * its own way back — which is how a phone is navigated and was the part that felt broken.
 */
export function MenuPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { user, signOut } = useAuth();
  const provider = useProvider();
  const { workspace, setWorkspace } = useWorkspace();
  const [switching, setSwitching] = useState(false);

  return (
    <div className="space-y-4 px-3 pb-6 pt-1">
      <section className="rounded-xl bg-white p-4">
        <p className="truncate text-base font-semibold text-gray-950">{user?.name}</p>
        <p className="truncate text-sm text-gray-500">{user?.phone ?? user?.email}</p>

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

        <button
          type="button"
          onClick={() => setSwitching(true)}
          className="mt-2 flex w-full items-center gap-3 rounded-xl bg-gray-50 px-3 py-2.5 text-left transition active:bg-gray-100"
        >
          <Building2 size={17} className="shrink-0 text-gray-400" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-gray-900">{provider.displayName}</span>
            <span className="block text-xs text-gray-500">Сменить кабинет</span>
          </span>
          <Repeat size={15} className="shrink-0 text-gray-400" />
        </button>
      </section>

      <section className="rounded-xl bg-white p-3">
        <div className="grid grid-cols-3 gap-2">
          {shortcutsByWorkspace[workspace].map(item => (
            <button
              key={item.path}
              type="button"
              onClick={() => onNavigate(item.path)}
              className="flex flex-col items-center gap-2 rounded-xl px-2 py-3 text-center transition active:bg-gray-50"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <item.icon size={20} />
              </span>
              <span className="text-xs font-medium text-gray-800">{item.label}</span>
            </button>
          ))}
        </div>
      </section>

      {groups.map(group => (
        <section key={group.title}>
          <p className="px-1 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-500">{group.title}</p>
          <div className="overflow-hidden rounded-xl bg-white">
            {group.items.map((item, index) => (
              <button
                key={item.path}
                type="button"
                onClick={() => onNavigate(item.path)}
                className={cn(
                  'flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-gray-900 transition active:bg-gray-50',
                  index > 0 && 'border-t border-gray-100'
                )}
              >
                <item.icon size={17} className="shrink-0 text-gray-400" />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                <ChevronRight size={16} className="shrink-0 text-gray-400" />
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

      {switching && (
        <CabinetSwitchDialog open currentProviderId={provider.providerId} onClose={() => setSwitching(false)} />
      )}
    </div>
  );
}
