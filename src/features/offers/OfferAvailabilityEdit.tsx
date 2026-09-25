import { useEffect, useState } from 'react';
import { Plus, Save, Trash2, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { SectionPage } from '../../components/layout/SectionPage';
import { DateRangePicker } from '../../components/ui/DateRangePicker';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { TimeSelect, toHhMm } from '../../components/ui/TimeSelect';
import { ApiError, offerAvailabilityApi } from '../../lib/api-client';
import type { Offer, OfferAvailability, OfferAvailabilityBlockedPeriod, OfferAvailabilityWindow } from '../../types';
import {
  availabilityStatusOptions,
  DEFAULT_TIMEZONE,
  emptyOfferAvailabilityForm,
  offerAvailabilityToForm,
  type OfferAvailabilityForm,
} from './offerAvailabilityTypes';

function emptyWindow(): OfferAvailabilityWindow {
  return { startsOn: '', endsOn: '', dailyOpensAt: '09:00', dailyClosesAt: '21:00' };
}

function emptyBlockedPeriod(): OfferAvailabilityBlockedPeriod {
  return { startsOn: '', endsOn: '', reasonCode: 'maintenance' };
}

interface OfferAvailabilityEditProps {
  offer: Offer;
  onNavigate: (path: string) => void;
}

export function OfferAvailabilityEdit({ offer, onNavigate }: OfferAvailabilityEditProps) {
  const readPath = `/offers/${offer.offerId}/availability`;
  const [availability, setAvailability] = useState<OfferAvailability | null>(null);
  const [form, setForm] = useState<OfferAvailabilityForm>(emptyOfferAvailabilityForm());
  const [windows, setWindows] = useState<OfferAvailabilityWindow[]>([]);
  const [blockedPeriods, setBlockedPeriods] = useState<OfferAvailabilityBlockedPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    offerAvailabilityApi.get(offer.offerId)
      .then(next => {
        if (cancelled) return;
        setAvailability(next);
        setForm(offerAvailabilityToForm(next));
        setWindows(next.availabilityWindows ?? []);
        setBlockedPeriods(next.blockedPeriods ?? []);
      })
      .catch(err => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setAvailability(null);
        } else {
          setError(err instanceof ApiError ? `Не удалось загрузить: ${err.message}` : 'Не удалось загрузить настройки.');
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [offer.offerId]);

  const patchWindow = (index: number, patch: Partial<OfferAvailabilityWindow>) => {
    setWindows(ws => ws.map((w, i) => (i === index ? { ...w, ...patch } : w)));
  };
  const removeWindow = (index: number) => {
    setWindows(ws => ws.filter((_, i) => i !== index));
  };
  const patchBlocked = (index: number, patch: Partial<OfferAvailabilityBlockedPeriod>) => {
    setBlockedPeriods(bs => bs.map((b, i) => (i === index ? { ...b, ...patch } : b)));
  };
  const removeBlocked = (index: number) => {
    setBlockedPeriods(bs => bs.filter((_, i) => i !== index));
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const next = await offerAvailabilityApi.put(offer.offerId, {
        timezone: form.timezone.trim() || DEFAULT_TIMEZONE,
        status: form.status,
        slotIntervalMinutes: Number(form.slotIntervalMinutes) || null,
        availabilityWindows: windows.map(w => ({
          ...w,
          dailyOpensAt: `${toHhMm(w.dailyOpensAt)}:00`,
          dailyClosesAt: `${toHhMm(w.dailyClosesAt)}:00`,
        })),
        blockedPeriods,
      });
      setAvailability(next);
      onNavigate(readPath);
    } catch (err) {
      setError(err instanceof ApiError ? `Не удалось сохранить: ${err.message}` : 'Не удалось сохранить.');
      setSaving(false);
    }
  };

  return (
    <SectionPage
      title="Настройка доступности"
      description={offer.title}
      breadcrumb={{ label: 'Доступность', path: readPath }}
      onNavigate={onNavigate}
      error={error}
    >
      {loading ? (
        <p className="text-sm text-gray-500">Загружаем настройки...</p>
      ) : (
        <div className="max-w-2xl space-y-4">
          <Input
            label="Часовой пояс"
            value={form.timezone}
            onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}
            placeholder={DEFAULT_TIMEZONE}
          />

          <Select
            label="Принимать бронирования"
            value={form.status}
            options={availabilityStatusOptions}
            onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
          />

          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="Шаг слота (мин)"
              type="number"
              min="1"
              value={form.slotIntervalMinutes}
              onChange={e => setForm(f => ({ ...f, slotIntervalMinutes: e.target.value }))}
              placeholder="Не задан"
            />
          </div>

          <div className="space-y-2 border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-semibold text-gray-900">Сезонные окна работы</h4>
                <p className="mt-0.5 text-xs text-gray-500">Когда предложение доступно для бронирования.</p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setWindows(ws => [...ws, emptyWindow()])}
              >
                <Plus size={13} /> Добавить окно
              </Button>
            </div>
            {windows.length === 0 ? (
              <div className="rounded-md border border-dashed border-amber-200 bg-amber-50 px-3 py-4 text-center text-xs text-amber-700">
                Добавьте хотя бы одно окно работы — без него предложение не будет принимать бронирования.
              </div>
            ) : (
              windows.map((window, index) => (
                <div key={index} className="grid items-end gap-2 rounded-md border border-gray-100 bg-gray-50 p-2 sm:grid-cols-[1.6fr_100px_100px_auto]">
                  <DateRangePicker
                    label="Сезон"
                    startsOn={window.startsOn}
                    endsOn={window.endsOn}
                    onChange={range => patchWindow(index, range)}
                  />
                  <TimeSelect
                    label="Открытие"
                    value={window.dailyOpensAt}
                    onChange={value => patchWindow(index, { dailyOpensAt: value })}
                  />
                  <TimeSelect
                    label="Закрытие"
                    value={window.dailyClosesAt}
                    onChange={value => patchWindow(index, { dailyClosesAt: value })}
                  />
                  <Button size="sm" variant="ghost" onClick={() => removeWindow(index)}>
                    <Trash2 size={13} />
                  </Button>
                </div>
              ))
            )}
          </div>

          <div className="space-y-2 border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-semibold text-gray-900">Закрытые периоды</h4>
                <p className="mt-0.5 text-xs text-gray-500">Даты, когда предложение недоступно.</p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setBlockedPeriods(bs => [...bs, emptyBlockedPeriod()])}
              >
                <Plus size={13} /> Закрыть даты
              </Button>
            </div>
            {blockedPeriods.length === 0 ? (
              <div className="rounded-md border border-dashed border-gray-200 px-3 py-4 text-center text-xs text-gray-500">
                Закрытых периодов нет.
              </div>
            ) : (
              blockedPeriods.map((period, index) => (
                <div key={index} className="grid items-end gap-2 rounded-md border border-gray-100 bg-gray-50 p-2 sm:grid-cols-[1.4fr_1fr_auto]">
                  <DateRangePicker
                    label="Период"
                    startsOn={period.startsOn}
                    endsOn={period.endsOn}
                    onChange={range => patchBlocked(index, range)}
                  />
                  <Input
                    label="Причина"
                    value={period.reasonCode ?? ''}
                    onChange={e => patchBlocked(index, { reasonCode: e.target.value })}
                    placeholder="maintenance"
                  />
                  <Button size="sm" variant="ghost" onClick={() => removeBlocked(index)}>
                    <Trash2 size={13} />
                  </Button>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-4">
            <p className="text-xs text-gray-500">
              {availability?.updatedAt
                ? `Обновлено: ${new Date(availability.updatedAt).toLocaleString('ru-RU')}`
                : 'Настройки ещё не сохранены'}
            </p>
            <div className="flex gap-2">
              <Button variant="primary" onClick={() => void save()} loading={saving}>
                <Save size={13} /> Сохранить
              </Button>
              <Button variant="secondary" disabled={saving} onClick={() => onNavigate(readPath)}>
                <X size={13} /> Отмена
              </Button>
            </div>
          </div>
        </div>
      )}
    </SectionPage>
  );
}
