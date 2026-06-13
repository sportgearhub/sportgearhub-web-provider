import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Archive, Check, ChevronDown, CreditCard as Edit2, Plus, Trash2 } from 'lucide-react';
import { ActionMenu } from '../../components/ui/ActionMenu';
import { Button } from '../../components/ui/Button';
import { IconTooltip } from '../../components/ui/IconTooltip';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import type { ResourceInventorySummary, ResourceUnit } from '../../types';
import { emptyUnitForm, type UnitForm } from './availabilityTypes';

interface InventoryParkCardProps {
  summary: ResourceInventorySummary | null;
  units: ResourceUnit[];
  form: UnitForm;
  saving: boolean;
  error?: string;
  onFormChange: (value: UnitForm) => void;
  onSave: () => Promise<boolean>;
  onEdit: (unit: ResourceUnit) => void;
  onArchive: (unit: ResourceUnit) => void;
  onDelete: (unit: ResourceUnit) => void;
  onQuickPatch: (unitId: string, patch: { status?: string; conditionStatus?: string }) => Promise<void>;
  onNavigate?: (path: string) => void;
  onOpenStockBalance?: () => void;
}

type BadgeVariant = 'green' | 'yellow' | 'red' | 'blue' | 'gray' | 'orange' | 'teal';

interface StatusOption {
  value: string;
  label: string;
  variant: BadgeVariant;
}

const STATUS_OPTIONS: StatusOption[] = [
  { value: 'available', label: 'Доступен', variant: 'green' },
  { value: 'in_use', label: 'В использовании', variant: 'blue' },
  { value: 'maintenance', label: 'В ремонте', variant: 'yellow' },
  { value: 'lost', label: 'Потерян', variant: 'red' },
  { value: 'retired', label: 'Списан', variant: 'gray' },
];

const CONDITION_OPTIONS: StatusOption[] = [
  { value: 'ready', label: 'Готова', variant: 'green' },
  { value: 'needs_inspection', label: 'Нужна проверка', variant: 'orange' },
  { value: 'maintenance', label: 'В ремонте', variant: 'yellow' },
  { value: 'damaged', label: 'Повреждена', variant: 'red' },
  { value: 'retired', label: 'Списана', variant: 'gray' },
];

