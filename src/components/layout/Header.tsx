import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  ChevronDown,
  CreditCard,
  FileText,
  HelpCircle,
  Building2,
  LogOut,
  MapPin,
  Mountain,
  Plus,
  Store,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { useProvider } from '../../features/providers/ProviderContext';
import { selectProvider } from '../../lib/active-provider';
import { statusMeta } from '../../features/providers/providerStatus';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

const navItems: { label: string; path: string }[] = [
  { label: 'Дашборд', path: '/' },
  { label: 'Заказы', path: '/bookings' },
  { label: 'Выдача', path: '/fulfillment' },
  { label: 'Каталог', path: '/resources' },
  { label: 'Предложения', path: '/offers' },
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
  /** Console-relative path, e.g. "/resources". */
  currentPath: string;
  onNavigate: (path: string) => void;
  actions?: React.ReactNode;
}

export function Header({ currentPath, onNavigate, actions }: HeaderProps) {
  const { user, signOut } = useAuth();
  const provider = useProvider();
  const isActive = (path: string) => (path === '/' ? currentPath === '/' : currentPath.startsWith(path));

  return (
    <header className="sticky top-0 z-30 border-b bg-background">
      <div className="mx-auto flex w-full max-w-screen-xl flex-wrap items-center gap-x-4 gap-y-1 px-6 py-1.5">
        <button
          type="button"
          onClick={() => onNavigate('/')}
          className="flex shrink-0 items-center gap-2 rounded-md text-left transition hover:opacity-80"
          title="На главную"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <Mountain size={15} />
          </span>
          <span className="hidden text-sm font-semibold text-foreground sm:block">Sportgearhub</span>
        </button>
        {/* Scrolls sideways on a phone rather than wrapping to a second row. Safe now that the menus
            are portalled: a scroll container can no longer clip them. */}
        <nav
          className="order-last flex w-full items-center gap-1 overflow-x-auto pb-1 lg:order-none lg:w-auto lg:flex-1 lg:justify-center lg:overflow-visible lg:pb-0"
          aria-label="Разделы"
        >
          {navItems.map(item => (
            <button
              key={item.path}
              type="button"
              onClick={() => onNavigate(item.path)}
              aria-current={isActive(item.path) ? 'page' : undefined}
              className={cn(
                'shrink-0 rounded-md px-3 py-1 text-sm font-medium transition-colors',
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
          {/* The cabinet sits with the account, the way a seller cabinet puts the shop switcher. */}
          <ProviderSwitcher currentName={provider.displayName} />
          <Button type="button" variant="secondary" size="icon" className="h-8 w-8" title="Помощь">
            <HelpCircle size={14} />
          </Button>
          <UserMenu
            name={user?.name ?? ''}
            phone={user?.phone ?? ''}
            currentPath={currentPath}
            onNavigate={onNavigate}
            onSignOut={signOut}
          />
        </div>
      </div>
    </header>
  );
}

/** The cabinet in the header, with the way back to the list and to a new one — the picker's shortcut. */
function ProviderSwitcher({ currentName }: { currentName: string }) {
  const { providers } = useAuth();
  const current = useProvider();
  const navigate = useNavigate();
  const menu = useDropdown('right', 264);
  return (
    <>
      <button
        ref={menu.triggerRef}
        type="button"
        onClick={menu.toggle}
        aria-expanded={menu.open}
        aria-haspopup="menu"
        className={cn(
          'flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-left text-sm font-medium transition',
          menu.open ? 'bg-sidebar-accent text-foreground' : 'text-foreground hover:bg-sidebar-accent'
        )}
        title="Сменить кабинет"
      >
        <span className="max-w-[80px] truncate sm:max-w-[200px]">{currentName}</span>
        <ChevronDown size={13} className={cn('shrink-0 text-muted-foreground transition-transform', menu.open && 'rotate-180')} />
      </button>
      {menu.render(
        <>
          <p className="px-3 pb-1 pt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Кабинеты</p>
          {providers.map(item => {
            const meta = statusMeta(item.status);
            const active = item.providerId === current.providerId;
            return (
              <button
                key={item.providerId}
                type="button"
                role="menuitem"
                onClick={() => {
                  menu.close();
                  if (!active) {
                    selectProvider(item.providerId);
                    navigate('/');
                  }
                }}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-sidebar-accent',
                  active ? 'text-sidebar-primary' : 'text-foreground'
                )}
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">{active && <Check size={14} />}</span>
                <span className="min-w-0 flex-1 truncate">{item.displayName}</span>
                {item.status !== 'active' && <Badge variant={meta.variant}>{meta.label}</Badge>}
              </button>
            );
          })}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              menu.close();
              navigate('/providers/new');
            }}
            className="mt-1 flex h-9 w-full items-center gap-2 border-t px-3 text-left text-sm text-foreground transition hover:bg-sidebar-accent"
          >
            <Plus size={14} />
            Добавить кабинет
          </button>
        </>
      )}
    </>
  );
}

function UserMenu({
  name,
  phone,
  currentPath,
  onNavigate,
  onSignOut,
}: {
  name: string;
  phone: string;
  currentPath: string;
  onNavigate: (path: string) => void;
  onSignOut: () => void;
}) {
  const menu = useDropdown('right', 268);
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
          'flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-sm font-medium transition',
          inSettings || menu.open ? 'bg-sidebar-accent text-sidebar-primary' : 'text-foreground hover:bg-sidebar-accent'
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
          {profileMenuGroups.map(group => (
            <div key={group.title} className="border-b py-1 last:border-b-0">
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
        className="overflow-hidden rounded-md border bg-background py-1 shadow-xl"
      >
        {children}
      </div>,
      document.body
    );
  };
  return { open, close, toggle, triggerRef, render };
}
