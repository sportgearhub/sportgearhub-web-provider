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
  onBack,
  action,
}: {
  title: string;
  onBack: () => void;
  action?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 mx-3 mt-3 rounded-2xl bg-white shadow-sm lg:hidden">
      <div className="relative flex min-h-14 items-center gap-2 px-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Назад"
          className="shrink-0 rounded-lg p-2 text-gray-600 transition active:bg-gray-100"
        >
          <ArrowLeft size={20} />
        </button>
        <span className="pointer-events-none absolute left-1/2 max-w-[60%] -translate-x-1/2 truncate text-center text-base font-semibold text-gray-950">
          {title}
        </span>
        <span className="ml-auto shrink-0">{action}</span>
      </div>
    </header>
  );
}
