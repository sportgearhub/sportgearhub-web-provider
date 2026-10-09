import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Textarea } from '../../components/ui/Textarea';
import { ApiError, bookingsApi } from '../../lib/api-client';
import { rejectionMessage } from './commandResult';

interface HandoverFormProps {
  bookingId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function HandoverForm({ bookingId, onSuccess, onCancel }: HandoverFormProps) {
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    const handedOverAt = new Date().toISOString();
    try {
      const response = await bookingsApi.handover(bookingId, {
        handedOverAt,
        note: notes.trim() || undefined,
      });
      const rejected = rejectionMessage(response, 'Не удалось записать выдачу.');
      if (rejected) {
        setError(rejected);
        setLoading(false);
        return;
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось записать выдачу.');
      setLoading(false);
      return;
    }
    onSuccess();
    setLoading(false);
  };

  return (
    <div className="space-y-4 px-5 pb-4 pt-1">
      <p className="text-sm leading-5 text-gray-600">Подтвердите, что оборудование передано клиенту.</p>

      <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
        <p className="text-xs text-blue-800">
          Время выдачи будет записано как <strong>{new Date().toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}</strong>
        </p>
      </div>

      <div className="space-y-3">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Чеклист</label>
          <div className="space-y-2">
            {['Оборудование осмотрено и чистое', 'Документ клиента проверен', 'Согласие подписано', 'Серийный номер оборудования записан'].map(item => (
              <label key={item} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" defaultChecked />
                {item}
              </label>
            ))}
          </div>
        </div>

        <Textarea
          label="Заметки по выдаче (необязательно)"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          placeholder="Состояние, выданные аксессуары и другие детали..."
        />
      </div>

      <div className="grid grid-cols-2 gap-2 pt-1 [&>button]:w-full [&>button]:justify-center">
        <Button variant="primary" onClick={handleSubmit} loading={loading}>
          Подтвердить выдачу
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={loading}>
          Отмена
        </Button>
      </div>
    </div>
  );
}
