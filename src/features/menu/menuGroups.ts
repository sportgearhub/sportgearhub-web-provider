import {
  Building2,
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
