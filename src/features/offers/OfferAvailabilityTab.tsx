import { useEffect, useState } from 'react';
import { AlertTriangle, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { ApiError, offerAvailabilityApi } from '../../lib/api-client';
import type { Offer, OfferAvailability, OfferAvailabilityBlockedPeriod, OfferAvailabilityWindow } from '../../types';

const DEFAULT_TIMEZONE = 'Asia/Yekaterinburg';

function emptyWindow(): OfferAvailabilityWindow {
  return { startsOn: '', endsOn: '', dailyOpensAt: '09:00', dailyClosesAt: '21:00' };
}

function emptyBlockedPeriod(): OfferAvailabilityBlockedPeriod {
  return { startsOn: '', endsOn: '', reasonCode: 'maintenance' };
}

function emptySettings(offerId: string): OfferAvailability {
  return {
    settingsId: '',
    offerId,
    timezone: DEFAULT_TIMEZONE,
    availabilityWindows: [],
    blockedPeriods: [],
    minRentHours: 1,
    maxRentHours: 8,
    advanceNoticeHours: 1,
    status: 'active',
    updatedAt: '',
  };
}

interface OfferAvailabilityTabProps {
  offer: Offer;
}

export function OfferAvailabilityTab({ offer }: OfferAvailabilityTabProps) {
  const [settings, setSettings] = useState<OfferAvailability>(emptySettings(offer.offerId));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [missing, setMissing] = useState(false);

  const load = async (cancelled = false) => {
    setLoading(true);
    setError('');
    setMissing(false);
    try {
      const data = await offerAvailabilityApi.get(offer.offerId);
      if (!cancelled) setSettings(data);
    } catch (err) {
      if (cancelled) return;
      if (err instanceof ApiError && err.status === 404) {
        setMissing(true);
        setSettings(emptySettings(offer.offerId));
      } else {
        setError(err instanceof ApiError ? err.message : 'Не удалось загрузить настройки доступности.');
      }
    } finally {
      if (!cancelled) setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    void load(cancelled);
    return () => { cancelled = true; };
  }, [offer.offerId]);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const next = await offerAvailabilityApi.put(offer.offerId, {
        timezone: settings.timezone.trim() || DEFAULT_TIMEZONE,
        availabilityWindows: settings.availabilityWindows,
        blockedPeriods: settings.blockedPeriods,
        minRentHours: settings.minRentHours,
        maxRentHours: settings.maxRentHours,
        advanceNoticeHours: settings.advanceNoticeHours,
        status: settings.status,
      });
      setSettings(next);
      setMissing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить настройки доступности.');
    } finally {
      setSaving(false);
    }
  };

  const patchWindow = (index: number, patch: Partial<OfferAvailabilityWindow>) => {
    setSettings(s => ({
      ...s,
      availabilityWindows: s.availabilityWindows.map((w, i) => (i === index ? { ...w, ...patch } : w)),
    }));
  };

  const removeWindow = (index: number) => {
    setSettings(s => ({ ...s, availabilityWindows: s.availabilityWindows.filter((_, i) => i !== index) }));
  };

  const patchBlocked = (index: number, patch: Partial<OfferAvailabilityBlockedPeriod>) => {
    setSettings(s => ({
      ...s,
      blockedPeriods: s.blockedPeriods.map((b, i) => (i === index ? { ...b, ...patch } : b)),
    }));
  };

  const removeBlocked = (index: number) => {
    setSettings(s => ({ ...s, blockedPeriods: s.blockedPeriods.filter((_, i) => i !== index) }));
  };

  if (loading) {
    return <div className="py-12 text-center text-sm text-gray-500">Загружаем доступность...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Доступность предложения</h3>
          <p className="mt-0.5 text-xs text-gray-500">Укажите сезонные окна работы, часы приёма и ограничения аренды.</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => void load()}>
          <RefreshCw size={13} /> Обновить
        </Button>
      </div>

      {missing && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          <AlertTriangle size={14} /> Настройки ещё не сохранены. Задайте параметры и нажмите «Сохранить».
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      <Card>
        <CardHeader
          title="Основные параметры"
          action={
            <Button size="sm" variant="primary" loading={saving} onClick={() => void save()}>
              <Save size={13} /> Сохранить
            </Button>
          }
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Input
            label="Часовой пояс"
            value={settings.timezone}
            onChange={e => setSettings(s => ({ ...s, timezone: e.target.value }))}
            placeholder="Asia/Yekaterinburg"
          />
          <Input
            label="Мин. часов аренды"
            type="number"
            min="1"
            value={String(settings.minRentHours)}
            onChange={e => setSettings(s => ({ ...s, minRentHours: Number(e.target.value) || 1 }))}
          />
          <Input
            label="Макс. часов аренды"
            type="number"
            min="1"
            value={String(settings.maxRentHours)}
            onChange={e => setSettings(s => ({ ...s, maxRentHours: Number(e.target.value) || 1 }))}
          />
          <Input
            label="Заблаговременность (ч)"
            type="number"
            min="0"
            value={String(settings.advanceNoticeHours)}
            onChange={e => setSettings(s => ({ ...s, advanceNoticeHours: Number(e.target.value) || 0 }))}
          />
        </div>
        <div className="mt-4">
          <Select
            label="Статус"
            value={settings.status}
            onChange={e => setSettings(s => ({ ...s, status: e.target.value }))}
            options={[
              { value: 'active', label: 'Принимаем бронирования' },
              { value: 'inactive', label: 'Временно закрыто' },
            ]}
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Сезонные окна работы"
          subtitle="Когда предложение доступно для бронирования."
          action={
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setSettings(s => ({ ...s, availabilityWindows: [...s.availabilityWindows, emptyWindow()] }))}
            >
              <Plus size={13} /> Добавить окно
            </Button>
          }
        />
        {settings.availabilityWindows.length === 0 ? (
          <div className="rounded-md border border-dashed border-gray-200 px-3 py-6 text-center text-sm text-gray-500">
            Добавьте сезонное окно работы.
          </div>
        ) : (
          <div className="space-y-2">
            {settings.availabilityWindows.map((window, index) => (
              <div key={index} className="grid gap-2 rounded-md border border-gray-100 bg-gray-50 p-2 md:grid-cols-[1fr_1fr_100px_100px_auto]">
                <Input
                  label="Начало сезона"
                  type="date"
                  value={window.startsOn}
                  onChange={e => patchWindow(index, { startsOn: e.target.value })}
                />
                <Input
                  label="Конец сезона"
                  type="date"
                  value={window.endsOn}
                  onChange={e => patchWindow(index, { endsOn: e.target.value })}
                />
                <Input
                  label="Открытие"
                  type="time"
                  value={window.dailyOpensAt}
                  onChange={e => patchWindow(index, { dailyOpensAt: e.target.value })}
                />
                <Input
                  label="Закрытие"
                  type="time"
                  value={window.dailyClosesAt}
                  onChange={e => patchWindow(index, { dailyClosesAt: e.target.value })}
                />
                <div className="flex items-end">
                  <Button size="sm" variant="ghost" onClick={() => removeWindow(index)}>
                    <Trash2 size={13} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Закрытые периоды"
          subtitle="Даты, когда предложение недоступно для бронирования."
          action={
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setSettings(s => ({ ...s, blockedPeriods: [...s.blockedPeriods, emptyBlockedPeriod()] }))}
            >
              <Plus size={13} /> Закрыть даты
            </Button>
          }
        />
        {settings.blockedPeriods.length === 0 ? (
          <div className="rounded-md border border-dashed border-gray-200 px-3 py-6 text-center text-sm text-gray-500">
            Закрытых периодов нет.
          </div>
        ) : (
          <div className="space-y-2">
            {settings.blockedPeriods.map((period, index) => (
              <div key={index} className="grid gap-2 rounded-md border border-gray-100 bg-gray-50 p-2 md:grid-cols-[1fr_1fr_1fr_auto]">
                <Input
                  label="С"
                  type="date"
                  value={period.startsOn}
                  onChange={e => patchBlocked(index, { startsOn: e.target.value })}
                />
                <Input
                  label="По"
                  type="date"
                  value={period.endsOn}
                  onChange={e => patchBlocked(index, { endsOn: e.target.value })}
                />
                <Input
                  label="Причина"
                  value={period.reasonCode}
                  onChange={e => patchBlocked(index, { reasonCode: e.target.value })}
                  placeholder="maintenance"
                />
                <div className="flex items-end">
                  <Button size="sm" variant="ghost" onClick={() => removeBlocked(index)}>
                    <Trash2 size={13} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
