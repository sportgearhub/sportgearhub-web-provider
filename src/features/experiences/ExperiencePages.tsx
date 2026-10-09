import { useMemo, useState } from 'react';
import { CalendarDays, Clock, ImageOff, MapPin, Plus, Users } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { CopyValue } from '../../components/ui/CopyValue';
import { DetailList, DetailRow } from '../../components/ui/DetailList';
import { SegmentedTabs } from '../../components/ui/SegmentedTabs';
import { MobileHomeHeader } from '../../components/layout/MobileHomeHeader';
import { SectionPage } from '../../components/layout/SectionPage';
import { SettingsCard } from '../../components/layout/SettingsCard';
import {
  departures,
  experienceBookings,
  experienceById,
  experiences,
  formatDuration,
  money,
  payouts,
  type Departure,
} from './prototypeData';

/** Said once, on every screen of this workspace, so nobody mistakes seeded data for their own. */
function PrototypeNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-2.5 text-xs leading-5 text-gray-600">
      <span className="font-medium text-gray-800">Прототип.</span> {children}
    </p>
  );
}

const statusMeta: Record<string, { label: string; variant: 'green' | 'gray' | 'orange' | 'yellow' | 'red' | 'blue' }> = {
  active: { label: 'Опубликовано', variant: 'green' },
  draft: { label: 'Черновик', variant: 'gray' },
  paused: { label: 'Снято', variant: 'orange' },
  confirmed: { label: 'Оплачено', variant: 'green' },
  pending: { label: 'Ждёт оплаты', variant: 'yellow' },
  cancelled: { label: 'Отменено', variant: 'red' },
  completed: { label: 'Проведено', variant: 'gray' },
};

const when = (iso: string) =>
  new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** How full a departure is — the number this business actually runs on. */
function Occupancy({ booked, capacity }: { booked: number; capacity: number }) {
  const share = capacity > 0 ? booked / capacity : 0;
  const full = booked >= capacity;
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100">
        <span
          className={`block h-full rounded-full ${full ? 'bg-emerald-600' : share > 0.5 ? 'bg-blue-600' : 'bg-amber-500'}`}
          style={{ width: `${Math.min(100, share * 100)}%` }}
        />
      </span>
      <span className={`text-xs ${full ? 'font-medium text-emerald-700' : 'text-gray-600'}`}>
        {booked}/{capacity}
      </span>
    </span>
  );
}

// ─── Впечатления ──────────────────────────────────────────────────────────────

