import { useState, type ReactNode } from 'react';
import { ArrowLeft, HelpCircle } from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';

/**
 * The bar every screen opened from a list wears.
 *
 * One element for all of them, because they are all the same promise: a way back where a thumb
 * expects it, the name of where you are, and whatever this particular screen can do in the far
 * corner. White across the top with no gap at the edges and its underside round, which is the
 * shape the console's own header has — a sub-page should look like the same app one level in, not
 * like a dialog that drifted up the screen.
 *
 * Phones only. Above `lg` the console's header is on screen with the sections in it, and the page
 * draws its own heading and breadcrumb in the content column.
 *
 * Two ways to get one. Screens whose bar is just back-and-a-name are listed in the console's
 * route table and it draws this for them. A screen with something of its own to put in the corner
 * — a menu for the card being looked at, a count and «выбрать все» — marks itself `bare` in that
 * table and renders this itself, passing `action`.
 */
export function SubPageHeader({
  title,
  description,
  onBack,
  action,
  help,
}: {
  title: string;
  /**
   * A line under the name. With one, the pair sits beside the arrow rather than in the middle of
   * the bar: two centred lines under a back button read as a paragraph that lost its page.
   */
  description?: string;
  onBack: () => void;
  /** Buttons for the far corner. */
  action?: ReactNode;
  /**
   * A sentence explaining the screen, behind a question mark in the corner. For the screens that
   * need one — what a group of cards is, say — where nobody wants it on screen twice.
   */
  help?: string;
}) {
  return (
    // `before:` paints white off the top of the screen, for the overscroll: a phone lets you
    // pull a page past its beginning, and grey showing above a white bar reads as a loose bar.
    <header className="sticky top-0 z-30 rounded-b-2xl bg-white shadow-sm before:pointer-events-none before:absolute before:inset-x-0 before:bottom-full before:h-screen before:bg-white lg:hidden">
      <div className="relative flex min-h-14 items-center gap-2 px-4 py-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Назад"
          className="-ml-2 shrink-0 rounded-lg p-2 text-gray-600 transition active:bg-gray-100"
        >
          <ArrowLeft size={20} />
        </button>

        {description ? (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-base font-semibold leading-5 text-gray-950">{title}</span>
            <span className="mt-0.5 block truncate text-xs text-gray-500">{description}</span>
          </span>
        ) : (
          // Laid over the bar rather than placed in it, so it is centred on the screen and not on
          // whatever is left of it beside the arrow.
          <span className="pointer-events-none absolute left-1/2 max-w-[58%] -translate-x-1/2 truncate text-center text-base font-semibold text-gray-950">
            {title}
          </span>
        )}

        <span className={`-mr-2 flex shrink-0 items-center ${description ? '' : 'ml-auto'}`}>
          {action}
          {help && <Help title={title} text={help} />}
        </span>
      </div>
    </header>
  );
}

function Help({ title, text }: { title: string; text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Справка"
        className="shrink-0 rounded-lg p-2 text-gray-500 transition active:bg-gray-100"
      >
        <HelpCircle size={20} />
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title={title} center>
        <p className="px-5 pb-4 pt-1 text-sm leading-6 text-gray-700">{text}</p>
      </BottomSheet>
    </>
  );
}
