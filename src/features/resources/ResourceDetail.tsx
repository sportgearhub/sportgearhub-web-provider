import { useEffect, useState } from 'react';
import { CalendarDays, CreditCard as Edit2, Package } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ResourceImagesSection } from './ResourceImagesSection';
import { ResourceParkTab } from './ResourceParkTab';
import { ResourceActionsMenu } from './ResourceActionsMenu';
import { ResourceOffersTab } from './ResourceOffersTab';
import { equipmentApi, resourcesApi, type EquipmentAttribute, type ResourceAttributeValue } from '../../lib/api-client';


import type { Offer, Resource, ResourceStatus } from '../../types';

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

type DetailTab = 'overview' | 'park' | 'offers' | 'photos';

const detailTabs: Array<{ value: DetailTab; label: string }> = [
  { value: 'overview', label: 'Обзор' },
  { value: 'park', label: 'Инвентарь' },
  { value: 'offers', label: 'Предложения' },
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
  const offers: Offer[] = [];

  useEffect(() => {
    const syncFromHistory = () => {
      setActiveTab(readTabFromUrl());
      setTabResetKey(current => current + 1);
    };
    window.addEventListener('popstate', syncFromHistory);
    return () => window.removeEventListener('popstate', syncFromHistory);
  }, []);

  return (
    <div className="flex w-full flex-col">
      {/* Header bar */}
      <div className="flex items-center justify-end border-b border-gray-200 bg-white px-6 py-3">
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
        <div className="border-b border-red-200 bg-red-50 px-6 py-2 text-xs text-red-700">
          {removeError}
          {resource.status !== 'archived' && (
            <button type="button" className="ml-2 font-semibold underline underline-offset-2" onClick={onArchive}>
              Архивировать вместо удаления
            </button>
          )}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 border-b border-gray-200 bg-white px-6">
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

      {/* Tab content — full width, no extra padding */}
      {activeTab === 'overview' && (
        <div className="grid gap-4 p-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
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
            <ResourceAttributesPanel resource={resource} />
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

      {activeTab === 'park' && <ResourceParkTab key={`park-${tabResetKey}`} resource={resource} onNavigate={onNavigate} />}

      {activeTab === 'offers' && (
        <ResourceOffersTab key={`offers-${tabResetKey}`} resource={resource} onNavigate={onNavigate} />
      )}

      {activeTab === 'photos' &&<ResourceImagesSection key={`photos-${tabResetKey}`} resourceId={resource.resourceId} />}
    </div>
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

/** Human-readable display for one stored attribute value: prefer displayValue, fall back to value. */
function attributeDisplayValue(attribute: EquipmentAttribute | undefined, value: ResourceAttributeValue): string {
  if (value.displayValue) return value.displayValue;
  // No server-provided label — resolve enums via the schema and append units.
  if (attribute?.allowedValues?.length) {
    const match = attribute.allowedValues.find(option => option.valueKey === value.value);
    if (match) return match.label;
  }
  if (value.valueType === 'boolean') return value.value === 'true' ? 'Да' : value.value === 'false' ? 'Нет' : value.value;
  if (!value.value) return '—';
  return attribute?.unitLabel ? `${value.value} ${attribute.unitLabel}` : value.value;
}

function ResourceAttributesPanel({ resource }: { resource: Resource }) {
  const [schemaAttributes, setSchemaAttributes] = useState<EquipmentAttribute[]>([]);
  const [values, setValues] = useState<ResourceAttributeValue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      resource.category?.slug
        ? equipmentApi.resourceCategoryAttributes(resource.resourceType, resource.category.slug).then(s => s.attributes).catch(() => [])
        : Promise.resolve([] as EquipmentAttribute[]),
      resourcesApi.getAttributes(resource.resourceId).then(r => r.attributes).catch(() => [] as ResourceAttributeValue[]),
    ])
      .then(([attrs, vals]) => {
        if (cancelled) return;
        setSchemaAttributes(attrs);
        setValues(vals.filter(v => attributeDisplayValue(attrs.find(a => a.key === v.key), v) !== '—' && attributeDisplayValue(attrs.find(a => a.key === v.key), v) !== ''));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [resource.resourceId, resource.resourceType, resource.category?.slug]);

  if (loading || values.length === 0) return null;

  const byKey = new Map(schemaAttributes.map(a => [a.key, a]));

  return (
    <div className="mt-4 border-t border-gray-100 pt-4">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Характеристики</h4>
      <div className="grid gap-2 md:grid-cols-2">
        {values.map(value => {
          const attribute = byKey.get(value.key);
          return <Row key={value.key} label={attribute?.label ?? value.key} value={attributeDisplayValue(attribute, value)} />;
        })}
      </div>
    </div>
  );
}
