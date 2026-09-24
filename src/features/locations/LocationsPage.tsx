import { useEffect, useState } from 'react';
import { MapPin, Plus, Save } from 'lucide-react';
import { AddressAutocomplete } from '../../components/ui/AddressAutocomplete';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { ApiError, locationsApi } from '../../lib/api-client';
import type { ProviderLocation } from '../../types';
import { OpenStreetMapPicker } from './OpenStreetMapPicker';

type LocationForm = {
  locationId?: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
};

const emptyForm: LocationForm = { name: '', address: '', latitude: null, longitude: null };

/**
 * «Пункты проката» — where a provider hands gear over. An address picked from the registry, or a
 * pin on the map; the city comes from the address on the API side. Name is optional.
 */
export function LocationsPage({ embedded = false }: { embedded?: boolean }) {
  const [locations, setLocations] = useState<ProviderLocation[]>([]);
  const [form, setForm] = useState<LocationForm>(emptyForm);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setLocations(await locationsApi.list());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить пункты проката.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const startCreate = () => {
    setForm(emptyForm);
    setError('');
    setEditing(true);
  };

  const startEdit = (location: ProviderLocation) => {
    setForm({
      locationId: location.locationId,
      name: location.name,
      address: location.address,
      latitude: location.latitude ?? null,
      longitude: location.longitude ?? null,
    });
    setError('');
    setEditing(true);
  };

  const save = async () => {
    if (!form.address.trim()) {
      setError('Укажите адрес — выберите его из подсказок или на карте.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        address: form.address.trim(),
        name: form.name.trim() || undefined,
        latitude: form.latitude,
        longitude: form.longitude,
      };
      if (form.locationId) {
        await locationsApi.patch(form.locationId, payload);
      } else {
        await locationsApi.create(payload);
      }
      setEditing(false);
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить пункт проката.');
    } finally {
      setSaving(false);
    }
  };

  const coordinates = form.latitude !== null && form.longitude !== null ? { latitude: form.latitude, longitude: form.longitude } : null;

  return (
    <div className="p-6">
      <div className={embedded ? 'space-y-4' : 'mx-auto max-w-5xl space-y-4'}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Пункты проката</h2>
            <p className="mt-0.5 text-xs text-gray-500">Адреса, где вы выдаёте и принимаете снаряжение. Каждое предложение привязано к одному пункту.</p>
          </div>
          {!editing && (
            <Button size="sm" variant="primary" onClick={startCreate}>
              <Plus size={14} /> Добавить
            </Button>
          )}
        </div>
        {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        {editing && (
          <Card>
            <h3 className="text-sm font-semibold text-gray-900">{form.locationId ? 'Пункт проката' : 'Новый пункт проката'}</h3>
            <div className="mt-3 space-y-3">
              <div className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <AddressAutocomplete
                    label="Адрес"
                    value={form.address}
                    onChange={address => setForm(current => ({ ...current, address }))}
                    onSelect={suggestion => setForm(current => ({
                      ...current,
                      address: suggestion.value,
                      latitude: suggestion.geoLat ? Number(suggestion.geoLat) : current.latitude,
                      longitude: suggestion.geoLon ? Number(suggestion.geoLon) : current.longitude,
                    }))}
                    placeholder="Начните вводить адрес"
                  />
                </div>
                <Button type="button" variant="secondary" onClick={() => setMapOpen(true)} title="Указать на карте">
                  <MapPin size={14} /> На карте
                </Button>
              </div>
              <Input
                label="Название (необязательно)"
                value={form.name}
                onChange={event => setForm(current => ({ ...current, name: event.target.value }))}
                placeholder="Пункт на Ленина, 1"
              />
              {coordinates && (
                <p className="text-[11px] text-gray-500">
                  Точка на карте: {coordinates.latitude.toFixed(5)}, {coordinates.longitude.toFixed(5)}
                </p>
              )}
            </div>
            <OpenStreetMapPicker
              open={mapOpen}
              value={coordinates}
              onClose={() => setMapOpen(false)}
              onAddressSelect={address => setForm(current => ({ ...current, address }))}
              onSave={next => setForm(current => ({ ...current, latitude: next.latitude, longitude: next.longitude }))}
            />
            <div className="mt-4 flex gap-2">
              <Button variant="primary" onClick={() => void save()} loading={saving}>
                <Save size={14} /> Сохранить
              </Button>
              <Button variant="secondary" onClick={() => setEditing(false)} disabled={saving}>
                Отмена
              </Button>
            </div>
          </Card>
        )}
        {!editing && (
          <Card>
            {loading ? (
              <div className="py-10 text-center text-sm text-gray-500">Загружаем пункты проката...</div>
            ) : locations.length === 0 ? (
              <div className="py-10 text-center">
                <MapPin size={24} className="mx-auto text-gray-300" />
                <p className="mt-2 text-sm font-medium text-gray-900">Пунктов проката пока нет.</p>
                <p className="mt-1 text-xs text-gray-500">Добавьте адрес, где вы выдаёте снаряжение, — он понадобится предложениям.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {locations.map(location => (
                  <button
                    key={location.locationId}
                    type="button"
                    onClick={() => startEdit(location)}
                    className="flex w-full items-start justify-between gap-4 py-3 text-left transition hover:bg-gray-50"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-gray-900">{location.name}</span>
                      <span className="mt-0.5 block text-xs text-gray-500">{location.cityName ? `${location.cityName} · ` : ''}{location.address}</span>
                    </span>
                    {location.latitude !== null && location.latitude !== undefined && <MapPin size={14} className="mt-1 shrink-0 text-gray-400" />}
                  </button>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