const PILL_COLORS: Record<BadgeVariant, { badge: string; dot: string }> = {
  green: { badge: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:ring-emerald-300', dot: 'bg-emerald-500' },
  yellow: { badge: 'border-amber-200 bg-amber-50 text-amber-700 hover:ring-amber-300', dot: 'bg-amber-400' },
  red: { badge: 'border-red-200 bg-red-50 text-red-700 hover:ring-red-300', dot: 'bg-red-500' },
  blue: { badge: 'border-blue-200 bg-blue-50 text-blue-700 hover:ring-blue-300', dot: 'bg-blue-500' },
  gray: { badge: 'border-border bg-muted text-muted-foreground hover:ring-gray-300', dot: 'bg-gray-400' },
  orange: { badge: 'border-orange-200 bg-orange-50 text-orange-700 hover:ring-orange-300', dot: 'bg-orange-500' },
  teal: { badge: 'border-teal-200 bg-teal-50 text-teal-700 hover:ring-teal-300', dot: 'bg-teal-500' },
};

function StatusPill({
  value,
  options,
  disabled,
  onSelect,
}: {
  value: string;
  options: StatusOption[];
  disabled?: boolean;
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const current = options.find(o => o.value === value) ?? { label: value || '—', variant: 'gray' as BadgeVariant };
  const colors = PILL_COLORS[current.variant];

  const toggle = () => {
    if (open) {
      setOpen(false);
    } else {
      setRect(btnRef.current?.getBoundingClientRect() ?? null);
      setOpen(true);
    }
  };

  useEffect(() => {
    if (!open) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node)) return;
      if (dropRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const close = () => setOpen(false);
    document.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  const dropdown = open && !disabled && rect && createPortal(
    <div
      ref={dropRef}
      style={{ position: 'fixed', top: rect.bottom + 4, left: rect.left, zIndex: 9999 }}
      className="min-w-[148px] rounded-lg border border-gray-200 bg-white p-1 shadow-xl"
    >
      {options.map(opt => {
        const isSelected = opt.value === value;
        const optColors = PILL_COLORS[opt.variant];
        return (
          <button
            key={opt.value}
            type="button"
            role="option"
            aria-selected={isSelected}
            onClick={() => {
              onSelect(opt.value);
              setOpen(false);
            }}
            className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition
              ${isSelected ? 'bg-blue-50 text-blue-900' : 'text-gray-800 hover:bg-gray-50'}
            `}
          >
            <span className={`inline-flex h-2 w-2 shrink-0 rounded-full ${optColors.dot}`} />
            <span className="flex-1 font-medium">{opt.label}</span>
            {isSelected && <Check size={12} className="shrink-0 text-blue-600" />}
          </button>
        );
      })}
    </div>,
    document.body,
  );

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={toggle}
        className={`group inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-all
          ${colors.badge}
          ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:shadow-sm hover:ring-1'}
        `}
      >
        {current.label}
        {!disabled && (
          <ChevronDown
            size={10}
            className={`shrink-0 transition-all ${open ? 'rotate-180 opacity-70' : 'opacity-0 group-hover:opacity-60'}`}
          />
        )}
      </button>
      {dropdown}
    </>
  );
}

export function InventoryParkCard({
  summary,
  units,
  form,
  saving,
  error = '',
  onFormChange,
  onSave,
  onEdit,
  onArchive,
  onDelete,
  onQuickPatch,
  onOpenStockBalance,
}: InventoryParkCardProps) {
  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const warnings = buildInventoryWarnings(summary);

  const openCreateModal = () => {
    onFormChange(emptyUnitForm());
    setUnitModalOpen(true);
  };

  const openEditModal = (unit: ResourceUnit) => {
    onEdit(unit);
    setUnitModalOpen(true);
  };

  const saveFromModal = async () => {
    const saved = await onSave();
    if (saved) setUnitModalOpen(false);
  };

  return (
    <div>
      <div className="flex items-start justify-between border-b border-gray-200 px-6 py-3">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-gray-900">Инвентарь</h3>
          </div>
          <div className="mt-1 flex gap-6 text-xs text-gray-500">
            <span>Всего: <strong className="text-gray-900">{summary?.totalUnits ?? 0}</strong></span>
            <span>Готовы: <strong className="text-gray-900">{summary?.readyUnits ?? 0}</strong></span>
            <span>В ремонте: <strong className="text-gray-900">{summary?.maintenanceUnits ?? 0}</strong></span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onOpenStockBalance && (
            <Button size="sm" variant="secondary" onClick={onOpenStockBalance}>
              Обновить остатки
            </Button>
          )}
          <Button size="sm" variant="primary" onClick={openCreateModal}>
            <Plus size={13} /> Добавить велосипед
          </Button>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="border-b border-gray-100 px-6 py-2 space-y-1.5">
          {warnings.map(warning => (
            <div key={warning} className="flex items-center justify-between gap-3 text-xs text-amber-700">
              <span>{warning}</span>
            </div>
          ))}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full table-fixed text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="w-[16%] px-3 py-1.5 text-left">Инвентарный код</th>
              <th className="w-[14%] px-3 py-1.5 text-left">Внешний код</th>
              <th className="w-[18%] px-3 py-1.5 text-left">Заметки</th>
              <th className="w-[12%] px-3 py-1.5 text-left">Статус</th>
              <th className="w-[13%] px-3 py-1.5 text-left">Состояние</th>
              <th className="w-[11%] px-3 py-1.5 text-left">Создан</th>
              <th className="w-[11%] px-3 py-1.5 text-left">Изменён</th>
              <th className="w-[9%] px-3 py-1.5"></th>
            </tr>
          </thead>
          <tbody>
            {units.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-sm text-gray-500">Добавьте конкретные велосипеды.</td>
              </tr>
            ) : units.map(unit => {
              return (
                <tr key={unit.unitId} className="border-t border-gray-100">
                  <td className="px-3 py-1.5">
                    <span className="block truncate font-medium text-gray-900">{unit.inventoryCode || '—'}</span>
                  </td>
                  <td className="px-3 py-1.5 text-xs text-gray-500 truncate">{unit.externalReferenceCode || '—'}</td>
                  <td className="px-3 py-1.5 text-gray-700 truncate">{unit.notes || <span className="text-gray-400">—</span>}</td>
                  <td className="px-3 py-1.5">
                    <StatusPill
                      value={unit.status}
                      options={STATUS_OPTIONS}
                      disabled={saving}
                      onSelect={value => void onQuickPatch(unit.unitId, { status: value })}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <StatusPill
                      value={unit.conditionStatus ?? ''}
                      options={CONDITION_OPTIONS}
                      disabled={saving}
                      onSelect={value => void onQuickPatch(unit.unitId, { conditionStatus: value })}
                    />
                  </td>
                  <td className="px-3 py-1.5 text-xs text-gray-500">{fmtDate(unit.createdAt)}</td>
                  <td className="px-3 py-1.5 text-xs text-gray-500">{fmtDate(unit.updatedAt)}</td>
                  <td className="px-3 py-1.5 text-right">
                    <ActionMenu
                      label={`Действия с велосипедом ${unit.inventoryCode || ''}`}
                      disabled={saving}
                      items={[
                        { label: 'Изменить', icon: <Edit2 size={14} />, onClick: () => openEditModal(unit) },
                        { label: 'Убрать из проката', icon: <Archive size={14} />, onClick: () => onArchive(unit), disabled: saving },
                        { label: 'Удалить навсегда', icon: <Trash2 size={14} />, onClick: () => onDelete(unit), danger: true, disabled: saving },
                      ]}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal
        open={unitModalOpen}
        onClose={() => {
          if (!saving) setUnitModalOpen(false);
        }}
        title={form.unitId ? 'Изменить велосипед' : 'Добавить велосипед'}
        size="md"
      >
        <div className="space-y-4">
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-foreground">Номер на наклейке</span>
              <IconTooltip label="Что такое номер на наклейке">
                Код, который видит сотрудник на самом велосипеде: наклейка, бирка, гравировка или инвентарный номер.
              </IconTooltip>
            </div>
            <Input value={form.inventoryCode} onChange={event => onFormChange({ ...form, inventoryCode: event.target.value })} placeholder="BIKE-001" />
          </div>

          {form.unitId && (
            <div className="grid gap-3 md:grid-cols-2">
              <Select
                label="Статус"
                options={[
                  { value: 'available', label: 'Доступен' },
                  { value: 'in_use', label: 'В использовании' },
                  { value: 'retired', label: 'Списан' },
                  { value: 'lost', label: 'Потерян' },
                ]}
                value={form.status}
                onChange={event => onFormChange({ ...form, status: event.target.value })}
              />
              <Select
                label="Техническое состояние"
                options={[
                  { value: 'ready', label: 'Готова' },
                  { value: 'maintenance', label: 'Ремонт' },
                  { value: 'damaged', label: 'Повреждена' },
                ]}
                value={form.conditionStatus}
                onChange={event => onFormChange({ ...form, conditionStatus: event.target.value })}
              />
            </div>
          )}

          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-foreground">Внутренний код</span>
              <IconTooltip label="Что такое внутренний код">
                Необязательно. Укажите номер из вашей учетной системы, таблицы или CRM, если ведете отдельный учет.
              </IconTooltip>
            </div>
            <Input value={form.externalReferenceCode} onChange={event => onFormChange({ ...form, externalReferenceCode: event.target.value })} placeholder="ASSET-0091" />
          </div>

          <Textarea
            label="Заметки"
            value={form.notes}
            onChange={event => onFormChange({ ...form, notes: event.target.value })}
            rows={2}
            placeholder="Например: царапина на раме"
          />

          <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
            <Button variant="secondary" onClick={() => setUnitModalOpen(false)} disabled={saving}>
              Отмена
            </Button>
            <Button variant="primary" onClick={() => void saveFromModal()} loading={saving}>
              {form.unitId ? 'Сохранить' : 'Добавить'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}


function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function buildInventoryWarnings(summary: ResourceInventorySummary | null) {
  const warnings: string[] = [];
  if ((summary?.totalUnits ?? 0) === 0) warnings.push('Добавьте конкретные велосипеды.');
  if ((summary?.readyUnits ?? 0) === 0) warnings.push('Нет готовых к прокату единиц.');
  if ((summary?.maintenanceUnits ?? 0) > 0) warnings.push(`В ремонте: ${summary?.maintenanceUnits} ед.`);
  if ((summary?.damagedUnits ?? 0) > 0) warnings.push(`Повреждены: ${summary?.damagedUnits} ед.`);
  return warnings;
}
