import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * A value you take with you — a phone number, an address, a reference.
 *
 * One press copies it. Not a `tel:` link, which on a desktop hands the number to whatever claimed
 * the protocol rather than to the person; and not a menu either, because a menu asking «скопировать
 * это?» after you clicked the thing you wanted to copy is a question with one answer.
 *
 * The icon turns into a tick and says so, because a copy that gives no sign is indistinguishable
 * from a click that missed.
 */
export function CopyValue({
  value,
  icon,
  children,
  className,
  /** Announced to screen readers and shown on hover, e.g. «Телефон клиента». */
  label,
}: {
  value: string;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setFailed(false);
    } catch {
      // Refused on an insecure origin or by a locked-down browser. Selecting by hand still works,
      // so the value stays on screen and the control says it could not do it rather than lying.
      setFailed(true);
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { setCopied(false); setFailed(false); }, 2000);
  };

  return (
    <button
      type="button"
      onClick={event => { event.stopPropagation(); void copy(); }}
      title={failed ? 'Не удалось скопировать' : copied ? 'Скопировано' : label ? `Скопировать: ${label}` : 'Скопировать'}
      aria-label={label ? `Скопировать ${label}: ${value}` : `Скопировать ${value}`}
      className={cn(
        'group -mx-1 inline-flex max-w-full items-center gap-1.5 rounded-lg px-1 py-0.5 text-left font-medium transition',
        copied ? 'text-emerald-700' : failed ? 'text-red-600' : 'text-blue-700 hover:bg-blue-50 hover:text-blue-800',
        className
      )}
    >
      {icon}
      <span className="min-w-0 break-all">{children ?? value}</span>
      {copied
        ? <Check size={14} className="shrink-0" />
        : <Copy size={14} className="shrink-0 opacity-50 transition group-hover:opacity-100" />}
    </button>
  );
}
