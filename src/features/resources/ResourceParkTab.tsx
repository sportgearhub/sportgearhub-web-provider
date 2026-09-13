import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { ApiError, availabilityApi } from '../../lib/api-client';
import type { Resource, ResourceInventorySummary, ResourceUnit } from '../../types';
import {
  AllocationCard,
  allocationToForm,
  emptyAllocationForm,
  type AllocationForm,
} from '../availability/AllocationCard';
import { InventoryParkCard } from '../availability/InventoryParkCard';
import { emptyUnitForm, unitToForm, type UnitForm } from '../availability/availabilityTypes';
import { StockBalancePage } from './StockBalancePage';

interface ResourceParkTabProps {
  resource: Resource;
  onNavigate?: (path: string) => void;
}

type ParkView = 'list' | 'stock-balance';

export function ResourceParkTab({ resource, onNavigate }: ResourceParkTabProps) {
  const [view, setView] = useState<ParkView>('list');
  const [summary, setSummary] = useState<ResourceInventorySummary | null>(null);
  const [units, setUnits] = useState<ResourceUnit[]>([]);
  const [form, setForm] = useState<UnitForm>(emptyUnitForm());
  const [allocationForm, setAllocationForm] = useState<AllocationForm>(emptyAllocationForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingAllocation, setSavingAllocation] = useState(false);
  const [error, setError] = useState('');
  const [unitError, setUnitError] = useState('');
  const [allocationError, setAllocationError] = useState('');

  const loadPark = async () => {
    setLoading(true);
    setError('');
    try {
      const [nextSummary, nextUnits, nextAllocation] = await Promise.all([
        availabilityApi.getInventorySummary(resource.resourceId),
        availabilityApi.listUnits(resource.resourceId),
        // No allocation row yet is the normal starting state — it means "count the ready units".
        availabilityApi.getAllocation(resource.resourceId).catch(() => null),
      ]);
      setSummary(nextSummary);
      setUnits(nextUnits);
      setAllocationForm(nextAllocation ? allocationToForm(nextAllocation) : emptyAllocationForm());
    } catch (err) {
      setError(err instanceof ApiError ? `Не удалось загрузить инвентарь: ${err.message}` : 'Не удалось загрузить инвентарь.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPark();
  }, [resource.resourceId]);

  const saveAllocation = async () => {
    setSavingAllocation(true);
    setAllocationError('');
    try {
      const sharedInventory = allocationForm.allocationMode === 'shared_inventory';
      const next = await availabilityApi.putAllocation(resource.resourceId, {
        allocationMode: allocationForm.allocationMode,
        baseQuantity: sharedInventory ? Number(allocationForm.baseQuantity) || 0 : null,
        allocationRules: {
          maxPerBooking: Number(allocationForm.maxPerBooking) || null,
          maxConcurrent: Number(allocationForm.maxConcurrent) || null,
          sharedPoolCode: allocationForm.sharedPoolCode.trim() || null,
        },
        status: 'active',
      });
      setAllocationForm(allocationToForm(next));
      setSummary(await availabilityApi.getInventorySummary(resource.resourceId).catch(() => summary));
    } catch (err) {
      setAllocationError(err instanceof ApiError ? `Не удалось сохранить правила: ${err.message}` : 'Не удалось сохранить правила.');
    } finally {
      setSavingAllocation(false);
    }
  };

  const saveUnit = async () => {
    setSaving(true);
    setUnitError('');
    try {
      const payload = {
        inventoryCode: form.inventoryCode.trim() || null,
        notes: form.notes.trim() || null,
        status: form.status || 'available',
        conditionStatus: form.conditionStatus || 'ready',
        externalReferenceCode: form.externalReferenceCode.trim() || null,
      };
      if (form.unitId) {
        await availabilityApi.patchUnit(resource.resourceId, form.unitId, payload);
      } else {
        await availabilityApi.createUnit(resource.resourceId, payload);
      }
      setForm(emptyUnitForm());
      await loadPark();
      return true;
    } catch (err) {
      setUnitError(err instanceof ApiError ? `Не удалось сохранить велосипед: ${err.message}` : 'Не удалось сохранить велосипед.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const quickPatch = async (unitId: string, patch: { status?: string; conditionStatus?: string }) => {
    setSaving(true);
    setError('');
    try {
      await availabilityApi.patchUnit(resource.resourceId, unitId, patch);
      await loadPark();
    } catch (err) {
      setError(err instanceof ApiError ? `Не удалось сохранить: ${err.message}` : 'Не удалось сохранить.');
    } finally {
      setSaving(false);
    }
  };

  const archiveUnit = async (unit: ResourceUnit) => {
    setSaving(true);
    setError('');
    setUnitError('');
    try {
      await availabilityApi.archiveUnit(resource.resourceId, unit.unitId);
      await loadPark();
    } catch (err) {
      setError(err instanceof ApiError ? `Не удалось убрать велосипед: ${err.message}` : 'Не удалось убрать велосипед.');
    } finally {
      setSaving(false);
    }
  };

  const deleteUnit = async (unit: ResourceUnit) => {
    setSaving(true);
    setError('');
    setUnitError('');
    try {
      await availabilityApi.deleteUnit(resource.resourceId, unit.unitId);
      await loadPark();
    } catch (err) {
      setError(err instanceof ApiError ? `Не удалось удалить велосипед: ${err.message}` : 'Не удалось удалить велосипед.');
    } finally {
      setSaving(false);
    }
  };

  if (resource.capacityMode === 'scheduled_slot') {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
        У этой позиции доступность работает по расписанию. Инвентарь нужен для прокатных позиций.
      </div>
    );
  }

  if (view === 'stock-balance') {
    return (
      <StockBalancePage
        resource={resource}
        onBack={() => { setView('list'); void loadPark(); }}
      />
    );
  }

  if (loading) {
    return <div className="py-12 text-center text-sm text-gray-500">Загружаем инвентарь...</div>;
  }

  return (
    <div>
      {error && (
        <div className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-6 py-2 text-xs text-red-700">
          <AlertTriangle size={14} /> {error}
        </div>
      )}
      <AllocationCard
        form={allocationForm}
        saving={savingAllocation}
        error={allocationError}
        onChange={value => {
          setAllocationError('');
          setAllocationForm(value);
        }}
        onSave={() => void saveAllocation()}
      />
      <InventoryParkCard
        summary={summary}
        units={units}
        form={form}
        saving={saving}
        error={unitError}
        onFormChange={value => {
          setUnitError('');
          setForm(value);
        }}
        onSave={saveUnit}
        onEdit={unit => setForm(unitToForm(unit))}
        onArchive={unit => void archiveUnit(unit)}
        onDelete={unit => void deleteUnit(unit)}
        onQuickPatch={(unitId, patch) => quickPatch(unitId, patch)}
        onNavigate={onNavigate}
        onOpenStockBalance={() => setView('stock-balance')}
      />
    </div>
  );
}
