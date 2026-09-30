import { useState } from 'react';
import { Calculator } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ApiError, productsApi } from '../../lib/api-client';
import type { QuotePreview } from '../../types';
import { formatPrice } from './productStatus';

const DURATIONS = [
  { hours: 1, label: '1 час' },
  { hours: 4, label: 'Полдня' },
  { hours: 24, label: 'Сутки' },
  { hours: 72, label: '3 дня' },
];

/**
 * «Сколько заплатит клиент» — the seller's own calculator. Tiers and a deposit are easy to set and
 * hard to add up in your head, so the platform's own arithmetic is shown rather than re-implemented
 * here: the same quote endpoint checkout uses.
 */
export function ProductQuoteCalculator({ productId }: { productId: string }) {
  const [hours, setHours] = useState(24);
  const [quantity, setQuantity] = useState('1');
  const [quote, setQuote] = useState<QuotePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = async (nextHours: number) => {
    setHours(nextHours);
    setLoading(true);
    setError('');
    try {
      const startAt = new Date();
      startAt.setHours(startAt.getHours() + 24, 0, 0, 0);
      setQuote(await productsApi.quote(productId, {
        startAt: startAt.toISOString(),
        durationHours: nextHours,
        quantity: Number(quantity) || 1,
      }));
    } catch (err) {
      setQuote(null);
      setError(err instanceof ApiError ? err.message : 'Не удалось рассчитать.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-md border border-gray-200 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
          <Calculator size={14} className="text-gray-400" /> Сколько заплатит клиент
        </p>
        <Input
          type="number"
          min="1"
          value={quantity}
          onChange={event => setQuantity(event.target.value)}
          className="w-20"
          aria-label="Количество"
        />
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {DURATIONS.map(duration => (
          <Button
            key={duration.hours}
            size="sm"
            variant={hours === duration.hours && quote ? 'primary' : 'secondary'}
            disabled={loading}
            onClick={() => void run(duration.hours)}
          >
            {duration.label}
          </Button>
        ))}
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {quote && !error && (
        <dl className="mt-3 space-y-1 border-t border-gray-100 pt-3 text-sm">
          <Line label="Аренда" value={formatPrice(quote.subtotal)} />
          {Boolean(quote.fees) && <Line label="Сервисный сбор" value={formatPrice(quote.fees ?? 0)} />}
          {Boolean(quote.depositAmount) && <Line label="Залог" value={formatPrice(quote.depositAmount ?? 0)} muted />}
          <div className="flex items-center justify-between border-t border-gray-100 pt-1.5">
            <dt className="text-sm font-medium text-gray-900">Итого</dt>
            <dd className="text-sm font-semibold text-gray-950">{formatPrice(quote.totalPrice)}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}

function Line({ label, value, muted }: { label: string; value: string | null; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className={muted ? 'text-gray-500' : 'text-gray-600'}>{label}</dt>
      <dd className={muted ? 'text-gray-500' : 'text-gray-900'}>{value ?? '—'}</dd>
    </div>
  );
}
