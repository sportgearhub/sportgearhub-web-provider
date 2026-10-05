/**
 * Demo data for the Впечатления workspace.
 *
 * There is no API behind any of this yet. It lives in one file so the shape the screens assume is
 * written down in one place — when the endpoints arrive, this is the list of fields they have to
 * answer with, and every page stops importing from here.
 *
 * Dates are computed from today so the screens never look stale.
 */

export type ExperienceStatus = 'active' | 'draft' | 'paused';

export interface Experience {
  experienceId: string;
  title: string;
  status: ExperienceStatus;
  /** Minutes from meeting to finish — the first thing a customer filters on. */
  durationMinutes: number;
  pricePerPerson: number;
  /** Seats a single departure can hold. */
  capacity: number;
  meetingPoint: string;
  languages: string[];
  photoUrl: string | null;
  rating: number | null;
  reviews: number;
}

export interface Departure {
  departureId: string;
  experienceId: string;
  startsAt: string;
  booked: number;
  capacity: number;
  guide: string | null;
  status: 'scheduled' | 'cancelled';
}

export interface ExperienceBooking {
  bookingId: string;
  bookingNumber: string;
  experienceId: string;
  departureId: string;
  customerName: string;
  customerPhone: string;
  adults: number;
  children: number;
  total: number;
  status: 'confirmed' | 'pending' | 'cancelled' | 'completed';
}

export interface PayoutLine {
  periodLabel: string;
  gross: number;
  commission: number;
  net: number;
  status: 'paid' | 'scheduled';
  paidOn: string | null;
}

const atHour = (dayOffset: number, hour: number) => {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
};

export const experiences: Experience[] = [
  {
    experienceId: 'x1',
    title: 'Сплав по Инзеру на рафтах',
    status: 'active',
    durationMinutes: 300,
    pricePerPerson: 3500,
    capacity: 12,
    meetingPoint: 'Уфа, ул. Ленина, 10 — сбор у офиса',
    languages: ['Русский'],
    photoUrl: null,
    rating: 4.9,
    reviews: 42,
  },
  {
    experienceId: 'x2',
    title: 'Утренний SUP на городском пруду',
    status: 'active',
    durationMinutes: 90,
    pricePerPerson: 1200,
    capacity: 8,
    meetingPoint: 'Пляж Солнечный, прокат у пирса',
    languages: ['Русский', 'English'],
    photoUrl: null,
    rating: 4.7,
    reviews: 18,
  },
  {
    experienceId: 'x3',
    title: 'Ночное восхождение на Иремель',
    status: 'draft',
    durationMinutes: 720,
    pricePerPerson: 5600,
    capacity: 10,
    meetingPoint: 'Тюлюк, база «Иремель»',
    languages: ['Русский'],
    photoUrl: null,
    rating: null,
    reviews: 0,
  },
  {
    experienceId: 'x4',
    title: 'Велотур по Шиханам',
    status: 'paused',
    durationMinutes: 240,
    pricePerPerson: 2800,
    capacity: 6,
    meetingPoint: 'Стерлитамак, парковка у Торатау',
    languages: ['Русский'],
    photoUrl: null,
    rating: 4.8,
    reviews: 7,
  },
];

export const departures: Departure[] = [
  { departureId: 'd1', experienceId: 'x2', startsAt: atHour(0, 8), booked: 6, capacity: 8, guide: 'Айгиз', status: 'scheduled' },
  { departureId: 'd2', experienceId: 'x1', startsAt: atHour(0, 10), booked: 12, capacity: 12, guide: 'Рустем', status: 'scheduled' },
  { departureId: 'd3', experienceId: 'x2', startsAt: atHour(1, 8), booked: 2, capacity: 8, guide: 'Айгиз', status: 'scheduled' },
  { departureId: 'd4', experienceId: 'x1', startsAt: atHour(2, 10), booked: 5, capacity: 12, guide: null, status: 'scheduled' },
  { departureId: 'd5', experienceId: 'x4', startsAt: atHour(3, 9), booked: 0, capacity: 6, guide: null, status: 'scheduled' },
  { departureId: 'd6', experienceId: 'x1', startsAt: atHour(5, 10), booked: 9, capacity: 12, guide: 'Рустем', status: 'scheduled' },
  { departureId: 'd7', experienceId: 'x2', startsAt: atHour(6, 8), booked: 8, capacity: 8, guide: 'Айгиз', status: 'scheduled' },
];

export const experienceBookings: ExperienceBooking[] = [
  { bookingId: 'b1', bookingNumber: 'SGH-X-1041', experienceId: 'x2', departureId: 'd1', customerName: 'Айгиз Искужин', customerPhone: '+79279383562', adults: 2, children: 1, total: 3600, status: 'confirmed' },
  { bookingId: 'b2', bookingNumber: 'SGH-X-1042', experienceId: 'x1', departureId: 'd2', customerName: 'Олег Р.', customerPhone: '+79170000001', adults: 4, children: 0, total: 14000, status: 'confirmed' },
  { bookingId: 'b3', bookingNumber: 'SGH-X-1043', experienceId: 'x2', departureId: 'd3', customerName: 'Игорь П.', customerPhone: '+79170000002', adults: 2, children: 0, total: 2400, status: 'pending' },
  { bookingId: 'b4', bookingNumber: 'SGH-X-1044', experienceId: 'x1', departureId: 'd4', customerName: 'Ирина С.', customerPhone: '+79170000003', adults: 5, children: 0, total: 17500, status: 'confirmed' },
  { bookingId: 'b5', bookingNumber: 'SGH-X-1045', experienceId: 'x1', departureId: 'd6', customerName: 'Пётр В.', customerPhone: '+79170000004', adults: 2, children: 2, total: 10500, status: 'cancelled' },
];

export const payouts: PayoutLine[] = [
  { periodLabel: 'Сентябрь, 2-я половина', gross: 184500, commission: 18450, net: 166050, status: 'paid', paidOn: atHour(-6, 12) },
  { periodLabel: 'Сентябрь, 1-я половина', gross: 142000, commission: 14200, net: 127800, status: 'paid', paidOn: atHour(-21, 12) },
  { periodLabel: 'Октябрь, 1-я половина', gross: 68400, commission: 6840, net: 61560, status: 'scheduled', paidOn: null },
];

export const experienceById = (id: string) => experiences.find(item => item.experienceId === id);
export const departureById = (id: string) => departures.find(item => item.departureId === id);

/** «5 ч» / «1 ч 30 мин» — a duration said the way a person says it. */
export function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} мин`;
  return rest === 0 ? `${hours} ч` : `${hours} ч ${rest} мин`;
}

export const money = (value: number) => `${new Intl.NumberFormat('ru-RU').format(value)} ₽`;
