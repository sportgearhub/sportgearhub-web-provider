import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { DateRangePicker, formatRuDate } from '../../components/ui/DateRangePicker';
import { StringListEditor } from '../../components/ui/StringListEditor';
import { TimeSelect } from '../../components/ui/TimeSelect';
import { ActionBar, ChoiceCards, FieldNote, FieldRow, FloatingInput, FloatingSelect, FloatingTextarea, FormPage, FormSection, FormStepper, PickerRow } from '../../components/form';
import { INFO_SECTION_KINDS } from './infoSections';
import { ApiError, locationsApi, offersApi, pricingApi } from '../../lib/api-client';
import type { Offer, OfferAuthoringOption, OfferAuthoringOptions, OfferAvailabilityBlockedPeriod, OfferAvailabilityWindow, OfferInfoSection, ProviderLocation, RentalTier, Resource } from '../../types';

function isAuthoringOptionActive(option: OfferAuthoringOption | undefined) {
  return option?.isActive !== false;
}

function nextAuthoringValue(current: string, fallback: string, options: OfferAuthoringOption[]) {
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
  fulfillmentLocationId?: string | null;
  durationHours?: number | null;
  // Availability
  timezone?: string;
  availabilityWindows?: OfferAvailabilityWindow[];
  blockedPeriods?: OfferAvailabilityBlockedPeriod[];
  slotIntervalMinutes?: number | null;
  availabilityStatus?: string;
  // Info sections (included / excluded / bring / requirements …)
  infoSections?: OfferInfoSection[];
};

const DEFAULT_TIMEZONE = 'Asia/Yekaterinburg';


const CREATE_STEPS = ['Информация о предложении', 'Предварительный просмотр'];

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

const STANDARD_TIERS: RentalTier[] = [
  { upToHours: 1, price: 0, label: '1 час' },
  { upToHours: 4, price: 0, label: 'Полдня' },
  { upToHours: 24, price: 0, label: 'Сутки' },
];

function currencySymbol(code: string) {
  return code === 'RUB' || code === '' ? '₽' : code;
}

function formatMoney(value: number | string, currency: string) {
  const amount = Number(value);
  if (Number.isNaN(amount)) return '—';
  return `${amount.toLocaleString('ru-RU')} ${currencySymbol(currency)}`;
}

interface OfferFormProps {
  offer?: Offer;
  resources: Resource[];
  onSubmit: (data: OfferFormData) => void | Promise<void>;
  onCancel: () => void;
  initialResourceId?: string;
  submitting?: boolean;
  /** Hide the offer-type picker (e.g. creating from a resource, where it's always "rental"). */
  hideOfferType?: boolean;
  /** Error from the save itself, shown next to the primary action. */
  submitError?: string;
}

/**
 * «Создание предложения» / «Редактирование предложения». One page of sections: what it is and
 * where it is handed over, the price, and — behind «Заполнить больше» — what the client should
 * know, when it can be booked and when it is shown. Creation ends with a preview of the card.
 */
