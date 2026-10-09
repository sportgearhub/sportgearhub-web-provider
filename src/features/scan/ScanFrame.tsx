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
  className,
  children,
}: {
  videoRef: RefObject<HTMLVideoElement>;
  scanning: boolean;
  busy?: boolean;
  busyLabel?: string;
  className?: string;
  /** What to show over the lens while it is not reading: why not, and what to do about it. */
  children?: ReactNode;
}) {
  return (
    <div className={cn('relative aspect-square overflow-hidden rounded-3xl bg-gray-950 shadow-lg', className)}>
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
        <div className="pointer-events-none absolute inset-6">
          <Corner className="left-0 top-0 rounded-tl-xl border-l-4 border-t-4" />
          <Corner className="right-0 top-0 rounded-tr-xl border-r-4 border-t-4" />
          <Corner className="bottom-0 left-0 rounded-bl-xl border-b-4 border-l-4" />
          <Corner className="bottom-0 right-0 rounded-br-xl border-b-4 border-r-4" />
        </div>
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
    </div>
  );
}

function Corner({ className }: { className: string }) {
  return <span className={cn('absolute h-8 w-8 border-white', className)} />;
}
