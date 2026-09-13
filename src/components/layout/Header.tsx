import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronRight, HelpCircle, LogOut, Mountain, UserRound } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';

export type HeaderBreadcrumb = {
  label: string;
  path?: string;
};

type MenuItem = {
  label: string;
  path: string;
  /** Draws a divider above the item, to separate money and account from shop setup. */
  separated?: boolean;
};

const navItems: { label: string; path: string }[] = [
  { label: 'Дашборд', path: '/' },
  { label: 'Выдача', path: '/fulfillment' },
  { label: 'Каталог', path: '/resources' },
  { label: 'Предложения', path: '/offers' },
];

export const settingsMenuItems: MenuItem[] = [
  { label: 'Магазин', path: '/settings/shop' },
  { label: 'Локации', path: '/settings/locations' },
  { label: 'Сотрудники', path: '/settings/employees' },
  { label: 'Выплаты', path: '/settings/payouts', separated: true },
  { label: 'Аккаунт', path: '/settings/account' },
];

interface HeaderProps {
  currentPath: string;
  title?: string;
  subtitle?: string;
  breadcrumbs?: HeaderBreadcrumb[];
  onNavigate: (path: string) => void;
  actions?: React.ReactNode;
}

export function Header({ currentPath, title, subtitle, breadcrumbs, onNavigate, actions }: HeaderProps) {
  const { user, activeMembership, signOut } = useAuth();
  const providerName = activeMembership?.displayName ?? 'Кабинет партнёра';
  const hasBreadcrumbs = Boolean(breadcrumbs?.length);
  const hasTitle = Boolean(title);
  const settingsActive = currentPath.startsWith('/settings');

  const isActive = (path: string) => (path === '/' ? currentPath === '/' : currentPath.startsWith(path));

  return (
    <header className="sticky top-0 z-30 border-b bg-background">
      <div className="mx-auto flex w-full max-w-screen-xl flex-wrap items-center gap-x-4 gap-y-1 px-6 py-2">
        <button
          type="button"
          onClick={() => onNavigate('/')}
          className="flex shrink-0 items-center gap-2.5 rounded-md pr-1 text-left transition hover:opacity-80"
          title="На главную"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
            <Mountain size={18} />
          </span>
          <span className="hidden max-w-[180px] truncate text-sm font-semibold text-foreground sm:block">{providerName}</span>
        </button>

        {/* Wraps to its own row on narrow screens rather than scrolling, so nothing can clip the menu. */}
        <nav
          className="order-last flex w-full flex-wrap items-center justify-center gap-1 pb-1 lg:order-none lg:w-auto lg:flex-1 lg:pb-0"
          aria-label="Разделы"
        >
          {navItems.map(item => (
            <button
              key={item.path}
              type="button"
              onClick={() => onNavigate(item.path)}
              aria-current={isActive(item.path) ? 'page' : undefined}
              className={cn(
                'shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                isActive(item.path)
                  ? 'bg-sidebar-accent text-sidebar-primary'
                  : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
              )}
            >
              {item.label}
            </button>
          ))}

          <SettingsMenu active={settingsActive} currentPath={currentPath} onNavigate={onNavigate} />
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-0">
          {actions}
          <Button type="button" variant="secondary" size="icon" title="Помощь">
            <HelpCircle size={15} />
          </Button>
          <UserMenu
            name={user?.name ?? ''}
            role={user?.role ?? ''}
            onAccount={() => onNavigate('/settings/account')}
            onSignOut={signOut}
          />
        </div>
      </div>

      {(hasTitle || hasBreadcrumbs) && (
        <div className="mx-auto w-full max-w-screen-xl px-6 pb-3 pt-1.5">
          {hasBreadcrumbs ? (
            <nav className="flex min-w-0 items-center gap-1.5 text-base font-semibold" aria-label="Хлебные крошки">
              {breadcrumbs!.map((crumb, index) => {
                const last = index === breadcrumbs!.length - 1;
                return (
                  <span key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
                    {crumb.path && !last ? (
                      <button
                        type="button"
                        onClick={() => onNavigate(crumb.path!)}
                        className="shrink-0 text-muted-foreground transition hover:text-foreground"
                      >
                        {crumb.label}
                      </button>
                    ) : (
                      <span className={last ? 'truncate text-foreground' : 'shrink-0 text-muted-foreground'}>
                        {last ? title : crumb.label}
                      </span>
                    )}
                    {!last && <ChevronRight size={15} className="shrink-0 text-muted-foreground" />}
                  </span>
                );
              })}
            </nav>
          ) : (
            <h1 className="truncate text-base font-semibold text-foreground">{title}</h1>
          )}
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      )}
    </header>
  );
}

