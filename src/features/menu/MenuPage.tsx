import {
  Building2,
  ChevronRight,
  CreditCard,
  FileText,
  LogOut,
  MapPin,
  Package,
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
import { CabinetHeader } from '../../components/layout/CabinetHeader';
import { useWorkspace, type Workspace } from '../workspace/workspace';
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
  // Which shortcuts to show: the work differs between the two businesses even though the cabinet
  // and its settings do not.
  const { workspace } = useWorkspace();

  return (
    <div className="space-y-4 px-3 pb-6">
      {/* The cabinet is the header here, as it is on the home screens: its mark, its name with a
          way to change it, how customers reach it, and its settings in the corner. The two
          businesses are not offered on this screen — this is the cabinet's own list, and the
          switch belongs where the work is. */}
      <CabinetHeader onNavigate={onNavigate} className="-mx-3" />

      {/* Who is signed in — and a way into that account, rather than a card that only says it. */}
      <button
        type="button"
        onClick={() => onNavigate('/settings/account')}
        className="flex w-full items-center gap-3 rounded-xl bg-white px-4 py-3 text-left transition active:bg-gray-50"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
          <UserRound size={19} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-gray-950">{user?.name}</span>
          <span className="block truncate text-xs text-gray-500">{user?.phone ?? user?.email}</span>
        </span>
        <ChevronRight size={16} className="shrink-0 text-gray-400" />
      </button>

      <section className="rounded-xl bg-white p-3">
        <div className="grid grid-cols-3 gap-2">
          {shortcutsByWorkspace[workspace].map(item => (
            <button
              key={item.path}
              type="button"
              onClick={() => onNavigate(item.path)}
              className="flex flex-col items-center gap-2.5 rounded-xl px-2 py-4 text-center transition active:bg-gray-50"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                <item.icon size={26} />
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

    </div>
  );
}
