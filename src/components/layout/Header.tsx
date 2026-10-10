import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CalendarCheck,
  Building2,
  Check,
  CalendarDays,
  ChevronDown,
  Home,
  LogOut,
  Package,
  Plus,
  UserRound,
  LayoutGrid,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { selectProvider } from '../../lib/active-provider';
import { useAuth } from '../../context/useAuth';
import { useProvider } from '../../features/providers/ProviderContext';
import { BrandWordmark } from './BrandWordmark';
import { settingsGroups } from '../../features/menu/menuGroups';
import { cn } from '../../lib/utils';
import { useWorkspace, type Workspace } from '../../features/workspace/workspace';

type NavItem = { label: string; path: string; icon: LucideIcon };

/** Each workspace has its own sections; nothing is shared but the cabinet underneath them. */
const navByWorkspace: Record<Workspace, NavItem[]> = {
  rental: [
    { label: 'Главная', path: '/', icon: Home },
    { label: 'Заказы', path: '/bookings', icon: CalendarCheck },
    { label: 'Каталог', path: '/products', icon: Package },
    { label: 'Финансы', path: '/finances', icon: Wallet },
  ],
  // Four, because «Меню» is the fifth and five is what fits across a phone. Впечатления live one
  // tap away on the home screen and in the menu, which is where a list of your own products
  // belongs anyway — it is visited to change something, not all day.
  experience: [
    { label: 'Главная', path: '/x', icon: Home },
    { label: 'Расписание', path: '/x/schedule', icon: CalendarDays },
    { label: 'Брони', path: '/x/bookings', icon: CalendarCheck },
    { label: 'Финансы', path: '/x/finances', icon: Wallet },
  ],
};

// The profile menu shows the same rooms as Меню and Настройки do on a phone, from one array —
// this was a second copy, and it had already drifted: no Финансы, «Реквизиты» for what the other
// two call «Реквизиты выплат».
const profileMenuGroups = settingsGroups;

interface HeaderProps {
  /** Console-relative path, e.g. "/products". */
  currentPath: string;
  onNavigate: (path: string) => void;
  actions?: React.ReactNode;
}

/**
 * The console's header, which is a desktop thing.
 *
 * On a phone the sections are in the bar at the bottom, within a thumb's reach, and a screen one
 * level in draws its own bar (see SubPageHeader) — so there is nothing left for this to do below
 * `lg`, and the layout does not render it there.
 */
export function Header({ currentPath, onNavigate, actions }: HeaderProps) {
  const { user, signOut } = useAuth();
  const provider = useProvider();
  const { workspace } = useWorkspace();
  const isActive = (path: string) =>
    path === '/' || path === '/x' ? currentPath === path : currentPath.startsWith(path);

  return (
    <header className="sticky top-0 z-30 rounded-b-2xl bg-white shadow-sm">
      <div className="mx-auto flex min-h-16 w-full max-w-screen-xl flex-wrap items-center gap-x-4 gap-y-1 px-6 py-2">
        <button
          type="button"
          onClick={() => onNavigate('/')}
          className="flex shrink-0 items-center rounded-lg text-left transition hover:opacity-80"
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
          {navByWorkspace[workspace].map(item => (
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
            currentProviderId={provider.providerId}
            currentPath={currentPath}
            onNavigate={onNavigate}
              onSignOut={signOut}
            />
          </div>
        </div>
      </div>

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
export function MobileNavBar({
  currentPath,
  onNavigate,
}: {
  currentPath: string;
  onNavigate: (path: string) => void;
}) {
  const { workspace } = useWorkspace();
  const inMenu = currentPath === '/menu' || currentPath.startsWith('/settings');
  const isActive = (path: string) =>
    path === '/' || path === '/x' ? currentPath === path : currentPath.startsWith(path);

  return (
    <>
      <nav
        aria-label="Разделы"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-background pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <div className="flex">
          {navByWorkspace[workspace].map(item => {
            const active = isActive(item.path) && !inMenu;
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
            onClick={() => onNavigate('/menu')}
            aria-current={inMenu ? 'page' : undefined}
            className={cn(
              'flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors',
              inMenu ? 'text-blue-700' : 'text-gray-500'
            )}
          >
            <LayoutGrid size={20} strokeWidth={inMenu ? 2.4 : 2} />
            Меню
          </button>
        </div>
      </nav>

    </>
  );
}

function ProfileMenu({
  name,
  phone,
  currentProviderId,
  currentPath,
  onNavigate,
  onSignOut,
}: {
  name: string;
  phone: string;
  currentProviderId: string;
  currentPath: string;
  onNavigate: (path: string) => void;
  onSignOut: () => void;
}) {
  const menu = useDropdown('right', 280);
  const { providers } = useAuth();
  const navigate = useNavigate();
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

          {/* The cabinet, back where it was: a seller with one never thinks about it, and a seller
              with two changes it rarely enough that it belongs behind the same button as the
              account rather than taking a place of its own in the bar. */}
          <div className="border-b py-1">
            <p className="px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Кабинет
            </p>
            {providers.map(item => (
              <button
                key={item.providerId}
                type="button"
                role="menuitem"
                onClick={() => {
                  menu.close();
                  if (item.providerId === currentProviderId) return;
                  selectProvider(item.providerId);
                  // Everything on screen belongs to the old cabinet; a reload replaces it honestly.
                  navigate(0);
                }}
                className={cn(
                  'flex h-9 w-full items-center gap-2 px-3 text-left text-sm transition hover:bg-sidebar-accent',
                  item.providerId === currentProviderId ? 'text-sidebar-primary' : 'text-foreground'
                )}
              >
                <Building2 size={14} className="shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{item.displayName}</span>
                {item.providerId === currentProviderId && <Check size={14} className="shrink-0" />}
              </button>
            ))}
            <button
              type="button"
              role="menuitem"
              onClick={() => { menu.close(); navigate('/providers/new'); }}
              className="flex h-9 w-full items-center gap-2 px-3 text-left text-sm text-blue-700 transition hover:bg-sidebar-accent"
            >
              <Plus size={14} className="shrink-0" /> Добавить кабинет
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
