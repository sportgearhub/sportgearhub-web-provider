import type { ReactNode, RefObject } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * The square you hold a phone up to.
 *
 * Shared by the counter's scanner and by scanning a label from inside the catalogue, so that the
 * thing an operator learns to point is the same shape in both places. The brackets mark where the
 * code has to be, with nothing dimmed, because everything inside the square is being read.
 */
export function ScanFrame({
  videoRef,
  scanning,
  busy,
  busyLabel,
  fill,
  className,
  children,
  overlay,
}: {
  videoRef: RefObject<HTMLVideoElement>;
  scanning: boolean;
  busy?: boolean;
  busyLabel?: string;
  /**
   * Take the whole screen rather than being a square on it. For the page that is only this: the
   * lens fills everything under the bar, and the square to aim with is marked inside it with the
   * surround dimmed, which is also the honest picture — the detector reads the middle.
   */
  fill?: boolean;
  className?: string;
  /** What to show over the lens while it is not reading: why not, and what to do about it. */
  children?: ReactNode;
  /** What to show over it whatever it is doing — a hint, an error, the one button. */
  overlay?: ReactNode;
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden bg-gray-950',
        fill ? 'min-h-0 flex-1' : 'aspect-square rounded-3xl shadow-lg',
        className
      )}
    >
      <video
        ref={videoRef}
        playsInline
        muted
        className={cn(
          'absolute inset-0 h-full w-full object-cover transition-opacity',
          scanning ? 'opacity-100' : 'opacity-0'
        )}
      />

      {scanning && (
        fill ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative h-64 w-64 max-w-[74vw] rounded-3xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
              <Corner className="left-0 top-0 rounded-tl-2xl border-l-4 border-t-4" />
              <Corner className="right-0 top-0 rounded-tr-2xl border-r-4 border-t-4" />
              <Corner className="bottom-0 left-0 rounded-bl-2xl border-b-4 border-l-4" />
              <Corner className="bottom-0 right-0 rounded-br-2xl border-b-4 border-r-4" />
            </div>
          </div>
        ) : (
          <div className="pointer-events-none absolute inset-6">
            <Corner className="left-0 top-0 rounded-tl-xl border-l-4 border-t-4" />
            <Corner className="right-0 top-0 rounded-tr-xl border-r-4 border-t-4" />
            <Corner className="bottom-0 left-0 rounded-bl-xl border-b-4 border-l-4" />
            <Corner className="bottom-0 right-0 rounded-br-xl border-b-4 border-r-4" />
          </div>
        )
      )}

      {!scanning && !busy && (
        <div className="absolute inset-0 flex items-center justify-center">{children}</div>
      )}

      {busy && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-950/80">
          <Loader2 size={26} className="animate-spin text-white" />
          {busyLabel && <p className="text-sm text-white">{busyLabel}</p>}
        </div>
      )}

      {overlay}
    </div>
  );
}

function Corner({ className }: { className: string }) {
  return <span className={cn('absolute h-8 w-8 border-white', className)} />;
}
