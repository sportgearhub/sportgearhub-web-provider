import type { ReactNode } from 'react';

/** A single centred column on a quiet ground: the picker and the creation flow live here, outside the console shell. */
export function FocusFrame({
  children,
  contentClassName = 'mx-auto w-full max-w-xl space-y-5',
}: {
  children: ReactNode;
  contentClassName?: string;
}) {
  return (
    // On a phone this is the whole screen, so it is plain white with no gutter and nothing to
    // float on — a card inset from the edges of a 390px display is a frame around a frame. The
    // quiet ground and the centred column start at `sm`, where there is room to float in.
    <div className="flex min-h-[100dvh] items-start justify-center bg-white px-0 py-6 sm:bg-[#f3f6fb] sm:px-4 sm:py-10">
      <div className={contentClassName}>{children}</div>
    </div>
  );
}
