import { useEffect, useState } from 'react';
import { AlertTriangle, Plus, Save, Trash2, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { ApiError, locationsApi } from '../../lib/api-client';
import type { LocationSchedule, ScheduleException, WorkingHours } from '../../types';

const DAYS: { key: string; label: string }[] = [
  { key: 'monday', label: 'Понедельник' },
  { key: 'tuesday', label: 'Вторник' },
  { key: 'wednesday', label: 'Среда' },
  { key: 'thursday', label: 'Четверг' },
  { key: 'friday', label: 'Пятница' },
  { key: 'saturday', label: 'Суббота' },
  { key: 'sunday', label: 'Воскресенье' },
];

type DayDraft = { open: boolean; allDay: boolean; opensAt: string; closesAt: string };

const defaultDay = (): DayDraft => ({ open: true, allDay: false, opensAt: '10:00', closesAt: '20:00' });

/** Round the clock, as a pair of times: the API stores hours, not a flag. */
const ALL_DAY = { opensAt: '00:00', closesAt: '23:59' };

const isAllDay = (opensAt: string, closesAt: string) =>
  opensAt.slice(0, 5) === '00:00' && closesAt.slice(0, 5) >= '23:59';

/** `HH:mm` from the inputs, `HH:mm:ss` on the wire, as the API documents it. */
const toWireTime = (value: string) => (value.length === 5 ? `${value}:00` : value);

function toDrafts(schedule: LocationSchedule | null): Record<string, DayDraft> {
  const drafts: Record<string, DayDraft> = {};
  DAYS.forEach(({ key }) => {
    const hours = schedule?.workingHours.find(item => item.day.toLowerCase() === key);
    drafts[key] = hours
      ? {
        open: true,
        allDay: isAllDay(hours.opensAt, hours.closesAt),
        opensAt: hours.opensAt.slice(0, 5),
        closesAt: hours.closesAt.slice(0, 5),
      }
      : schedule
        ? { ...defaultDay(), open: false }
        : defaultDay();
  });
  return drafts;
}

/**
 * Opening hours for a pickup point. The API takes the week whole — a day left out is a day closed —
 * so the dialog loads what is stored first and saves all seven days back.
 */
export function LocationScheduleDialog({
  open,
  locationId,
  locationName,
  onClose,
  onSaved,
}: {
  open: boolean;
  locationId: string;
  locationName: string;
  onClose: () => void;
  onSaved: (schedule: LocationSchedule) => void;
}) {
  const [days, setDays] = useState<Record<string, DayDraft>>(() => toDrafts(null));
  const [exceptions, setExceptions] = useState<ScheduleException[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setLoadFailed(false);
    setError('');
    locationsApi.getSchedule(locationId)
      .then(schedule => {
        if (cancelled) return;
        setDays(toDrafts(schedule));
        setExceptions(schedule.exceptions ?? []);
      })
      .catch(() => {
        // Saving replaces the week, so an unread schedule has to be said out loud.
        if (cancelled) return;
        setDays(toDrafts(null));
        setExceptions([]);
        setLoadFailed(true);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, locationId]);

  const patchDay = (key: string, patch: Partial<DayDraft>) =>
    setDays(current => ({ ...current, [key]: { ...current[key], ...patch } }));

  const save = async () => {
    const workingHours: WorkingHours[] = DAYS
      .filter(({ key }) => days[key]?.open)
      .map(({ key }) => {
        const day = days[key];
        const hours = day.allDay ? ALL_DAY : day;
        return { day: key, opensAt: toWireTime(hours.opensAt), closesAt: toWireTime(hours.closesAt) };
      });

    if (workingHours.some(hours => hours.opensAt >= hours.closesAt)) {
      setError('Время открытия должно быть раньше закрытия.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      // An exception with hours overrides that day; without them it is a closed day. Both go out
      // in the same HH:mm:ss the working hours use.
      const wireExceptions = exceptions.map(exception => ({
        ...exception,
        opensAt: exception.opensAt ? toWireTime(exception.opensAt) : null,
        closesAt: exception.closesAt ? toWireTime(exception.closesAt) : null,
      }));
      onSaved(await locationsApi.setSchedule(locationId, { workingHours, exceptions: wireExceptions }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить расписание.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Часы работы — ${locationName}`} size="lg">
      {loadFailed && (
        <p className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-5 text-amber-900">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          Не удалось загрузить текущее расписание — показаны значения по умолчанию. Сохранение
          заменит неделю целиком, поэтому проверьте каждый день.
        </p>
      )}
      {error && <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {loading ? (
        <p className="py-6 text-center text-sm text-gray-500">Загружаем расписание...</p>
      ) : (
      <>
      <div className="space-y-1.5">
        {DAYS.map(({ key, label }) => {
          const day = days[key] ?? defaultDay();
          return (
            <div key={key} className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-100 px-3 py-2">
              <label className="flex min-w-[9.5rem] items-center gap-2 text-sm text-gray-900">
                <input
                  type="checkbox"
                  checked={day.open}
                  onChange={event => patchDay(key, { open: event.target.checked })}
                  className="h-4 w-4 rounded border-gray-300"
                />
                {label}
              </label>
              {day.open ? (
                <div className="flex flex-wrap items-center gap-3">
                  {day.allDay ? (
                    <span className="text-sm text-gray-600">00:00 — 23:59</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={day.opensAt}
                        onChange={event => patchDay(key, { opensAt: event.target.value })}
                        className="w-28"
                      />
                      <span className="text-gray-400">—</span>
                      <Input
                        type="time"
                        value={day.closesAt}
                        onChange={event => patchDay(key, { closesAt: event.target.value })}
                        className="w-28"
                      />
                    </div>
                  )}
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={day.allDay}
                      onChange={event => patchDay(key, { allDay: event.target.checked })}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    Круглосуточно
                  </label>
                </div>
              ) : (
                <span className="text-sm text-gray-500">Выходной</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-5 border-t border-gray-100 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-gray-900">Исключения</p>
            <p className="text-xs text-gray-500">Праздники и особые дни. Без времени — закрыто на весь период.</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setExceptions(current => [...current, { from: '', to: '', opensAt: null, closesAt: null, reason: '' }])}
          >
            <Plus size={13} /> Добавить
          </Button>
        </div>

        <div className="mt-2 space-y-2">
          {exceptions.map((exception, index) => (
            <div key={index} className="grid gap-2 rounded-lg border border-gray-100 bg-gray-50 p-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <Input
                type="date"
                value={exception.from}
                onChange={event => setExceptions(current => current.map((item, i) => (i === index ? { ...item, from: event.target.value } : item)))}
              />
              <Input
                type="date"
                value={exception.to}
                onChange={event => setExceptions(current => current.map((item, i) => (i === index ? { ...item, to: event.target.value } : item)))}
              />
              <Input
                value={exception.reason ?? ''}
                placeholder="Причина"
                onChange={event => setExceptions(current => current.map((item, i) => (i === index ? { ...item, reason: event.target.value } : item)))}
              />
              <Button variant="ghost" size="sm" aria-label="Удалить исключение" onClick={() => setExceptions(current => current.filter((_, i) => i !== index))}>
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-2 border-t border-gray-100 pt-4">
        <Button variant="secondary" disabled={saving} onClick={onClose}><X size={14} /> Отмена</Button>
        <Button variant="primary" loading={saving} onClick={() => void save()}><Save size={14} /> Сохранить неделю</Button>
      </div>
      </>
      )}
    </Modal>
  );
}
