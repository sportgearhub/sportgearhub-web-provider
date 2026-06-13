import { Save } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import type { OfferAvailability, Offer } from '../../types';
import { availabilityStatusOptions, DEFAULT_TIMEZONE, type OfferAvailabilityForm } from './availabilityTypes';

interface AvailabilityProfileCardProps {
  offer: Offer | null;
  form: OfferAvailabilityForm;
  availability: OfferAvailability | null;
  saving: boolean;
  onFormChange: (value: OfferAvailabilityForm) => void;
  onSave: () => void;
}

export function AvailabilityProfileCard({
  offer,
  form,
  availability,
  saving,
  onFormChange,
  onSave,
}: AvailabilityProfileCardProps) {
  const isActive = availability?.status === 'active';

  return (
    <Card>
      <CardHeader
        title="Правила бронирования"
        subtitle={offer ? `Предложение: ${offer.title}` : 'Выберите предложение для настройки доступности.'}
        action={<Badge variant={isActive ? 'green' : 'yellow'}>{isActive ? 'Включено' : 'Не настроено'}</Badge>}
      />

      {!offer ? (
        <p className="text-xs text-gray-500">Для настройки доступности необходимо создать предложение.</p>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="Часовой пояс"
              value={form.timezone}
              onChange={event => onFormChange({ ...form, timezone: event.target.value })}
              placeholder={DEFAULT_TIMEZONE}
            />
            <Select
              label="Принимать бронирования"
              value={form.status}
              options={availabilityStatusOptions}
              onChange={event => onFormChange({ ...form, status: event.target.value })}
            />
            <Input
              label="Минимальное время аренды (ч)"
              type="number"
              min="1"
              value={form.minRentHours}
              onChange={event => onFormChange({ ...form, minRentHours: event.target.value })}
            />
            <Input
              label="Максимальное время аренды (ч)"
              type="number"
              min="1"
              value={form.maxRentHours}
              onChange={event => onFormChange({ ...form, maxRentHours: event.target.value })}
            />
          </div>

          {availability && (availability.availabilityWindows.length > 0 || availability.blockedPeriods.length > 0) && (
            <p className="mt-3 text-xs text-gray-500">
              Окна работы: {availability.availabilityWindows.length} · Заблокированные периоды: {availability.blockedPeriods.length}
            </p>
          )}

          <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
            <p className="text-xs text-gray-500">
              Обновлено: {availability?.updatedAt ? new Date(availability.updatedAt).toLocaleString('ru-RU') : 'ещё нет'}
            </p>
            <Button size="sm" variant="primary" onClick={onSave} loading={saving}>
              <Save size={13} /> Сохранить
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
