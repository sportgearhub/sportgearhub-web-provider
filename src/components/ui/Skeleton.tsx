import { cn } from '../../lib/utils';

/**
 * A shape where something is still loading.
 *
 * The alternative is rendering the empty value — a dashboard of zeros, a table of dashes — which
 * is not neutral: it is a specific, wrong answer, and it is indistinguishable from a seller who
 * genuinely has nothing. A grey bar says «ещё не знаю», which is the truth at that moment.
 */
export function Skeleton({ className }: { className?: string }) {
  return <span className={cn('block animate-pulse rounded-lg bg-gray-100', className)} aria-hidden="true" />;
}

/**
 * A block of skeletons standing in for a list, with the row shape its content will have, so the
 * page does not jump when the answer arrives.
 */
export function SkeletonRows({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('divide-y divide-gray-100', className)} role="status" aria-busy="true">
      <span className="sr-only">Загружаем…</span>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-6 w-20 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Label-and-value rows, for a read view waiting on what it is about to show. */
export function SkeletonDetail({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-3', className)} role="status" aria-busy="true">
      <span className="sr-only">Загружаем…</span>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="grid grid-cols-1 gap-1 py-1 sm:grid-cols-[minmax(160px,220px)_1fr] sm:gap-6">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3.5 w-40" />
        </div>
      ))}
    </div>
  );
}
