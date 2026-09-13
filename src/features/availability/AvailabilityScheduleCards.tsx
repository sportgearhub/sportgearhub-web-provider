import { Save } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import type { CapacitySlot, OfferAvailabilityBlockedPeriod, OfferAvailabilityWindow } from '../../types';
import {
  emptyAvailabilityWindow,
  emptyBlockedPeriod,
  toTimeInput,
  type OfferAvailabilityForm,
  type SlotForm,
} from './availabilityTypes';

interface OfferScheduleCardProps {
  form: OfferAvailabilityForm;
  saving: boolean;
  onChange: (value: OfferAvailabilityForm) => void;
  onSave: () => void;
}

export function OfferScheduleCard({ form, saving, onChange, onSave }: OfferScheduleCardProps) {
  const updateWindow = (index: number, patch: Partial<OfferAvailabilityWindow>) => {
    onChange({
      ...form,
      windows: form.windows.map((window, windowIndex) => (windowIndex === index ? { ...window, ...patch } : window)),
    });
  };
  const updateBlock = (index: number, patch: Partial<OfferAvailabilityBlockedPeriod>) => {
    onChange({
      ...form,
      blockedPeriods: form.blockedPeriods.map((block, blockIndex) => (blockIndex === index ? { ...block, ...patch } : block)),
    });
  };

  return (
    <Card>
      <CardHeader
        title="Расписание"
        subtitle="Периоды, когда предложение доступно, и часы работы внутри них."
        action={<Button size="sm" variant="primary" onClick={onSave} loading={saving}><Save size={13} /> Сохранить</Button>}
      />
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-gray-500">Часовой пояс — {form.timezone}. Меняется в правилах бронирования.</p>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onChange({ ...form, windows: [...form.windows, emptyAvailabilityWindow()] })}
          >
            Добавить период
          </Button>
        </div>

        <div className="space-y-2">
          {form.windows.length === 0 ? (
            <div className="rounded-md border border-dashed border-gray-200 px-3 py-6 text-center text-sm text-gray-500">
              Добавьте период работы — например сезон с часами выдачи.
            </div>
          ) : form.windows.map((window, index) => (
            <div key={index} className="grid gap-2 rounded-md border border-gray-100 bg-gray-50 p-2 md:grid-cols-[1fr_1fr_110px_110px_80px]">
              <Input type="date" value={window.startsOn ?? ''} onChange={event => updateWindow(index, { startsOn: event.target.value })} />
              <Input type="date" value={window.endsOn ?? ''} onChange={event => updateWindow(index, { endsOn: event.target.value })} />
              <Input type="time" value={toTimeInput(window.dailyOpensAt)} onChange={event => updateWindow(index, { dailyOpensAt: event.target.value })} />
              <Input type="time" value={toTimeInput(window.dailyClosesAt)} onChange={event => updateWindow(index, { dailyClosesAt: event.target.value })} />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onChange({ ...form, windows: form.windows.filter((_, windowIndex) => windowIndex !== index) })}
              >
                Удалить
              </Button>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 pt-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Закрытые даты</h3>
            <p className="text-xs text-gray-500">Дни, когда бронирование временно недоступно.</p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onChange({ ...form, blockedPeriods: [...form.blockedPeriods, emptyBlockedPeriod()] })}
          >
            Закрыть даты
          </Button>
        </div>
        <div className="space-y-2">
          {form.blockedPeriods.map((block, index) => (
            <div key={index} className="grid gap-2 rounded-md border border-gray-100 bg-gray-50 p-2 md:grid-cols-[1fr_1fr_1fr_80px]">
              <Input type="date" value={block.startsOn ?? ''} onChange={event => updateBlock(index, { startsOn: event.target.value })} />
              <Input type="date" value={block.endsOn ?? ''} onChange={event => updateBlock(index, { endsOn: event.target.value })} />
              <Input value={block.reasonCode ?? ''} onChange={event => updateBlock(index, { reasonCode: event.target.value })} placeholder="Причина, например ремонт" />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onChange({ ...form, blockedPeriods: form.blockedPeriods.filter((_, blockIndex) => blockIndex !== index) })}
              >
                Удалить
              </Button>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

interface AvailabilitySlotsCardProps {
  slots: CapacitySlot[];
  form: SlotForm;
  saving: boolean;
  onFormChange: (value: SlotForm) => void;
  onCreate: () => void;
  onClose: (slot: CapacitySlot) => void;
}

export function AvailabilitySlotsCard({
  slots,
  form,
  saving,
  onFormChange,
  onCreate,
  onClose,
}: AvailabilitySlotsCardProps) {
  return (
    <Card>
      <CardHeader title="Окна записи" subtitle="Создайте конкретное время, на которое клиент сможет записаться." />
      <div className="grid gap-2 border-b border-gray-100 pb-4 md:grid-cols-[1fr_180px_180px_110px]">
        <Input label="Название" value={form.title} onChange={event => onFormChange({ ...form, title: event.target.value })} placeholder="Утренняя группа" />
        <Input label="Начало" type="datetime-local" value={form.startsAt} onChange={event => onFormChange({ ...form, startsAt: event.target.value })} />
        <Input label="Конец" type="datetime-local" value={form.endsAt} onChange={event => onFormChange({ ...form, endsAt: event.target.value })} />
        <Input label="Мест" type="number" min="1" value={form.totalCapacity} onChange={event => onFormChange({ ...form, totalCapacity: event.target.value })} />
      </div>
      <div className="mt-3 flex items-end gap-2">
        <Input label="Место встречи" value={form.meetingPoint} onChange={event => onFormChange({ ...form, meetingPoint: event.target.value })} placeholder="Адрес или ориентир" />
        <Button size="sm" variant="primary" onClick={onCreate} loading={saving} disabled={!form.startsAt || !form.endsAt}>
          Создать окно
        </Button>
      </div>
      <div className="mt-4 overflow-hidden rounded-md border border-gray-100">
        <table className="w-full table-fixed text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="px-3 py-2 text-left">Окно</th>
              <th className="px-3 py-2 text-left">Время</th>
              <th className="px-3 py-2 text-right">Места</th>
              <th className="px-3 py-2 text-left">Состояние</th>
              <th className="px-3 py-2 text-right">Действия</th>
            </tr>
          </thead>
          <tbody>
            {slots.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-sm text-gray-500">Окон записи пока нет.</td>
              </tr>
            ) : slots.map(slot => (
              <tr key={slot.slotId} className="border-t border-gray-100">
                <td className="px-3 py-2">
                  <p className="truncate font-medium text-gray-900">{slot.title || 'Окно записи'}</p>
                  {slot.meetingPoint && <p className="truncate text-xs text-gray-500">{slot.meetingPoint}</p>}
                </td>
                <td className="px-3 py-2 text-gray-700">
                  {new Date(slot.startsAt).toLocaleString('ru-RU')}<br />
                  <span className="text-xs text-gray-500">{new Date(slot.endsAt).toLocaleString('ru-RU')}</span>
                </td>
                <td className="px-3 py-2 text-right text-gray-700">{slot.availableCapacity}/{slot.totalCapacity}</td>
                <td className="px-3 py-2">
                  <Badge variant={slot.status === 'open' ? 'green' : slot.status === 'cancelled' ? 'red' : 'gray'}>{slotStatusLabel(slot.status)}</Badge>
                </td>
                <td className="px-3 py-2 text-right">
                  <Button size="sm" variant="secondary" onClick={() => onClose(slot)} disabled={saving || slot.status !== 'open'}>
                    Закрыть
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function slotStatusLabel(status: string) {
  if (status === 'open') return 'Открыто';
  if (status === 'closed') return 'Закрыто';
  if (status === 'cancelled') return 'Отменено';
  return status;
}
