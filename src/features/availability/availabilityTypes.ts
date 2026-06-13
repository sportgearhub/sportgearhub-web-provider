import type { AvailabilityCalendar, AvailabilityProfile, OfferAvailability, Resource, ResourceUnit } from '../../types';

export const DEFAULT_TIMEZONE = 'Asia/Yekaterinburg';

export const availabilityStatusOptions = [
  { value: 'active', label: 'Да, принимать' },
  { value: 'inactive', label: 'Нет, временно закрыто' },
];

export const dayOptions = [
  { value: 'monday', label: 'Пн' },
  { value: 'tuesday', label: 'Вт' },
  { value: 'wednesday', label: 'Ср' },
  { value: 'thursday', label: 'Чт' },
  { value: 'friday', label: 'Пт' },
  { value: 'saturday', label: 'Сб' },
  { value: 'sunday', label: 'Вс' },
];

export type ProfileForm = {
  availabilityMode: string;
  timezone: string;
  bookingHorizonDays: string;
  status: string;
};

export type SlotForm = {
  title: string;
  startsAt: string;
  endsAt: string;
  totalCapacity: string;
  meetingPoint: string;
};

export type OfferAvailabilityForm = {
  timezone: string;
  status: string;
  minRentHours: string;
  maxRentHours: string;
};

export function emptyOfferAvailabilityForm(): OfferAvailabilityForm {
  return { timezone: DEFAULT_TIMEZONE, status: 'active', minRentHours: '1', maxRentHours: '24' };
}

export function offerAvailabilityToForm(avail: OfferAvailability): OfferAvailabilityForm {
  return {
    timezone: avail.timezone || DEFAULT_TIMEZONE,
    status: avail.status || 'active',
    minRentHours: String(avail.minRentHours ?? 1),
    maxRentHours: String(avail.maxRentHours ?? 24),
  };
}

export type UnitForm = {
  unitId?: string;
  inventoryCode: string;
  notes: string;
  status: string;
  conditionStatus: string;
  externalReferenceCode: string;
};

export function availabilityModeFor(resource: Resource | null) {
  if (resource?.capacityMode === 'scheduled_slot') return 'scheduled_slot';
  return 'inventory';
}

export function modeLabel(mode: string) {
  return mode === 'scheduled_slot' ? 'По расписанию' : 'По наличию в инвентаре';
}

export function emptyProfileForm(mode: string): ProfileForm {
  return {
    availabilityMode: mode,
    timezone: DEFAULT_TIMEZONE,
    bookingHorizonDays: '30',
    status: 'active',
  };
}

export function profileToForm(profile: AvailabilityProfile, fallbackMode: string): ProfileForm {
  return {
    availabilityMode: profile.availabilityMode || fallbackMode,
    timezone: profile.timezone || DEFAULT_TIMEZONE,
    bookingHorizonDays: String(profile.bookingHorizonDays ?? 30),
    status: profile.status || 'active',
  };
}

export function emptyCalendar(): AvailabilityCalendar {
  return {
    timezone: DEFAULT_TIMEZONE,
    recurringRules: [],
    blockedPeriods: [],
    exceptions: [],
    updatedAt: new Date().toISOString(),
  };
}

export function emptySlotForm(): SlotForm {
  return {
    title: '',
    startsAt: '',
    endsAt: '',
    totalCapacity: '1',
    meetingPoint: '',
  };
}

export function emptyUnitForm(): UnitForm {
  return {
    inventoryCode: '',
    notes: '',
    status: 'available',
    conditionStatus: 'ready',
    externalReferenceCode: '',
  };
}

export function unitToForm(unit: ResourceUnit): UnitForm {
  return {
    unitId: unit.unitId,
    inventoryCode: unit.inventoryCode ?? '',
    notes: unit.notes ?? '',
    status: unit.status || 'available',
    conditionStatus: unit.conditionStatus || 'ready',
    externalReferenceCode: unit.externalReferenceCode ?? '',
  };
}

export function toDatetimeLocal(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromDatetimeLocal(value: string) {
  return value ? new Date(value).toISOString() : null;
}
