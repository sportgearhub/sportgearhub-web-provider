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
  bare,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  error?: string;
  breadcrumb?: { label: string; path: string };
  onNavigate?: (path: string) => void;
  /**
   * The screen has a bar of its own above it (see SubPageHeader), so on a phone this frame draws
   * neither the name nor the side padding: the name is already up there, and the sections below
   * want the full width the way every list in this console has it.
   */
  bare?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={bare ? 'py-3 sm:p-6' : 'px-4 py-4 sm:p-6'}>
      {breadcrumb && onNavigate && !bare && (
        <button
          type="button"
          onClick={() => onNavigate(breadcrumb.path)}
          className="mb-3 flex items-center gap-1.5 text-sm text-gray-500 transition hover:text-gray-900"
        >
          <ArrowLeft size={14} />
          {breadcrumb.label}
        </button>
      )}
      <div className={`flex-wrap items-start justify-between gap-3 ${bare ? 'hidden sm:flex' : 'flex'}`}>
        <div>
          <h1 className="text-xl font-semibold text-gray-950">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-sm text-gray-500">{description}</p>}
        </div>
        {action}
      </div>
      {error && (
        <p className={`mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 ${bare ? 'mx-3 sm:mx-0' : ''}`}>
          {error}
        </p>
      )}
      <div className={bare ? 'sm:mt-4' : 'mt-4'}>{children}</div>
    </div>
  );
}
