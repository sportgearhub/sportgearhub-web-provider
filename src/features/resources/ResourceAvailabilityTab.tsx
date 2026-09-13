import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Select } from '../../components/ui/Select';
import { ApiError, availabilityApi, offerAvailabilityApi, offersApi } from '../../lib/api-client';
import type {
  AvailabilityDiagnostics,
  CapacitySlot,
  Offer,
  OfferAvailability,
  Resource,
} from '../../types';
import { AvailabilityDiagnosticsCard } from '../availability/AvailabilityDiagnosticsCard';
import { AvailabilityProfileCard } from '../availability/AvailabilityProfileCard';
import { AvailabilitySlotsCard } from '../availability/AvailabilityScheduleCards';
import {
  availabilityModeFor,
  emptyOfferAvailabilityForm,
  emptySlotForm,
  modeLabel,
  offerAvailabilityToForm,
  type OfferAvailabilityForm,
  type SlotForm,
} from '../availability/availabilityTypes';

interface ResourceAvailabilityTabProps {
  resource: Resource;
}

export function ResourceAvailabilityTab({ resource }: ResourceAvailabilityTabProps) {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [selectedOfferId, setSelectedOfferId] = useState('');
  const [availability, setAvailability] = useState<OfferAvailability | null>(null);
  const [diagnostics, setDiagnostics] = useState<AvailabilityDiagnostics | null>(null);
  const [slots, setSlots] = useState<CapacitySlot[]>([]);
  const [form, setForm] = useState<OfferAvailabilityForm>(emptyOfferAvailabilityForm());
  const [slotForm, setSlotForm] = useState<SlotForm>(emptySlotForm());
  const [loading, setLoading] = useState(true);
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [savingSlot, setSavingSlot] = useState(false);
  const [error, setError] = useState('');

  const expectedMode = availabilityModeFor(resource);
  const scheduledMode = expectedMode === 'scheduled_slot';
  const selectedOffer = offers.find(o => o.offerId === selectedOfferId) ?? null;
  const availabilityActive = availability?.status === 'active';
  const scheduledProfileReady = scheduledMode && availabilityActive;

  const loadDiagnostics = async () => {
    try {
      const next = await availabilityApi.getDiagnostics(resource.resourceId);
      setDiagnostics(next);
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) {
        setError(err instanceof ApiError ? `Не удалось загрузить проверку: ${err.message}` : 'Не удалось загрузить проверку.');
      }
    }
  };

  const loadSlots = async () => {
    try {
      setSlots(await availabilityApi.listSlots(resource.resourceId));
    } catch (err) {
      setError(err instanceof ApiError ? `Не удалось загрузить расписание: ${err.message}` : 'Не удалось загрузить расписание.');
    }
  };

  const loadOfferAvailability = async (offerId: string) => {
    setAvailability(null);
    setForm(emptyOfferAvailabilityForm());
    try {
      const next = await offerAvailabilityApi.get(offerId);
      setAvailability(next);
      setForm(offerAvailabilityToForm(next));
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) {
        setError(err instanceof ApiError ? `Не удалось загрузить доступность: ${err.message}` : 'Не удалось загрузить доступность.');
      }
    }
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError('');
      setOffers([]);
      setAvailability(null);
      setDiagnostics(null);
      setSlots([]);

      try {
        const allOffers = await offersApi.list();
        const resourceOffers = allOffers.filter(
          o => o.primaryResourceId === resource.resourceId || o.resourceId === resource.resourceId
        );
        if (cancelled) return;
        setOffers(resourceOffers);

        const firstId = resourceOffers[0]?.offerId ?? '';
        if (firstId) {
          setSelectedOfferId(firstId);
          await loadOfferAvailability(firstId);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? `Не удалось загрузить предложения: ${err.message}` : 'Не удалось загрузить предложения.');
      }

      if (!cancelled) {
        await loadDiagnostics();
        if (scheduledMode) await loadSlots();
        setLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [resource.resourceId]);

  const handleOfferChange = async (offerId: string) => {
    setSelectedOfferId(offerId);
    setError('');
    await loadOfferAvailability(offerId);
  };

  const saveAvailability = async () => {
    if (!selectedOfferId || !availability) return;
    setSavingAvailability(true);
    setError('');
    try {
      const next = await offerAvailabilityApi.put(selectedOfferId, {
        timezone: form.timezone.trim() || 'UTC',
        status: form.status,
        slotIntervalMinutes: Number(form.slotIntervalMinutes) || null,
        availabilityWindows: availability.availabilityWindows,
        blockedPeriods: availability.blockedPeriods,
      });
      setAvailability(next);
      setForm(offerAvailabilityToForm(next));
      await loadDiagnostics();
    } catch (err) {
      setError(err instanceof ApiError ? `Не удалось сохранить: ${err.message}` : 'Не удалось сохранить.');
    } finally {
      setSavingAvailability(false);
    }
  };

  const createSlot = async () => {
    setSavingSlot(true);
    setError('');
    try {
      const next = await availabilityApi.createSlot(resource.resourceId, {
        title: slotForm.title.trim() || null,
        startsAt: new Date(slotForm.startsAt).toISOString(),
        endsAt: new Date(slotForm.endsAt).toISOString(),
        totalCapacity: Number(slotForm.totalCapacity) || 1,
        status: 'open',
        meetingPoint: slotForm.meetingPoint.trim() || null,
      });
      setSlots(current => [...current, next].sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
      setSlotForm(emptySlotForm());
      await loadDiagnostics();
    } catch (err) {
      setError(err instanceof ApiError ? `Не удалось создать окно записи: ${err.message}` : 'Не удалось создать окно записи.');
    } finally {
      setSavingSlot(false);
    }
  };

  const closeSlot = async (slot: CapacitySlot) => {
    setSavingSlot(true);
    setError('');
    try {
      const next = await availabilityApi.closeSlot(resource.resourceId, slot.slotId, 'provider_closed');
      setSlots(current => current.map(item => (item.slotId === next.slotId ? next : item)));
      await loadDiagnostics();
    } catch (err) {
      setError(err instanceof ApiError ? `Не удалось закрыть окно: ${err.message}` : 'Не удалось закрыть окно.');
    } finally {
      setSavingSlot(false);
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-sm text-gray-500">Загружаем доступность...</div>;
  }

  return (
    <div className="space-y-4 px-6 py-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Доступность</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            {modeLabel(expectedMode)} · настройки применяются к выбранному предложению
          </p>
        </div>
        <div className="flex items-center gap-2">
          {offers.length > 1 && (
            <Select
              options={offers.map(o => ({ value: o.offerId, label: o.title }))}
              value={selectedOfferId}
              onChange={e => void handleOfferChange(e.target.value)}
            />
          )}
          <Button size="sm" variant="secondary" onClick={() => void loadOfferAvailability(selectedOfferId).then(loadDiagnostics)}>
            <RefreshCw size={13} /> Проверить
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {offers.length === 0 ? (
        <Card>
          <p className="text-sm font-semibold text-gray-900">Нет предложений</p>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            Создайте предложение во вкладке «Предложения», чтобы настроить доступность.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
          <AvailabilityProfileCard
            offer={selectedOffer}
            form={form}
            availability={availability}
            saving={savingAvailability}
            onFormChange={setForm}
            onSave={() => void saveAvailability()}
          />
          <AvailabilityDiagnosticsCard diagnostics={diagnostics} />
        </div>
      )}

      {scheduledProfileReady ? (
        <AvailabilitySlotsCard
          slots={slots}
          form={slotForm}
          saving={savingSlot}
          onFormChange={setSlotForm}
          onCreate={() => void createSlot()}
          onClose={slot => void closeSlot(slot)}
        />
      ) : scheduledMode && offers.length > 0 ? (
        <Card>
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 text-amber-600" />
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Сначала включите правила бронирования</h3>
              <p className="mt-1 text-xs leading-5 text-gray-500">
                Окна записи появятся после сохранения включённых правил бронирования.
              </p>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
