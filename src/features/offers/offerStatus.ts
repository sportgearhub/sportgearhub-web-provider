import type { Offer, OfferStatus } from '../../types';

/**
 * The offer's place in the world, in the API's own words. `paused` is the seller's switch;
 * `suspended` is the platform's, and `ActivateOfferAsync` refuses to lift it, so the console
 * shows it and offers nothing.
 */
export const offerStatusBadge: Record<OfferStatus, { label: string; variant: 'green' | 'yellow' | 'gray' | 'blue' | 'red' }> = {
  active: { label: 'Активно', variant: 'green' },
  draft: { label: 'Черновик', variant: 'yellow' },
  paused: { label: 'На паузе', variant: 'gray' },
  suspended: { label: 'Остановлено платформой', variant: 'red' },
  archived: { label: 'В архиве', variant: 'gray' },
};

export const offerStatusFilterOptions = [
  { value: '', label: 'Все статусы' },
  { value: 'active', label: 'Активно' },
  { value: 'draft', label: 'Черновик' },
  { value: 'paused', label: 'На паузе' },
  { value: 'suspended', label: 'Остановлено платформой' },
  { value: 'archived', label: 'В архиве' },
];

/** Whether the seller may publish or pause it themselves. A platform suspension is not theirs to lift. */
export function offerIsSellerControlled(offer: Pick<Offer, 'status'>) {
  return offer.status !== 'suspended' && offer.status !== 'archived';
}
