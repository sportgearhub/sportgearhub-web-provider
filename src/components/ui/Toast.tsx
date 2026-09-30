import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { cn } from '../../lib/utils';

type ToastKind = 'error' | 'success';
type ToastState = { id: number; kind: ToastKind; message: ReactNode };

const DISMISS_AFTER = 6000;

/**
 * A message that does not move the page.
 *
 * An error rendered in the flow pushes everything below it down, which on a sign-in screen means
 * the field you are typing into jumps the moment you get something wrong — and jumps back when you
 * fix it. This floats over the page instead, so the form stays exactly where the hands left it.
 */
export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const seq = useRef(0);

  const show = useCallback((message: ReactNode, kind: ToastKind = 'error') => {
    if (!message) return;
    seq.current += 1;
    setToast({ id: seq.current, kind, message });
  }, []);

  const dismiss = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (!toast) return;
    // Keyed on the id, so a second error restarts the clock rather than inheriting the first's.
    const timer = window.setTimeout(() => setToast(null), DISMISS_AFTER);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const node = toast ? <Toast key={toast.id} kind={toast.kind} message={toast.message} onDismiss={dismiss} /> : null;

  return { show, dismiss, node };
}

function Toast({
  kind,
  message,
  onDismiss,
}: {
  kind: ToastKind;
  message: ReactNode;
  onDismiss: () => void;
}) {
  const [shown, setShown] = useState(false);
  const isError = kind === 'error';
  const Icon = isError ? AlertCircle : CheckCircle2;

  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex justify-center px-4">
      <div
        role={isError ? 'alert' : 'status'}
        aria-live={isError ? 'assertive' : 'polite'}
        className={cn(
          'pointer-events-auto flex w-full max-w-md items-start gap-2.5 rounded-xl border px-4 py-3 shadow-lg transition-all duration-200',
          shown ? 'translate-y-0 opacity-100' : '-translate-y-3 opacity-0',
          isError ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'
        )}
      >
        <Icon size={17} className={cn('mt-px shrink-0', isError ? 'text-red-600' : 'text-emerald-600')} />
        <p className="min-w-0 flex-1 text-sm leading-5">{message}</p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Закрыть"
          className={cn(
            '-mr-1 shrink-0 rounded-md p-0.5 transition',
            isError ? 'text-red-400 hover:bg-red-100 hover:text-red-700' : 'text-emerald-500 hover:bg-emerald-100 hover:text-emerald-700'
          )}
        >
          <X size={15} />
        </button>
      </div>
    </div>,
    document.body
  );
}
