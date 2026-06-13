import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { ApiError, resourcesApi } from '../../lib/api-client';
import type { Resource } from '../../types';
import { createOfferWithSetup } from './offerCreate';
import { OfferForm, type OfferFormData } from './OfferForm';

interface OfferCreatePageProps {
  resourceId: string;
  onNavigate: (path: string) => void;
  onHeaderContentChange?: (content: { title: string; subtitle?: string; breadcrumbs?: { label: string; path?: string }[] } | null) => void;
}

export function OfferCreatePage({ resourceId, onNavigate, onHeaderContentChange }: OfferCreatePageProps) {
  const [resource, setResource] = useState<Resource | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const createInFlightRef = useRef(false);

  const backToOffers = `/resources/${resourceId}?tab=offers`;

  useEffect(() => {
    onHeaderContentChange?.({
      title: 'Создать предложение',
      breadcrumbs: [
        { label: 'Каталог', path: '/resources' },
        { label: resource?.title ?? 'Позиция', path: backToOffers },
        { label: 'Новое предложение' },
      ],
    });
    return () => onHeaderContentChange?.(null);
  }, [onHeaderContentChange, resource?.title, backToOffers]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    resourcesApi.get(resourceId)
      .then(next => { if (!cancelled) setResource(next); })
      .catch(err => {
        if (!cancelled) setError(err instanceof ApiError ? `Не удалось загрузить позицию: ${err.message}` : 'Не удалось загрузить позицию.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [resourceId]);

  const handleCreate = async (data: OfferFormData) => {
    if (createInFlightRef.current) return;
    createInFlightRef.current = true;
    setSaving(true);
    setError('');
    try {
      await createOfferWithSetup(
        { ...data, title: data.title || (resource ? `Прокат: ${resource.title}` : 'Новое предложение') },
        { resourceFallback: resourceId }
      );
      onNavigate(backToOffers);
    } catch (err) {
      setError(err instanceof ApiError ? `Не удалось создать предложение: ${err.message}` : 'Не удалось создать предложение.');
    } finally {
      setSaving(false);
      createInFlightRef.current = false;
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
          <AlertTriangle size={14} className="shrink-0 text-red-600" />
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}
      {loading ? (
        <div className="py-16 text-center text-sm text-gray-500">Загружаем позицию…</div>
      ) : (
        <OfferForm
          resources={resource ? [resource] : []}
          initialResourceId={resourceId}
          hideOfferType
          onSubmit={handleCreate}
          onCancel={() => onNavigate(backToOffers)}
          submitting={saving}
        />
      )}
    </div>
  );
}
