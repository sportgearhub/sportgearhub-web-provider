import { useEffect, useState } from 'react';
import { ApiError, offersApi, pricingApi } from '../../lib/api-client';
import type { Offer, OfferStatus, Resource } from '../../types';
import { OfferDetail } from '../offers/OfferDetail';
import { OfferForm, type OfferFormData } from '../offers/OfferForm';
import { createOfferWithSetup } from '../offers/offerCreate';
import { attachOfferReadiness, attachOffersReadiness } from '../offers/offerReadiness';

async function enrichOfferPrice(offer: Offer): Promise<Offer> {
  try {
    const policy = await pricingApi.getOfferPolicy(offer.offerId);
    return {
      ...offer,
      basePrice: policy.baseAmount ?? undefined,
      price: policy.baseAmount ?? null,
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadOffer = async () => {
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

  const handleStatusChange = async (status: OfferStatus) => {
    if (!offer) return;
    setSaving(true);
    setError('');
    try {
      const nextOffer =
        status === 'active'
          ? await offersApi.activate(offer.offerId)
          : status === 'paused'
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

  return (
    <OfferDetail
      offer={offer}
      onConfigurePolicy={() => onNavigate?.(`/offers/${offer.offerId}/policy`)}
      onEdit={() => onNavigate?.(`/offers/${offer.offerId}/edit`)}
      onStatusChange={status => void handleStatusChange(status)}
      onOpenAvailability={() => onNavigate?.(`/offers/${offer.offerId}/availability`)}
      onOpenPolicy={() => onNavigate?.(`/offers/${offer.offerId}/policy`)}
    />
  );
}
