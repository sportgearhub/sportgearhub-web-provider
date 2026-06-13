import { useEffect, useRef, useState } from 'react';
import { CalendarRange, Check, ChevronDown, Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DateRangePicker } from '../../components/ui/DateRangePicker';
import { Input } from '../../components/ui/Input';
import { StringListEditor } from '../../components/ui/StringListEditor';
import { TimeSelect } from '../../components/ui/TimeSelect';
import { Textarea } from '../../components/ui/Textarea';
import { ApiError, locationsApi, offersApi, pricingApi } from '../../lib/api-client';
import type { Offer, OfferAuthoringOption, OfferAuthoringOptions, OfferAvailabilityBlockedPeriod, OfferAvailabilityWindow, ProviderLocation, RentalTier, Resource } from '../../types';

type SimpleOption = {
  value: string;
  label: string;
};

function isAuthoringOptionActive(option: OfferAuthoringOption | undefined) {
  return option?.isActive !== false;
}

function nextAuthoringValue(
  current: string,
  fallback: string,
  options: OfferAuthoringOption[]
) {
  const currentOption = options.find(option => option.value === current);
  if (currentOption && isAuthoringOptionActive(currentOption)) return current;

  const defaultOption = options.find(option => option.value === fallback);
  if (defaultOption && isAuthoringOptionActive(defaultOption)) return fallback;

  return options.find(isAuthoringOptionActive)?.value ?? '';
}

export type OfferFormData = Partial<Offer> & {
  pricingMode?: string;
  pricingBaseAmount?: number;
  pricingCurrency?: string;
  pricingStatus?: string;
  rentalTiers?: RentalTier[];
  multiDayRate?: number | null;
  fulfillmentLocationId?: string | null;
  // Availability (wizard step 3)
  timezone?: string;
  availabilityWindows?: OfferAvailabilityWindow[];
  blockedPeriods?: OfferAvailabilityBlockedPeriod[];
  minRentHours?: number;
  maxRentHours?: number;
  availabilityStatus?: string;
  // Visibility (wizard step 4)
  visibilityMode?: string;
  visibleFrom?: string | null;
  visibleUntil?: string | null;
  // Inclusions
  included?: string[];
  excluded?: string[];
};

const DEFAULT_TIMEZONE = 'Asia/Yekaterinburg';

const VISIBILITY_MODES = [
  { value: 'always_visible', label: 'Всегда видно', description: 'Предложение постоянно показывается клиентам в каталоге.', icon: Eye },
  { value: 'seasonal', label: 'По расписанию', description: 'Показывается клиентам только в выбранный период дат.', icon: CalendarRange },
  { value: 'hidden', label: 'Скрыто', description: 'Не показывается клиентам и недоступно по прямой ссылке.', icon: EyeOff },
] as const;

function emptyWindow(): OfferAvailabilityWindow {
  return { startsOn: '', endsOn: '', dailyOpensAt: '09:00', dailyClosesAt: '21:00' };
}

function emptyBlockedPeriod(): OfferAvailabilityBlockedPeriod {
  return { startsOn: '', endsOn: '', reasonCode: 'maintenance' };
}

