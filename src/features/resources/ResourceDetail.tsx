import { useEffect, useState } from 'react';
import { CalendarDays, CreditCard as Edit2, Package } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ResourceImagesSection } from './ResourceImagesSection';
import { ResourceParkTab } from './ResourceParkTab';
import { ResourceActionsMenu } from './ResourceActionsMenu';
import { ResourceOffersTab } from './ResourceOffersTab';
import { ResourceAvailabilityTab } from './ResourceAvailabilityTab';
import { ResourceModelsTab } from './ResourceModelsTab';
import { ResourcePricingTab } from './ResourcePricingTab';
import type { Booking, Offer, Resource, ResourceStatus, ResourceVariant } from '../../types';

const statusBadge: Record<ResourceStatus, { label: string; variant: 'green' | 'yellow' | 'gray' | 'blue' }> = {
  active: { label: 'Активен', variant: 'green' },
  draft: { label: 'Черновик', variant: 'yellow' },
  inactive: { label: 'Отключен', variant: 'gray' },
  archived: { label: 'В архиве', variant: 'gray' },
};

interface ResourceDetailProps {
  resource: Resource;
  onEdit: () => void;
  onArchive: () => void;
  onRemove: () => void;
  removing?: boolean;
  removeError?: string;
  onNavigate?: (path: string) => void;
}

type DetailTab = 'overview' | 'models' | 'park' | 'offers' | 'availability' | 'pricing' | 'photos';

const detailTabs: Array<{ value: DetailTab; label: string }> = [
  { value: 'overview', label: 'Обзор' },
  { value: 'models', label: 'Модели' },
  { value: 'park', label: 'Инвентарь' },
  { value: 'offers', label: 'Предложения' },
  { value: 'availability', label: 'Доступность' },
  { value: 'pricing', label: 'Цена' },
  { value: 'photos', label: 'Фото' },
];

function readTabFromUrl(): DetailTab {
  const value = new URLSearchParams(window.location.search).get('tab');
  return detailTabs.some(tab => tab.value === value) ? value as DetailTab : 'overview';
}

