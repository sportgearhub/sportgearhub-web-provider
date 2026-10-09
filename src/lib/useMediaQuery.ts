import { useEffect, useState } from 'react';

/**
 * Whether a CSS media query matches, as state.
 *
 * Layout belongs in Tailwind's breakpoints, not here: this is for the places where the two sizes
 * behave differently rather than look different — a phone that loads the next page as you reach
 * the end of the list, where a desktop pages through it. Initialised from the query rather than
 * from a guess, so the first render is already right.
 */
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false
  );

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const list = window.matchMedia(query);
    setMatches(list.matches);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** Below Tailwind's `md`, which is where this console stops being a table and becomes a list. */
export const PHONE = '(max-width: 767px)';
