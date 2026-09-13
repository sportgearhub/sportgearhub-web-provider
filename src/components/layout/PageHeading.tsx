import { ChevronRight } from 'lucide-react';

export type PageBreadcrumb = {
  label: string;
  path?: string;
};

/**
 * The page's own name, in the content column rather than the header: the header stays one compact
 * bar, and the title scrolls away with the page it belongs to. Callers pass the trail with the
 * current page as its last crumb, which is rendered as the heading instead of a repeated link.
 */
export function PageHeading({
  title,
  subtitle,
  breadcrumbs,
  onNavigate,
}: {
  title?: string;
  subtitle?: string;
  breadcrumbs?: PageBreadcrumb[];
  onNavigate: (path: string) => void;
}) {
  const trail = (breadcrumbs ?? []).slice(0, -1);
  if (!title && trail.length === 0) return null;

  return (
    <div className="shrink-0 px-6 pb-4 pt-5">
      {trail.length > 0 && (
        <nav className="mb-1.5 flex flex-wrap items-center gap-1 text-xs text-muted-foreground" aria-label="Хлебные крошки">
          {trail.map((crumb, index) => (
            <span key={`${crumb.label}-${index}`} className="flex items-center gap-1">
              {index > 0 && <ChevronRight size={13} className="text-muted-foreground/70" />}
              {crumb.path ? (
                <button
                  type="button"
                  onClick={() => onNavigate(crumb.path!)}
                  className="transition hover:text-foreground hover:underline"
                >
                  {crumb.label}
                </button>
              ) : (
                <span>{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      {title && <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>}
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
