import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { ApiError, bookingsApi } from '../../lib/api-client';

const REASONS = [
  { value: 'unavailable', label: 'Снаряжение занято или недоступно' },
  { value: 'maintenance', label: 'Нужен ремонт или обслуживание' },
  { value: 'schedule_conflict', label: 'Не получится выдать в это время' },
  { value: 'customer_request', label: 'Клиент попросил отменить' },
  { value: 'other', label: 'Другая причина' },
];

/**
 * Declining a request. Nothing was charged — a `seller_confirms` card takes no money until the
 * seller says yes — so there is nothing to refund and no warning to give about one.
 */
export function DeclineForm({
  bookingId,
  onSuccess,
  onCancel,
}: {
  bookingId: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [reasonCode, setReasonCode] = useState('unavailable');
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setLoading(true);
    setError('');
    try {
      await bookingsApi.decline(bookingId, { reasonCode, comment: comment.trim() || undefined });
      onSuccess();
    } catch (err) {
      setError(err instanceof ApiError
        ? err.code === 'booking.not_awaiting_confirmation'
          ? 'Заявку уже обработали. Обновите список.'
          : err.message
        : 'Не удалось отклонить заявку.');
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 px-5 pb-4 pt-1">
      <p className="text-sm leading-5 text-gray-600">
        Снаряжение освободится, клиент получит уведомление. Деньги не списывались, возвращать нечего.
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Select
        label="Причина"
        value={reasonCode}
        options={REASONS}
        onChange={event => setReasonCode(event.target.value)}
      />

      <div>
        <Textarea
          label="Комментарий для клиента"
          rows={3}
          value={comment}
          onChange={event => setComment(event.target.value)}
        />
        <p className="mt-1.5 text-xs text-gray-500">Необязательно. Клиент увидит этот текст.</p>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-1 [&>button]:w-full [&>button]:justify-center">
        <Button variant="secondary" disabled={loading} onClick={onCancel}>Отмена</Button>
        <Button variant="danger" loading={loading} onClick={() => void submit()}>Отклонить</Button>
      </div>
    </div>
  );
}
