import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';
import { AnchoredPopover } from './AnchoredPopover';
import { cn } from '../../lib/utils';

/**
 * A value worth taking with you — a phone number, an address, a reference.
 *
 * Not a `tel:` link. On the desktop where a seller actually works, following one hands the number
 * to whatever application claimed the protocol, or to nothing at all; what the person wanted was
 * the number, to paste into the thing they already use. This shows it in full and copies it in one
 * press, and says so afterwards, because a copy that gives no sign is indistinguishable from a
 * click that missed.
 */
export function CopyValue({
  value,
  label,
  icon,
  children,
  className,
}: {
  value: string;
  /** What the value is, shown above it in the flyout. */
  label?: string;
  icon?: ReactNode;
  /** The trigger's text; defaults to the value itself. */
  children?: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Clipboard access can be refused outright (an insecure origin, a locked-down browser).
      // Selecting the text by hand still works, so the flyout stays open rather than claiming
      // something happened.
      setCopied(false);
    }
  };

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={event => { event.stopPropagation(); setOpen(current => !current); }}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          'inline-flex items-center gap-1 rounded-lg px-1 -mx-1 font-medium text-blue-700 transition hover:bg-blue-50 hover:text-blue-800',
          className
        )}
      >
        {icon}
        {children ?? value}
      </button>

      <AnchoredPopover anchorRef={anchorRef} open={open} onClose={() => setOpen(false)} width={220}>
        <div className="px-3 py-2.5" onClick={event => event.stopPropagation()}>
          {label && <p className="text-[11px] uppercase tracking-wide text-gray-500">{label}</p>}
          <p className="mt-0.5 select-all break-all text-sm font-medium text-gray-950">{value}</p>
          <button
            type="button"
            onClick={() => void copy()}
            className={cn(
              'mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition',
              copied ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
            )}
          >
            {copied ? <><Check size={14} /> Скопировано</> : <><Copy size={14} /> Скопировать</>}
          </button>
        </div>
      </AnchoredPopover>
    </>
  );
}
