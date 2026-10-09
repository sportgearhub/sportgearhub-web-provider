import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { ApiError, bookingsApi } from '../../lib/api-client';

/**
 * Why a seller cancels something already paid for. Not the same list as declining: these are all
 * the seller being unable to deliver, because a customer changing their mind cancels it themselves.
 */
const REASONS = [
  { value: 'equipment_damaged', label: 'Снаряжение сломалось или повреждено' },
  { value: 'unavailable', label: 'Снаряжения не будет в наличии' },
  { value: 'schedule_conflict', label: 'Не получится выдать в это время' },
  { value: 'customer_request', label: 'Клиент попросил отменить' },
  { value: 'other', label: 'Другая причина' },
];

/**
 * Cancelling a confirmed booking.
 *
 * Declining answers a request before any money moves; this undoes a booking that was paid for, and
 * the two are different conversations. **The customer is refunded in full, always** — whatever the
 * hour, and even on a card whose terms forbid cancellation. Refund rules price a customer changing
 * their mind; they have no business charging one for a seller who cannot deliver.
 *
 * The comment reaches the customer by e-mail, so the field says so and the placeholder is written
 * as something a person would read.
 */
export function CancelForm({
  bookingId,
  onSuccess,
  onCancel,
}: {
  bookingId: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [reasonCode, setReasonCode] = useState('equipment_damaged');
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setLoading(true);
    setError('');
    try {
      // Cancel answers with the decision rather than a fulfillment outcome; a booking already in a
      // terminal state answers `already_terminal` as an error, which is safe to have double-tapped.
      await bookingsApi.cancel(bookingId, { reasonCode, comment: comment.trim() || undefined });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось отменить бронирование.');
      setLoading(false);
      return;
    }
    onSuccess();
    setLoading(false);
  };

  return (
    <div className="space-y-4 px-5 pb-4 pt-1">
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm leading-5 text-amber-900">
        Клиенту вернётся вся сумма, включая залог — независимо от правил отмены в карточке. Снаряжение
        освободится, и бронь закроется.
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Select
        label="Причина"
        value={reasonCode}
        options={REASONS}
        onChange={event => setReasonCode(event.target.value)}
      />

      <Textarea
        label="Что написать клиенту — уйдёт ему на почту"
        rows={3}
        value={comment}
        onChange={event => setComment(event.target.value)}
        placeholder="Велосипед сломался сегодня утром, приносим извинения. Вернули всю сумму."
      />

      <div className="grid grid-cols-2 gap-2 pt-1 [&>button]:w-full [&>button]:justify-center">
        <Button variant="secondary" disabled={loading} onClick={onCancel}>Не отменять</Button>
        <Button variant="danger" loading={loading} onClick={() => void submit()}>Отменить бронь</Button>
      </div>
    </div>
  );
}
