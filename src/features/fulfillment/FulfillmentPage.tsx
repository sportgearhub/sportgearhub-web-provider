import { useEffect, useState } from 'react';
import { AlertCircle, CheckSquare, ChevronLeft } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ApiError, bookingsApi, fulfillmentApi } from '../../lib/api-client';
import { HandoverForm } from './HandoverForm';
import { ReturnForm } from './ReturnForm';
import { CompleteForm } from './CompleteForm';
import { IssueReportForm } from './IssueReportForm';
import type { BookingListItem, FulfillmentItem, FulfillmentStage } from '../../types';

const stageConfig: Record<FulfillmentStage, { label: string; variant: 'yellow' | 'blue' | 'teal' | 'green' | 'red' }> = {
  pending_handover: { label: 'Ожидает выдачи', variant: 'yellow' },
  active: { label: 'На руках', variant: 'blue' },
  returned: { label: 'Возвращено', variant: 'teal' },
  completed: { label: 'Завершено', variant: 'green' },
  issue_reported: { label: 'Есть обращение', variant: 'red' },
};

const CLOSED_STAGES: FulfillmentStage[] = ['completed', 'issue_reported'];

type FulfillmentAction = 'handover' | 'return' | 'complete' | 'issue';

/**
 * A queue row as the operator reads it. /fulfillment says what stage a booking is at and which of
 * the three moves it will accept; it does not repeat the customer or the product title, so those
 * are joined in from /bookings. The join is best-effort — a row with no matching booking still
 * shows, because being unable to name the customer is no reason to hide work that is due.
 */
type QueueRow = FulfillmentItem & {
  productTitle: string | null;
  customerName: string | null;
  customerPhone: string | null;
};

export function FulfillmentPage() {
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [selected, setSelected] = useState<QueueRow | null>(null);
  const [action, setAction] = useState<FulfillmentAction | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadQueue = async () => {
    setError('');
    setLoading(true);
    try {
      const [items, bookings] = await Promise.all([
        fulfillmentApi.getQueue(),
        // Labels only. If this half fails the queue is still actionable, so it degrades quietly.
        bookingsApi.list({}).catch(() => [] as BookingListItem[]),
      ]);
      const byId = new Map(bookings.map(booking => [booking.bookingId, booking]));
      setQueue(items.map(item => {
        const booking = byId.get(item.bookingId);
        return {
          ...item,
          productTitle: booking?.product.title ?? null,
          customerName: booking?.customer?.fullName ?? null,
          customerPhone: booking?.customer?.phone ?? null,
        };
      }));
    } catch (err) {
      setError(err instanceof ApiError ? `Не удалось загрузить очередь: ${err.message}` : 'Не удалось загрузить очередь.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadQueue();
  }, []);

  const handleAction = (item: QueueRow, nextAction: FulfillmentAction) => {
    setSelected(item);
    setAction(nextAction);
  };

  const handleSuccess = () => {
    const successLabels: Record<FulfillmentAction, string> = {
      handover: 'Выдача записана.',
      return: 'Возврат записан.',
      complete: 'Бронирование завершено.',
      issue: 'Обращение отправлено.',
    };
    if (action) setSuccessMsg(successLabels[action]);
    setAction(null);
    setSelected(null);
    void loadQueue();
    window.setTimeout(() => setSuccessMsg(''), 4000);
  };

  const openItems = queue.filter(item => !CLOSED_STAGES.includes(item.fulfillmentStage));
  const closedItems = queue.filter(item => CLOSED_STAGES.includes(item.fulfillmentStage));

  if (action && selected) {
    return (
      <div className="max-w-2xl p-6">
        <button
          onClick={() => {
            setAction(null);
            setSelected(null);
          }}
          className="mb-4 flex items-center gap-1.5 text-xs text-gray-500 transition-colors hover:text-gray-800"
        >
          <ChevronLeft size={14} /> Назад к очереди выдачи
        </button>

        <div className="mb-4">
          <h2 className="text-sm font-semibold text-gray-900">{selected.bookingNumber}</h2>
          <p className="mt-0.5 text-xs text-gray-500">{describe(selected)}</p>
        </div>

        {action === 'handover' && <HandoverForm item={selected} onSuccess={handleSuccess} onCancel={() => setAction(null)} />}
        {action === 'return' && <ReturnForm item={selected} onSuccess={handleSuccess} onCancel={() => setAction(null)} />}
        {action === 'complete' && <CompleteForm item={selected} onSuccess={handleSuccess} onCancel={() => setAction(null)} />}
        {action === 'issue' && <IssueReportForm item={selected} onSuccess={handleSuccess} onCancel={() => setAction(null)} />}
      </div>
    );
  }

  return (
    <div className="space-y-5">
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

      {loading && (
        <Card>
          <p className="text-xs text-gray-500">Загружаем очередь выдачи…</p>
        </Card>
      )}

      {!loading && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-700">Открытая очередь</h3>
            <Badge variant="blue">{openItems.length}</Badge>
          </div>
          {openItems.length === 0 ? (
            <Card>
              <p className="text-xs text-gray-500">Нет активных задач по выдаче.</p>
            </Card>
          ) : (
            openItems.map(item => <FulfillmentCard key={item.bookingId} item={item} onAction={handleAction} />)
          )}
        </section>
      )}

      {!loading && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-700">Завершено и обращения</h3>
            <Badge variant="gray">{closedItems.length}</Badge>
          </div>
          {closedItems.length === 0 ? (
            <Card>
              <p className="text-xs text-gray-500">Завершённые аренды и обращения появятся здесь.</p>
            </Card>
          ) : (
            closedItems.map(item => <FulfillmentCard key={item.bookingId} item={item} onAction={handleAction} compact />)
          )}
        </section>
      )}
    </div>
  );
}

