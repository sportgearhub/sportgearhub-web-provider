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
    <div className="flex min-h-screen items-start justify-center bg-[#f3f6fb] px-4 py-10">
      <div className={contentClassName}>{children}</div>
    </div>
  );
}
