import { offersApi, pricingApi } from '../../lib/api-client';
import type { Offer } from '../../types';
import type { OfferFormData } from './OfferForm';

/**
 * Creates an offer and applies its full setup in one go: pricing policy,
 * availability windows and visibility. Shared by every "create offer" entry
 * point so the wizard's later steps are persisted consistently. Returns the
 * created offer.
 */
export async function createOfferWithSetup(
  data: OfferFormData,
  options: { resourceFallback?: string } = {}
): Promise<Offer> {
  const primaryResourceId = data.primaryResourceId || data.resourceId || options.resourceFallback || '';

  const offer = await offersApi.create({
    primaryResourceId,
    offerType: data.offerType || 'rental',
    bookingFlowType: data.bookingFlowType || 'direct_checkout',
    title: data.title || 'Новое предложение',
    description: data.description || undefined,
    durationHours: data.durationHours ?? null,
    fulfillmentLocationId: data.fulfillmentLocationId ?? null,
  });

  await pricingApi.putOfferPolicy(offer.offerId, {
    pricingMode: data.pricingMode || 'rental_tiers',
    currency: data.pricingCurrency || 'RUB',
    baseAmount: data.pricingMode === 'rental_tiers' ? null : (data.pricingBaseAmount ?? null),
    rentalTiers: data.pricingMode === 'rental_tiers' ? (data.rentalTiers ?? null) : null,
    status: data.pricingStatus || 'active',
  });



  // Info sections — only persist when the provider listed something.
  if (data.infoSections?.length) {
    await offersApi.putInfoSections(offer.offerId, data.infoSections);
  }

  return offer;
}
