import { useEffect, useRef, useState } from 'react';
import { LocateFixed, MapPin, Minus, Plus, Search, X } from 'lucide-react';
import maplibregl, { type Map, type StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { addressesApi, ApiError, type RuAddressSuggestion } from '../../lib/api-client';

type Coordinates = {
  latitude: number;
  longitude: number;
};

type MapStyleKey = 'balanced' | 'light';

interface OpenStreetMapPickerProps {
  open: boolean;
  value: Coordinates | null;
  onSave: (coordinates: Coordinates) => void;
  onAddressSelect?: (address: string) => void;
  onClose: () => void;
}

const DEFAULT_CENTER: Coordinates = {
  latitude: 54.7388,
  longitude: 55.9721,
};

const mapStyles: Record<MapStyleKey, StyleSpecification> = {
  balanced: {
    version: 8,
    sources: {
      cartoVoyager: {
        type: 'raster',
        tiles: ['https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors © CARTO',
      },
    },
    layers: [
      {
        id: 'carto-voyager',
        type: 'raster',
        source: 'cartoVoyager',
      },
    ],
  },
  light: {
    version: 8,
    sources: {
      cartoLight: {
        type: 'raster',
        tiles: ['https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors © CARTO',
      },
    },
    layers: [
      {
        id: 'carto-light',
        type: 'raster',
        source: 'cartoLight',
      },
    ],
  },
};

export function OpenStreetMapPicker({ open, value, onSave, onAddressSelect, onClose }: OpenStreetMapPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const lastAppliedValueRef = useRef('');
  const suppressNextValueSyncRef = useRef(false);
  const selectedAddressRef = useRef<string | null>(null);
  const wheelDeltaRef = useRef(0);
  const lastWheelZoomRef = useRef(0);
  const reverseGeocodeRequestRef = useRef(0);
  const lastReverseGeocodeKeyRef = useRef('');
  const needsReverseGeocodeRef = useRef(false);
  const suppressNextSuggestionLookupRef = useRef(false);
  const [query, setQuery] = useState('');
  const [draftCoordinates, setDraftCoordinates] = useState<Coordinates | null>(value);
  const [detectedAddress, setDetectedAddress] = useState('');
  const [suggestions, setSuggestions] = useState<RuAddressSuggestion[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestError, setSuggestError] = useState('');
  const [mapStyleKey, setMapStyleKey] = useState<MapStyleKey>('balanced');
  const [locatingUser, setLocatingUser] = useState(false);
  const [geoNotice, setGeoNotice] = useState('');
  const center = value ?? DEFAULT_CENTER;

  const setMapDrivenQuery = (value: string) => {
    suppressNextSuggestionLookupRef.current = true;
    setQuery(value);
    setSuggestions([]);
    setSuggestionsOpen(false);
    setSuggestError('');
    setLoadingSuggestions(false);
  };

  const markMapMoving = () => {
    reverseGeocodeRequestRef.current += 1;
    needsReverseGeocodeRef.current = true;
    selectedAddressRef.current = null;
    setDetectedAddress('');
    setMapDrivenQuery('Определяем адрес...');
  };

  const updateFromCenter = (map: Map) => {
    const nextCenter = map.getCenter();
    const coordinates = {
      latitude: roundCoordinate(nextCenter.lat),
      longitude: roundCoordinate(nextCenter.lng),
    };
    const nextKey = coordinatesKey(coordinates);
    lastAppliedValueRef.current = coordinatesKey(coordinates);
    suppressNextValueSyncRef.current = true;
    setDraftCoordinates(coordinates);
    if (lastReverseGeocodeKeyRef.current !== nextKey || needsReverseGeocodeRef.current) {
      reverseGeocodeAt(coordinates);
    }
  };

  const reverseGeocodeAt = async (coordinates: Coordinates) => {
    const requestId = reverseGeocodeRequestRef.current + 1;
    reverseGeocodeRequestRef.current = requestId;
    needsReverseGeocodeRef.current = false;
    lastReverseGeocodeKeyRef.current = coordinatesKey(coordinates);

    try {
      const response = await addressesApi.ruGeolocate({
        lat: coordinates.latitude,
        lon: coordinates.longitude,
        count: 1,
        radiusMeters: 100,
        language: 'ru',
      });
      if (reverseGeocodeRequestRef.current !== requestId) return;

      const address = response.suggestions[0]?.value ?? '';
      setDetectedAddress(address);
      selectedAddressRef.current = address || null;
      setMapDrivenQuery(address);
    } catch {
      if (reverseGeocodeRequestRef.current !== requestId) return;
      setDetectedAddress('');
      setMapDrivenQuery('');
    }
  };

  const applyCoordinates = (coordinates: Coordinates, zoom = 16) => {
    const nextCoordinates = {
      latitude: roundCoordinate(coordinates.latitude),
      longitude: roundCoordinate(coordinates.longitude),
    };
    lastAppliedValueRef.current = coordinatesKey(nextCoordinates);
    setDraftCoordinates(nextCoordinates);
    mapRef.current?.flyTo({
      center: [nextCoordinates.longitude, nextCoordinates.latitude],
      zoom,
      duration: 550,
      essential: true,
    });
  };

  useEffect(() => {
    if (!open) {
      setQuery('');
      setSuggestions([]);
      setSuggestionsOpen(false);
      setIsSearchFocused(false);
      setSuggestError('');
      setDetectedAddress('');
      setLocatingUser(false);
      setGeoNotice('');
      selectedAddressRef.current = null;
      lastReverseGeocodeKeyRef.current = '';
      needsReverseGeocodeRef.current = false;
    } else {
      setDraftCoordinates(value);
    }
  }, [open]);

  useEffect(() => {
    if (suppressNextSuggestionLookupRef.current) {
      suppressNextSuggestionLookupRef.current = false;
      setSuggestions([]);
      setSuggestError('');
      setLoadingSuggestions(false);
      return;
    }

    if (!open || !isSearchFocused || query.trim().length < 3) {
      setSuggestions([]);
      setSuggestionsOpen(false);
      setSuggestError('');
      setLoadingSuggestions(false);
      return;
    }

    let cancelled = false;
    setLoadingSuggestions(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await addressesApi.ruSuggestions(query.trim(), 7);
        if (cancelled) return;
        setSuggestions(response.suggestions);
        setSuggestError('');
        setSuggestionsOpen(true);
      } catch (err) {
        if (cancelled) return;
        setSuggestions([]);
        setSuggestError(err instanceof ApiError ? err.message : 'Не удалось загрузить адреса.');
        setSuggestionsOpen(true);
      } finally {
        if (!cancelled) setLoadingSuggestions(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, isSearchFocused, query]);

  useEffect(() => {
    if (!geoNotice) return;

    const timer = window.setTimeout(() => setGeoNotice(''), 3500);
    return () => window.clearTimeout(timer);
  }, [geoNotice]);

  useEffect(() => {
    if (!open) return;
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: mapStyles[mapStyleKey],
      center: [center.longitude, center.latitude],
      zoom: value ? 15 : 11,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      scrollZoom: false,
    });

    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();

    map.on('dragstart', markMapMoving);
    map.on('moveend', () => updateFromCenter(map));
    map.once('load', () => updateFromCenter(map));

    mapRef.current = map;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      wheelDeltaRef.current += event.deltaY;
      const now = window.performance.now();
      if (Math.abs(wheelDeltaRef.current) < 80 || now - lastWheelZoomRef.current < 140) return;

      zoomBy(wheelDeltaRef.current > 0 ? -0.5 : 0.5);
      wheelDeltaRef.current = 0;
      lastWheelZoomRef.current = now;
    };

    containerRef.current.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      containerRef.current?.removeEventListener('wheel', handleWheel);
      map.remove();
      mapRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const currentCenter = map.getCenter();
    const currentZoom = map.getZoom();
    map.setStyle(mapStyles[mapStyleKey]);
    map.once('styledata', () => {
      map.jumpTo({ center: currentCenter, zoom: currentZoom, bearing: 0, pitch: 0 });
    });
  }, [mapStyleKey]);

  useEffect(() => {
    if (!draftCoordinates || !mapRef.current) return;
    const nextKey = coordinatesKey(draftCoordinates);
    if (lastAppliedValueRef.current === nextKey) return;
    if (suppressNextValueSyncRef.current) {
      suppressNextValueSyncRef.current = false;
      lastAppliedValueRef.current = nextKey;
      return;
    }
    lastAppliedValueRef.current = nextKey;
    const lngLat: [number, number] = [draftCoordinates.longitude, draftCoordinates.latitude];
    mapRef.current.easeTo({ center: lngLat, zoom: Math.max(mapRef.current.getZoom(), 14), duration: 350 });
  }, [draftCoordinates?.latitude, draftCoordinates?.longitude]);

  const selectSuggestion = (suggestion: RuAddressSuggestion) => {
    setMapDrivenQuery(suggestion.value);
    setSuggestionsOpen(false);
    selectedAddressRef.current = suggestion.value;
    const coordinates = extractSuggestionCoordinates(suggestion);
    if (!coordinates) {
      setSuggestError('У этого адреса нет координат.');
      return;
    }

    applyCoordinates(coordinates, 16);
  };

  const useBrowserLocation = () => {
    if (!navigator.geolocation) {
      setGeoNotice('Геолокация недоступна в браузере.');
      return;
    }

    setLocatingUser(true);
    setGeoNotice('Запрашиваем текущую геопозицию...');
    navigator.geolocation.getCurrentPosition(
      position => {
        setLocatingUser(false);
        setGeoNotice('');
        selectedAddressRef.current = null;
        setDetectedAddress('');
        applyCoordinates({
          latitude: roundCoordinate(position.coords.latitude),
          longitude: roundCoordinate(position.coords.longitude),
        }, 16);
      },
      () => {
        setLocatingUser(false);
        setGeoNotice('Не удалось получить текущую геопозицию.');
      },
      {
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: 60_000,
      },
    );
  };

  const zoomBy = (delta: number) => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({
      center: map.getCenter(),
      zoom: Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), map.getZoom() + delta)),
      duration: 220,
    });
  };

  const saveSelection = () => {
    const coordinates = draftCoordinates ?? center;
    onSave(coordinates);
    if (selectedAddressRef.current || detectedAddress) onAddressSelect?.(selectedAddressRef.current ?? detectedAddress);
    onClose();
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 flex h-[min(760px,calc(100vh-48px))] w-[min(960px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xl">
        <div className="border-b border-gray-100 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <MapPin size={18} className="mt-0.5 shrink-0 text-blue-600" />
              <div className="min-w-0">
                <p className="text-base font-semibold text-gray-900">Выберите адрес</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={onClose}>
                <X size={13} />
              </Button>
            </div>
          </div>

          <div className="relative mt-2">
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-gray-400" />
              <Input
                value={query}
                onChange={event => {
                  setQuery(event.target.value);
                  setIsSearchFocused(true);
                  setSuggestionsOpen(true);
                }}
                onFocus={() => {
                  setIsSearchFocused(true);
                  if (suggestions.length > 0 || suggestError) setSuggestionsOpen(true);
                }}
                onBlur={() => {
                  setIsSearchFocused(false);
                  setSuggestionsOpen(false);
                }}
                placeholder="Найти адрес в Уфе или другой город"
                className="pl-9"
              />
            </div>
            <p className="mt-1 text-[11px] text-gray-500">Введите полный адрес, включая дом</p>
            {suggestionsOpen && (loadingSuggestions || suggestions.length > 0 || suggestError) && (
              <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                {loadingSuggestions && <div className="px-3 py-2 text-xs text-gray-500">Ищем адрес...</div>}
                {!loadingSuggestions && suggestError && <div className="px-3 py-2 text-xs text-red-600">{suggestError}</div>}
                {!loadingSuggestions && !suggestError && suggestions.map(suggestion => (
                  <button
                    key={`${suggestion.fiasId ?? suggestion.value}-${suggestion.unrestrictedValue}`}
                    type="button"
                    onMouseDown={event => event.preventDefault()}
                    onClick={() => selectSuggestion(suggestion)}
                    className="w-full px-3 py-2 text-left transition hover:bg-blue-50"
                  >
                    <span className="block truncate text-sm font-medium text-gray-900">{suggestion.value}</span>
                    {suggestion.unrestrictedValue && suggestion.unrestrictedValue !== suggestion.value && (
                      <span className="mt-0.5 block truncate text-[11px] text-gray-500">{suggestion.unrestrictedValue}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="relative min-h-0 flex-1">
          <div ref={containerRef} className="h-full w-full" />
          {geoNotice && (
            <div className="absolute right-14 top-3 z-20 max-w-[260px] rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs text-amber-800 shadow-lg">
              {geoNotice}
            </div>
          )}
          <div className="absolute left-3 top-3 z-10 flex overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
            <button
              type="button"
              onClick={() => setMapStyleKey('balanced')}
              className={`h-9 px-3 text-xs font-medium transition ${mapStyleKey === 'balanced' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700'}`}
            >
              Детальная
            </button>
            <div className="w-px bg-gray-100" />
            <button
              type="button"
              onClick={() => setMapStyleKey('light')}
              className={`h-9 px-3 text-xs font-medium transition ${mapStyleKey === 'light' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700'}`}
            >
              Светлая
            </button>
          </div>
          <div className="absolute right-3 top-3 z-10 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
            <button
              type="button"
              onClick={useBrowserLocation}
              disabled={locatingUser}
              className="flex h-9 w-9 items-center justify-center text-gray-700 transition hover:bg-blue-50 hover:text-blue-700 disabled:cursor-wait disabled:opacity-60"
              title="Мое местоположение"
            >
              <LocateFixed size={16} className={locatingUser ? 'animate-pulse' : ''} />
            </button>
            <div className="h-px bg-gray-100" />
            <button
              type="button"
              onClick={() => zoomBy(0.5)}
              className="flex h-9 w-9 items-center justify-center text-gray-700 transition hover:bg-blue-50 hover:text-blue-700"
              title="Приблизить"
            >
              <Plus size={16} />
            </button>
            <div className="h-px bg-gray-100" />
            <button
              type="button"
              onClick={() => zoomBy(-0.5)}
              className="flex h-9 w-9 items-center justify-center text-gray-700 transition hover:bg-blue-50 hover:text-blue-700"
              title="Отдалить"
            >
              <Minus size={16} />
            </button>
          </div>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative -mt-8 flex h-16 w-16 items-center justify-center">
              <span className="absolute bottom-1 h-3 w-8 rounded-full bg-slate-900/20 blur-sm" />
              <span className="relative flex h-11 w-11 items-center justify-center rounded-full border-2 border-white bg-blue-600 shadow-xl shadow-blue-900/30">
                <span className="absolute -bottom-[10px] h-0 w-0 border-x-[10px] border-t-[15px] border-x-transparent border-t-white" />
                <span className="absolute -bottom-2 h-0 w-0 border-x-[9px] border-t-[14px] border-x-transparent border-t-blue-600" />
                <span className="relative z-10 flex h-5 w-5 items-center justify-center rounded-full bg-white">
                  <MapPin size={13} className="text-blue-600" />
                </span>
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-3 py-3">
          <div className="flex shrink-0 items-center gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Отмена
            </Button>
            <Button type="button" variant="primary" onClick={saveSelection}>
              Сохранить
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

function roundCoordinate(value: number) {
  return Number(value.toFixed(6));
}

function coordinatesKey(coordinates: Coordinates) {
  return `${roundCoordinate(coordinates.latitude)}:${roundCoordinate(coordinates.longitude)}`;
}

function extractSuggestionCoordinates(suggestion: RuAddressSuggestion): Coordinates | null {
  const latitude = parseCoordinate(suggestion.geoLat);
  const longitude = parseCoordinate(suggestion.geoLon);
  if (latitude === null || longitude === null) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

function parseCoordinate(value: string | null) {
  if (!value) return null;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}
