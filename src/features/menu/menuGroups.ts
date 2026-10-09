import {
  Building2,
  CalendarDays,
  Package,
  ScanLine,
  Sparkles,
  CreditCard,
  FileText,
  MapPin,
  Store,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export type MenuRow = { label: string; path: string; icon: LucideIcon };

/**
 * The cabinet's own screens, grouped.
 *
 * One list, read by both Меню and Настройки — the gear in the cabinet's bar and the Меню tab are
 * two doors to the same rooms, and two copies of this array would drift within a week.
 */
export const settingsGroups: { title: string; items: MenuRow[] }[] = [
  {
    title: 'Управление кабинетом',
    items: [
      { label: 'Профиль проката', path: '/settings/shop', icon: Store },
      { label: 'Пункты проката', path: '/settings/locations', icon: MapPin },
      { label: 'Сотрудники', path: '/settings/employees', icon: Users },
    ],
  },
  {
    title: 'Деньги',
    items: [
      { label: 'Финансы', path: '/finances', icon: Wallet },
      { label: 'Реквизиты выплат', path: '/settings/payouts', icon: CreditCard },
    ],
  },
  {
    title: 'Документы',
    items: [
      { label: 'Информация о продавце', path: '/settings/seller', icon: Building2 },
      { label: 'Договоры', path: '/settings/contracts', icon: FileText },
    ],
  },
  {
    title: 'Учётная запись',
    items: [{ label: 'Аккаунт', path: '/settings/account', icon: UserRound }],
  },
];

/**
 * The jobs reached from a home screen, in the order they are reached.
 *
 * Сканер is first and is not in the navigation bar: it is one job done at a counter rather than
 * one of the places this console is, and the screen a seller lands on is the one they open with a
 * customer in front of them.
 */
export const homeShortcuts: Record<string, MenuRow[]> = {
  rental: [
    { label: 'Сканер', path: '/scan', icon: ScanLine },
    { label: 'Каталог', path: '/products', icon: Package },
    { label: 'Финансы', path: '/finances', icon: Wallet },
  ],
  experience: [
    { label: 'Впечатления', path: '/x/experiences', icon: Sparkles },
    { label: 'Расписание', path: '/x/schedule', icon: CalendarDays },
    { label: 'Финансы', path: '/finances', icon: Wallet },
  ],
};
