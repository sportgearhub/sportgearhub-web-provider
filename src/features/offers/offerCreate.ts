import { offerAvailabilityApi, offersApi, pricingApi } from '../../lib/api-client';
import type { Offer } from '../../types';
import { toHhMm } from '../../components/ui/TimeSelect';
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

  // Availability is optional — only persist when the provider added at least one window.
  if (data.availabilityWindows?.length) {
    await offerAvailabilityApi.put(offer.offerId, {
      timezone: data.timezone?.trim() || 'Asia/Yekaterinburg',
      availabilityWindows: data.availabilityWindows.map(w => ({
        ...w,
        dailyOpensAt: `${toHhMm(w.dailyOpensAt)}:00`,
        dailyClosesAt: `${toHhMm(w.dailyClosesAt)}:00`,
      })),
      blockedPeriods: data.blockedPeriods ?? [],
      minRentHours: data.minRentHours ?? 1,
      maxRentHours: data.maxRentHours ?? 24,
      status: data.availabilityStatus || 'active',
    });
  }

  // Visibility — only persist when it differs from the default "always visible".
  if (data.visibilityMode && data.visibilityMode !== 'always_visible') {
    await offersApi.putVisibility(offer.offerId, {
      visibilityMode: data.visibilityMode,
      visibleFrom: data.visibleFrom ?? null,
      visibleUntil: data.visibleUntil ?? null,
      status: 'active',
    });
  }

  // Info sections — only persist when the provider listed something.
  if (data.infoSections?.length) {
    await offersApi.putInfoSections(offer.offerId, data.infoSections);
  }

  return offer;
}
