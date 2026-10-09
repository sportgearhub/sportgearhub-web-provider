import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Textarea } from '../../components/ui/Textarea';
import { ApiError, bookingsApi } from '../../lib/api-client';
import { rejectionMessage } from './commandResult';

interface ReturnFormProps {
  bookingId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ReturnForm({ bookingId, onSuccess, onCancel }: ReturnFormProps) {
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    const returnedAt = new Date().toISOString();
    try {
      const response = await bookingsApi.return(bookingId, {
        returnedAt,
        note: notes.trim() || undefined,
      });
      const rejected = rejectionMessage(response, 'Не удалось записать возврат.');
      if (rejected) {
        setError(rejected);
        setLoading(false);
        return;
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось записать возврат.');
      setLoading(false);
      return;
    }
    onSuccess();
    setLoading(false);
  };

  return (
    <div className="space-y-4 px-5 pb-4 pt-1">
      <p className="text-sm leading-5 text-gray-600">Запишите состояние снаряжения. Приём возврата закрывает аренду — отдельно завершать её не нужно.</p>

      <div className="bg-teal-50 border border-teal-100 rounded-lg px-4 py-3">
        <p className="text-xs text-teal-800">
          Время возврата будет записано как <strong>{new Date().toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}</strong>
        </p>
      </div>

      <div className="space-y-3">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
        <Textarea
          label="Заметки по возврату"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          placeholder="Повреждения, недостающие аксессуары, детали позднего возврата..."
        />

        {/* A dropdown nobody reads teaches people to fill fields without looking. Damage goes
            through «Сообщить о проблеме», which has consequences. */}
        <p className="text-xs text-gray-500">
          Если со снаряжением что-то не так — отправьте обращение, а не пометку в заметках.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-1 [&>button]:w-full [&>button]:justify-center">
        <Button variant="primary" onClick={handleSubmit} loading={loading}>
          Подтвердить возврат
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={loading}>
          Отмена
        </Button>
      </div>
    </div>
  );
}
