import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Textarea } from '../../components/ui/Textarea';
import { ApiError, bookingsApi } from '../../lib/api-client';
import { rejectionMessage } from './commandResult';
import type { FulfillmentItem } from '../../types';

interface CompleteFormProps {
  item: FulfillmentItem;
  onSuccess: () => void;
  onCancel: () => void;
}

export function CompleteForm({ item, onSuccess, onCancel }: CompleteFormProps) {
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    const completedAt = new Date().toISOString();
    try {
      const response = await bookingsApi.complete(item.bookingId, {
        completedAt,
        note: notes.trim() || undefined,
      });
      const rejected = rejectionMessage(response, 'Не удалось завершить бронь.');
      if (rejected) {
        setError(rejected);
        setLoading(false);
        return;
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось завершить бронь.');
      setLoading(false);
      return;
    }
    onSuccess();
    setLoading(false);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Завершить бронь</h3>
        <p className="text-xs text-gray-500 mt-0.5">Отметьте бронь как полностью завершенную.</p>
      </div>

      <div className="bg-emerald-50 border border-emerald-100 rounded-md px-4 py-3">
        <p className="text-xs text-emerald-800">
          Завершение подтверждает, что оборудование возвращено, а аренда закрыта.
        </p>
      </div>

      <Textarea
        label="Заметки о завершении (необязательно)"
        value={notes}
        onChange={e => setNotes(e.target.value)}
        rows={3}
        placeholder="Итоговые комментарии, оценка, дальнейшие действия..."
      />
      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}

      <div className="flex gap-2 pt-2">
        <Button variant="primary" onClick={handleSubmit} loading={loading}>
          Завершить
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={loading}>
          Отмена
        </Button>
      </div>
    </div>
  );
}