/** The customer and the product, whichever of the two the bookings join managed to supply. */
function describe(item: QueueRow) {
  const parts = [item.customerName, item.productTitle].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : 'Бронирование';
}

function formatMoment(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function FulfillmentCard({
  item,
  onAction,
  compact = false,
}: {
  item: QueueRow;
  onAction: (item: QueueRow, action: FulfillmentAction) => void;
  compact?: boolean;
}) {
  const stage = stageConfig[item.fulfillmentStage];
  // Which moves are open is the API's call, not ours — it accounts for booking type, timestamps and
  // whatever else it knows. Reporting a problem is the one thing that stays available while the
  // booking is still open.
  const canReportIssue = !CLOSED_STAGES.includes(item.fulfillmentStage);

  return (
    <Card>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-gray-900">{item.bookingNumber}</h4>
            <Badge variant={stage.variant}>{stage.label}</Badge>
          </div>
          <p className="text-xs text-gray-600">{describe(item)}</p>
          <p className="text-xs text-gray-500">
            {formatMoment(item.startAt)} — {formatMoment(item.endAt)}
            {item.quantity > 1 ? ` · ${item.quantity} шт.` : ''}
          </p>
          {/* The person is standing at the counter; a number to call is worth more than a note. */}
          {item.customerPhone && (
            <a
              href={`tel:${item.customerPhone}`}
              onClick={event => event.stopPropagation()}
              className="inline-block text-xs font-medium text-blue-700 hover:underline"
            >
              {item.customerPhone}
            </a>
          )}
        </div>

        {!compact && (
          <div className="flex flex-wrap gap-2">
            {item.handoverAllowed && (
              <Button size="sm" variant="primary" onClick={() => onAction(item, 'handover')}>
                Записать выдачу
              </Button>
            )}
            {item.returnAllowed && (
              <Button size="sm" variant="secondary" onClick={() => onAction(item, 'return')}>
                Записать возврат
              </Button>
            )}
            {item.completionAllowed && (
              <Button size="sm" variant="primary" onClick={() => onAction(item, 'complete')}>
                Завершить
              </Button>
            )}
            {canReportIssue && (
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
