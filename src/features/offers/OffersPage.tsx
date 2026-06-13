import { useEffect, useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { ActionMenu } from '../../components/ui/ActionMenu';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { ApiError, offersApi, pricingApi, resourcesApi } from '../../lib/api-client';
import type { Offer, OfferStatus, Resource } from '../../types';
import { OfferAvailabilityView } from './OfferAvailabilityView';
import { OfferDetail } from './OfferDetail';
import { createOfferWithSetup } from './offerCreate';
import { OfferForm, type OfferFormData } from './OfferForm';
import { OfferPolicyTab } from './OfferPolicyTab';
import { attachOfferReadiness, attachOffersReadiness, offerBookingSetupReady, offerCustomerVisible } from './offerReadiness';
import { bookingFlowLabel, offerTypeLabel } from './offerDisplay';

type View = 'list' | 'detail' | 'create' | 'edit' | 'availability' | 'policy';

const statusBadge: Record<OfferStatus, { label: string; variant: 'green' | 'yellow' | 'gray' | 'blue' }> = {
  active: { label: 'Активно', variant: 'green' },
  draft: { label: 'Черновик', variant: 'yellow' },
  inactive: { label: 'Неактивно', variant: 'gray' },
  archived: { label: 'В архиве', variant: 'gray' },
};

function mergeOfferPricing(offer: Offer, data: OfferFormData): Offer {
  return { ...offer, basePrice: data.pricingBaseAmount, price: data.pricingBaseAmount ?? null, currency: data.pricingCurrency || 'RUB' };
}

async function enrichOfferPrices(offers: Offer[]) {
  return Promise.all(offers.map(async offer => {
    try {
      const policy = await pricingApi.getOfferPolicy(offer.offerId);
      return { ...offer, basePrice: policy.baseAmount ?? policy.unitRules?.baseAmount, price: policy.baseAmount ?? policy.unitRules?.baseAmount ?? null, currency: policy.currency || offer.currency || 'RUB' };
    } catch {
      return offer;
    }
  }));
}

export function OffersPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [query, setQuery] = useState('');
  const [view, setView] = useState<View>('list');
  const [selected, setSelected] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const resourceById = useMemo(() => new Map(resources.map(r => [r.resourceId, r])), [resources]);
  const resourceOptions = useMemo(() => [
    { value: '', label: 'Весь инвентарь' },
    ...resources.map(r => ({ value: r.resourceId, label: r.title })),
  ], [resources]);

  const loadData = async () => {
    setError('');
    setLoading(true);
    try {
      const [nextResources, nextOffers] = await Promise.all([resourcesApi.list(), offersApi.list()]);
      setResources(nextResources);
      setOffers(await attachOffersReadiness(await enrichOfferPrices(nextOffers)));
    } catch (err) {
      setError(err instanceof ApiError ? `Не удалось загрузить: ${err.message}` : 'Не удалось загрузить предложения.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadData(); }, []);

  const filtered = offers.filter(offer => {
    const matchesStatus = !statusFilter || offer.status === statusFilter;
    const matchesResource = !resourceFilter || offer.primaryResourceId === resourceFilter || offer.resourceId === resourceFilter;
    const resourceTitle = resourceById.get(offer.primaryResourceId)?.title ?? offer.resourceTitle ?? '';
    const matchesQuery = !query || [offer.title, resourceTitle, offer.offerId].join(' ').toLowerCase().includes(query.toLowerCase());
    return matchesStatus && matchesResource && matchesQuery;
  });

  const resourceTitleOf = (offer: Offer) =>
    resourceById.get(offer.primaryResourceId)?.title || offer.resourceTitle || offer.primaryResourceId || '—';

  const updateOfferInState = (nextOffer: Offer) => {
    setOffers(prev => prev.map(o => (o.offerId === nextOffer.offerId ? nextOffer : o)));
    setSelected(cur => cur?.offerId === nextOffer.offerId ? nextOffer : cur);
  };

  const openDetail = (offer: Offer) => { setSelected(offer); setView('detail'); };
  const openList = () => { setView('list'); setSelected(null); setError(''); };

  const handleCreate = async (data: OfferFormData) => {
    setError(''); setSaving(true);
    try {
      const nextOffer = await createOfferWithSetup(data, { resourceFallback: resourceFilter || '' });
      const readyOffer = await attachOfferReadiness(nextOffer);
      setOffers(prev => [mergeOfferPricing(readyOffer, data), ...prev]);
      openList();
    } catch (err) {
      setError(err instanceof ApiError ? `Не удалось создать: ${err.message}` : 'Не удалось создать предложение.');
    } finally { setSaving(false); }
  };

  const handleUpdate = async (data: OfferFormData) => {
    if (!selected) return;
    setError(''); setSaving(true);
    try {
      const nextOffer = await offersApi.patch(selected.offerId, { title: data.title, description: data.description, fulfillmentLocationId: data.fulfillmentLocationId ?? null });
      await pricingApi.putOfferPolicy(selected.offerId, {
        pricingMode: data.pricingMode || 'rental_tiers',
        currency: data.pricingCurrency || 'RUB',
        baseAmount: data.pricingMode === 'rental_tiers' ? null : (data.pricingBaseAmount ?? null),
        rentalTiers: data.pricingMode === 'rental_tiers' ? (data.rentalTiers ?? null) : null,
        multiDayRate: data.pricingMode === 'rental_tiers' ? (data.multiDayRate ?? null) : null,
        status: data.pricingStatus || 'active',
      });
      await offersApi.putInclusions(selected.offerId, { included: data.included ?? [], excluded: data.excluded ?? [] });
      updateOfferInState(mergeOfferPricing(await attachOfferReadiness(nextOffer), data));
      setView('detail');
    } catch (err) {
      setError(err instanceof ApiError ? `Не удалось сохранить: ${err.message}` : 'Не удалось сохранить предложение.');
    } finally { setSaving(false); }
  };

  const handleStatusChange = async (offer: Offer, status: OfferStatus) => {
    setError(''); setSaving(true);
    try {
      const nextOffer = status === 'active' ? await offersApi.activate(offer.offerId)
        : status === 'inactive' ? await offersApi.deactivate(offer.offerId)
        : status === 'archived' ? await offersApi.archive(offer.offerId, 'provider_requested')
        : await offersApi.patch(offer.offerId, {});
      updateOfferInState(await attachOfferReadiness(nextOffer));
    } catch (err) {
      setError(err instanceof ApiError ? `Не удалось изменить статус: ${err.message}` : 'Не удалось изменить статус.');
    } finally { setSaving(false); }
  };

  // ── Edit view ──────────────────────────────────────────────────────────────
  if (view === 'edit' && selected) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-3">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setView('detail')} className="text-xs text-gray-500 hover:text-gray-800">← Назад</button>
            <h3 className="text-sm font-semibold text-gray-900">Редактировать предложение</h3>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          <OfferForm offer={selected} resources={resources} onSubmit={handleUpdate} onCancel={() => setView('detail')} submitting={saving} />
        </div>
      </div>
    );
  }

  // ── Availability sub-view ────────────────────────────────────────────────────
  if (view === 'availability' && selected) {
    return <OfferAvailabilityView offer={selected} onBack={() => setView('detail')} />;
  }

  // ── Policy sub-view ──────────────────────────────────────────────────────────
  if (view === 'policy' && selected) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Правила</h3>
            <p className="mt-0.5 text-xs text-gray-500">{selected.title}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setView('detail')}>Назад</Button>
        </div>
        <div className="flex-1 overflow-auto">
          <OfferPolicyTab offer={selected} />
        </div>
      </div>
    );
  }

  // ── Detail view ────────────────────────────────────────────────────────────
  if (view === 'detail' && selected) {
    return (
      <div className="flex h-full flex-col overflow-auto">
        <OfferDetail
          offer={selected}
          onBack={openList}
          onEdit={() => setView('edit')}
          onStatusChange={status => void handleStatusChange(selected, status)}
          onConfigurePolicy={() => setView('policy')}
          onOpenAvailability={() => setView('availability')}
          onOpenPolicy={() => setView('policy')}
        />
      </div>
    );
  }

  // ── Create view ────────────────────────────────────────────────────────────
  if (view === 'create') {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-3">
          <div className="flex items-center gap-3">
            <button type="button" onClick={openList} className="text-xs text-gray-500 hover:text-gray-800">← Назад</button>
            <h3 className="text-sm font-semibold text-gray-900">Новое предложение</h3>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          <OfferForm resources={resources} onSubmit={handleCreate} onCancel={openList} initialResourceId={resourceFilter || undefined} submitting={saving} />
        </div>
      </div>
    );
  }

  // ── List view ──────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      {/* Nav bar */}
      <nav className="border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between px-6 py-3">
          <div>
            <h1 className="text-sm font-semibold text-gray-900">Предложения</h1>
            <p className="text-xs text-gray-500">
              {loading ? 'Загружаем...' : `${filtered.length} из ${offers.length} · видно клиентам: ${filtered.filter(offerCustomerVisible).length}`}
            </p>
          </div>
          <div className="flex items-center gap-2 mx-6 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Поиск по предложениям..."
                className="w-full rounded border border-gray-300 bg-white px-8 py-2 text-sm text-gray-900 transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <Select
              options={[{ value: '', label: 'Все статусы' }, { value: 'active', label: 'Активно' }, { value: 'draft', label: 'Черновик' }, { value: 'inactive', label: 'Неактивно' }]}
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            />
            <Select options={resourceOptions} value={resourceFilter} onChange={e => setResourceFilter(e.target.value)} />
          </div>
          <Button variant="primary" size="sm" onClick={() => setView('create')}>
            <Plus size={13} /> Добавить
          </Button>
        </div>
      </nav>

      {error && (
        <div className="border-b border-red-200 bg-red-50 px-6 py-2 text-xs text-red-700">{error}</div>
      )}

      {/* Table */}
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full table-fixed border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-gray-50">
            <tr className="border-b border-gray-200">
              <th className="w-[30%] px-4 py-2 text-left text-xs font-semibold text-gray-700">Предложение</th>
              <th className="w-[20%] px-4 py-2 text-left text-xs font-semibold text-gray-700">Инвентарь</th>
              <th className="w-[12%] px-4 py-2 text-right text-xs font-semibold text-gray-700">Цена</th>
              <th className="w-[14%] px-4 py-2 text-left text-xs font-semibold text-gray-700">Статус</th>
              <th className="w-[18%] px-4 py-2 text-left text-xs font-semibold text-gray-700">Готовность</th>
              <th className="w-[6%] px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-500">Загружаем предложения...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-500">Предложения не найдены.</td></tr>
            ) : filtered.map(offer => {
              const sb = statusBadge[offer.status];
              const ready = offerBookingSetupReady(offer);
              return (
                <tr
                  key={offer.offerId}
                  className="cursor-pointer border-b border-gray-100 hover:bg-gray-50"
                  onClick={() => openDetail(offer)}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      {offer.mediaPreviewUrl ? (
                        <img src={offer.mediaPreviewUrl} alt="" className="h-8 w-8 shrink-0 rounded border border-gray-200 object-cover" />
                      ) : (
                        <span className="h-8 w-8 shrink-0 rounded border border-dashed border-gray-200 bg-gray-50" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-medium text-gray-900">{offer.title}</p>
                        <p className="truncate text-xs text-gray-500">{offerTypeLabel(offer.offerType)} · {bookingFlowLabel(offer.bookingFlowType)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="truncate px-4 py-2.5 text-sm text-gray-700">{resourceTitleOf(offer)}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-gray-900">
                    {typeof offer.basePrice === 'number' ? `${offer.basePrice.toLocaleString()} ${offer.currency ?? 'RUB'}` : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant={sb.variant}>{sb.label}</Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs font-medium ${ready ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {ready ? 'Готово' : 'Не настроено'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                    <ActionMenu
                      label={`Действия с ${offer.title}`}
                      disabled={saving}
                      className="justify-end"
                      items={[
                        { label: 'Открыть', onClick: () => openDetail(offer) },
                        offer.status === 'active'
                          ? { label: 'Отключить', onClick: () => void handleStatusChange(offer, 'inactive'), disabled: saving }
                          : { label: 'Включить', onClick: () => void handleStatusChange(offer, 'active'), disabled: saving || !offerBookingSetupReady(offer) },
                        { label: 'В архив', onClick: () => void handleStatusChange(offer, 'archived'), danger: true, disabled: saving },
                      ]}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
