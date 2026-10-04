import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Textarea } from '../../components/ui/Textarea';
import { Select } from '../../components/ui/Select';
import { ApiError, bookingsApi } from '../../lib/api-client';
import { rejectionMessage } from './commandResult';

interface ReturnFormProps {
  bookingId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const conditionOptions = [
  { value: 'excellent', label: 'Отличное - без проблем' },
  { value: 'good', label: 'Хорошее - небольшой износ' },
  { value: 'fair', label: 'Среднее - заметный износ' },
  { value: 'damaged', label: 'Повреждено - требует внимания' },
];

export function ReturnForm({ bookingId, onSuccess, onCancel }: ReturnFormProps) {
  const [condition, setCondition] = useState('good');
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
        conditionSummary: [{ key: 'condition', value: condition }],
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
    <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Зафиксировать возврат</h3>
        <p className="text-xs text-gray-500 mt-0.5">Запишите состояние снаряжения. Приём возврата закрывает аренду — отдельно завершать её не нужно.</p>
      </div>

      <div className="bg-teal-50 border border-teal-100 rounded-lg px-4 py-3">
        <p className="text-xs text-teal-800">
          Время возврата будет записано как <strong>{new Date().toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}</strong>
        </p>
      </div>

      <div className="space-y-3">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
        <Select
          label="Состояние оборудования"
          options={conditionOptions}
          value={condition}
          onChange={e => setCondition(e.target.value)}
        />

        <Textarea
          label="Заметки по возврату"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          placeholder="Повреждения, недостающие аксессуары, детали позднего возврата..."
        />

        {condition === 'damaged' && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
            <p className="text-xs text-amber-800 font-medium">Обнаружено повреждение</p>
            <p className="text-xs text-amber-700 mt-0.5">Для дальнейшей обработки автоматически будет создан отчет о проблеме.</p>
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-2">
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