function toMinutes(time: string): number {
  const [h, m] = (time || '').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

const WIZARD_STEPS = ['Основное', 'Цена', 'Доступность', 'Видимость'] as const;

const STANDARD_TIERS: RentalTier[] = [
  { upToHours: 1, price: 0, label: '1 час' },
  { upToHours: 4, price: 0, label: 'Полдня' },
  { upToHours: 24, price: 0, label: 'Сутки' },
];

interface OfferFormProps {
  offer?: Offer;
  resources: Resource[];
  onSubmit: (data: OfferFormData) => void | Promise<void>;
  onCancel: () => void;
  initialResourceId?: string;
  submitting?: boolean;
  /** Hide the offer-type picker (e.g. creating from a resource, where it's always "rental"). */
  hideOfferType?: boolean;
}

export function OfferForm({ offer, resources, onSubmit, onCancel, initialResourceId, submitting = false, hideOfferType = false }: OfferFormProps) {
  const [title, setTitle] = useState(offer?.title || '');
  const [resourceId, setResourceId] = useState(offer?.primaryResourceId || offer?.resourceId || initialResourceId || '');
  const [offerType, setOfferType] = useState(offer?.offerType || '');
  const [bookingFlowType, setBookingFlowType] = useState(offer?.bookingFlowType || '');
  const [pricingMode, setPricingMode] = useState('rental_tiers');
  const [pricingBaseAmount, setPricingBaseAmount] = useState(String(offer?.basePrice || offer?.price || ''));
  const [pricingCurrency, setPricingCurrency] = useState(offer?.currency || 'RUB');
  const [rentalTiers, setRentalTiers] = useState<RentalTier[]>([]);
  const [multiDayRate, setMultiDayRate] = useState('');
  const [description, setDescription] = useState(offer?.description || '');
  const [included, setIncluded] = useState<string[]>([]);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [locations, setLocations] = useState<ProviderLocation[]>([]);
  const [locationId, setLocationId] = useState(readFulfillmentLocationId(offer));
  const [authoringOptions, setAuthoringOptions] = useState<OfferAuthoringOptions | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState('');
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingError, setPricingError] = useState('');
  const [locationsError, setLocationsError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Wizard (creation only)
  const isWizard = !offer;
  const [step, setStep] = useState(0);

  // Availability (wizard step 3)
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);
  const [availabilityStatus, setAvailabilityStatus] = useState('active');
  const [minRentHours, setMinRentHours] = useState('1');
  const [maxRentHours, setMaxRentHours] = useState('24');
  const [windows, setWindows] = useState<OfferAvailabilityWindow[]>([]);
  const [blockedPeriods, setBlockedPeriods] = useState<OfferAvailabilityBlockedPeriod[]>([]);

  // Visibility (wizard step 4)
  const [visibilityMode, setVisibilityMode] = useState('always_visible');
  const [visibleFrom, setVisibleFrom] = useState<string | null>(null);
  const [visibleUntil, setVisibleUntil] = useState<string | null>(null);

  const pricingModeOptions = authoringOptions?.pricingModes ?? [];

  const patchWindow = (index: number, patch: Partial<OfferAvailabilityWindow>) =>
    setWindows(ws => ws.map((w, i) => (i === index ? { ...w, ...patch } : w)));
  const patchBlocked = (index: number, patch: Partial<OfferAvailabilityBlockedPeriod>) =>
    setBlockedPeriods(bs => bs.map((b, i) => (i === index ? { ...b, ...patch } : b)));

  const resourceOptions = [
    { value: '', label: 'Выберите позицию' },
    ...resources.map(r => ({ value: r.resourceId, label: r.title })),
  ];
  const locationOptions = [
    { value: '', label: 'Выберите пункт выдачи' },
    ...locations
      .filter(location => location.status !== 'inactive')
      .map(location => ({ value: location.locationId, label: `${location.name} · ${location.cityName ?? location.address}` })),
  ];

  useEffect(() => {
    let cancelled = false;

    setLocationsError('');
    locationsApi.list()
      .then(nextLocations => {
        if (cancelled) return;
        setLocations(nextLocations);
        setLocationId(current => current || nextLocations.find(location => location.isDefaultPickup)?.locationId || '');
      })
      .catch(err => {
        if (!cancelled) setLocationsError(err instanceof ApiError ? err.message : 'Не удалось загрузить пункты выдачи.');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    setOptionsLoading(true);
    setOptionsError('');
    offersApi.authoringOptions(resourceId || undefined)
      .then(options => {
        if (cancelled) return;

        setAuthoringOptions(options);
        setOfferType(current => nextAuthoringValue(current, options.defaults.offerType, options.offerTypes));
        setBookingFlowType(current => nextAuthoringValue(current, options.defaults.bookingFlowType, options.bookingFlowTypes));
        if (options.pricingModes?.length) {
          setPricingMode(current => nextAuthoringValue(current, options.defaults.pricingMode || options.pricingModes[0].value, options.pricingModes));
        }
      })
      .catch(err => {
        if (!cancelled) {
          setOptionsError(err instanceof ApiError ? err.message : 'Не удалось загрузить параметры предложения.');
        }
      })
      .finally(() => {
        if (!cancelled) setOptionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [resourceId]);

  useEffect(() => {
    if (!offer?.offerId) return;
    let cancelled = false;

    setPricingLoading(true);
    setPricingError('');
    pricingApi.getOfferPolicy(offer.offerId)
      .then(policy => {
        if (cancelled) return;
        setPricingMode(policy.pricingMode || 'per_unit_time');
        setPricingBaseAmount(
          policy.pricingMode === 'rental_tiers'
            ? ''
            : String(policy.baseAmount ?? policy.unitRules?.baseAmount ?? '')
        );
        setPricingCurrency(policy.currency || 'RUB');
        setRentalTiers(policy.rentalTiers ?? []);
        setMultiDayRate(policy.multiDayRate != null ? String(policy.multiDayRate) : '');
      })
      .catch(err => {
        if (!cancelled && !(err instanceof ApiError && err.status === 404)) {
          setPricingError(err instanceof ApiError ? err.message : 'Не удалось загрузить цену предложения.');
        }
      })
      .finally(() => {
        if (!cancelled) setPricingLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [offer?.offerId]);

  useEffect(() => {
    if (!offer?.offerId) return;
    let cancelled = false;
    offersApi.getInclusions(offer.offerId)
      .then(inclusions => {
        if (cancelled) return;
        setIncluded(inclusions.included ?? []);
        setExcluded(inclusions.excluded ?? []);
      })
      .catch(() => { /* none set yet */ });
    return () => { cancelled = true; };
  }, [offer?.offerId]);

  const validateBasics = () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = 'Укажите название.';
    if (!resourceId) e.resourceId = 'Выберите позицию инвентаря.';
    if (!offerType) e.offerType = 'Выберите тип предложения.';
    if (offerType && !isAuthoringOptionActive(authoringOptions?.offerTypes.find(option => option.value === offerType))) {
      e.offerType = 'Этот тип предложения недоступен.';
    }
    if (!bookingFlowType) e.bookingFlowType = 'Выберите сценарий бронирования.';
    if (bookingFlowType && !isAuthoringOptionActive(authoringOptions?.bookingFlowTypes.find(option => option.value === bookingFlowType))) {
      e.bookingFlowType = 'Этот сценарий бронирования недоступен.';
    }
    if (!locationId) e.locationId = 'Выберите пункт выдачи.';
    return e;
  };

  const validatePricing = () => {
    const e: Record<string, string> = {};
    if (!pricingMode) e.pricingMode = 'Выберите способ расчета цены.';
    if (!pricingCurrency.trim()) e.pricingCurrency = 'Укажите валюту.';
    if (pricingMode === 'rental_tiers') {
      if (rentalTiers.length === 0) e.rentalTiers = 'Добавьте хотя бы одну ступень.';
      else {
        for (let i = 0; i < rentalTiers.length; i++) {
          if (rentalTiers[i].upToHours <= 0) { e.rentalTiers = `Ступень ${i + 1}: upToHours должен быть больше нуля.`; break; }
          if (rentalTiers[i].price < 0) { e.rentalTiers = `Ступень ${i + 1}: цена не может быть отрицательной.`; break; }
          if (i > 0 && rentalTiers[i].upToHours <= rentalTiers[i - 1].upToHours) {
            e.rentalTiers = 'Ступени должны идти в строго возрастающем порядке upToHours.'; break;
          }
        }
      }
    } else if (!pricingBaseAmount || isNaN(Number(pricingBaseAmount)) || Number(pricingBaseAmount) < 0) {
      e.pricingBaseAmount = 'Укажите корректную цену.';
    }
    return e;
  };

  const validateAvailability = () => {
    const e: Record<string, string> = {};
    if (Number(minRentHours) > Number(maxRentHours)) {
      e.rentHours = 'Минимальное время аренды не может превышать максимальное.';
    }
    windows.forEach((w, i) => {
      if (!w.startsOn || !w.endsOn) e[`window-${i}`] = `Окно ${i + 1}: укажите период сезона.`;
      else if (w.startsOn > w.endsOn) e[`window-${i}`] = `Окно ${i + 1}: начало сезона позже конца.`;
      else if (toMinutes(w.dailyOpensAt) >= toMinutes(w.dailyClosesAt)) e[`window-${i}`] = `Окно ${i + 1}: открытие должно быть раньше закрытия.`;
    });
    blockedPeriods.forEach((b, i) => {
      if (b.startsOn && b.endsOn && b.startsOn > b.endsOn) e[`blocked-${i}`] = `Закрытый период ${i + 1}: начало позже конца.`;
    });
    return e;
  };

  const validateVisibility = () => {
    const e: Record<string, string> = {};
    if (visibilityMode === 'seasonal' && !(visibleFrom && visibleUntil)) {
      e.visibilityRange = 'Укажите период показа для режима «По расписанию».';
    }
    return e;
  };

  const stepValidators = [validateBasics, validatePricing, validateAvailability, validateVisibility];

  const buildData = (): OfferFormData => {
    const resource = resources.find(r => r.resourceId === resourceId);
    return {
      title,
      primaryResourceId: resourceId,
      offerType,
      bookingFlowType,
      resourceId,
      resourceTitle: resource?.title || '',
      pricingMode,
      pricingBaseAmount: pricingMode === 'rental_tiers' ? undefined : Number(pricingBaseAmount),
      pricingCurrency: pricingCurrency || 'RUB',
      pricingStatus: 'active',
      rentalTiers: pricingMode === 'rental_tiers' ? rentalTiers : undefined,
      multiDayRate: pricingMode === 'rental_tiers' && multiDayRate.trim() !== '' ? Number(multiDayRate) : null,
      description,
      fulfillmentLocationId: locationId || null,
      // Availability + visibility (used by the create wizard; ignored on edit)
      timezone,
      availabilityWindows: windows,
      blockedPeriods,
      minRentHours: Number(minRentHours) || 1,
      maxRentHours: Number(maxRentHours) || 24,
      availabilityStatus,
      visibilityMode,
      visibleFrom,
      visibleUntil,
      included: included.map(item => item.trim()).filter(Boolean),
      excluded: excluded.map(item => item.trim()).filter(Boolean),
    };
  };

  const goNext = () => {
    const e = stepValidators[step]();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    setErrors({});
    setStep(s => Math.min(WIZARD_STEPS.length - 1, s + 1));
  };

  const goBack = () => { setErrors({}); setStep(s => Math.max(0, s - 1)); };

  const handleSubmit = () => {
    // Edit mode validates basics + pricing; wizard validates the final step (others already passed).
    const e = isWizard ? validateVisibility() : { ...validateBasics(), ...validatePricing() };
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    void onSubmit(buildData());
  };

  const basicsPanel = (
    <Card>
      <div className="space-y-4">
        <Input
          label="Название предложения"
          value={title}
          onChange={e => setTitle(e.target.value)}
          error={errors.title}
          placeholder="Например: горный велосипед на день"
        />
        <FancySelect
          label="Инвентарь"
          options={resourceOptions}
          value={resourceId}
          onChange={value => {
            setResourceId(value);
            setOfferType('');
            setBookingFlowType('');
          }}
          error={errors.resourceId}
        />
        <FancySelect
          label="Пункт выдачи"
          options={locationOptions}
          value={locationId}
          onChange={setLocationId}
          error={errors.locationId}
        />
        {locationsError && (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Пункты выдачи не загрузились. Добавьте или проверьте их в разделе настроек.
          </p>
        )}

        <div className="space-y-3">
          {!hideOfferType && (
            <OptionPicker
              title="Тип предложения"
              options={authoringOptions?.offerTypes ?? []}
              value={offerType}
              loading={optionsLoading}
              error={errors.offerType}
              onChange={setOfferType}
            />
          )}
          <OptionPicker
            title="Бронирование"
            options={authoringOptions?.bookingFlowTypes ?? []}
            value={bookingFlowType}
            loading={optionsLoading}
            error={errors.bookingFlowType}
            onChange={setBookingFlowType}
          />
          {optionsError && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {optionsError}
            </p>
          )}
        </div>

        <Textarea
          label="Описание (необязательно)"
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={3}
          placeholder="Что включено, основные детали..."
        />

        <div className="space-y-4 border-t border-gray-100 pt-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Что входит в предложение</h3>
            <p className="mt-0.5 text-xs text-gray-500">Списки видны клиенту. Порядок = порядок показа.</p>
          </div>
          <StringListEditor
            label="Что включено"
            items={included}
            onChange={setIncluded}
            placeholder="Например: Прокат сапборда"
            addLabel="Добавить пункт"
          />
          <StringListEditor
            label="Что не включено"
            items={excluded}
            onChange={setExcluded}
            placeholder="Например: Трансфер до пляжа"
            addLabel="Добавить пункт"
          />
        </div>
      </div>
    </Card>
  );

  const pricingPanel = (
    <Card>
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Цена предложения</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            Используется при расчёте стоимости бронирования.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-foreground">Как считать цену</p>
          {optionsLoading ? (
            <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">Загружаем способы расчёта…</div>
          ) : pricingModeOptions.length === 0 ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">Для этой позиции нет доступных способов расчёта.</div>
          ) : (
            <div className="space-y-2">
              {pricingModeOptions.map(mode => {
                const selected = pricingMode === mode.value;
                const disabled = mode.isActive === false;
                return (
                  <button
                    key={mode.value}
                    type="button"
                    disabled={disabled}
                    onClick={() => setPricingMode(mode.value)}
                    className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition ${
                      disabled ? 'cursor-not-allowed border-gray-100 bg-gray-50 opacity-60'
                        : selected ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500/30'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                    aria-pressed={selected}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="text-sm font-medium text-gray-900">{mode.title}</span>
                      {mode.description && <span className="mt-0.5 block text-xs leading-5 text-gray-500">{mode.description}</span>}
                    </span>
                    {selected && <Check size={16} className="mt-0.5 shrink-0 text-blue-600" />}
                  </button>
                );
              })}
            </div>
          )}
          {errors.pricingMode && <p className="text-xs text-red-600">{errors.pricingMode}</p>}
        </div>

        {pricingMode !== 'rental_tiers' && (
          <div className="grid gap-3 md:grid-cols-[1fr_140px]">
            <Input
              label={pricingMode === 'per_unit_time' ? 'Цена за час' : 'Цена'}
              type="number"
              value={pricingBaseAmount}
              onChange={e => setPricingBaseAmount(e.target.value)}
              error={errors.pricingBaseAmount}
              placeholder="Например: 500"
            />
            <Input
              label="Валюта"
              value={pricingCurrency}
              onChange={e => setPricingCurrency(e.target.value.toUpperCase())}
              placeholder="RUB"
              disabled={pricingLoading}
            />
          </div>
        )}

        {pricingMode === 'rental_tiers' && (
          <div className="space-y-3">
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-gray-700">Тарифные ступени</p>
                <div className="flex items-center gap-2">
                  {rentalTiers.length === 0 && (
                    <Button size="sm" variant="secondary" onClick={() => setRentalTiers(STANDARD_TIERS.map(t => ({ ...t })))}>
                      Стандартные ступени
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setRentalTiers(t => [...t, { upToHours: 0, price: 0, label: '' }])}
                  >
                    <Plus size={12} /> Ступень
                  </Button>
                </div>
              </div>
              <p className="mb-2 text-xs leading-5 text-gray-500">
                Цена за прокат вплоть до указанного числа часов. Ступени идут по возрастанию: например 1 ч, 4 ч (полдня), 24 ч (сутки).
              </p>
              {errors.rentalTiers && <p className="mb-2 text-xs text-red-600">{errors.rentalTiers}</p>}
              {rentalTiers.length === 0 ? (
                <div className="rounded-md border border-dashed border-gray-200 px-3 py-4 text-center text-xs text-gray-500">
                  Добавьте ступени или нажмите «Стандартные ступени».
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-[90px_1fr_1fr_auto] gap-2 px-1 text-[11px] font-medium uppercase tracking-wide text-gray-400">
                    <span>До (часов)</span><span>Цена, {pricingCurrency || 'RUB'}</span><span>Название</span><span />
                  </div>
                  {rentalTiers.map((tier, index) => (
                    <div key={index} className="grid grid-cols-[90px_1fr_1fr_auto] items-center gap-2 rounded-md border border-gray-100 bg-gray-50 p-2">
                      <Input
                        type="number"
                        min="1"
                        value={String(tier.upToHours)}
                        onChange={e => setRentalTiers(t => t.map((x, i) => i === index ? { ...x, upToHours: Number(e.target.value) || 0 } : x))}
                        placeholder="8"
                      />
                      <Input
                        type="number"
                        min="0"
                        value={String(tier.price)}
                        onChange={e => setRentalTiers(t => t.map((x, i) => i === index ? { ...x, price: Number(e.target.value) || 0 } : x))}
                        placeholder="900"
                      />
                      <Input
                        value={tier.label ?? ''}
                        onChange={e => setRentalTiers(t => t.map((x, i) => i === index ? { ...x, label: e.target.value } : x))}
                        placeholder="Полдня"
                      />
                      <Button size="sm" variant="ghost" onClick={() => setRentalTiers(t => t.filter((_, i) => i !== index))}>
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="grid gap-3 md:grid-cols-[1fr_140px]">
              <Input
                label="Цена за сутки сверх ступеней (необязательно)"
                type="number"
                min="0"
                value={multiDayRate}
                onChange={e => setMultiDayRate(e.target.value)}
                placeholder="1300"
              />
              <Input
                label="Валюта"
                value={pricingCurrency}
                onChange={e => setPricingCurrency(e.target.value.toUpperCase())}
                placeholder="RUB"
                disabled={pricingLoading}
              />
            </div>
          </div>
        )}
        {pricingError && (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Не удалось загрузить текущую цену. Можно сохранить новое значение.
          </p>
        )}
      </div>
    </Card>
  );

  const availabilityPanel = (
    <Card>
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Доступность</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            Когда предложение можно бронировать. Можно пропустить и настроить позже.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Input label="Часовой пояс" value={timezone} onChange={e => setTimezone(e.target.value)} placeholder={DEFAULT_TIMEZONE} />
          <FancySelect
            label="Приём бронирований"
            options={[
              { value: 'active', label: 'Принимать' },
              { value: 'inactive', label: 'Временно закрыто' },
            ]}
            value={availabilityStatus}
            onChange={setAvailabilityStatus}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Input label="Мин. часов аренды" type="number" min="1" value={minRentHours} onChange={e => setMinRentHours(e.target.value)} />
          <Input label="Макс. часов аренды" type="number" min="1" value={maxRentHours} onChange={e => setMaxRentHours(e.target.value)} />
        </div>
        {errors.rentHours && <p className="text-xs text-red-600">{errors.rentHours}</p>}

        <div className="space-y-2 border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-700">Сезонные окна работы</p>
            <Button size="sm" variant="secondary" onClick={() => setWindows(ws => [...ws, emptyWindow()])}>
              <Plus size={12} /> Добавить окно
            </Button>
          </div>
          {windows.length === 0 ? (
            <div className="rounded-md border border-dashed border-gray-200 px-3 py-4 text-center text-xs text-gray-500">
              Без окон работы предложение не будет принимать брони. Можно добавить позже.
            </div>
          ) : (
            windows.map((window, index) => (
              <div key={index}>
                <div className="grid items-end gap-2 rounded-md border border-gray-100 bg-gray-50 p-2 sm:grid-cols-[1.6fr_100px_100px_auto]">
                  <DateRangePicker
                    label="Сезон"
                    startsOn={window.startsOn}
                    endsOn={window.endsOn}
                    onChange={range => patchWindow(index, range)}
                  />
                  <TimeSelect label="Открытие" value={window.dailyOpensAt} onChange={value => patchWindow(index, { dailyOpensAt: value })} />
                  <TimeSelect label="Закрытие" value={window.dailyClosesAt} onChange={value => patchWindow(index, { dailyClosesAt: value })} />
                  <Button size="sm" variant="ghost" onClick={() => setWindows(ws => ws.filter((_, i) => i !== index))}>
                    <Trash2 size={13} />
                  </Button>
                </div>
                {errors[`window-${index}`] && <p className="mt-1 text-xs text-red-600">{errors[`window-${index}`]}</p>}
              </div>
            ))
          )}
        </div>

        <div className="space-y-2 border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-700">Закрытые периоды</p>
            <Button size="sm" variant="secondary" onClick={() => setBlockedPeriods(bs => [...bs, emptyBlockedPeriod()])}>
              <Plus size={12} /> Закрыть даты
            </Button>
          </div>
          {blockedPeriods.length === 0 ? (
            <div className="rounded-md border border-dashed border-gray-200 px-3 py-4 text-center text-xs text-gray-500">
              Закрытых периодов нет.
            </div>
          ) : (
            blockedPeriods.map((period, index) => (
              <div key={index}>
                <div className="grid items-end gap-2 rounded-md border border-gray-100 bg-gray-50 p-2 sm:grid-cols-[1.4fr_1fr_auto]">
                  <DateRangePicker
                    label="Период"
                    startsOn={period.startsOn}
                    endsOn={period.endsOn}
                    onChange={range => patchBlocked(index, range)}
                  />
                  <Input
                    label="Причина"
                    value={period.reasonCode ?? ''}
                    onChange={e => patchBlocked(index, { reasonCode: e.target.value })}
                    placeholder="maintenance"
                  />
                  <Button size="sm" variant="ghost" onClick={() => setBlockedPeriods(bs => bs.filter((_, i) => i !== index))}>
                    <Trash2 size={13} />
                  </Button>
                </div>
                {errors[`blocked-${index}`] && <p className="mt-1 text-xs text-red-600">{errors[`blocked-${index}`]}</p>}
              </div>
            ))
          )}
        </div>
      </div>
    </Card>
  );

  const visibilityPanel = (
    <Card>
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Видимость</h3>
          <p className="mt-0.5 text-xs text-gray-500">Когда предложение видно клиентам в каталоге.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
            {VISIBILITY_MODES.map(mode => {
              const selected = visibilityMode === mode.value;
              const Icon = mode.icon;
              return (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => setVisibilityMode(mode.value)}
                  title={mode.description}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                    selected ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                  aria-pressed={selected}
                >
                  <Icon size={14} className={selected ? 'text-blue-600' : 'text-gray-400'} />
                  {mode.label}
                </button>
              );
            })}
          </div>
          {visibilityMode === 'seasonal' && (
            <div className="w-52">
              <DateRangePicker
                startsOn={visibleFrom ?? ''}
                endsOn={visibleUntil ?? ''}
                placeholder="Укажите период"
                onChange={range => { setVisibleFrom(range.startsOn || null); setVisibleUntil(range.endsOn || null); }}
              />
            </div>
          )}
        </div>
        <p className="text-xs leading-5 text-gray-500">
          {VISIBILITY_MODES.find(m => m.value === visibilityMode)?.description}
        </p>
        {errors.visibilityRange && <p className="text-xs text-red-600">{errors.visibilityRange}</p>}
      </div>
    </Card>
  );

  const wizardPanels = [basicsPanel, pricingPanel, availabilityPanel, visibilityPanel];
  const isLastStep = step === WIZARD_STEPS.length - 1;

  return (
    <div className={`${isWizard ? 'max-w-3xl' : 'max-w-2xl'} mx-auto space-y-5`}>
      <div>
        <h2 className="text-sm font-semibold text-gray-900">{offer ? 'Редактировать предложение' : 'Создать предложение'}</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          {offer ? 'Обновите условия предложения.' : 'Опишите новое предложение аренды для клиентов.'}
        </p>
      </div>

      {isWizard && (
        <ol className="flex items-center gap-2 text-xs">
          {WIZARD_STEPS.map((label, index) => {
            const state = index === step ? 'current' : index < step ? 'done' : 'todo';
            return (
              <li key={label} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { if (index < step) { setErrors({}); setStep(index); } }}
                  disabled={index > step}
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium transition ${
                    state === 'current' ? 'bg-blue-600 text-white'
                      : state === 'done' ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  <span className="flex h-4 w-4 items-center justify-center rounded-full border border-current text-[10px]">{index + 1}</span>
                  {label}
                </button>
                {index < WIZARD_STEPS.length - 1 && <span className="h-px w-3 bg-gray-200" />}
              </li>
            );
          })}
        </ol>
      )}

      {isWizard ? wizardPanels[step] : <>{basicsPanel}{pricingPanel}</>}

      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          {isWizard && step > 0 && (
            <Button variant="secondary" onClick={goBack} disabled={submitting}>Назад</Button>
          )}
          <Button variant="ghost" onClick={onCancel} disabled={submitting}>Отмена</Button>
        </div>
        {isWizard && !isLastStep ? (
          <Button variant="primary" onClick={goNext}>Далее</Button>
        ) : (
          <Button variant="primary" onClick={handleSubmit} loading={submitting}>
            {offer ? 'Сохранить изменения' : 'Создать предложение'}
          </Button>
        )}
      </div>
    </div>
  );
}

function FancySelect({
  label,
  options,
  value,
  error,
  onChange,
}: {
  label: string;
  options: SimpleOption[];
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const selected = options.find(option => option.value === value);

  useEffect(() => {
    if (!open) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <p className="mb-1.5 text-xs font-medium text-foreground">{label}</p>
      <button
        type="button"
        onClick={() => setOpen(current => !current)}
        className={`flex h-9 w-full items-center justify-between rounded-md border bg-white px-3 py-2 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-blue-100 ${
          error ? 'border-red-300' : open ? 'border-blue-300' : 'border-gray-200'
        }`}
      >
        <span className={`truncate ${selected?.value ? 'text-gray-900' : 'text-gray-400'}`}>
          {selected?.label ?? 'Выберите значение'}
        </span>
        <ChevronDown size={16} className={`ml-3 shrink-0 text-gray-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-40 mt-1 max-h-72 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg">
          {options.map(option => {
            const isSelected = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                onMouseDown={event => event.preventDefault()}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition ${
                  isSelected ? 'bg-blue-50 text-blue-950' : 'text-gray-800 hover:bg-gray-50'
                }`}
              >
                <span className="truncate">{option.label}</span>
                {isSelected && <Check size={14} className="shrink-0 text-blue-700" />}
              </button>
            );
          })}
        </div>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function readFulfillmentLocationId(offer: Offer | undefined) {
  if (!offer) return '';
  if (offer.fulfillmentLocationId) return offer.fulfillmentLocationId;

  const summaryLocation = offer.locationSummary?.fulfillmentLocation;
  if (summaryLocation && typeof summaryLocation === 'object') {
    const id = (summaryLocation as Record<string, unknown>).fulfillmentLocationId;
    if (typeof id === 'string') return id;
  }

  const legacyId = offer.location?.providerLocationId;
  return typeof legacyId === 'string' ? legacyId : '';
}

function OptionPicker({
  title,
  options,
  value,
  loading,
  error,
  onChange,
}: {
  title: string;
  options: OfferAuthoringOption[];
  value: string;
  loading: boolean;
  error?: string;
  onChange: (value: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const selected = options.find(option => option.value === value);

  useEffect(() => {
    if (!open) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [open]);

  if (loading) {
    return (
      <div>
        <p className="mb-1.5 text-xs font-medium text-foreground">{title}</p>
        <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
          Загружаем модели...
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <p className="mb-1.5 text-xs font-medium text-foreground">{title}</p>
      <button
        type="button"
        onClick={() => setOpen(current => !current)}
        className={`flex min-h-10 w-full items-center justify-between rounded-md border bg-white px-3 py-2 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-blue-100 ${
          error ? 'border-red-300' : open ? 'border-blue-300' : 'border-gray-200'
        }`}
      >
        <span className="min-w-0">
          <span className={`block truncate font-medium ${selected ? 'text-gray-900' : 'text-gray-400'}`}>
            {selected?.title ?? 'Выберите значение'}
          </span>
          {selected?.description && (
            <span className="mt-0.5 block truncate text-xs text-gray-500">{selected.description}</span>
          )}
        </span>
        <ChevronDown size={16} className={`ml-3 shrink-0 text-gray-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-40 mt-1 max-h-72 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg">
          {options.map(option => {
            const isSelected = option.value === value;
            const isActive = isAuthoringOptionActive(option);

            return (
              <button
                key={option.value}
                type="button"
                onMouseDown={event => event.preventDefault()}
                onClick={() => {
                  if (!isActive) return;
                  onChange(option.value);
                  setOpen(false);
                }}
                disabled={!isActive}
                className={`flex w-full items-start justify-between gap-3 px-3 py-2 text-left transition ${
                  !isActive
                    ? 'cursor-not-allowed bg-gray-50 text-gray-400'
                    : isSelected
                      ? 'bg-blue-50 text-blue-950'
                      : 'text-gray-800 hover:bg-gray-50'
                }`}
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <span>{option.title}</span>
                    {!isActive && (
                      <span className="rounded-full bg-gray-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                        Недоступно
                      </span>
                    )}
                  </span>
                  {option.description && (
                    <span className={`mt-0.5 block text-xs leading-4 ${isActive ? 'text-gray-500' : 'text-gray-400'}`}>
                      {option.description}
                    </span>
                  )}
                </span>
                {isSelected && <Check size={14} className="mt-0.5 shrink-0 text-blue-700" />}
              </button>
            );
          })}
        </div>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
