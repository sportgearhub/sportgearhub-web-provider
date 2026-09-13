// The API validates these against a closed list (see AllowedPricingModes / AllowedPricingStatuses in the
// provider configuration service): anything else comes back as a 400. `/offers/authoring-options` serves
// the modes too, so prefer those when a screen has them loaded and use these as the fallback.
export const PRICING_MODE_OPTIONS = [
  { value: 'rental_tiers', label: 'По тарифным ступеням' },
  { value: 'fixed', label: 'Фиксированная' },
  { value: 'per_participant', label: 'За участника' },
];

export const PRICING_STATUS_OPTIONS = [
  { value: 'active', label: 'Активна' },
  { value: 'superseded', label: 'Заменена' },
  { value: 'archived', label: 'В архиве' },
];

export const DEFAULT_PRICING_MODE = 'rental_tiers';

export function baseAmountLabel(pricingMode: string) {
  return pricingMode === 'per_participant' ? 'Цена за участника' : 'Базовая цена';
}
