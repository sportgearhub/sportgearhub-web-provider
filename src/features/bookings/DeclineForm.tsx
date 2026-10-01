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
    <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Отклонить заявку</h3>
        <p className="mt-0.5 text-xs text-gray-500">
          Снаряжение освободится, клиент получит уведомление. Деньги не списывались, возвращать нечего.
        </p>
      </div>

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

      <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
        <Button variant="secondary" disabled={loading} onClick={onCancel}>Отмена</Button>
        <Button variant="danger" loading={loading} onClick={() => void submit()}>Отклонить</Button>
      </div>
    </div>
  );
}
