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
  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-950">{title}</h2>
          {description && <p className="mt-0.5 max-w-xl text-xs leading-5 text-gray-500">{description}</p>}
        </div>
        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </header>
      <div className="px-5 py-4">{children}</div>
      {footer && <div className="border-t border-gray-100 bg-gray-50/60 px-5 py-3">{footer}</div>}
    </section>
  );
}