function SettingsMenu({
  active,
  currentPath,
  onNavigate,
}: {
  active: boolean;
  currentPath: string;
  onNavigate: (path: string) => void;
}) {
  const menu = useDropdown();

  return (
    <>
      <button
        ref={menu.triggerRef}
        type="button"
        onClick={menu.toggle}
        aria-expanded={menu.open}
        aria-haspopup="menu"
        className={cn(
          'flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
          active || menu.open
            ? 'bg-sidebar-accent text-sidebar-primary'
            : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
        )}
      >
        Настройки
        <ChevronDown size={13} className={cn('transition-transform', menu.open && 'rotate-180')} />
      </button>

      {menu.render(
        settingsMenuItems.map(item => (
          <button
            key={item.path}
            type="button"
            role="menuitem"
            onClick={() => {
              menu.close();
              onNavigate(item.path);
            }}
            className={cn(
              'flex h-9 w-full items-center px-3 text-left text-sm transition hover:bg-sidebar-accent',
              item.separated && 'mt-1 border-t',
              currentPath.startsWith(item.path) ? 'text-sidebar-primary' : 'text-foreground'
            )}
          >
            {item.label}
          </button>
        ))
      )}
    </>
  );
}

function UserMenu({
  name,
  role,
  onAccount,
  onSignOut,
}: {
  name: string;
  role: string;
  onAccount: () => void;
  onSignOut: () => void;
}) {
  const menu = useDropdown('right');

  return (
    <>
      <button
        ref={menu.triggerRef}
        type="button"
        onClick={menu.toggle}
        aria-expanded={menu.open}
        aria-haspopup="menu"
        title={name}
        className="flex h-9 w-9 items-center justify-center rounded-md border bg-background text-xs font-bold text-foreground transition hover:bg-sidebar-accent"
      >
        {name.charAt(0).toUpperCase() || '?'}
      </button>

      {menu.render(
        <>
          <div className="border-b px-3 pb-2 pt-1">
            <p className="truncate text-xs font-medium text-foreground">{name}</p>
            <p className="truncate text-[11px] capitalize text-muted-foreground">{role.replace(/_/g, ' ')}</p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              menu.close();
              onAccount();
            }}
            className="flex h-9 w-full items-center gap-2 px-3 text-left text-sm text-foreground transition hover:bg-sidebar-accent"
          >
            <UserRound size={14} />
            Аккаунт
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              menu.close();
              onSignOut();
            }}
            className="flex h-9 w-full items-center gap-2 px-3 text-left text-sm text-red-600 transition hover:bg-red-50"
          >
            <LogOut size={14} />
            Выйти
          </button>
        </>
      )}
    </>
  );
}

const MENU_WIDTH = 208;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/**
 * Header menus render into document.body: an absolutely positioned menu is at the mercy of every
 * ancestor's overflow, and the header sits inside a clipped, sticky shell.
 */
function useDropdown(align: 'left' | 'right' = 'left') {
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
      ? { left: clamp(rect.left, gutter, window.innerWidth - MENU_WIDTH - gutter) }
      : { right: clamp(window.innerWidth - rect.right, gutter, window.innerWidth - MENU_WIDTH - gutter) };

    return createPortal(
      <div
        ref={menuRef}
        role="menu"
        style={{ position: 'fixed', top: rect.bottom + 6, width: MENU_WIDTH, zIndex: 9999, ...placement }}
        className="overflow-hidden rounded-md border bg-background py-1 shadow-xl"
      >
        {children}
      </div>,
      document.body
    );
  };

  return { open, close, toggle, triggerRef, render };
}
