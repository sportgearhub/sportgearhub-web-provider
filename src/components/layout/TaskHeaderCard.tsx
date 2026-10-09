import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';

/**
 * A page's own bar, for the screens that bring their own actions.
 *
 * The console draws one of these from its route table, but it can only draw what every task
 * shares: a way back and a name. A screen with something of its own in the corner — a menu for
 * the thing being looked at — draws its own instead, and the console stands down for that route.
 * Same card as the console's: white, floating on the ground with both sides round.
 *
 * Phones only. Above `lg` the console's header is on screen with the sections in it.
 */
export function TaskHeaderCard({
  title,
  description,
  onBack,
  action,
}: {
  title: string;
  /**
   * A line under the name. With one the pair sits beside the arrow rather than in the middle of
   * the bar: two lines centred under a back button read as a paragraph that lost its page.
   */
  description?: string;
  onBack: () => void;
  action?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 mx-3 mt-3 rounded-2xl bg-white shadow-sm lg:hidden">
      <div className="relative flex min-h-14 items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Назад"
          className="shrink-0 rounded-lg p-2 text-gray-600 transition active:bg-gray-100"
        >
          <ArrowLeft size={20} />
        </button>
        {description ? (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-base font-semibold leading-5 text-gray-950">{title}</span>
            <span className="mt-0.5 block truncate text-xs text-gray-500">{description}</span>
          </span>
        ) : (
          <span className="pointer-events-none absolute left-1/2 max-w-[60%] -translate-x-1/2 truncate text-center text-base font-semibold text-gray-950">
            {title}
          </span>
        )}
        <span className={description ? 'shrink-0' : 'ml-auto shrink-0'}>{action}</span>
      </div>
    </header>
  );
}
