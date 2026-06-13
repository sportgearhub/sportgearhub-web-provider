import { useEffect, useState } from 'react';
import { ApiError, resourcesApi } from '../../lib/api-client';
import type { Resource } from '../../types';
import type { HeaderBreadcrumb } from '../../components/layout/Header';
import { ResourceDeleteDialog } from './ResourceDeleteDialog';
import { ResourceDetail } from './ResourceDetail';
import { ResourceError } from './ResourcePageChrome';

interface ResourceDetailPageProps {
  resourceId: string;
  onNavigate: (path: string) => void;
  onHeaderContentChange?: (content: { title: string; subtitle?: string; breadcrumbs?: HeaderBreadcrumb[] } | null) => void;
}

export function ResourceDetailPage({ resourceId, onNavigate, onHeaderContentChange }: ResourceDetailPageProps) {
  const [resource, setResource] = useState<Resource | null>(null);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState('');
  const [removeError, setRemoveError] = useState('');
  const [removeTarget, setRemoveTarget] = useState<Resource | null>(null);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError('');
    resourcesApi.get(resourceId)
      .then(nextResource => {
        if (!cancelled) setResource(nextResource);
      })
      .catch(err => {
        if (!cancelled) {
          setError(err instanceof ApiError ? `Не удалось загрузить позицию: ${err.message}` : 'Не удалось загрузить позицию.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [resourceId]);

  useEffect(() => {
    if (!onHeaderContentChange) return;
    if (resource) {
      onHeaderContentChange({
        title: resource.title,
        subtitle: `${resource.categoryName ?? resource.resourceType} · ${resourceStatusLabel(resource.status)}`,
        breadcrumbs: [
          { label: 'Каталог', path: '/resources' },
          { label: resource.title },
        ],
      });
    } else {
      onHeaderContentChange({
        title: 'Позиция',
        breadcrumbs: [
          { label: 'Каталог', path: '/resources' },
          { label: 'Позиция' },
        ],
      });
    }

    return () => onHeaderContentChange(null);
  }, [onHeaderContentChange, resource]);

  const handleArchive = async (target: Resource) => {
    setError('');
    setRemoveError('');
    try {
      await resourcesApi.archive(target.resourceId, 'provider_requested');
      onNavigate('/resources');
    } catch {
      setError('Не удалось архивировать позицию в API.');
    }
  };

  const handleRemove = async (target: Resource) => {
    setError('');
    setRemoveError('');
    setRemoving(true);
    try {
      await resourcesApi.remove(target.resourceId);
      setRemoveTarget(null);
      onNavigate('/resources');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setRemoveError('Позиция уже связана с предложениями, бронями или выдачей. Удаление недоступно, используйте архивирование.');
      } else if (err instanceof ApiError && err.status === 404) {
        setRemoveError('Позиция не найдена или недоступна для текущего партнера.');
      } else {
        setRemoveError('Не удалось удалить позицию.');
      }
    } finally {
      setRemoving(false);
    }
  };

  return (
    <>
      <div className="flex h-screen flex-col bg-white">
        <div className="flex-1 overflow-auto">
          {error && <ResourceError message={error} />}
          {loading ? (
            <div className="py-12 text-center text-sm text-gray-500">Загружаем позицию...</div>
          ) : resource ? (
            <ResourceDetail
              resource={resource}
              onNavigate={onNavigate}
              onEdit={() => onNavigate(`/resources/${resource.resourceId}/edit`)}
              onArchive={() => void handleArchive(resource)}
              onRemove={() => {
                setRemoveError('');
                setRemoveTarget(resource);
              }}
              removing={removing}
              removeError={removeError}
            />
          ) : null}
        </div>
      </div>

      <ResourceDeleteDialog
        resource={removeTarget}
        removing={removing}
        error={removeError}
        onClose={() => {
          setRemoveTarget(null);
          setRemoveError('');
        }}
        onConfirm={target => void handleRemove(target)}
        onArchive={target => {
          setRemoveTarget(null);
          void handleArchive(target);
        }}
      />
    </>
  );
}

function resourceStatusLabel(status: Resource['status']) {
  if (status === 'active') return 'Активна';
  if (status === 'draft') return 'Черновик';
  if (status === 'inactive') return 'Отключена';
  if (status === 'archived') return 'В архиве';
  return status;
}
