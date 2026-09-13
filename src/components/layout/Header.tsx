import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, HelpCircle, LogOut, Mountain, Settings, UserRound } from 'lucide-react';
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
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex min-h-14 items-center gap-2 px-4 lg:px-6">
        <button
          type="button"
          onClick={() => onNavigate('/')}
          className="flex shrink-0 items-center gap-2.5 rounded-md pr-1 text-left transition hover:opacity-80"
          title="На главную"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
            <Mountain size={18} />
          </span>
          <span className="hidden max-w-[180px] truncate text-sm font-semibold text-foreground lg:block">{providerName}</span>
        </button>

        <span className="mx-1 hidden h-6 w-px shrink-0 bg-border sm:block" />

        <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto" aria-label="Разделы">
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

          <NavDropdown
            label="Настройки"
            icon={<Settings size={14} />}
            active={settingsActive}
            items={settingsMenuItems}
            currentPath={currentPath}
            onNavigate={onNavigate}
          />
        </nav>

        <div className="flex shrink-0 items-center gap-2">
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
        <div className="border-t bg-muted/30 px-4 py-2 lg:px-6">
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

function NavDropdown({
  label,
  icon,
  active,
  items,
  currentPath,
  onNavigate,
}: {
  label: string;
  icon?: React.ReactNode;
  active: boolean;
  items: MenuItem[];
  currentPath: string;
  onNavigate: (path: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useCloseOnOutside<HTMLDivElement>(open, () => setOpen(false));

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
          active || open
            ? 'bg-sidebar-accent text-sidebar-primary'
            : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
        )}
      >
        {icon}
        {label}
        <ChevronDown size={13} className={cn('transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div role="menu" className="absolute left-0 top-full z-40 mt-1 w-52 overflow-hidden rounded-md border bg-background py-1 shadow-lg">
          {items.map(item => (
            <button
              key={item.path}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
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
          ))}
        </div>
      )}
    </div>
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
  const [open, setOpen] = useState(false);
  const ref = useCloseOnOutside<HTMLDivElement>(open, () => setOpen(false));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        title={name}
        className="flex h-9 w-9 items-center justify-center rounded-md border bg-background text-xs font-bold text-foreground transition hover:bg-sidebar-accent"
      >
        {name.charAt(0).toUpperCase() || '?'}
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-full z-40 mt-1 w-52 overflow-hidden rounded-md border bg-background py-1 shadow-lg">
          <div className="border-b px-3 pb-2 pt-1">
            <p className="truncate text-xs font-medium text-foreground">{name}</p>
            <p className="truncate text-[11px] capitalize text-muted-foreground">{role.replace(/_/g, ' ')}</p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
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
              setOpen(false);
              onSignOut();
            }}
            className="flex h-9 w-full items-center gap-2 px-3 text-left text-sm text-red-600 transition hover:bg-red-50"
          >
            <LogOut size={14} />
            Выйти
          </button>
        </div>
      )}
    </div>
  );
}

/** Closes a menu on an outside click or Escape, while it is open. */
function useCloseOnOutside<T extends HTMLElement>(open: boolean, onClose: () => void) {
  const ref = useRef<T>(null);
  // Held in a ref so a fresh closure from the caller does not resubscribe the listeners every render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!ref.current?.contains(event.target as Node)) onCloseRef.current();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return ref;
}