export function OfferForm({ offer, resources, onSubmit, onCancel, initialResourceId, submitting = false, hideOfferType = false, submitError }: OfferFormProps) {
  const isEdit = Boolean(offer);
  const [step, setStep] = useState(0);
  const [showMore, setShowMore] = useState(isEdit);
  const moreRef = useRef<HTMLDivElement | null>(null);

  const [title, setTitle] = useState(offer?.title || '');
  const [resourceId, setResourceId] = useState(offer?.primaryResourceId || offer?.resourceId || initialResourceId || '');
  const [offerType, setOfferType] = useState(offer?.offerType || '');
  const [bookingFlowType, setBookingFlowType] = useState(offer?.bookingFlowType || '');
  const [pricingMode, setPricingMode] = useState('rental_tiers');
  const [pricingBaseAmount, setPricingBaseAmount] = useState(String(offer?.basePrice || offer?.price || ''));
  const [pricingCurrency, setPricingCurrency] = useState(offer?.currency || 'RUB');
  const [rentalTiers, setRentalTiers] = useState<RentalTier[]>([]);
  const [description, setDescription] = useState(offer?.description || '');
  const [sectionItems, setSectionItems] = useState<Record<string, string[]>>({});
  const [locations, setLocations] = useState<ProviderLocation[]>([]);
  const [locationId, setLocationId] = useState(readFulfillmentLocationId(offer));
  const [authoringOptions, setAuthoringOptions] = useState<OfferAuthoringOptions | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState('');
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingError, setPricingError] = useState('');
  const [locationsError, setLocationsError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Availability (creation only; edited later on the offer itself)
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);
  const [availabilityStatus, setAvailabilityStatus] = useState('active');
  const [durationHours, setDurationHours] = useState('');
  const [slotIntervalMinutes, setSlotIntervalMinutes] = useState('');
  const [windows, setWindows] = useState<OfferAvailabilityWindow[]>([]);
  const [blockedPeriods, setBlockedPeriods] = useState<OfferAvailabilityBlockedPeriod[]>([]);


  const pricingModeOptions = authoringOptions?.pricingModes ?? [];
  const fixedResource = resources.length === 1 && Boolean(initialResourceId) ? resources[0] : null;
  const selectedResource = resources.find(item => item.resourceId === resourceId);
  const selectedLocation = locations.find(item => item.locationId === locationId);

  const patchWindow = (index: number, patch: Partial<OfferAvailabilityWindow>) =>
    setWindows(ws => ws.map((w, i) => (i === index ? { ...w, ...patch } : w)));
  const patchBlocked = (index: number, patch: Partial<OfferAvailabilityBlockedPeriod>) =>
    setBlockedPeriods(bs => bs.map((b, i) => (i === index ? { ...b, ...patch } : b)));

  useEffect(() => {
    let cancelled = false;
    setLocationsError('');
    locationsApi.list()
      .then(nextLocations => {
        if (cancelled) return;
        setLocations(nextLocations);
        // Preselect only when the choice is not a choice: a new offer and exactly one пункт.
        // An existing offer keeps what the API says, so saving a renamed offer cannot move it.
        if (!offer && nextLocations.length === 1) {
          setLocationId(current => current || nextLocations[0].locationId);
        }
      })
      .catch(err => {
        if (!cancelled) setLocationsError(err instanceof ApiError ? err.message : 'Не удалось загрузить пункты проката.');
      });
    return () => { cancelled = true; };
  }, [offer]);

  useEffect(() => {
    let cancelled = false;
    setOptionsLoading(true);
    setOptionsError('');
    offersApi.authoringOptions(resourceId || undefined)
      .then(options => {
        if (cancelled) return;
        setAuthoringOptions(options);
        // A payload without `defaults` must not take the form down; the lists still let one choose.
        const defaults = options.defaults ?? { offerType: '', bookingFlowType: '', pricingMode: '' };
        setOfferType(current => nextAuthoringValue(current, defaults.offerType, options.offerTypes ?? []));
        setBookingFlowType(current => nextAuthoringValue(current, defaults.bookingFlowType, options.bookingFlowTypes ?? []));
        if (options.pricingModes?.length) {
          setPricingMode(current => nextAuthoringValue(current, defaults.pricingMode || options.pricingModes[0].value, options.pricingModes));
        }
      })
      .catch(err => {
        if (!cancelled) setOptionsError(err instanceof ApiError ? err.message : 'Не удалось загрузить параметры предложения.');
      })
      .finally(() => { if (!cancelled) setOptionsLoading(false); });
    return () => { cancelled = true; };
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
        setPricingBaseAmount(policy.pricingMode === 'rental_tiers' ? '' : String(policy.baseAmount ?? ''));
        setPricingCurrency(policy.currency || 'RUB');
        setRentalTiers(policy.rentalTiers ?? []);
      })
      .catch(err => {
        if (!cancelled && !(err instanceof ApiError && err.status === 404)) {
          setPricingError(err instanceof ApiError ? err.message : 'Не удалось загрузить цену предложения.');
        }
      })
      .finally(() => { if (!cancelled) setPricingLoading(false); });
    return () => { cancelled = true; };
  }, [offer?.offerId]);

  useEffect(() => {
    if (!offer?.offerId) return;
    let cancelled = false;
    offersApi.getInfoSections(offer.offerId)
      .then(result => {
        if (cancelled) return;
        const next: Record<string, string[]> = {};
        (result.sections ?? []).forEach(section => { next[section.kind] = section.items ?? []; });
        setSectionItems(next);
      })
      .catch(() => { /* none set yet */ });
    return () => { cancelled = true; };
  }, [offer?.offerId]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = 'Укажите название.';
    if (!resourceId) e.resourceId = 'Выберите позицию инвентаря.';
    if (!offerType) e.offerType = 'Выберите тип предложения.';
    else if (!isAuthoringOptionActive(authoringOptions?.offerTypes.find(option => option.value === offerType))) e.offerType = 'Этот тип предложения недоступен.';
    if (!bookingFlowType) e.bookingFlowType = 'Выберите сценарий бронирования.';
    else if (!isAuthoringOptionActive(authoringOptions?.bookingFlowTypes.find(option => option.value === bookingFlowType))) e.bookingFlowType = 'Этот сценарий бронирования недоступен.';
    if (!locationId) e.locationId = 'Выберите пункт проката.';

    if (!pricingMode) e.pricingMode = 'Выберите способ расчёта цены.';
    if (pricingMode === 'rental_tiers') {
      if (rentalTiers.length === 0) e.rentalTiers = 'Добавьте хотя бы одну ступень.';
      else {
        for (let i = 0; i < rentalTiers.length; i++) {
          if (rentalTiers[i].upToHours <= 0) { e.rentalTiers = `Ступень ${i + 1}: укажите, до скольких часов она действует.`; break; }
          if (rentalTiers[i].price < 0) { e.rentalTiers = `Ступень ${i + 1}: цена не может быть отрицательной.`; break; }
          if (i > 0 && rentalTiers[i].upToHours <= rentalTiers[i - 1].upToHours) { e.rentalTiers = 'Ступени должны идти по возрастанию часов.'; break; }
        }
      }
    } else if (!pricingBaseAmount || isNaN(Number(pricingBaseAmount)) || Number(pricingBaseAmount) < 0) {
      e.pricingBaseAmount = 'Укажите цену.';
    }

    if (!isEdit) {
      windows.forEach((w, i) => {
        if (!w.startsOn || !w.endsOn) e[`window-${i}`] = 'Укажите период сезона.';
        else if (w.startsOn > w.endsOn) e[`window-${i}`] = 'Начало сезона позже конца.';
        else if (toMinutes(w.dailyOpensAt) >= toMinutes(w.dailyClosesAt)) e[`window-${i}`] = 'Открытие должно быть раньше закрытия.';
      });
      blockedPeriods.forEach((b, i) => {
        if (b.startsOn && b.endsOn && b.startsOn > b.endsOn) e[`blocked-${i}`] = 'Начало позже конца.';
      });
    }

    setErrors(e);
    if (Object.keys(e).length > 0) {
      if (Object.keys(e).some(key => key.startsWith('window') || key.startsWith('blocked'))) setShowMore(true);
      window.setTimeout(() => document.querySelector('[aria-invalid="true"], [data-error="true"]')?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 0);
      return false;
    }
    return true;
  };

  const buildData = (): OfferFormData => ({
    title: title.trim(),
    primaryResourceId: resourceId,
    offerType,
    bookingFlowType,
    resourceId,
    resourceTitle: selectedResource?.title || '',
    pricingMode,
    pricingBaseAmount: pricingMode === 'rental_tiers' ? undefined : Number(pricingBaseAmount),
    pricingCurrency: pricingCurrency || 'RUB',
    pricingStatus: 'active',
    rentalTiers: pricingMode === 'rental_tiers' ? rentalTiers : undefined,
    description,
    fulfillmentLocationId: locationId || null,
    durationHours: Number(durationHours) || null,
    timezone,
    availabilityWindows: windows,
    blockedPeriods,
    slotIntervalMinutes: Number(slotIntervalMinutes) || null,
    availabilityStatus,
    infoSections: INFO_SECTION_KINDS
      .map(({ kind }) => ({ kind, items: (sectionItems[kind] ?? []).map(item => item.trim()).filter(Boolean) }))
      .filter(section => section.items.length > 0),
  });

  const goToPreview = () => {
    if (!validate()) return;
    setStep(1);
    window.scrollTo({ top: 0 });
  };

  const revealMore = () => {
    setShowMore(true);
    window.setTimeout(() => moreRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 0);
  };

  const bookingLabel = authoringOptions?.bookingFlowTypes.find(option => option.value === bookingFlowType)?.title;
  const priceLines: string[] = pricingMode === 'rental_tiers'
    ? rentalTiers.map(tier => `${tier.label?.trim() || `до ${tier.upToHours} ч`} — ${formatMoney(tier.price, pricingCurrency)}`)
    : [pricingMode === 'per_unit_time' ? `${formatMoney(pricingBaseAmount, pricingCurrency)} в час` : formatMoney(pricingBaseAmount, pricingCurrency)];

  if (!isEdit && step === 1) {
    return (
      <FormPage>
        <FormStepper steps={CREATE_STEPS} current={1} onSelect={setStep} />
        <FormSection title="Так предложение увидят клиенты" description="Проверьте карточку. Изменить что-то можно, вернувшись на шаг назад.">
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            {selectedResource?.mediaPreviewUrl && <img src={selectedResource.mediaPreviewUrl} alt="" className="aspect-[4/3] w-full object-cover" />}
            <div className="space-y-4 p-5">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">{selectedResource?.title ?? 'Инвентарь'}</p>
                <h3 className="mt-1 text-xl font-semibold text-gray-950">{title.trim()}</h3>
                {description.trim() && <p className="mt-2 text-sm leading-5 text-gray-700">{description.trim()}</p>}
              </div>
              <PreviewBlock title="Цена">
                <ul className="space-y-0.5 text-sm text-gray-900">{priceLines.map(line => <li key={line}>{line}</li>)}</ul>
              </PreviewBlock>
              <PreviewBlock title="Пункт проката">
                <p className="text-sm text-gray-900">{selectedLocation ? `${selectedLocation.name}${selectedLocation.cityName ? ` · ${selectedLocation.cityName}` : ''}` : '—'}</p>
                {selectedLocation && <p className="text-xs text-gray-500">{selectedLocation.address}</p>}
              </PreviewBlock>
              {bookingLabel && <PreviewBlock title="Бронирование"><p className="text-sm text-gray-900">{bookingLabel}</p></PreviewBlock>}
              {INFO_SECTION_KINDS.filter(({ kind }) => (sectionItems[kind] ?? []).some(item => item.trim())).map(({ kind, label }) => (
                <PreviewBlock key={kind} title={label}>
                  <ul className="list-disc space-y-0.5 pl-5 text-sm text-gray-900">
                    {(sectionItems[kind] ?? []).filter(item => item.trim()).map((item, index) => <li key={index}>{item}</li>)}
                  </ul>
                </PreviewBlock>
              ))}
              <PreviewBlock title="Доступность">
                <p className="text-sm text-gray-900">
                  {windows.length > 0
                    ? windows.map(w => `${formatRuDate(w.startsOn)} – ${formatRuDate(w.endsOn)}, ${w.dailyOpensAt}–${w.dailyClosesAt}`).join('; ')
                    : 'Окна работы не заданы — брони не принимаются, пока вы их не добавите.'}
                </p>
                {/* Creation publishes straight away: the API gives a new offer the active status. */}
                <p className="text-xs text-gray-500">Предложение будет опубликовано сразу после создания. Снять с публикации можно в любой момент.</p>
              </PreviewBlock>
            </div>
          </div>
        </FormSection>
        <ActionBar
          error={submitError}
          left={
            <>
              <Button variant="secondary" onClick={() => setStep(0)} disabled={submitting}>Назад</Button>
              <Button variant="ghost" onClick={onCancel} disabled={submitting}>Отмена</Button>
            </>
          }
          right={<Button variant="primary" onClick={() => void onSubmit(buildData())} loading={submitting}>Завершить создание</Button>}
        />
      </FormPage>
    );
  }

  return (
    <FormPage>
      {!isEdit && <FormStepper steps={CREATE_STEPS} current={0} />}

      <FormSection title="Информация о предложении">
        <FloatingInput
          label="Название"
          required
          value={title}
          onChange={event => setTitle(event.target.value)}
          error={errors.title}
          hint="Например: Горный велосипед на день"
          maxLength={160}
        />
        {fixedResource ? (
          <FloatingInput label="Инвентарь" value={fixedResource.title} readOnly disabled />
        ) : (
          <PickerRow
            label="Инвентарь"
            required
            items={resources.map(item => ({ value: item.resourceId, label: item.title, description: item.categoryName || item.category?.title }))}
            value={resourceId}
            onChange={value => { setResourceId(value); setOfferType(''); setBookingFlowType(''); }}
            error={errors.resourceId}
            emptyText="Сначала добавьте позицию в каталог."
          />
        )}
        <PickerRow
          label="Пункт проката"
          required
          items={locations.filter(location => location.status !== 'inactive').map(location => ({
            value: location.locationId,
            label: location.name,
            description: location.cityName ? `${location.cityName}, ${location.address}` : location.address,
          }))}
          value={locationId}
          onChange={setLocationId}
          error={errors.locationId || (locationsError ? 'Пункты проката не загрузились.' : undefined)}
          hint="Где клиент получит и вернёт снаряжение."
          emptyText="Пунктов проката пока нет."
          footer={<Link to="/settings/locations" className="font-medium text-blue-700 hover:underline">Добавить пункт проката</Link>}
        />
        {!hideOfferType && (
          <FloatingSelect
            label="Тип предложения"
            required
            value={offerType}
            onChange={setOfferType}
            options={(authoringOptions?.offerTypes ?? []).map(option => ({ value: option.value, label: option.title, description: option.description, disabled: !isAuthoringOptionActive(option) }))}
            hint={authoringOptions?.offerTypes.find(option => option.value === offerType)?.description}
            error={errors.offerType}
            disabled={optionsLoading}
          />
        )}
        <FloatingSelect
          label="Бронирование"
          required
          value={bookingFlowType}
          onChange={setBookingFlowType}
          options={(authoringOptions?.bookingFlowTypes ?? []).map(option => ({ value: option.value, label: option.title, description: option.description, disabled: !isAuthoringOptionActive(option) }))}
          hint={authoringOptions?.bookingFlowTypes.find(option => option.value === bookingFlowType)?.description}
          error={errors.bookingFlowType || optionsError || undefined}
          disabled={optionsLoading}
        />
        <FloatingTextarea
          label="Описание"
          value={description}
          onChange={event => setDescription(event.target.value)}
          rows={3}
          hint="Что включено и главные детали. Необязательно."
        />
      </FormSection>

      <FormSection title="Цена" description="Используется при расчёте стоимости бронирования.">
        {optionsLoading ? (
          <p className="px-1 text-sm text-gray-500">Загружаем способы расчёта…</p>
        ) : pricingModeOptions.length === 0 ? (
          <p className="px-1 text-sm text-amber-700">Для этой позиции нет доступных способов расчёта.</p>
        ) : (
          <ChoiceCards
            options={pricingModeOptions.map(mode => ({ value: mode.value, title: mode.title, description: mode.description, disabled: mode.isActive === false }))}
            value={pricingMode}
            onChange={setPricingMode}
          />
        )}
        <FieldNote error={errors.pricingMode} />

        {pricingMode !== 'rental_tiers' && (
          <FloatingInput
            label={pricingMode === 'per_unit_time' ? 'Цена за час' : 'Цена'}
            required
            type="number"
            min="0"
            inputMode="decimal"
            value={pricingBaseAmount}
            onChange={event => setPricingBaseAmount(event.target.value)}
            error={errors.pricingBaseAmount}
            suffix={currencySymbol(pricingCurrency)}
            disabled={pricingLoading}
          />
        )}

        {pricingMode === 'rental_tiers' && (
          <div className="space-y-3" data-error={errors.rentalTiers ? 'true' : undefined}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-gray-700">Тарифные ступени</p>
              <div className="flex items-center gap-2">
                {rentalTiers.length === 0 && (
                  <Button size="sm" variant="secondary" onClick={() => setRentalTiers(STANDARD_TIERS.map(t => ({ ...t })))}>Стандартные</Button>
                )}
                <Button size="sm" variant="secondary" onClick={() => setRentalTiers(t => [...t, { upToHours: 0, price: 0, label: '' }])}>
                  <Plus size={12} /> Ступень
                </Button>
              </div>
            </div>
            {rentalTiers.length === 0 ? (
              <p className="rounded-lg border border-dashed border-gray-300 px-3 py-4 text-center text-sm text-gray-500">
                Цена за прокат до указанного числа часов: например 1 ч, 4 ч (полдня), 24 ч (сутки).
              </p>
            ) : (
              rentalTiers.map((tier, index) => (
                <div key={index} className="grid grid-cols-[96px_1fr_1fr_auto] items-start gap-2">
                  <FloatingInput
                    label="До, ч"
                    type="number"
                    min="1"
                    value={tier.upToHours ? String(tier.upToHours) : ''}
                    onChange={e => setRentalTiers(t => t.map((x, i) => i === index ? { ...x, upToHours: Number(e.target.value) || 0 } : x))}
                  />
                  <FloatingInput
                    label="Цена"
                    type="number"
                    min="0"
                    value={String(tier.price)}
                    suffix={currencySymbol(pricingCurrency)}
                    onChange={e => setRentalTiers(t => t.map((x, i) => i === index ? { ...x, price: Number(e.target.value) || 0 } : x))}
                  />
                  <FloatingInput
                    label="Название"
                    value={tier.label ?? ''}
                    onChange={e => setRentalTiers(t => t.map((x, i) => i === index ? { ...x, label: e.target.value } : x))}
                  />
                  <Button size="icon" variant="ghost" className="mt-2.5" onClick={() => setRentalTiers(t => t.filter((_, i) => i !== index))} aria-label="Удалить ступень">
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))
            )}
            <FieldNote error={errors.rentalTiers} />
          </div>
        )}
        {pricingError && <p className="px-1 text-xs text-amber-700">Не удалось загрузить текущую цену. Можно сохранить новое значение.</p>}
      </FormSection>

      {!showMore && (
        <div className="pt-8">
          <Button variant="secondary" onClick={revealMore}>Заполнить больше</Button>
          <p className="mt-2 text-xs text-gray-500">Информация для клиента{!isEdit ? ', доступность и видимость' : ''} — можно заполнить сейчас или позже.</p>
        </div>
      )}

      {showMore && (
        <div ref={moreRef}>
          <FormSection title="Информация для клиента" description="Списки видны клиенту в карточке. Порядок пунктов — порядок показа.">
            {INFO_SECTION_KINDS.map(({ kind, label, placeholder }) => (
              <StringListEditor
                key={kind}
                label={label}
                items={sectionItems[kind] ?? []}
                onChange={items => setSectionItems(current => ({ ...current, [kind]: items }))}
                placeholder={placeholder}
                addLabel="Добавить пункт"
              />
            ))}
          </FormSection>

          {!isEdit && (
            <>
              <FormSection title="Доступность" description="Когда предложение можно бронировать. Без окон работы брони не принимаются.">
                <FieldRow>
                  <FloatingInput label="Часовой пояс" value={timezone} onChange={e => setTimezone(e.target.value)} />
                  <FloatingSelect
                    label="Приём бронирований"
                    value={availabilityStatus}
                    onChange={setAvailabilityStatus}
                    options={[{ value: 'active', label: 'Принимать' }, { value: 'inactive', label: 'Временно закрыто' }]}
                  />
                </FieldRow>
                <FieldRow>
                  <FloatingInput label="Длительность сеанса, ч" type="number" min="1" value={durationHours} onChange={e => setDurationHours(e.target.value)} hint="Для сеансов фиксированной длины." />
                  <FloatingInput label="Шаг слота, мин" type="number" min="1" value={slotIntervalMinutes} onChange={e => setSlotIntervalMinutes(e.target.value)} />
                </FieldRow>

                <div className="flex items-center justify-between pt-2">
                  <p className="text-sm text-gray-700">Сезонные окна работы</p>
                  <Button size="sm" variant="secondary" onClick={() => setWindows(ws => [...ws, emptyWindow()])}><Plus size={12} /> Окно</Button>
                </div>
                {windows.map((window, index) => (
                  <div key={index} data-error={errors[`window-${index}`] ? 'true' : undefined}>
                    <div className="grid items-end gap-2 rounded-lg border border-gray-200 p-3 sm:grid-cols-[1.6fr_100px_100px_auto]">
                      <DateRangePicker label="Сезон" startsOn={window.startsOn} endsOn={window.endsOn} onChange={range => patchWindow(index, range)} />
                      <TimeSelect label="Открытие" value={window.dailyOpensAt} onChange={value => patchWindow(index, { dailyOpensAt: value })} />
                      <TimeSelect label="Закрытие" value={window.dailyClosesAt} onChange={value => patchWindow(index, { dailyClosesAt: value })} />
                      <Button size="icon" variant="ghost" onClick={() => setWindows(ws => ws.filter((_, i) => i !== index))} aria-label="Удалить окно"><Trash2 size={13} /></Button>
                    </div>
                    <FieldNote error={errors[`window-${index}`]} />
                  </div>
                ))}

                <div className="flex items-center justify-between pt-2">
                  <p className="text-sm text-gray-700">Закрытые периоды</p>
                  <Button size="sm" variant="secondary" onClick={() => setBlockedPeriods(bs => [...bs, emptyBlockedPeriod()])}><Plus size={12} /> Закрыть даты</Button>
                </div>
                {blockedPeriods.map((period, index) => (
                  <div key={index} data-error={errors[`blocked-${index}`] ? 'true' : undefined}>
                    <div className="grid items-end gap-2 rounded-lg border border-gray-200 p-3 sm:grid-cols-[1.4fr_1fr_auto]">
                      <DateRangePicker label="Период" startsOn={period.startsOn} endsOn={period.endsOn} onChange={range => patchBlocked(index, range)} />
                      <FloatingInput label="Причина" value={period.reasonCode ?? ''} onChange={e => patchBlocked(index, { reasonCode: e.target.value })} />
                      <Button size="icon" variant="ghost" onClick={() => setBlockedPeriods(bs => bs.filter((_, i) => i !== index))} aria-label="Удалить период"><Trash2 size={13} /></Button>
                    </div>
                    <FieldNote error={errors[`blocked-${index}`]} />
                  </div>
                ))}
              </FormSection>

            </>
          )}
        </div>
      )}

      <ActionBar
        error={isEdit ? submitError : undefined}
        left={
          <>
            <Button variant="secondary" onClick={onCancel} disabled={submitting}>Отмена</Button>
            {!showMore && <Button variant="ghost" onClick={revealMore}>Заполнить больше</Button>}
          </>
        }
        right={
          isEdit
            ? <Button variant="primary" onClick={() => { if (validate()) void onSubmit(buildData()); }} loading={submitting}>Сохранить</Button>
            : <Button variant="primary" onClick={goToPreview}>Далее</Button>
        }
      />
    </FormPage>
  );
}

function PreviewBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{title}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

/** The пункт проката the offer already hands over at, or nothing. The API is the only source. */
function readFulfillmentLocationId(offer: Offer | undefined) {
  return offer?.fulfillmentLocationId ?? '';
}