export function ExperiencesPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [tab, setTab] = useState('all');
  const shown = experiences.filter(item => tab === 'all' || item.status === tab);

  return (
    <SectionPage
      title="Впечатления"
      description="Туры, занятия и экскурсии, которые вы проводите."
      action={<Button variant="primary"><Plus size={15} /> Добавить</Button>}
    >
      <PrototypeNote>
        Данные демонстрационные: API для впечатлений ещё нет. Экран показывает, какие поля
        понадобятся, когда он появится.
      </PrototypeNote>

      <div className="space-y-3">
        <SegmentedTabs
          items={[
            { value: 'all', label: 'Все', count: experiences.length },
            { value: 'active', label: 'Опубликованы', count: experiences.filter(i => i.status === 'active').length },
            { value: 'draft', label: 'Черновики', count: experiences.filter(i => i.status === 'draft').length },
            { value: 'paused', label: 'Сняты', count: experiences.filter(i => i.status === 'paused').length },
          ]}
          value={tab}
          onChange={setTab}
        />

        <ul className="space-y-2">
          {shown.map(item => {
            const meta = statusMeta[item.status];
            const next = departures.find(d => d.experienceId === item.experienceId);
            return (
              <li key={item.experienceId} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                <button
                  type="button"
                  onClick={() => onNavigate('/x/schedule')}
                  className="w-full p-3 text-left transition hover:bg-gray-50 sm:p-4"
                >
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                    {item.rating && <span className="text-xs text-gray-500">★ {item.rating} · {item.reviews} отзывов</span>}
                  </span>

                  <span className="mt-2.5 flex items-start gap-3">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-300">
                      <ImageOff size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium leading-5 text-gray-900">{item.title}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Clock size={12} /> {formatDuration(item.durationMinutes)}</span>
                        <span className="flex items-center gap-1"><Users size={12} /> до {item.capacity} чел.</span>
                        <span className="font-medium text-gray-900">{money(item.pricePerPerson)} / чел.</span>
                      </span>
                      <span className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                        <MapPin size={12} className="shrink-0" /> {item.meetingPoint}
                      </span>
                    </span>
                  </span>

                  {next && (
                    <span className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-2.5 text-xs text-gray-500">
                      <CalendarDays size={12} /> Ближайший выход: {when(next.startsAt)}
                      <Occupancy booked={next.booked} capacity={next.capacity} />
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </SectionPage>
  );
}

// ─── Расписание ───────────────────────────────────────────────────────────────

/**
 * The calendar is the product here.
 *
 * A rental card is in sale or it is not; an experience is a list of departures, each with seats
 * that fill. Every supplier console for tours is built around this screen, because «есть ли места
 * в субботу» is the question that is asked all day.
 */
export function ExperienceSchedulePage() {
  const byDay = useMemo(() => {
    const map = new Map<string, Departure[]>();
    departures.forEach(departure => {
      const key = new Date(departure.startsAt).toDateString();
      map.set(key, [...(map.get(key) ?? []), departure]);
    });
    return [...map.entries()].sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());
  }, []);

  return (
    <SectionPage title="Расписание" description="Выходы, места и гиды.">
      <PrototypeNote>
        Демонстрационное расписание. Настоящее появится вместе с API: выход, вместимость, гид,
        отмена и повторяющиеся слоты.
      </PrototypeNote>

      <div className="space-y-4">
        {byDay.map(([day, items]) => (
          <SettingsCard
            key={day}
            title={new Date(day).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
            description={`${items.length} ${items.length === 1 ? 'выход' : 'выхода'}`}
          >
            <ul className="divide-y divide-gray-100">
              {items.map(departure => {
                const experience = experienceById(departure.experienceId);
                const full = departure.booked >= departure.capacity;
                return (
                  <li key={departure.departureId} className="flex flex-wrap items-center gap-3 py-2.5">
                    <span className="w-14 shrink-0 text-sm font-medium text-gray-900">
                      {new Date(departure.startsAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-gray-900">{experience?.title}</span>
                      <span className="text-xs text-gray-500">
                        {departure.guide ? `Гид: ${departure.guide}` : 'Гид не назначен'}
                      </span>
                    </span>
                    <Occupancy booked={departure.booked} capacity={departure.capacity} />
                    {full && <Badge variant="green">мест нет</Badge>}
                    {!departure.guide && <Badge variant="yellow">нужен гид</Badge>}
                  </li>
                );
              })}
            </ul>
          </SettingsCard>
        ))}
      </div>
    </SectionPage>
  );
}

// ─── Бронирования ─────────────────────────────────────────────────────────────

export function ExperienceBookingsPage() {
  const [tab, setTab] = useState('all');
  const shown = experienceBookings.filter(booking => tab === 'all' || booking.status === tab);

  return (
    <SectionPage title="Бронирования" description="Кто идёт и когда.">
      <PrototypeNote>
        Демонстрационные брони. Состав группы — взрослые и дети — это то, чем бронь впечатления
        отличается от брони проката.
      </PrototypeNote>

      <div className="space-y-3">
        <SegmentedTabs
          items={[
            { value: 'all', label: 'Все', count: experienceBookings.length },
            { value: 'confirmed', label: 'Оплачены', count: experienceBookings.filter(b => b.status === 'confirmed').length },
            { value: 'pending', label: 'Ждут оплаты', count: experienceBookings.filter(b => b.status === 'pending').length },
            { value: 'cancelled', label: 'Отменены', count: experienceBookings.filter(b => b.status === 'cancelled').length },
          ]}
          value={tab}
          onChange={setTab}
        />

        <ul className="space-y-2">
          {shown.map(booking => {
            const experience = experienceById(booking.experienceId);
            const departure = departures.find(d => d.departureId === booking.departureId);
            const meta = statusMeta[booking.status];
            return (
              <li key={booking.bookingId} className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant={meta.variant}>{meta.label}</Badge>
                  <span className="text-xs text-gray-500">№{booking.bookingNumber}</span>
                </div>
                <p className="mt-2 text-sm font-medium text-gray-900">{experience?.title}</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {departure ? when(departure.startsAt) : '—'} · {booking.adults} взр.
                  {booking.children > 0 ? ` · ${booking.children} дет.` : ''}
                </p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="flex flex-wrap items-center gap-x-2 text-xs text-gray-600">
                    {booking.customerName}
                    <CopyValue value={booking.customerPhone} label="телефон клиента" className="text-xs" />
                  </span>
                  <span className="text-sm font-medium text-gray-900">{money(booking.total)}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </SectionPage>
  );
}

// ─── Финансы ──────────────────────────────────────────────────────────────────

export function ExperienceFinancesPage() {
  const upcoming = payouts.find(line => line.status === 'scheduled');
  const earned = payouts.reduce((sum, line) => sum + line.net, 0);

  return (
    <SectionPage title="Финансы" description="Что заработано и что уже выплачено.">
      <PrototypeNote>
        Демонстрационные суммы. Реальные выплаты считает платформа: комиссия удерживается при
        расчёте, выплата уходит по графику.
      </PrototypeNote>

      <div className="max-w-3xl space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <SummaryTile label="Заработано за 3 периода" value={money(earned)} />
          <SummaryTile label="К выплате" value={upcoming ? money(upcoming.net) : '—'} tone="accent" />
          <SummaryTile label="Комиссия платформы" value="10 %" />
        </div>

        <SettingsCard title="Выплаты" description="По периодам, с удержанной комиссией.">
          <DetailList>
            {payouts.map(line => (
              <DetailRow key={line.periodLabel} label={line.periodLabel}>
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <span className="block text-sm font-medium text-gray-900">{money(line.net)}</span>
                    <span className="block text-xs text-gray-500">
                      {money(line.gross)} − {money(line.commission)} комиссия
                    </span>
                  </span>
                  <Badge variant={line.status === 'paid' ? 'green' : 'yellow'}>
                    {line.status === 'paid' && line.paidOn
                      ? `выплачено ${new Date(line.paidOn).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`
                      : 'запланировано'}
                  </Badge>
                </span>
              </DetailRow>
            ))}
          </DetailList>
        </SettingsCard>

        <SettingsCard title="Реквизиты" description="Общие для проката и впечатлений.">
          <p className="text-sm text-gray-600">
            Деньги за впечатления приходят на тот же счёт, что и за прокат — кабинет и юридическое
            лицо одни. Реквизиты меняются в настройках.
          </p>
        </SettingsCard>
      </div>
    </SectionPage>
  );
}

function SummaryTile({ label, value, tone = 'plain' }: { label: string; value: string; tone?: 'plain' | 'accent' }) {
  return (
    <div className={`rounded-xl border p-3 ${tone === 'accent' ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-white'}`}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${tone === 'accent' ? 'text-blue-900' : 'text-gray-900'}`}>{value}</p>
    </div>
  );
}

// ─── Главная ──────────────────────────────────────────────────────────────────

export function ExperienceDashboardPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const today = new Date().toDateString();
  const todays = departures.filter(d => new Date(d.startsAt).toDateString() === today);
  const seatsToday = todays.reduce((sum, d) => sum + d.booked, 0);
  const needGuide = departures.filter(d => !d.guide).length;

  return (
    <>
      <MobileHomeHeader />
      <SectionPage title="Впечатления" description="Сегодня и ближайшие выходы.">
        <PrototypeNote>Демонстрационные данные — API впечатлений ещё не существует.</PrototypeNote>

        <div className="max-w-3xl space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <SummaryTile label="Выходов сегодня" value={String(todays.length)} />
            <SummaryTile label="Гостей сегодня" value={String(seatsToday)} tone="accent" />
            <SummaryTile label="Без гида" value={String(needGuide)} />
          </div>

          <SettingsCard
            title="Сегодня"
            description={todays.length > 0 ? 'Выходы на сегодня.' : undefined}
            action={<Button variant="secondary" size="sm" onClick={() => onNavigate('/x/schedule')}>Всё расписание</Button>}
          >
            {todays.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-500">Сегодня выходов нет.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {todays.map(departure => (
                  <li key={departure.departureId} className="flex flex-wrap items-center gap-3 py-2.5">
                    <span className="w-14 shrink-0 text-sm font-medium text-gray-900">
                      {new Date(departure.startsAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="min-w-0 flex-1 text-sm text-gray-900">{experienceById(departure.experienceId)?.title}</span>
                    <Occupancy booked={departure.booked} capacity={departure.capacity} />
                  </li>
                ))}
              </ul>
            )}
          </SettingsCard>
        </div>
      </SectionPage>
    </>
  );
}
