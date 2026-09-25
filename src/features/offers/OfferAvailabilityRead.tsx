import { useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { DetailList, DetailRow } from '../../components/ui/DetailList';
import { SectionPage } from '../../components/layout/SectionPage';
import { ApiError, offerAvailabilityApi } from '../../lib/api-client';
import type { Offer, OfferAvailability } from '../../types';
import { DEFAULT_TIMEZONE } from './offerAvailabilityTypes';
import { YearAvailabilityCalendar } from './YearAvailabilityCalendar';

function humanDate(value: string) {
  return value ? value.split('-').reverse().join('.') : '—';
}

function hhmm(value: string | null | undefined) {
  return (value ?? '').slice(0, 5);
}

/** Availability as it stands: the settings, the seasons, and the year they add up to. */
export function OfferAvailabilityRead({ offer, onNavigate }: { offer: Offer; onNavigate: (path: string) => void }) {
  const [availability, setAvailability] = useState<OfferAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    offerAvailabilityApi.get(offer.offerId)
      .then(next => {
        if (!cancelled) setAvailability(next);
      })
      .catch(err => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) setAvailability(null);
        else setError(err instanceof ApiError ? err.message : 'Не удалось загрузить доступность.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [offer.offerId]);

  const windows = availability?.availabilityWindows ?? [];
  const blocked = availability?.blockedPeriods ?? [];
  const configured = Boolean(availability);

  return (
    <SectionPage
      title="Доступность"
      description={offer.title}
      breadcrumb={{ label: 'Предложение', path: `/offers/${offer.offerId}` }}
      onNavigate={onNavigate}
      error={error}
      action={
        <div className="flex items-center gap-2">
          {configured && (
            <Badge variant={availability?.status === 'active' ? 'green' : 'yellow'}>
              {availability?.status === 'active' ? 'Включено' : 'Не принимает брони'}
            </Badge>
          )}
          <Button variant="secondary" onClick={() => onNavigate(`/offers/${offer.offerId}/availability/edit`)}>
            <Pencil size={14} /> Редактировать
          </Button>
        </div>
      }
    >
      {loading ? (
        <p className="text-sm text-gray-500">Загружаем...</p>
      ) : !configured ? (
        <div className="max-w-xl rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-5 text-amber-900">
          <p className="font-semibold">Доступность ещё не настроена.</p>
          <p className="mt-1">Без сезонных окон предложение не принимает бронирования.</p>
          <Button className="mt-3" variant="primary" onClick={() => onNavigate(`/offers/${offer.offerId}/availability/edit`)}>
            Настроить
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.9fr)]">
          <div>
            <DetailList>
              <DetailRow label="Часовой пояс" value={availability?.timezone || DEFAULT_TIMEZONE} />
              <DetailRow label="Принимать бронирования" value={availability?.status === 'active' ? 'Да' : 'Нет'} />
              <DetailRow
                label="Шаг слота"
                value={availability?.slotIntervalMinutes ? `${availability.slotIntervalMinutes} мин` : null}
              />
              <DetailRow
                label="Обновлено"
                value={availability?.updatedAt ? new Date(availability.updatedAt).toLocaleString('ru-RU') : null}
              />
            </DetailList>

            <h3 className="mt-8 text-sm font-semibold text-gray-900">Сезонные окна работы</h3>
            {windows.length === 0 ? (
              <p className="mt-2 rounded-md border border-dashed border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-800">
                Окон нет — предложение не принимает бронирования.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-200">
                {windows.map((window, index) => (
                  <li key={index} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
                    <span className="text-gray-900">{humanDate(window.startsOn)} — {humanDate(window.endsOn)}</span>
                    <span className="text-gray-500">{hhmm(window.dailyOpensAt)}–{hhmm(window.dailyClosesAt)}</span>
                  </li>
                ))}
              </ul>
            )}

            <h3 className="mt-8 text-sm font-semibold text-gray-900">Закрытые периоды</h3>
            {blocked.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500">Закрытых периодов нет.</p>
            ) : (
              <ul className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-200">
                {blocked.map((period, index) => (
                  <li key={index} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
                    <span className="text-gray-900">{humanDate(period.startsOn)} — {humanDate(period.endsOn)}</span>
                    {period.reasonCode && <span className="text-gray-500">{period.reasonCode}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <YearAvailabilityCalendar windows={windows} blockedPeriods={blocked} />
        </div>
      )}
    </SectionPage>
  );
}
