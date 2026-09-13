import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Select } from '../../components/ui/Select';
import { ApiError, availabilityApi, offerAvailabilityApi, offersApi, resourcesApi } from '../../lib/api-client';
import type {
  AvailabilityDiagnostics,
  CapacitySlot,
  Offer,
  OfferAvailability,
  Resource,
} from '../../types';
import { AvailabilityDiagnosticsCard } from './AvailabilityDiagnosticsCard';
import { AvailabilityProfileCard } from './AvailabilityProfileCard';
import { AvailabilityResourceList } from './AvailabilityResourceList';
import { AvailabilitySlotsCard, OfferScheduleCard } from './AvailabilityScheduleCards';
import {
  DEFAULT_TIMEZONE,
  availabilityModeFor,
  emptyOfferAvailabilityForm,
  emptySlotForm,
  modeLabel,
  offerAvailabilityToForm,
  type OfferAvailabilityForm,
  type SlotForm,
} from './availabilityTypes';

interface AvailabilityPageProps {
  onNavigate?: (path: string) => void;
}

export function AvailabilityPage({ onNavigate }: AvailabilityPageProps) {
  const [resources, setResources] = useState<Resource[]>([]);
  const [selectedResourceId, setSelectedResourceId] = useState('');
  const [offers, setOffers] = useState<Offer[]>([]);
  const [selectedOfferId, setSelectedOfferId] = useState('');
  const [availability, setAvailability] = useState<OfferAvailability | null>(null);
  const [diagnostics, setDiagnostics] = useState<AvailabilityDiagnostics | null>(null);
  const [slots, setSlots] = useState<CapacitySlot[]>([]);
  const [form, setForm] = useState<OfferAvailabilityForm>(emptyOfferAvailabilityForm());
  const [slotForm, setSlotForm] = useState<SlotForm>(emptySlotForm());
  const [loadingResources, setLoadingResources] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [savingSlot, setSavingSlot] = useState(false);
  const [error, setError] = useState('');

  const selectedResource = useMemo(
    () => resources.find(r => r.resourceId === selectedResourceId) ?? null,
    [resources, selectedResourceId]
  );
  const selectedOffer = useMemo(
    () => offers.find(o => o.offerId === selectedOfferId) ?? null,
    [offers, selectedOfferId]
  );
  const expectedMode = availabilityModeFor(selectedResource);
  const scheduledMode = expectedMode === 'scheduled_slot';
  const scheduledProfileReady = scheduledMode && availability?.status === 'active';

  useEffect(() => {
    let cancelled = false;
    setLoadingResources(true);
    setError('');
    resourcesApi.list()
      .then(next => {
        if (cancelled) return;
        setResources(next);
        setSelectedResourceId(current => current || next[0]?.resourceId || '');
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof ApiError ? `Не удалось загрузить позиции: ${err.message}` : 'Не удалось загрузить позиции.');
      })
      .finally(() => { if (!cancelled) setLoadingResources(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selectedResource) {
      setOffers([]);
      setAvailability(null);
      setDiagnostics(null);
      setSlots([]);
      setForm(emptyOfferAvailabilityForm());
      return;
    }

    let cancelled = false;
    const mode = availabilityModeFor(selectedResource);

    const loadDetails = async () => {
      setLoadingDetails(true);
      setError('');
      setAvailability(null);
      setDiagnostics(null);
      setSlots([]);
      setForm(emptyOfferAvailabilityForm());

      try {
        const allOffers = await offersApi.list();
        const resourceOffers = allOffers.filter(
          o => o.primaryResourceId === selectedResource.resourceId || o.resourceId === selectedResource.resourceId
        );
        if (cancelled) return;
        setOffers(resourceOffers);

        const firstOfferId = resourceOffers[0]?.offerId ?? '';
        setSelectedOfferId(firstOfferId);

        if (firstOfferId) {
          try {
            const nextAvail = await offerAvailabilityApi.get(firstOfferId);
            if (!cancelled) { setAvailability(nextAvail); setForm(offerAvailabilityToForm(nextAvail)); }
          } catch (err) {
            if (!cancelled && !(err instanceof ApiError && err.status === 404)) {
              setError(err instanceof ApiError ? `Не удалось загрузить доступность: ${err.message}` : 'Не удалось загрузить доступность.');
            }
          }
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? `Не удалось загрузить предложения: ${err.message}` : 'Не удалось загрузить предложения.');
      }

      try {
        const nextDiagnostics = await availabilityApi.getDiagnostics(selectedResource.resourceId);
        if (!cancelled) setDiagnostics(nextDiagnostics);
      } catch (err) {
        if (!cancelled && !(err instanceof ApiError && err.status === 404)) {
          setError(err instanceof ApiError ? `Не удалось загрузить диагностику: ${err.message}` : 'Не удалось загрузить диагностику.');
        }
      }

      if (mode === 'scheduled_slot') {
        try {
          const nextSlots = await availabilityApi.listSlots(selectedResource.resourceId);
          if (!cancelled) setSlots(nextSlots);
        } catch (err) {
          if (!cancelled) setError(err instanceof ApiError ? `Не удалось загрузить окна записи: ${err.message}` : 'Не удалось загрузить окна записи.');
        }
      }

      if (!cancelled) setLoadingDetails(false);
    };

    void loadDetails();
    return () => { cancelled = true; };
  }, [selectedResource]);

  const handleOfferChange = async (offerId: string) => {
    setSelectedOfferId(offerId);
    setAvailability(null);
    setForm(emptyOfferAvailabilityForm());
    setError('');
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

  const saveAvailability = async () => {
    if (!selectedOfferId || !availability) return;
    setSavingAvailability(true);
    setError('');
    try {
      const next = await offerAvailabilityApi.put(selectedOfferId, {
        timezone: form.timezone.trim() || DEFAULT_TIMEZONE,
        status: form.status,
        slotIntervalMinutes: Number(form.slotIntervalMinutes) || null,
        availabilityWindows: form.windows,
        blockedPeriods: form.blockedPeriods,
      });
      setAvailability(next);
      setForm(offerAvailabilityToForm(next));
      if (selectedResource) {
        const nextDiagnostics = await availabilityApi.getDiagnostics(selectedResource.resourceId).catch(() => null);
        if (nextDiagnostics) setDiagnostics(nextDiagnostics);
      }
    } catch (err) {
      setError(err instanceof ApiError ? `Не удалось сохранить: ${err.message}` : 'Не удалось сохранить.');
    } finally {
      setSavingAvailability(false);
    }
  };

  const createSlot = async () => {
    if (!selectedResource) return;
    setSavingSlot(true);
    setError('');
    try {
      const next = await availabilityApi.createSlot(selectedResource.resourceId, {
        title: slotForm.title.trim() || null,
        startsAt: new Date(slotForm.startsAt).toISOString(),
        endsAt: new Date(slotForm.endsAt).toISOString(),
        totalCapacity: Number(slotForm.totalCapacity) || 1,
        status: 'open',
        meetingPoint: slotForm.meetingPoint.trim() || null,
      });
      setSlots(current => [...current, next].sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
      setSlotForm(emptySlotForm());
    } catch (err) {
      setError(err instanceof ApiError ? `Не удалось создать окно: ${err.message}` : 'Не удалось создать окно.');
    } finally {
      setSavingSlot(false);
    }
  };

  const closeSlot = async (slot: CapacitySlot) => {
    if (!selectedResource) return;
    setSavingSlot(true);
    setError('');
    try {
      const next = await availabilityApi.closeSlot(selectedResource.resourceId, slot.slotId, 'provider_closed');
      setSlots(current => current.map(item => (item.slotId === next.slotId ? next : item)));
    } catch (err) {
      setError(err instanceof ApiError ? `Не удалось закрыть окно: ${err.message}` : 'Не удалось закрыть окно.');
    } finally {
      setSavingSlot(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <AvailabilityResourceList
        resources={resources}
        selectedResourceId={selectedResourceId}
        loading={loadingResources}
        onSelect={setSelectedResourceId}
        onNavigate={onNavigate}
      />

      <main className="min-w-0 flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl space-y-4 p-6">
          {selectedResource && (
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-base font-semibold text-gray-900">{selectedResource.title}</h1>
                <p className="mt-0.5 text-xs text-gray-500">{modeLabel(expectedMode)}</p>
              </div>
              <div className="flex items-center gap-2">
                {offers.length > 1 && (
                  <Select
                    options={offers.map(o => ({ value: o.offerId, label: o.title }))}
                    value={selectedOfferId}
                    onChange={e => void handleOfferChange(e.target.value)}
                  />
                )}
                <Button size="sm" variant="secondary" onClick={() => void handleOfferChange(selectedOfferId)}>
                  <RefreshCw size={13} /> Проверить
                </Button>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <AlertTriangle size={14} /> {error}
            </div>
          )}

          {!selectedResource ? (
            <Card><div className="py-16 text-center text-sm text-gray-500">Выберите прокатную позицию.</div></Card>
          ) : loadingDetails ? (
            <Card><div className="py-16 text-center text-sm text-gray-500">Загружаем настройки доступности...</div></Card>
          ) : offers.length === 0 ? (
            <Card>
              <p className="text-sm font-semibold text-gray-900">Нет предложений</p>
              <p className="mt-1 text-xs leading-5 text-gray-500">
                Создайте предложение для этой позиции, чтобы настроить доступность.
              </p>
              <Button className="mt-3" size="sm" variant="secondary" onClick={() => onNavigate?.(`/resources/${selectedResource.resourceId}?tab=offers`)}>
                Открыть предложения
              </Button>
            </Card>
          ) : (
            <>
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

              <OfferScheduleCard
                form={form}
                saving={savingAvailability}
                onChange={setForm}
                onSave={() => void saveAvailability()}
              />

              {scheduledProfileReady ? (
                <>
                  <AvailabilitySlotsCard
                    slots={slots}
                    form={slotForm}
                    saving={savingSlot}
                    onFormChange={setSlotForm}
                    onCreate={() => void createSlot()}
                    onClose={slot => void closeSlot(slot)}
                  />
                </>
              ) : scheduledMode ? (
                <Card>
                  <div className="flex items-start gap-3">
                    <AlertTriangle size={18} className="mt-0.5 text-amber-600" />
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">Сначала включите правила бронирования</h3>
                      <p className="mt-1 text-xs leading-5 text-gray-500">
                        Расписание и окна записи появятся после сохранения включённых правил.
                      </p>
                    </div>
                  </div>
                </Card>
              ) : null}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
