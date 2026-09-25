import type { ReactNode } from 'react';

/**
 * A read-only record: label on the left, value on the right. Profile pages show what is on file
 * this way and keep editing on their own page, so the common case — looking something up — is not
 * a form full of inputs you can change by accident.
 */
export function DetailList({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <dl className={`max-w-3xl ${className}`}>{children}</dl>;
}

export function DetailRow({
  label,
  value,
  children,
  hint,
}: {
  label: string;
  value?: string | null;
  children?: ReactNode;
  hint?: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-1 border-b border-gray-100 py-3 text-sm last:border-b-0 md:grid-cols-[220px_1fr] md:gap-6">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-gray-900">
        {children ?? (value ? value : <span className="text-gray-400">Не указано</span>)}
        {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
      </dd>
    </div>
  );
}
