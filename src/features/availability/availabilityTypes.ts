import type {
  OfferAvailability,
  OfferAvailabilityBlockedPeriod,
  OfferAvailabilityWindow,
  Resource,
  ResourceUnit,
} from '../../types';

export const DEFAULT_TIMEZONE = 'Asia/Yekaterinburg';

export const availabilityStatusOptions = [
  { value: 'active', label: 'Да, принимать' },
  { value: 'inactive', label: 'Нет, временно закрыто' },
];

export type SlotForm = {
  title: string;
  startsAt: string;
  endsAt: string;
  totalCapacity: string;
  meetingPoint: string;
};

// The whole offer availability contract travels in one PUT, so the working windows and the blocked
// periods live in the form alongside the scalar settings rather than in a separate resource calendar.
export type OfferAvailabilityForm = {
  timezone: string;
  status: string;
  slotIntervalMinutes: string;
  windows: OfferAvailabilityWindow[];
  blockedPeriods: OfferAvailabilityBlockedPeriod[];
};

export function emptyOfferAvailabilityForm(): OfferAvailabilityForm {
  return {
    timezone: DEFAULT_TIMEZONE,
    status: 'active',
    slotIntervalMinutes: '',
    windows: [],
    blockedPeriods: [],
  };
}

export function offerAvailabilityToForm(avail: OfferAvailability): OfferAvailabilityForm {
  return {
    timezone: avail.timezone || DEFAULT_TIMEZONE,
    status: avail.status || 'active',
    slotIntervalMinutes: avail.slotIntervalMinutes === null || avail.slotIntervalMinutes === undefined
      ? ''
      : String(avail.slotIntervalMinutes),
    windows: avail.availabilityWindows ?? [],
    blockedPeriods: avail.blockedPeriods ?? [],
  };
}

export function emptyAvailabilityWindow(): OfferAvailabilityWindow {
  return {
    startsOn: todayIso(),
    endsOn: todayIso(),
    dailyOpensAt: '10:00',
    dailyClosesAt: '20:00',
  };
}

export function emptyBlockedPeriod(): OfferAvailabilityBlockedPeriod {
  return { startsOn: todayIso(), endsOn: todayIso(), reasonCode: 'provider_closed' };
}

/** `<input type="time">` accepts "HH:mm" and "HH:mm:ss"; the API answers with seconds. */
export function toTimeInput(value: string | null | undefined) {
  return (value ?? '').slice(0, 5);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
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
