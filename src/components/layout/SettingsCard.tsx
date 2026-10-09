import type { ReactNode } from 'react';

/**
 * One subject per card: a heading that names it, a line saying what it is for, and its action in
 * the same header. An action that sits in the header of the thing it changes cannot be ambiguous —
 * «Редактировать» under «Реквизиты выплат» needs no further explanation, a loose link does.
 */
export function SettingsCard({
  title,
  description,
  action,
  footer,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  // On a phone a white panel on grey needs no border — the fill is the edge, and a band across
  // the screen with round corners is the shape the rest of the console uses. The desktop keeps its
  // outline, where sections sit on white.
  return (
    <section className="overflow-hidden rounded-2xl bg-white sm:rounded-xl sm:border sm:border-gray-200">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-4 py-3.5 sm:px-5 sm:py-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-950">{title}</h2>
          {description && <p className="mt-0.5 max-w-xl text-xs leading-5 text-gray-500">{description}</p>}
        </div>
        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </header>
      <div className="px-4 py-4 sm:px-5">{children}</div>
      {footer && <div className="border-t border-gray-100 bg-gray-50/60 px-4 py-3 sm:px-5">{footer}</div>}
    </section>
  );
}
