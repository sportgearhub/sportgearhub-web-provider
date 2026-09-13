import { useEffect, useState } from 'react';
import { AlertCircle, CheckSquare, ChevronLeft } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ApiError, fulfillmentApi } from '../../lib/api-client';
import { HandoverForm } from './HandoverForm';
import { ReturnForm } from './ReturnForm';
import { CompleteForm } from './CompleteForm';
import { IssueReportForm } from './IssueReportForm';
import type { FulfillmentItem, FulfillmentStatus } from '../../types';

const statusConfig: Record<FulfillmentStatus, { label: string; variant: 'yellow' | 'blue' | 'teal' | 'green' | 'red' }> = {
  pending_handover: { label: 'Ожидает выдачи', variant: 'yellow' },
  active: { label: 'Активно', variant: 'blue' },
  pending_return: { label: 'Ожидает возврата', variant: 'teal' },
  completed: { label: 'Завершено', variant: 'green' },
  issue_reported: { label: 'Есть обращение', variant: 'red' },
};

type FulfillmentAction = 'handover' | 'return' | 'complete' | 'issue';

export function FulfillmentPage() {
  const [queue, setQueue] = useState<FulfillmentItem[]>([]);
  const [selected, setSelected] = useState<FulfillmentItem | null>(null);
  const [action, setAction] = useState<FulfillmentAction | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadQueue = async () => {
    setError('');
    setLoading(true);
    try {
      const items = await fulfillmentApi.getQueue();
      setQueue(items.map(normalizeFulfillmentItem));
    } catch (err) {
      setError(err instanceof ApiError ? `Не удалось загрузить очередь: ${err.message}` : 'Не удалось загрузить очередь.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadQueue();
  }, []);

  const handleAction = (item: FulfillmentItem, nextAction: FulfillmentAction) => {
    setSelected(item);
    setAction(nextAction);
  };

  const handleSuccess = (updated: FulfillmentItem) => {
    setQueue(prev => prev.map(item => item.bookingId === updated.bookingId ? updated : item));
    const successLabels: Record<FulfillmentAction, string> = {
      handover: 'Выдача успешно записана.',
      return: 'Возврат успешно записан.',
      complete: 'Бронирование завершено.',
      issue: 'Обращение отправлено.',
    };

    if (action) {
      setSuccessMsg(successLabels[action]);
    }

    setAction(null);
    setSelected(null);
    void loadQueue();
    window.setTimeout(() => setSuccessMsg(''), 4000);
  };

  const activeItems = queue.filter(item =>
    item.status === 'pending_handover' || item.status === 'active' || item.status === 'pending_return'
  );
  const completedItems = queue.filter(item =>
    item.status === 'completed' || item.status === 'issue_reported'
  );

  if (action && selected) {
    return (
      <div className="p-6 max-w-2xl">
        <button
          onClick={() => {
            setAction(null);
            setSelected(null);
          }}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 mb-4 transition-colors"
        >
          <ChevronLeft size={14} /> Назад к очереди выдачи
        </button>

        <div className="mb-4">
          <h2 className="text-sm font-semibold text-gray-900">{selected.bookingRef}</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {selected.customer.name} · {selected.selection.offerTitle}
          </p>
        </div>

        {action === 'handover' && (
          <HandoverForm item={selected} onSuccess={handleSuccess} onCancel={() => setAction(null)} />
        )}
        {action === 'return' && (
          <ReturnForm item={selected} onSuccess={handleSuccess} onCancel={() => setAction(null)} />
        )}
        {action === 'complete' && (
          <CompleteForm item={selected} onSuccess={handleSuccess} onCancel={() => setAction(null)} />
        )}
        {action === 'issue' && (
          <IssueReportForm item={selected} onSuccess={handleSuccess} onCancel={() => setAction(null)} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5 p-6">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">Очередь выдачи</h2>
        <p className="text-xs text-gray-500 mt-0.5">Выдачи, возвраты и работа с обращениями.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
          <CheckSquare size={14} />
          <span>{successMsg}</span>
        </div>
      )}

      {loading ? (
        <Card>
          <p className="text-xs text-gray-500">Загружаем очередь выдачи...</p>
        </Card>
      ) : null}

      {!loading && <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-700">Открытая очередь</h3>
          <Badge variant="blue">{activeItems.length}</Badge>
        </div>

        {activeItems.length === 0 ? (
          <Card>
            <p className="text-xs text-gray-500">Нет активных задач по выдаче.</p>
          </Card>
        ) : (
          activeItems.map(item => (
            <FulfillmentCard
              key={item.bookingId}
              item={item}
              onAction={handleAction}
            />
          ))
        )}
      </section>}

      {!loading && <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-700">Завершено / обращения</h3>
          <Badge variant="gray">{completedItems.length}</Badge>
        </div>

        {completedItems.length === 0 ? (
          <Card>
            <p className="text-xs text-gray-500">Завершенные аренды и обращения появятся здесь.</p>
          </Card>
        ) : (
          completedItems.map(item => (
            <FulfillmentCard
              key={item.bookingId}
              item={item}
              onAction={handleAction}
              compact
            />
          ))
        )}
      </section>}
    </div>
  );
}

function normalizeFulfillmentItem(raw: Record<string, unknown>): FulfillmentItem {
  const booking = readRecord(raw.booking);
  const customer = readRecord(raw.customer ?? raw.customerSummary ?? booking.customerSummary);
  const selection = readRecord(raw.selection ?? raw.selectionSummary ?? booking.selectionSummary);
  const status = normalizeFulfillmentStatus(
    readString(raw.status) ||
    readString(raw.fulfillmentStage) ||
    readString(booking.fulfillmentStage) ||
    readString(booking.status)
  );
  const bookingId = readString(raw.bookingId) || readString(booking.bookingId) || readString(raw.id);
  const bookingRef =
    readString(raw.bookingRef) ||
    readString(raw.bookingNumber) ||
    readString(booking.bookingNumber) ||
    bookingId ||
    'Бронь';

  return {
    bookingId,
    bookingRef,
    status,
    customer: {
      id: readString(customer.customerId) || readString(customer.id) || bookingId,
      name: readString(customer.fullName) || readString(customer.name) || 'Клиент',
      email: readString(customer.email) || '',
      phone: readString(customer.phone) || undefined,
    },
    selection: {
      offerId: readString(selection.offerId) || readString(raw.offerId),
      offerTitle: readString(selection.offerTitle) || readString(raw.offerTitle) || 'Предложение',
      resourceId: readString(selection.resourceId) || readString(raw.resourceId),
      resourceTitle: readString(selection.resourceTitle) || readString(raw.resourceTitle) || 'Позиция',
      variantId: readString(selection.variantId) || undefined,
      variantTitle: readString(selection.variantTitle) || undefined,
      quantity: readNumber(selection.quantity) || readNumber(raw.quantity) || 1,
      startDate: readString(selection.startAt) || readString(selection.startDate) || readString(raw.startAt) || new Date().toISOString(),
      endDate: readString(selection.endAt) || readString(selection.endDate) || readString(raw.endAt) || undefined,
      durationLabel: readString(selection.durationLabel) || '',
    },
    handoverAt: readString(raw.handoverAt) || undefined,
    returnAt: readString(raw.returnAt) || undefined,
    completedAt: readString(raw.completedAt) || undefined,
    issueReportedAt: readString(raw.issueReportedAt) || undefined,
    notes: readString(raw.notes) || readString(raw.note) || undefined,
  };
}

function normalizeFulfillmentStatus(value: string): FulfillmentStatus {
  if (value === 'pending_handover' || value === 'handover_pending') return 'pending_handover';
  if (value === 'active' || value === 'handed_over') return 'active';
  if (value === 'pending_return' || value === 'return_pending' || value === 'returned') return 'pending_return';
  if (value === 'completed') return 'completed';
  if (value === 'issue_reported' || value === 'issue') return 'issue_reported';
  return 'pending_handover';
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function readNumber(value: unknown): number {
  return typeof value === 'number' ? value : 0;
}

function FulfillmentCard({
  item,
  onAction,
  compact = false,
}: {
  item: FulfillmentItem;
  onAction: (item: FulfillmentItem, action: FulfillmentAction) => void;
  compact?: boolean;
}) {
  const status = statusConfig[item.status];

  return (
    <Card>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-gray-900">{item.bookingRef}</h4>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
          <p className="text-xs text-gray-600">
            {item.customer.name} · {item.selection.offerTitle}
          </p>
          <p className="text-xs text-gray-500">
            {item.selection.resourceTitle}
            {item.selection.variantTitle ? ` · ${item.selection.variantTitle}` : ''}
          </p>
          <p className="text-xs text-gray-500">
            Начало: {new Date(item.selection.startDate).toLocaleString('ru-RU', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
          {item.notes && (
            <div className="flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{item.notes}</span>
            </div>
          )}
        </div>

        {!compact && (
          <div className="flex flex-wrap gap-2">
            {item.status === 'pending_handover' && (
              <Button size="sm" variant="primary" onClick={() => onAction(item, 'handover')}>
                Записать выдачу
              </Button>
            )}
            {item.status === 'active' && (
              <Button size="sm" variant="secondary" onClick={() => onAction(item, 'return')}>
                Записать возврат
              </Button>
            )}
            {item.status === 'pending_return' && (
              <Button size="sm" variant="primary" onClick={() => onAction(item, 'complete')}>
                Завершить
              </Button>
            )}
            {item.status !== 'issue_reported' && item.status !== 'completed' && (
              <Button size="sm" variant="ghost" onClick={() => onAction(item, 'issue')}>
                Сообщить о проблеме
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
