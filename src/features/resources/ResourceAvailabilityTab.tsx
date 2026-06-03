import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ApiError, availabilityApi } from '../../lib/api-client';
import type {
  AvailabilityDiagnostics,
  AvailabilityProfile,
  CapacitySlot,
  Resource,
} from '../../types';
import { AvailabilityDiagnosticsCard } from '../availability/AvailabilityDiagnosticsCard';
import { AvailabilityProfileCard } from '../availability/AvailabilityProfileCard';
import { AvailabilitySlotsCard } from '../availability/AvailabilityScheduleCards';
import {
  DEFAULT_TIMEZONE,
  availabilityModeFor,
  emptyProfileForm,
  emptySlotForm,
  modeLabel,
  profileToForm,
  type ProfileForm,
  type SlotForm,
} from '../availability/availabilityTypes';

interface ResourceAvailabilityTabProps {
  resource: Resource;
}

export function ResourceAvailabilityTab({ resource }: ResourceAvailabilityTabProps) {
  const [profile, setProfile] = useState<AvailabilityProfile | null>(null);
  const [diagnostics, setDiagnostics] = useState<AvailabilityDiagnostics | null>(null);
  const [slots, setSlots] = useState<CapacitySlot[]>([]);
  const [profileForm, setProfileForm] = useState<ProfileForm>(emptyProfileForm(availabilityModeFor(resource)));
  const [slotForm, setSlotForm] = useState<SlotForm>(emptySlotForm());
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingSlot, setSavingSlot] = useState(false);
  const [error, setError] = useState('');
  const [profileMissing, setProfileMissing] = useState(false);

  const expectedMode = availabilityModeFor(resource);
  const scheduledMode = expectedMode === 'scheduled_slot';
  const scheduledProfileReady = scheduledMode && profile?.status === 'active' && profile.availabilityMode === expectedMode;

  const loadDiagnostics = async (cancelled = false) => {
    try {
      const nextDiagnostics = await availabilityApi.getDiagnostics(resource.resourceId);
      if (!cancelled) setDiagnostics(nextDiagnostics);
    } catch (err) {
      if (!cancelled && !(err instanceof ApiError && err.status === 404)) {
        setError(err instanceof ApiError ? `Не удалось загрузить проверку: ${err.message}` : 'Не удалось загрузить проверку.');
      }
    }
  };

  const loadSlots = async (cancelled = false) => {
    try {
      const nextSlots = await availabilityApi.listSlots(resource.resourceId);
      if (!cancelled) setSlots(nextSlots);
    } catch (err) {
      if (!cancelled) {
        setError(err instanceof ApiError ? `Не удалось загрузить расписание: ${err.message}` : 'Не удалось загрузить расписание.');
      }
    }
  };

  const loadAvailability = async () => {
    let cancelled = false;

    setLoading(true);
    setError('');
    setProfileMissing(false);
    setDiagnostics(null);
    setSlots([]);

    try {
      const nextProfile = await availabilityApi.getProfile(resource.resourceId);
      if (cancelled) return;
      setProfile(nextProfile);
      setProfileForm(profileToForm(nextProfile, expectedMode));
    } catch (err) {
      if (cancelled) return;
      if (err instanceof ApiError && err.status === 404) {
        setProfile(null);
        setProfileMissing(true);
        setProfileForm(emptyProfileForm(expectedMode));
      } else {
        setError(err instanceof ApiError ? `Не удалось загрузить правила: ${err.message}` : 'Не удалось загрузить правила.');
      }
    }

    await loadDiagnostics(cancelled);
    if (expectedMode === 'scheduled_slot') await loadSlots(cancelled);
    if (!cancelled) setLoading(false);

    return () => {
      cancelled = true;
    };
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError('');
      setProfileMissing(false);
      setDiagnostics(null);
      setSlots([]);

      try {
        const nextProfile = await availabilityApi.getProfile(resource.resourceId);
        if (cancelled) return;
        setProfile(nextProfile);
        setProfileForm(profileToForm(nextProfile, expectedMode));
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setProfile(null);
          setProfileMissing(true);
          setProfileForm(emptyProfileForm(expectedMode));
        } else {
          setError(err instanceof ApiError ? `Не удалось загрузить правила: ${err.message}` : 'Не удалось загрузить правила.');
        }
      }

      await loadDiagnostics(cancelled);
      if (expectedMode === 'scheduled_slot') await loadSlots(cancelled);
      if (!cancelled) setLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [resource.resourceId]);

  const saveProfile = async () => {
    setSavingProfile(true);
    setError('');
    try {
      const nextProfile = await availabilityApi.putProfile(resource.resourceId, {
        availabilityMode: expectedMode,
        timezone: profileForm.timezone.trim() || DEFAULT_TIMEZONE,
        bookingHorizonDays: Number(profileForm.bookingHorizonDays) || 30,
        status: profileForm.status || 'active',
      });
      setProfile(nextProfile);
      setProfileForm(profileToForm(nextProfile, expectedMode));
      setProfileMissing(false);
      if (expectedMode === 'scheduled_slot' && nextProfile.status === 'active') await loadSlots();
      await loadDiagnostics();
    } catch (err) {
      setError(err instanceof ApiError ? `Не удалось сохранить правила: ${err.message}` : 'Не удалось сохранить правила.');
    } finally {
      setSavingProfile(false);
    }
  };

  const createSlot = async () => {
    setSavingSlot(true);
    setError('');
    try {
      const nextSlot = await availabilityApi.createSlot(resource.resourceId, {
        title: slotForm.title.trim() || null,
        startsAt: new Date(slotForm.startsAt).toISOString(),
        endsAt: new Date(slotForm.endsAt).toISOString(),
        totalCapacity: Number(slotForm.totalCapacity) || 1,
        status: 'open',
        meetingPoint: slotForm.meetingPoint.trim() || null,
      });
      setSlots(current => [...current, nextSlot].sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
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
      const nextSlot = await availabilityApi.closeSlot(resource.resourceId, slot.slotId, 'provider_closed');
      setSlots(current => current.map(item => (item.slotId === nextSlot.slotId ? nextSlot : item)));
      await loadDiagnostics();
    } catch (err) {
      setError(err instanceof ApiError ? `Не удалось закрыть окно записи: ${err.message}` : 'Не удалось закрыть окно записи.');
    } finally {
      setSavingSlot(false);
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-sm text-gray-500">Загружаем доступность...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Доступность</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            {modeLabel(expectedMode)} · настройте, когда клиенты смогут бронировать эту позицию
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => void loadAvailability()}>
          <RefreshCw size={13} /> Проверить
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
        <AvailabilityProfileCard
          resource={resource}
          form={profileForm}
          missing={profileMissing}
          profile={profile}
          saving={savingProfile}
          onFormChange={setProfileForm}
          onSave={() => void saveProfile()}
        />
        <AvailabilityDiagnosticsCard diagnostics={diagnostics} />
      </div>

      {scheduledProfileReady ? (
        <AvailabilitySlotsCard
          slots={slots}
          form={slotForm}
          saving={savingSlot}
          onFormChange={setSlotForm}
          onCreate={() => void createSlot()}
          onClose={slot => void closeSlot(slot)}
        />
      ) : scheduledMode ? (
        <Card>
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 text-amber-600" />
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Сначала включите правила бронирования</h3>
              <p className="mt-1 text-xs leading-5 text-gray-500">
                Окна записи появятся после сохранения включенных правил бронирования.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <p className="text-sm font-semibold text-gray-900">Инвентарь управляет фактической доступностью</p>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            Для прокатных велосипедов здесь задается горизонт бронирования. Конкретные велосипеды и готовность к прокату находятся во вкладке "Инвентарь".
          </p>
        </Card>
      )}
    </div>
  );
}
