import { useEffect, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { ApiError, offersApi, pricingApi } from '../../lib/api-client';
import type { Offer, OfferStatus, Resource } from '../../types';
import { OfferAvailabilityView } from '../offers/OfferAvailabilityView';
import { OfferPolicyTab } from '../offers/OfferPolicyTab';
import { OfferDetail } from '../offers/OfferDetail';
import { OfferForm, type OfferFormData } from '../offers/OfferForm';
import { createOfferWithSetup } from '../offers/offerCreate';
import { attachOfferReadiness, attachOffersReadiness } from '../offers/offerReadiness';

type OffersView = 'detail' | 'edit' | 'availability' | 'policy';

function mergeOfferPricing(offer: Offer, data: OfferFormData): Offer {
  return {
    ...offer,
    basePrice: data.pricingBaseAmount,
    price: data.pricingBaseAmount ?? null,
    currency: data.pricingCurrency || 'RUB',
  };
}

async function enrichOfferPrice(offer: Offer): Promise<Offer> {
  try {
    const policy = await pricingApi.getOfferPolicy(offer.offerId);
    return {
      ...offer,
      basePrice: policy.baseAmount ?? policy.unitRules?.baseAmount,
      price: policy.baseAmount ?? policy.unitRules?.baseAmount ?? null,
      currency: policy.currency || offer.currency || 'RUB',
    };
  } catch {
    return offer;
  }
}

interface ResourceOffersTabProps {
  resource: Resource;
  onNavigate?: (path: string) => void;
}

export function ResourceOffersTab({ resource, onNavigate }: ResourceOffersTabProps) {
  // One offer per resource: `offer` is the resource's single offer (or null).
  const [offer, setOffer] = useState<Offer | null>(null);
  const [view, setView] = useState<OffersView>('detail');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadOffer = async (resetView = true) => {
    setLoading(true);
    setError('');
    try {
      const allOffers = await offersApi.list();
      const resourceOffer = allOffers.find(item => item.primaryResourceId === resource.resourceId || item.resourceId === resource.resourceId);
      if (!resourceOffer) {
        setOffer(null);
        return;
      }
      const [enriched] = await attachOffersReadiness([await enrichOfferPrice(resourceOffer)]);
      setOffer(enriched);
      if (resetView) setView('detail');
    } catch (err) {
      setError(err instanceof ApiError ? `Не удалось загрузить предложение: ${err.message}` : 'Не удалось загрузить предложение.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOffer();
  }, [resource.resourceId]);

  const handleCreate = async (data: OfferFormData) => {
    setSaving(true);
    setError('');
    try {
      await createOfferWithSetup(
        { ...data, title: data.title || `Прокат: ${resource.title}` },
        { resourceFallback: resource.resourceId }
      );
      await loadOffer();
    } catch (err) {
      setError(err instanceof ApiError ? `Не удалось создать предложение: ${err.message}` : 'Не удалось создать предложение.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (data: OfferFormData) => {
    if (!offer) return;
    setSaving(true);
    setError('');
    try {
      const nextOffer = await offersApi.patch(offer.offerId, {
        title: data.title,
        description: data.description,
        fulfillmentLocationId: data.fulfillmentLocationId ?? null,
      });
      await pricingApi.putOfferPolicy(offer.offerId, {
        pricingMode: data.pricingMode || 'rental_tiers',
        currency: data.pricingCurrency || 'RUB',
        baseAmount: data.pricingMode === 'rental_tiers' ? null : (data.pricingBaseAmount ?? null),
        rentalTiers: data.pricingMode === 'rental_tiers' ? (data.rentalTiers ?? null) : null,
        multiDayRate: data.pricingMode === 'rental_tiers' ? (data.multiDayRate ?? null) : null,
        status: data.pricingStatus || 'active',
      });
      await offersApi.putInclusions(offer.offerId, { included: data.included ?? [], excluded: data.excluded ?? [] });
      setOffer(mergeOfferPricing(await attachOfferReadiness(nextOffer), data));
      setView('detail');
    } catch (err) {
      setError(err instanceof ApiError ? `Не удалось обновить предложение: ${err.message}` : 'Не удалось обновить предложение.');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (status: OfferStatus) => {
    if (!offer) return;
    setSaving(true);
    setError('');
    try {
      const nextOffer =
        status === 'active'
          ? await offersApi.activate(offer.offerId)
          : status === 'inactive'
            ? await offersApi.deactivate(offer.offerId)
            : status === 'archived'
              ? await offersApi.archive(offer.offerId, 'provider_requested')
              : await offersApi.patch(offer.offerId, {});
      setOffer(await attachOfferReadiness(nextOffer));
    } catch (err) {
      setError(err instanceof ApiError ? `Не удалось изменить статус предложения: ${err.message}` : 'Не удалось изменить статус предложения.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-sm text-gray-500">Загружаем предложение...</div>;
  }

  if (error && !offer) {
    return (
      <div className="p-6">
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
      </div>
    );
  }

  // No offer yet → show the creation form directly on the tab.
  if (!offer) {
    return (
      <div className="px-4 py-6 sm:px-6">
        {error && <div className="mx-auto mb-4 max-w-3xl rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
        <OfferForm
          resources={[resource]}
          initialResourceId={resource.resourceId}
          hideOfferType
          onSubmit={handleCreate}
          onCancel={() => onNavigate?.(`/resources/${resource.resourceId}`)}
          submitting={saving}
        />
      </div>
    );
  }

  if (view === 'availability') {
    return <OfferAvailabilityView offer={offer} onBack={() => setView('detail')} />;
  }

  if (view === 'policy') {
    return (
      <div>
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Правила</h3>
            <p className="mt-0.5 text-xs text-gray-500">{offer.title}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setView('detail')}>Назад</Button>
        </div>
        <OfferPolicyTab offer={offer} />
      </div>
    );
  }

  if (view === 'edit') {
    return (
      <div className="px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-2xl">
          <BackButton onClick={() => setView('detail')} />
        </div>
        <OfferForm
          offer={offer}
          resources={[resource]}
          initialResourceId={resource.resourceId}
          onSubmit={handleUpdate}
          onCancel={() => setView('detail')}
          submitting={saving}
        />
      </div>
    );
  }

  return (
    <OfferDetail
      offer={offer}
      onConfigurePolicy={() => setView('policy')}
      onEdit={() => setView('edit')}
      onStatusChange={status => void handleStatusChange(status)}
      onOpenAvailability={() => setView('availability')}
      onOpenPolicy={() => setView('policy')}
    />
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mb-2 flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800">
      <ChevronLeft size={14} /> Назад к предложению
    </button>
  );
}
