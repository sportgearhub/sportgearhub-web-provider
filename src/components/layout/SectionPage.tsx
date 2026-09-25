import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';

/**
 * The frame a full-page section shares: optional way back, name, one line of explanation, one
 * primary action, and errors in the same place each time.
 */
export function SectionPage({
  title,
  description,
  action,
  error,
  breadcrumb,
  onNavigate,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  error?: string;
  breadcrumb?: { label: string; path: string };
  onNavigate?: (path: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="p-6">
      {breadcrumb && onNavigate && (
        <button
          type="button"
          onClick={() => onNavigate(breadcrumb.path)}
          className="mb-3 flex items-center gap-1.5 text-sm text-gray-500 transition hover:text-gray-900"
        >
          <ArrowLeft size={14} />
          {breadcrumb.label}
        </button>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-950">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-sm text-gray-500">{description}</p>}
        </div>
        {action}
      </div>
      {error && <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="mt-6">{children}</div>
    </div>
  );
}
