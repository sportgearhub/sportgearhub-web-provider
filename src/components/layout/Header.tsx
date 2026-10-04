import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  Building2,
  CalendarCheck,
  ChevronDown,
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  MapPin,
  Package,
  Repeat,
  Store,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { useProvider } from '../../features/providers/ProviderContext';
import { BrandWordmark } from './BrandWordmark';
import { CabinetSwitchDialog } from '../../features/providers/CabinetSwitchDialog';
import { cn } from '../../lib/utils';

const navItems: { label: string; path: string; icon: LucideIcon }[] = [
  { label: 'Дашборд', path: '/', icon: LayoutDashboard },
  { label: 'Заказы', path: '/bookings', icon: CalendarCheck },
  { label: 'Каталог', path: '/products', icon: Package },
];

// Settings live in the profile menu, grouped as they are in the settings sidebar.
const profileMenuGroups: { title: string; items: { label: string; path: string; icon: LucideIcon }[] }[] = [
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
      { label: 'Реквизиты', path: '/settings/payouts', icon: CreditCard },
      { label: 'Договоры', path: '/settings/contracts', icon: FileText },
    ],
  },
  {
    title: 'Учётная запись',
    items: [{ label: 'Аккаунт', path: '/settings/account', icon: UserRound }],
  },
];

interface HeaderProps {
  /** Console-relative path, e.g. "/products". */
  currentPath: string;
  onNavigate: (path: string) => void;
  actions?: React.ReactNode;
  /**
   * A page that is one job rather than a place: creating a card, editing one. On a phone it takes
   * the screen — the header becomes a way back and the name of what you are doing, and the section
   * bar goes away, because leaving halfway through by tapping «Каталог» is not a thing to offer.
   */
  task?: { title: string; backTo: string } | null;
}

