import { ImageOff, MoreHorizontal } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { mediaUrl } from '../../lib/api-client';
import type { BookingListItem } from '../../types';
import { bookingStatusMeta, fulfillmentStageMeta, formatWindow, requestClock } from './bookingMeta';

/** What a row can be asked to do, beyond opening. */
export type BookingAction = 'handover' | 'return' | 'issue' | 'decline' | 'confirm' | 'cancel';

/**
 * One booking in a list of them, on a phone.
 *
 * Same shape as a product card — photo in the left column, everything written in one block to its
 * right, the state as a small chip above the name — so the two lists in this console are one thing
 * to learn. What differs is the bottom: a booking is work, so the one move it is waiting for is a
 * button on the card, and everything else is behind the dots.
 */
export function BookingCard({
  booking,
  busy,
  onOpen,
  onMenu,
  onAction,
}: {
  booking: BookingListItem;
  busy?: boolean;
  onOpen: () => void;
  onMenu: () => void;
  onAction: (action: BookingAction) => void;
}) {
  const status = bookingStatusMeta(booking.status);
  const stage = fulfillmentStageMeta(booking.fulfillment?.stage);
  const closed = booking.status === 'cancelled' || booking.status === 'expired' || booking.status === 'failed';
  const awaiting = booking.status === 'awaiting_seller_confirmation';

  /**
   * The one move the booking is waiting for.
   *
   * The API decides which are open — `handoverAllowed` and `returnAllowed` are the same rules the
   * command endpoints enforce — so this renders its answer rather than deriving one from status.
   */
  // A request is on a 24-hour clock that nothing else on screen would mention.
  const clock = awaiting ? requestClock(booking.createdAt) : null;

  const primary: { label: string; action: BookingAction } | null = awaiting
    ? { label: 'Подтвердить', action: 'confirm' }
    : booking.fulfillment?.handoverAllowed
      ? { label: 'Выдать', action: 'handover' }
      : booking.fulfillment?.returnAllowed
        ? { label: 'Принять возврат', action: 'return' }
        : null;

  return (
    <li className="relative overflow-hidden rounded-xl bg-white">
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full gap-3 p-3 text-left transition active:bg-gray-50"
      >
        <Thumb url={booking.product.mediaPreviewUrl} />
        <span className="min-w-0 flex-1">
          {/* Room at the right-hand end for the menu laid over that corner. */}
          <span className="flex flex-wrap items-center gap-1 pr-7">
            <Badge variant={status.variant} size="xs" tone="strong" shape="square">{status.label}</Badge>
            {stage && !closed && (
              <Badge variant={stage.variant} size="xs" tone="strong" shape="square">{stage.label}</Badge>
            )}
            {booking.fulfillment?.hasIssue && (
              <Badge variant="red" size="xs" tone="strong" shape="square">обращение</Badge>
            )}
          </span>
          <span className="mt-1.5 line-clamp-2 text-sm font-medium leading-5 text-gray-900">
            {booking.product.title}
          </span>
          <span className="mt-0.5 block truncate text-xs text-gray-500">
            №{booking.bookingNumber}
            {booking.quantity > 1 ? ` · ${booking.quantity} шт` : ''}
          </span>
          <span className="mt-1 block truncate text-xs font-medium text-gray-900">
            {formatWindow(booking.startAt, booking.endAt) ?? '—'}
          </span>
          <span className="mt-0.5 block truncate text-xs text-gray-500">
            {booking.customer?.fullName ?? 'Клиент'}
          </span>
          {clock && (
            <span className={`mt-1 block text-xs font-medium ${clock.urgent ? 'text-red-600' : 'text-amber-700'}`}>
              {clock.label}
            </span>
          )}
        </span>
      </button>

      {primary && (
        <div className="px-3 pb-3">
          <Button
            variant="primary"
            loading={busy}
            onClick={() => onAction(primary.action)}
            className="h-10 w-full justify-center"
          >
            {primary.label}
          </Button>
        </div>
      )}

      <button
        type="button"
        onClick={onMenu}
        aria-label="Действия с заказом"
        className="absolute right-1 top-1 rounded-lg p-2 text-gray-500 transition active:bg-gray-100"
      >
        <MoreHorizontal size={20} strokeWidth={2.5} />
      </button>
    </li>
  );
}

/** The same card with nothing in it yet, so a list that is loading keeps its shape. */
export function BookingCardSkeleton() {
  return (
    <li className="flex items-center gap-3 rounded-xl bg-white p-3">
      <Skeleton className="h-14 w-14 shrink-0" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3.5 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </li>
  );
}

function Thumb({ url }: { url: string | null }) {
  if (!url) {
    return (
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-300">
        <ImageOff size={18} />
      </span>
    );
  }
  return <img src={mediaUrl(url)} alt="" className="h-14 w-14 shrink-0 rounded-lg border border-gray-200 object-cover" />;
}
