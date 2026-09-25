import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ApiError, offersApi, pricingApi } from '../../lib/api-client';
import type { Offer, OfferStatus, Resource } from '../../types';
import { resourcesApi } from '../../lib/api-client';
import { SectionPage } from '../../components/layout/SectionPage';
import { Button } from '../../components/ui/Button';
import { OfferAvailabilityEdit } from './OfferAvailabilityEdit';
import { OfferAvailabilityRead } from './OfferAvailabilityRead';
import { OfferDetail } from './OfferDetail';
import { OfferForm, type OfferFormData } from './OfferForm';
import { OfferPolicyTab } from './OfferPolicyTab';
import { createOfferWithSetup } from './offerCreate';
import { attachOfferReadiness } from './offerReadiness';

/** Every offer page is addressable, so each one loads its own offer from the id in the URL. */
function useOffer(offerId: string) {
  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    offersApi.get(offerId)
      .then(async next => {
        const withReadiness = await attachOfferReadiness(next);
        if (!cancelled) setOffer(withReadiness);
      })
      .catch(err => {
        if (!cancelled) {
          setError(err instanceof ApiError && err.status === 404
            ? 'Предложение не найдено — возможно, оно удалено.'
            : err instanceof ApiError ? err.message : 'Не удалось загрузить предложение.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [offerId]);

  return { offer, setOffer, loading, error };
}

function OfferFrame({
  offerId,
  onNavigate,
  children,
}: {
  offerId: string;
  onNavigate: (path: string) => void;
  children: (offer: Offer, setOffer: (offer: Offer) => void) => ReactNode;
}) {
  const { offer, setOffer, loading, error } = useOffer(offerId);

  if (loading) return <p className="p-6 text-sm text-gray-500">Загружаем предложение...</p>;
  if (!offer) {
    return (
      <SectionPage title="Предложение" error={error} breadcrumb={{ label: 'Предложения', path: '/offers' }} onNavigate={onNavigate}>
        <Button variant="secondary" onClick={() => onNavigate('/offers')}>К списку предложений</Button>
      </SectionPage>
    );
  }
  return <>{children(offer, setOffer)}</>;
}

export function OfferDetailRoute({ offerId, onNavigate }: { offerId: string; onNavigate: (path: string) => void }) {
  const [error, setError] = useState('');

  return (
    <OfferFrame offerId={offerId} onNavigate={onNavigate}>
      {(offer, setOffer) => (
        <div className="flex min-h-0 flex-1 flex-col overflow-auto">
          {error && <p className="mx-6 mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <OfferDetail
            offer={offer}
            onBack={() => onNavigate('/offers')}
            onEdit={() => onNavigate(`/offers/${offerId}/edit`)}
            onStatusChange={status => void changeStatus(offer, status, setOffer, setError)}
            onConfigurePolicy={() => onNavigate(`/offers/${offerId}/policy`)}
            onOpenAvailability={() => onNavigate(`/offers/${offerId}/availability`)}
            onOpenPolicy={() => onNavigate(`/offers/${offerId}/policy`)}
          />
        </div>
      )}
    </OfferFrame>
  );
}

async function changeStatus(
  offer: Offer,
  status: OfferStatus,
  setOffer: (offer: Offer) => void,
  setError: (message: string) => void
) {
  setError('');
  try {
    const next = status === 'active' ? await offersApi.activate(offer.offerId)
      : status === 'paused' ? await offersApi.deactivate(offer.offerId)
      : status === 'archived' ? await offersApi.archive(offer.offerId, 'provider_requested')
      : await offersApi.patch(offer.offerId, {});
    setOffer(await attachOfferReadiness(next));
  } catch (err) {
    setError(err instanceof ApiError ? `Не удалось изменить статус: ${err.message}` : 'Не удалось изменить статус.');
  }
}

export function OfferEditRoute({ offerId, onNavigate }: { offerId: string; onNavigate: (path: string) => void }) {
  const [resources, setResources] = useState<Resource[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    resourcesApi.list().then(setResources).catch(() => setResources([]));
  }, []);

  const submit = async (offer: Offer, data: OfferFormData) => {
    setSaving(true);
    setError('');
    try {
      await offersApi.patch(offer.offerId, {
        title: data.title,
        description: data.description,
        fulfillmentLocationId: data.fulfillmentLocationId ?? null,
      });
      await pricingApi.putOfferPolicy(offer.offerId, {
        pricingMode: data.pricingMode || 'rental_tiers',
        currency: data.pricingCurrency || 'RUB',
        baseAmount: data.pricingMode === 'rental_tiers' ? null : (data.pricingBaseAmount ?? null),
        rentalTiers: data.pricingMode === 'rental_tiers' ? (data.rentalTiers ?? null) : null,
        status: data.pricingStatus || 'active',
      });
      await offersApi.putInfoSections(offer.offerId, data.infoSections ?? []);
      onNavigate(`/offers/${offer.offerId}`);
    } catch (err) {
      setError(err instanceof ApiError ? `Не удалось сохранить: ${err.message}` : 'Не удалось сохранить предложение.');
      setSaving(false);
    }
  };

  return (
    <OfferFrame offerId={offerId} onNavigate={onNavigate}>
      {offer => (
        <SectionPage
          title="Редактирование предложения"
          description={offer.title}
          breadcrumb={{ label: 'Предложение', path: `/offers/${offerId}` }}
          onNavigate={onNavigate}
        >
          <OfferForm
            offer={offer}
            resources={resources}
            submitting={saving}
            submitError={error}
            onSubmit={data => void submit(offer, data)}
            onCancel={() => onNavigate(`/offers/${offerId}`)}
          />
        </SectionPage>
      )}
    </OfferFrame>
  );
}

export function OfferAvailabilityRoute({ offerId, onNavigate }: { offerId: string; onNavigate: (path: string) => void }) {
  return (
    <OfferFrame offerId={offerId} onNavigate={onNavigate}>
      {offer => <OfferAvailabilityRead offer={offer} onNavigate={onNavigate} />}
    </OfferFrame>
  );
}

export function OfferAvailabilityEditRoute({ offerId, onNavigate }: { offerId: string; onNavigate: (path: string) => void }) {
  return (
    <OfferFrame offerId={offerId} onNavigate={onNavigate}>
      {offer => <OfferAvailabilityEdit offer={offer} onNavigate={onNavigate} />}
    </OfferFrame>
  );
}

export function OfferPolicyRoute({ offerId, onNavigate }: { offerId: string; onNavigate: (path: string) => void }) {
  return (
    <OfferFrame offerId={offerId} onNavigate={onNavigate}>
      {offer => (
        <SectionPage
          title="Правила"
          description={offer.title}
          breadcrumb={{ label: 'Предложение', path: `/offers/${offerId}` }}
          onNavigate={onNavigate}
        >
          <OfferPolicyTab offer={offer} />
        </SectionPage>
      )}
    </OfferFrame>
  );
}

export function OfferCreateRoute({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [resources, setResources] = useState<Resource[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    resourcesApi.list().then(setResources).catch(() => setResources([]));
  }, []);

  const submit = async (data: OfferFormData) => {
    setSaving(true);
    setError('');
    try {
      const offer = await createOfferWithSetup(data);
      onNavigate(`/offers/${offer.offerId}`);
    } catch (err) {
      setError(err instanceof ApiError ? `Не удалось создать: ${err.message}` : 'Не удалось создать предложение.');
      setSaving(false);
    }
  };

  return (
    <SectionPage
      title="Новое предложение"
      breadcrumb={{ label: 'Предложения', path: '/offers' }}
      onNavigate={onNavigate}
    >
      <OfferForm
        resources={resources}
        submitting={saving}
        submitError={error}
        onSubmit={data => void submit(data)}
        onCancel={() => onNavigate('/offers')}
      />
    </SectionPage>
  );
}
