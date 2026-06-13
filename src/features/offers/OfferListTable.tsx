import { CreditCard as Edit2, Eye, Search } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { Select } from '../../components/ui/Select';
import type { Offer, OfferStatus } from '../../types';
import { OfferReadinessChecklist } from './OfferReadinessChecklist';
import {
  bookingFlowLabel,
  offerTypeLabel,
} from './offerDisplay';
import { offerBookingSetupReady } from './offerReadiness';

const statusBadge: Record<OfferStatus, { label: string; variant: 'green' | 'yellow' | 'gray' | 'blue' }> = {
  active: { label: 'Активно', variant: 'green' },
  draft: { label: 'Черновик', variant: 'yellow' },
  inactive: { label: 'Неактивно', variant: 'gray' },
  archived: { label: 'В архиве', variant: 'gray' },
};

const statusOptions = [
  { value: '', label: 'Все статусы' },
  { value: 'active', label: 'Активно' },
  { value: 'draft', label: 'Черновик' },
  { value: 'inactive', label: 'Неактивно' },
];

interface OfferListTableProps {
  offers: Offer[];
  loading: boolean;
  saving: boolean;
  query: string;
  resourceFilter: string;
  statusFilter: string;
  resourceOptions: Array<{ value: string; label: string }>;
  onQueryChange: (value: string) => void;
  onResourceFilterChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onOpenDetail: (offer: Offer) => void;
  onEdit: (offer: Offer) => void;
  onStatusChange: (offer: Offer, status: OfferStatus) => void;
  resourceTitleOf: (offer: Offer) => string;
}

export function OfferListTable({
  offers,
  loading,
  saving,
  query,
  resourceFilter,
  statusFilter,
  resourceOptions,
  onQueryChange,
  onResourceFilterChange,
  onStatusFilterChange,
  onOpenDetail,
  onEdit,
  onStatusChange,
  resourceTitleOf,
}: OfferListTableProps) {
  return (
    <>
      <Card className="p-3">
        <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_180px_180px]">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={event => onQueryChange(event.target.value)}
              placeholder="Поиск по предложению, инвентарю, slug..."
              className="w-full rounded-xl border border-gray-200 bg-white px-9 py-2.5 text-sm text-gray-900 outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
            />
          </div>
          <Select options={resourceOptions} value={resourceFilter} onChange={event => onResourceFilterChange(event.target.value)} />
          <Select options={statusOptions} value={statusFilter} onChange={event => onStatusFilterChange(event.target.value)} />
        </div>
      </Card>

      <Card padding={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[1180px] w-full border-separate border-spacing-0">
            <thead>
              <tr className="bg-gray-50">
                <th className="sticky left-0 z-10 border-b border-r border-gray-100 bg-gray-50 px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                  Предложение
                </th>
                <th className="border-b border-gray-100 px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                  Инвентарь
                </th>
                <th className="border-b border-gray-100 px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                  Цена
                </th>
                <th className="border-b border-gray-100 px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                  Публикация
                </th>
                <th className="border-b border-gray-100 px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                  Статус
                </th>
                <th className="border-b border-gray-100 px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                  Обновлено
                </th>
                <th className="border-b border-gray-100 px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-500">
                    Загружаем предложения...
                  </td>
                </tr>
              ) : offers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-500">
                    Предложения не найдены.
                  </td>
                </tr>
              ) : (
                offers.map(offer => {
                  const status = statusBadge[offer.status];

                  return (
                    <tr key={offer.id} className="hover:bg-gray-50/70">
                      <td className="sticky left-0 z-[1] border-b border-r border-gray-100 bg-white px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          {offer.mediaPreviewUrl ? (
                            <img src={offer.mediaPreviewUrl} alt="" className="h-10 w-10 shrink-0 rounded-md border border-gray-200 object-cover" />
                          ) : (
                            <span className="h-10 w-10 shrink-0 rounded-md border border-dashed border-gray-200 bg-gray-50" />
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-gray-900">{offer.title}</p>
                            <p className="truncate text-[11px] text-gray-500">
                              {offerTypeLabel(offer.offerType)} · {bookingFlowLabel(offer.bookingFlowType)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="border-b border-gray-100 px-4 py-2.5 text-sm text-gray-700">{resourceTitleOf(offer)}</td>
                      <td className="border-b border-gray-100 px-4 py-2.5 text-right text-sm text-gray-700">
                        {typeof offer.basePrice === 'number' ? offer.basePrice.toLocaleString() : '—'} {offer.currency}
                      </td>
                      <td className="border-b border-gray-100 px-4 py-2.5">
                        <OfferReadinessChecklist offer={offer} compact />
                      </td>
                      <td className="border-b border-gray-100 px-4 py-2.5">
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </td>
                      <td className="border-b border-gray-100 px-4 py-2.5 text-sm text-gray-700">
                        {new Date(offer.updatedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                      </td>
                      <td className="border-b border-gray-100 px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => onOpenDetail(offer)}
                            className="rounded-md border border-gray-200 bg-white p-1.5 text-gray-500 transition hover:text-gray-800"
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onEdit(offer)}
                            className="rounded-md border border-gray-200 bg-white p-1.5 text-gray-500 transition hover:text-gray-800"
                          >
                            <Edit2 size={13} />
                          </button>
                          {offer.status === 'active' ? (
                            <button
                              type="button"
                              onClick={() => onStatusChange(offer, 'inactive')}
                              disabled={saving}
                              className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-600 transition hover:text-gray-900 disabled:opacity-50"
                            >
                              Отключить
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onStatusChange(offer, 'active')}
                              disabled={saving || !offerBookingSetupReady(offer)}
                              className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-600 transition hover:text-gray-900 disabled:opacity-50"
                            >
                              Включить
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
