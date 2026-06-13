import { HelpCircle, ChevronRight, Mountain } from 'lucide-react';
import { Button } from '../ui/Button';
import { useAuth } from '../../context/useAuth';

export type HeaderBreadcrumb = {
  label: string;
  path?: string;
};

interface HeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: HeaderBreadcrumb[];
  onNavigate?: (path: string) => void;
  actions?: React.ReactNode;
}

export function Header({ title, subtitle, breadcrumbs, onNavigate, actions }: HeaderProps) {
  const { activeMembership } = useAuth();
  const providerName = activeMembership?.displayName ?? 'Кабинет партнёра';
  const hasBreadcrumbs = Boolean(breadcrumbs?.length);
  const hasTitle = Boolean(title);

  return (
    <header className="sticky top-0 z-20 border-b bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:px-6">
      <div className="flex min-h-12 items-center gap-3">
        <button
          type="button"
          onClick={() => onNavigate?.('/')}
          className="flex shrink-0 items-center gap-2.5 rounded-md pr-1 text-left transition hover:opacity-80"
          title="На главную"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
            <Mountain size={18} />
          </span>
          <span className="hidden max-w-[180px] truncate text-sm font-semibold text-foreground sm:block">{providerName}</span>
        </button>
        <span className="h-6 w-px shrink-0 bg-border" />

        <div className="min-w-0 flex-1">
          {hasBreadcrumbs ? (
            <nav className="flex min-w-0 items-center gap-1.5 text-base font-semibold" aria-label="Навигация">
              {breadcrumbs!.map((crumb, index) => {
                const last = index === breadcrumbs!.length - 1;
                return (
                  <span key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
                    {crumb.path && !last ? (
                      <button
                        type="button"
                        onClick={() => onNavigate?.(crumb.path!)}
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
          ) : hasTitle ? (
            <h1 className="text-base font-semibold text-foreground">{title}</h1>
          ) : null}
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-2">
          {actions && <div className="mr-2 flex items-center gap-2">{actions}</div>}
          <Button type="button" variant="secondary" size="icon" title="Помощь">
            <HelpCircle size={15} />
          </Button>
        </div>
      </div>
    </header>
  );
}