export function Header({ currentPath, onNavigate, actions, task }: HeaderProps) {
  const { user, signOut } = useAuth();
  const provider = useProvider();
  const isActive = (path: string) => (path === '/' ? currentPath === '/' : currentPath.startsWith(path));

  return (
    <header className="sticky top-0 z-30 border-b bg-background">
      <div className="mx-auto flex min-h-16 w-full max-w-screen-xl flex-wrap items-center gap-x-4 gap-y-1 px-6 py-2">
        {task ? (
          <div className="flex min-w-0 flex-1 items-center gap-2 lg:hidden">
            <button
              type="button"
              onClick={() => onNavigate(task.backTo)}
              aria-label="Назад"
              className="-ml-2 shrink-0 rounded-lg p-2 text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
            >
              <ArrowLeft size={20} />
            </button>
            <span className="min-w-0 truncate text-base font-semibold text-gray-950">{task.title}</span>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => onNavigate('/')}
          className={cn(
            'shrink-0 items-center rounded-lg text-left transition hover:opacity-80',
            task ? 'hidden lg:flex' : 'flex'
          )}
          title="На главную"
          aria-label="Sportgearhub — на главную"
        >
          <BrandWordmark size="sm" className="sm:text-lg" />
        </button>
        {/* Scrolls sideways on a phone rather than wrapping to a second row. Safe now that the menus
            are portalled: a scroll container can no longer clip them. */}
        {/* Below `lg` the sections live in the bar at the bottom of the screen, within a thumb's
            reach, rather than at the top where no thumb goes. */}
        <nav className="hidden items-center gap-1 lg:flex lg:flex-1 lg:justify-center" aria-label="Разделы">
          {navItems.map(item => (
            <button
              key={item.path}
              type="button"
              onClick={() => onNavigate(item.path)}
              aria-current={isActive(item.path) ? 'page' : undefined}
              className={cn(
                'flex h-9 shrink-0 items-center rounded-lg px-3 text-sm font-medium transition-colors',
                isActive(item.path)
                  ? 'bg-sidebar-accent text-sidebar-primary'
                  : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-0">
          {actions}
          <div className="hidden lg:block">
            <ProfileMenu
            name={user?.name ?? ''}
            phone={user?.phone ?? ''}
            cabinetName={provider.displayName}
            currentProviderId={provider.providerId}
            currentPath={currentPath}
            onNavigate={onNavigate}
              onSignOut={signOut}
            />
          </div>
        </div>
      </div>

      {!task && <MobileNav currentPath={currentPath} onNavigate={onNavigate} isActive={isActive} />}
    </header>
  );
}

/**
 * The sections, on a phone, where the hand is.
 *
 * A row of tabs at the top of a tall screen is as far from the thumb as the interface gets; every
 * phone platform puts primary navigation at the bottom for that reason. «Профиль» opens a sheet
 * rather than a dropdown — a menu anchored under a trigger that already sits on the bottom edge
 * would open off the screen.
 */
function MobileNav({
  currentPath,
  onNavigate,
  isActive,
}: {
  currentPath: string;
  onNavigate: (path: string) => void;
  isActive: (path: string) => boolean;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const inSettings = currentPath.startsWith('/settings');

  return (
    <>
      <nav
        aria-label="Разделы"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-background pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <div className="flex">
          {navItems.map(item => {
            const active = isActive(item.path) && !inSettings;
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => onNavigate(item.path)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors',
                  active ? 'text-blue-700' : 'text-gray-500'
                )}
              >
                <item.icon size={20} strokeWidth={active ? 2.4 : 2} />
                {item.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-haspopup="dialog"
            aria-current={inSettings ? 'page' : undefined}
            className={cn(
              'flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors',
              inSettings ? 'text-blue-700' : 'text-gray-500'
            )}
          >
            <UserRound size={20} strokeWidth={inSettings ? 2.4 : 2} />
            Профиль
          </button>
        </div>
      </nav>

      {sheetOpen && (
        <MobileProfileSheet
          currentPath={currentPath}
          onNavigate={path => { setSheetOpen(false); onNavigate(path); }}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </>
  );
}

function MobileProfileSheet({
  currentPath,
  onNavigate,
  onClose,
}: {
  currentPath: string;
  onNavigate: (path: string) => void;
  onClose: () => void;
}) {
  const { user, signOut } = useAuth();
  const provider = useProvider();
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end lg:hidden" role="dialog" aria-modal="true" aria-label="Профиль">
      <div className="absolute inset-0 bg-gray-950/40" onClick={onClose} />
      <div className="relative max-h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-background pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-gray-950">{user?.name}</p>
            <p className="truncate text-sm text-gray-500">{user?.phone}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="-mr-1 rounded-lg p-1.5 text-gray-500 transition hover:bg-gray-100"
          >
            <X size={18} />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setSwitching(true)}
          className="flex w-full items-center gap-3 border-y border-gray-100 px-5 py-3 text-left transition hover:bg-gray-50"
        >
          <Building2 size={18} className="shrink-0 text-gray-400" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-gray-900">{provider.displayName}</span>
            <span className="block text-xs text-gray-500">Сменить кабинет</span>
          </span>
          <Repeat size={15} className="shrink-0 text-gray-400" />
        </button>

        {profileMenuGroups.map(group => (
          <div key={group.title} className="py-2">
            <p className="px-5 py-1 text-[11px] font-medium uppercase tracking-wide text-gray-500">{group.title}</p>
            {group.items.map(item => {
              const active = currentPath.startsWith(item.path);
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => onNavigate(item.path)}
                  className={cn(
                    'flex w-full items-center gap-3 px-5 py-2.5 text-left text-sm transition',
                    active ? 'bg-blue-50 text-blue-700' : 'text-gray-800 hover:bg-gray-50'
                  )}
                >
                  <item.icon size={17} className={active ? 'text-blue-600' : 'text-gray-400'} />
                  {item.label}
                </button>
              );
            })}
          </div>
        ))}

        <button
          type="button"
          onClick={() => void signOut()}
          className="flex w-full items-center gap-3 border-t border-gray-100 px-5 py-3.5 text-left text-sm text-red-600 transition hover:bg-red-50"
        >
          <LogOut size={17} /> Выйти
        </button>
      </div>

      {switching && <CabinetSwitchDialog open currentProviderId={provider.providerId} onClose={() => setSwitching(false)} />}
    </div>,
    document.body
  );
}

function ProfileMenu({
  name,
  phone,
  cabinetName,
  currentProviderId,
  currentPath,
  onNavigate,
  onSignOut,
}: {
  name: string;
  phone: string;
  cabinetName: string;
  currentProviderId: string;
  currentPath: string;
  onNavigate: (path: string) => void;
  onSignOut: () => void;
}) {
  const menu = useDropdown('right', 280);
  const [switching, setSwitching] = useState(false);
  const inSettings = currentPath.startsWith('/settings');

  return (
    <>
      <button
        ref={menu.triggerRef}
        type="button"
        onClick={menu.toggle}
        aria-expanded={menu.open}
        aria-haspopup="menu"
        title={name}
        className={cn(
          'flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition',
          inSettings || menu.open
            ? 'border-blue-200 bg-sidebar-accent text-sidebar-primary'
            : 'border-input bg-background text-foreground hover:bg-sidebar-accent'
        )}
      >
        <UserRound size={15} className="shrink-0" />
        <span className="hidden sm:block">Профиль</span>
        <ChevronDown size={13} className={cn('shrink-0 text-muted-foreground transition-transform', menu.open && 'rotate-180')} />
      </button>

      {menu.render(
        <>
          <div className="border-b px-3 pb-2 pt-1">
            <p className="truncate text-sm font-medium text-foreground">{name}</p>
            <p className="truncate text-xs text-muted-foreground">{phone}</p>
          </div>

          {/* The cabinet everything on screen belongs to, and the way to another one. */}
          <div className="border-b px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Кабинет</p>
            <p className="mt-0.5 truncate text-sm font-medium text-foreground">{cabinetName}</p>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                menu.close();
                setSwitching(true);
              }}
              className="mt-1 flex items-center gap-1.5 text-sm font-medium text-blue-700 transition hover:text-blue-800"
            >
              <Repeat size={13} /> Сменить кабинет
            </button>
          </div>

          {profileMenuGroups.map(group => (
            <div key={group.title} className="border-b py-1">
              <p className="px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{group.title}</p>
              {group.items.map(item => {
                const Icon = item.icon;
                const active = currentPath.startsWith(item.path);
                return (
                  <button
                    key={item.path}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      menu.close();
                      onNavigate(item.path);
                    }}
                    className={cn(
                      'flex h-9 w-full items-center gap-2 px-3 text-left text-sm transition hover:bg-sidebar-accent',
                      active ? 'text-sidebar-primary' : 'text-foreground'
                    )}
                  >
                    <Icon size={14} className="shrink-0 text-muted-foreground" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              menu.close();
              onSignOut();
            }}
            className="mt-1 flex h-9 w-full items-center gap-2 px-3 text-left text-sm text-red-600 transition hover:bg-red-50"
          >
            <LogOut size={14} />
            Выйти
          </button>
        </>
      )}

      <CabinetSwitchDialog open={switching} currentProviderId={currentProviderId} onClose={() => setSwitching(false)} />
    </>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/**
 * Header menus render into document.body: an absolutely positioned menu is at the mercy of every
 * ancestor's overflow, and the header sits inside a clipped, sticky shell.
 */
function useDropdown(align: 'left' | 'right' = 'left', width = 208) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);
  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    setRect(triggerRef.current?.getBoundingClientRect() ?? null);
    setOpen(true);
  };
  useEffect(() => {
    if (!open) return;
    const handleMouseDown = (event: MouseEvent) => {
      if (triggerRef.current?.contains(event.target as Node)) return;
      if (menuRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const dismiss = () => setOpen(false);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', dismiss);
    };
  }, [open]);
  const render = (children: React.ReactNode) => {
    if (!open || !rect) return null;
    // Kept inside the viewport: a trigger near the right edge would otherwise push the menu off-screen.
    const gutter = 8;
    const placement = align === 'left'
      ? { left: clamp(rect.left, gutter, window.innerWidth - width - gutter) }
      : { right: clamp(window.innerWidth - rect.right, gutter, window.innerWidth - width - gutter) };
    return createPortal(
      <div
        ref={menuRef}
        role="menu"
        style={{ position: 'fixed', top: rect.bottom + 6, width, zIndex: 9999, ...placement }}
        className="overflow-hidden rounded-lg border bg-background py-1 shadow-xl"
      >
        {children}
      </div>,
      document.body
    );
  };
  return { open, close, toggle, triggerRef, render };
}
