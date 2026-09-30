import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

/**
 * A panel pinned under something — a column header, a settings button.
 *
 * It renders into the body rather than next to its anchor: a table scrolls horizontally, and a
 * menu that is a child of a `<th>` gets clipped by that scroll box the moment it is wider than
 * the column it belongs to.
 */
export function AnchoredPopover({
  anchorRef,
  open,
  onClose,
  align = 'start',
  width,
  children,
}: {
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  align?: 'start' | 'end';
  /** Minimum width in px; the panel still grows with its content. */
  width?: number;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) return;

    const place = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const panelWidth = panelRef.current?.offsetWidth ?? width ?? 220;
      const left = align === 'end' ? rect.right - panelWidth : rect.left;
      setPosition({
        top: rect.bottom + 4,
        // Never let it hang off either edge of the window.
        left: Math.max(8, Math.min(left, window.innerWidth - panelWidth - 8)),
      });
    };

    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, align, width, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose();
    };
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  return createPortal(
    <div
      ref={panelRef}
      style={{
        top: position?.top ?? -9999,
        left: position?.left ?? -9999,
        minWidth: width,
        visibility: position ? 'visible' : 'hidden',
      }}
      className="fixed z-50 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-xl"
    >
      {children}
    </div>,
    document.body
  );
}
