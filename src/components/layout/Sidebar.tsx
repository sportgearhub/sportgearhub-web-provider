import {
  Building2,
  LayoutDashboard,
  Package,
  Tag,
  ClipboardList,
  CheckSquare,
  CreditCard,
  Settings,
  ChevronDown,
  LogOut,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  UserRound,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../context/useAuth';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { cn } from '../../lib/utils';

interface NavItem {
  label: string;
  icon: LucideIcon;
  path: string;
  badge?: string;
  children?: { label: string; path: string }[];
}

const navItems: NavItem[] = [
  { label: 'Дашборд', icon: LayoutDashboard, path: '/' },
  { label: 'Выдача', icon: CheckSquare, path: '/fulfillment', badge: '8' },
  { label: 'Каталог', icon: Package, path: '/resources' },
  { label: 'Предложения', icon: Tag, path: '/offers' },
  { label: 'Магазин', icon: Building2, path: '/settings/shop' },
  { label: 'Выплаты', icon: CreditCard, path: '/payouts' },
  {
    label: 'Настройки',
    icon: Settings,
    path: '/settings/account',
    children: [
      { label: 'Аккаунт', path: '/settings/account' },
      { label: 'Сотрудники', path: '/settings/employees' },
      { label: 'Локации', path: '/settings/locations' },
    ],
  },
  { label: 'Отчеты', icon: ClipboardList, path: '/reports' },
];

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({ currentPath, onNavigate, collapsed, onToggleCollapse }: SidebarProps) {
  const { user, signOut } = useAuth();
  const [expanded, setExpanded] = useState<string[]>(['Настройки']);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const toggleExpand = (label: string) => {
    setExpanded(prev =>
      prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
    );
  };

  const isActive = (path: string) => {
    if (path === '/') return currentPath === '/';
    return currentPath.startsWith(path);
  };

  return (
    <aside
      className={cn(
        'flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-r bg-sidebar text-sidebar-foreground transition-[width] duration-200',
        collapsed ? 'w-[76px]' : 'w-64'
      )}
    >
      <Button
        onClick={onToggleCollapse}
        variant="ghost"
        size="icon"
        className="m-3 self-center text-muted-foreground"
        title={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
      >
        {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
      </Button>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {navItems.map(item => {
          const Icon = item.icon;
          if (item.children) {
            const open = expanded.includes(item.label);
            const childActive = item.children.some(c => isActive(c.path));
            return (
              <div key={item.label} className="mb-2">
                <div
                  className={cn(
                    'flex h-9 w-full items-center rounded-md px-3 text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                    collapsed ? 'justify-center' : 'gap-3',
                    childActive && 'bg-sidebar-accent text-sidebar-accent-foreground'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onNavigate(item.path);
                      setExpanded(prev => prev.includes(item.label) ? prev : [...prev, item.label]);
                    }}
                    className={cn('flex min-w-0 flex-1 items-center text-left', collapsed ? 'justify-center' : 'gap-3')}
                    title={item.label}
                  >
                    <Icon size={16} className={cn('shrink-0', childActive ? 'text-sidebar-primary' : 'text-muted-foreground')} />
                    {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                  </button>
                  {!collapsed && (
                    <button
                      type="button"
                      onClick={() => toggleExpand(item.label)}
                      className="rounded p-0.5 hover:bg-sidebar-accent"
                      title={open ? 'Свернуть раздел' : 'Развернуть раздел'}
                    >
                      {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                  )}
                </div>
                {open && !collapsed && (
                  <div className="mt-1 space-y-1 border-l pl-3 ml-4">
                    {item.children.map(child => (
                      <button
                        key={child.path}
                        onClick={() => onNavigate(child.path)}
                        className={cn(
                          'h-8 w-full rounded-md px-3 text-left text-xs transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                          isActive(child.path) ? 'bg-sidebar-accent text-sidebar-primary' : 'text-muted-foreground'
                        )}
                      >
                        {child.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <button
              key={item.path}
              onClick={() => onNavigate(item.path)}
              className={cn(
                'mb-1 flex h-9 w-full items-center rounded-md px-3 text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                collapsed ? 'justify-center' : 'gap-3',
                isActive(item.path) && 'bg-sidebar-accent text-sidebar-accent-foreground'
              )}
              title={item.label}
            >
              <Icon size={16} className={cn('shrink-0', isActive(item.path) ? 'text-sidebar-primary' : 'text-muted-foreground')} />
              {!collapsed && <span className="flex-1 text-left">{item.label}</span>}
              {!collapsed && item.badge && (
                <Badge variant="blue">{item.badge}</Badge>
              )}
            </button>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="relative mt-2 border-t px-3 py-3">
          {userMenuOpen && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-40 cursor-default"
                aria-label="Закрыть меню пользователя"
                onClick={() => setUserMenuOpen(false)}
              />
              <div className="absolute bottom-[58px] right-3 z-50 w-52 overflow-hidden rounded-md border bg-background py-1 shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(false);
                    onNavigate('/settings/account');
                  }}
                  className="flex h-9 w-full items-center gap-2 px-3 text-left text-sm text-foreground transition hover:bg-sidebar-accent"
                >
                  <UserRound size={14} />
                  <span>Аккаунт</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(false);
                    signOut();
                  }}
                  className="flex h-9 w-full items-center gap-2 px-3 text-left text-sm text-red-600 transition hover:bg-red-50"
                >
                  <LogOut size={14} />
                  <span>Выйти</span>
                </button>
              </div>
            </>
          )}

          <div className="relative z-50 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md border bg-background">
              <span className="text-xs font-bold text-foreground">
                {user?.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground">{user?.name}</p>
              <p className="truncate text-[11px] capitalize text-muted-foreground">{user?.role.replace(/_/g, ' ')}</p>
            </div>
            <button
              type="button"
              onClick={() => setUserMenuOpen(open => !open)}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              title="Действия пользователя"
              aria-label="Действия пользователя"
              aria-expanded={userMenuOpen}
            >
              <MoreHorizontal size={16} />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