function writeResourceTabToUrl(tab: DetailTab, resetNested = false) {
  const params = new URLSearchParams(window.location.search);
  if (tab === 'overview') {
    params.delete('tab');
  } else {
    params.set('tab', tab);
  }
  if (resetNested) {
    params.delete('view');
    params.delete('offerId');
  }
  const query = params.toString();
  const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}`;
  window.history.pushState({}, '', nextUrl);
}

export function ResourceDetail({ resource, onEdit, onArchive, onRemove, removing = false, removeError = '', onNavigate }: ResourceDetailProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>(() => readTabFromUrl());
  const [tabResetKey, setTabResetKey] = useState(0);
  const status = statusBadge[resource.status];
  const variants: ResourceVariant[] = [];
  const offers: Offer[] = [];
  const bookings: Booking[] = [];

  const totalStock = variants.reduce((sum, variant) => sum + (variant.stock ?? 0), 0);
  const offerPrices = offers
    .map(offer => offer.basePrice)
    .filter((price): price is number => typeof price === 'number');
  const basePrice = offerPrices.length > 0 ? Math.min(...offerPrices) : null;
  const totalRevenue = bookings.reduce((sum, booking) => sum + booking.totalAmount, 0);

  useEffect(() => {
    const syncFromHistory = () => {
      setActiveTab(readTabFromUrl());
      setTabResetKey(current => current + 1);
    };
    window.addEventListener('popstate', syncFromHistory);
    return () => window.removeEventListener('popstate', syncFromHistory);
  }, []);

  return (
    <div className="w-full space-y-5">
      <div className="flex items-start justify-end gap-4">
        <div className="flex items-center gap-2">
          <Badge variant={status.variant} size="md">{status.label}</Badge>
          <Button size="sm" variant="secondary" onClick={onEdit}>
            <Edit2 size={13} /> Редактировать
          </Button>
          <ResourceActionsMenu
            resource={resource}
            onEdit={onEdit}
            onArchive={onArchive}
            onRemove={onRemove}
            removing={removing}
            showEdit={false}
          />
        </div>
      </div>

      {removeError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {removeError}
          {resource.status !== 'archived' && (
            <button type="button" className="ml-2 font-semibold underline underline-offset-2" onClick={onArchive}>
              Архивировать вместо удаления
            </button>
          )}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <DetailMetric label="Модели" value={String(variants.length)} />
        <DetailMetric label="Базовая цена" value={basePrice ? `${basePrice.toLocaleString()} RUB` : 'Не задана'} />
        <DetailMetric label="Доступный остаток" value={String(totalStock)} />
        <DetailMetric label="Брони / выручка" value={`${bookings.length} / ${totalRevenue.toLocaleString()} RUB`} />
      </div>

      <div className="flex flex-wrap gap-1 border-b border-gray-200">
        {detailTabs.map(tab => (
          <button
            key={tab.value}
            type="button"
            onClick={() => {
              if (tab.value === activeTab) {
                writeResourceTabToUrl(tab.value, true);
                setTabResetKey(current => current + 1);
                return;
              }
              writeResourceTabToUrl(tab.value, true);
              setActiveTab(tab.value);
            }}
            className={`border-b-2 px-3 py-2 text-sm font-medium transition ${
              activeTab === tab.value
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
          <Card>
            <div className="mb-4 flex items-center gap-2">
              <Package size={15} className="text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-900">Обзор позиции</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Row label="Категория" value={resource.categoryName ?? resource.resourceType} />
              <Row label="Создан" value={resource.createdAt ? new Date(resource.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Неизвестно'} />
              <Row label="Обновлен" value={new Date(resource.updatedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })} />
              <Row label="Предложения" value={String(offers.length)} />
            </div>
            {resource.description && (
              <p className="mt-4 text-sm text-gray-700">{resource.description}</p>
            )}
          </Card>

          <Card className="min-w-0 overflow-hidden">
            <div className="mb-4 flex items-center gap-2">
              <CalendarDays size={15} className="text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-900">Превью доступности</h3>
            </div>
            <div className="grid grid-cols-7 gap-2 text-center text-[11px]">
              {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => (
                <div key={day} className="bg-gray-50 px-2 py-2 text-gray-500">{day}</div>
              ))}
              {Array.from({ length: 14 }, (_, index) => (
                <div
                  key={index}
                  className={`px-2 py-3 text-xs ${
                    index % 5 === 0 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                  }`}
                >
                  {index % 5 === 0 ? 'Занято' : 'Свободно'}
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-gray-500">
              Временный календарь для будущей живой доступности и нагрузки по броням.
            </p>
          </Card>
        </div>
      )}

      {activeTab === 'models' && (
        <ResourceModelsTab key={`models-${tabResetKey}`} resource={resource} onNavigate={onNavigate} />
      )}

      {activeTab === 'park' && <ResourceParkTab key={`park-${tabResetKey}`} resource={resource} onNavigate={onNavigate} />}

      {activeTab === 'offers' && (
        <ResourceOffersTab key={`offers-${tabResetKey}`} resource={resource} onNavigate={onNavigate} />
      )}

      {activeTab === 'availability' && (
        <ResourceAvailabilityTab key={`availability-${tabResetKey}`} resource={resource} />
      )}

      {activeTab === 'pricing' && (
        <ResourcePricingTab key={`pricing-${tabResetKey}`} resource={resource} />
      )}

      {activeTab === 'photos' && <ResourceImagesSection key={`photos-${tabResetKey}`} resourceId={resource.resourceId} />}
    </div>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">{label}</p>
      <p className="mt-2 text-base font-semibold text-gray-900">{value}</p>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs font-medium text-gray-900 text-right">{value}</span>
    </div>
  );
}
