import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * A panel that comes down from the top of the window, full width, over a dimmed page.
 *
 * It is for work that needs room but is still one task — managing a product's photos, say. A
 * centred dialog would either crop the grid or float a tall box in the middle of the screen; this
 * keeps the page's own column width and lets the content be as wide as it needs.
 */
export function TopSheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  // Mounted first, shown a frame later, so the browser has a "from" position to animate out of.
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!open) {
      setShown(false);
      return;
    }
    const frame = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <div
        className={`absolute inset-0 bg-gray-950/40 transition-opacity duration-300 ${shown ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      <div
        className={`absolute inset-x-0 top-0 max-h-[92vh] overflow-y-auto rounded-b-2xl bg-background shadow-2xl transition-transform duration-300 ease-out ${
          shown ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <div className="mx-auto w-full max-w-screen-lg px-5 pb-6 pt-5 sm:px-8">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-950">{title}</h2>
              {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="-mr-1 shrink-0 rounded-md p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
              aria-label="Закрыть"
            >
              <X size={18} />
            </button>
          </div>

          {children}

          {footer && <div className="mt-6 flex justify-end gap-2 border-t border-gray-100 pt-4">{footer}</div>}
        </div>
      </div>
    </div>,
    document.body
  );
}
