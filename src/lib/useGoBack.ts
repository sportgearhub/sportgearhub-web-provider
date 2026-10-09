import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Back, meaning where you came from.
 *
 * A screen opened from a list has one obvious parent, and for a long time that is what the arrow
 * went to — a path written in the route table. But a card can be opened from the catalogue, from a
 * booking, from a group's page or from the scanner, and an arrow that always returns to «Каталог»
 * takes an operator mid-handover somewhere they never were.
 *
 * So it steps back through history when there is a step to take. React Router keeps an `idx` on
 * the history entry; at zero this tab has nowhere to go — the screen was opened by its URL, or the
 * page was reloaded on it — and the declared parent is the right answer rather than a dead arrow.
 */
export function useGoBack(fallback: string) {
  const navigate = useNavigate();
  return useCallback(() => {
    const index = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (index > 0) navigate(-1);
    else navigate(fallback);
  }, [navigate, fallback]);
}
