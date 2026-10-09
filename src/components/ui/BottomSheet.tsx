import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * A panel that rises from the bottom of the screen.
 *
 * Where a phone puts a choice: at the end of the screen the thumb already rests on, over the page
 * rather than instead of it, so the thing being filtered stays visible behind. The desktop gets
 * the same panel centred, because a sheet climbing the side of a monitor is just a dialog that
 * has lost its way.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  description,
  center,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  /** Put the name in the middle, with the close button laid over the right-hand end. */
  center?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!open) { setShown(false); return; }
    const frame = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div
        className={`absolute inset-0 bg-gray-950/40 transition-opacity duration-200 ${shown ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      <div
        className={`relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-xl transition-transform duration-200 ease-out sm:rounded-2xl ${
          shown ? 'translate-y-0' : 'translate-y-full sm:translate-y-0'
        }`}
      >
        <div className={`relative flex items-start gap-3 px-5 pb-3 pt-5 ${center ? 'justify-center' : 'justify-between'}`}>
          <div className={center ? 'min-w-0 px-6 text-center' : 'min-w-0'}>
            <h2 className="text-base font-semibold text-gray-950">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-gray-500">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className={`shrink-0 rounded-lg p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 ${
              center ? 'absolute right-4 top-4' : '-mr-1'
            }`}
          >
            <X size={18} />
          </button>
        </div>

        {/* No padding of its own: a list inside wants its separators to reach both edges. */}
        <div className="min-h-0 flex-1 overflow-y-auto pb-2">{children}</div>

        {footer && (
          <div className="border-t border-gray-100 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>
        )}
      </div>
    </div>,
    document.body
  );
}
