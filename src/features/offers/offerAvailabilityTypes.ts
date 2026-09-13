import type { OfferAvailability } from '../../types';

export const DEFAULT_TIMEZONE = 'Asia/Yekaterinburg';

export const availabilityStatusOptions = [
  { value: 'active', label: 'Да, принимать' },
  { value: 'inactive', label: 'Нет, временно закрыто' },
];

/** Scalar settings of the offer availability contract; windows and blocked periods are edited as lists. */
export type OfferAvailabilityForm = {
  timezone: string;
  status: string;
  slotIntervalMinutes: string;
};

export function emptyOfferAvailabilityForm(): OfferAvailabilityForm {
  return { timezone: DEFAULT_TIMEZONE, status: 'active', slotIntervalMinutes: '' };
}

export function offerAvailabilityToForm(avail: OfferAvailability): OfferAvailabilityForm {
  return {
    timezone: avail.timezone || DEFAULT_TIMEZONE,
    status: avail.status || 'active',
    slotIntervalMinutes: avail.slotIntervalMinutes === null || avail.slotIntervalMinutes === undefined
      ? ''
      : String(avail.slotIntervalMinutes),
  };
}
