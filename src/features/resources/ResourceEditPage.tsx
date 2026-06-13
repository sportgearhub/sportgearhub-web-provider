import { useEffect, useState } from 'react';
import { ApiError, equipmentApi, resourcesApi, type ResourceCategory } from '../../lib/api-client';
import type { Resource } from '../../types';
import { ResourceForm, type ResourceFormData } from './ResourceForm';
import { ResourceError } from './ResourcePageChrome';

interface ResourceEditPageProps {
  resourceId: string;
  onNavigate: (path: string) => void;
  onHeaderContentChange?: (content: { title: string; subtitle?: string; breadcrumbs?: { label: string; path?: string }[] } | null) => void;
}

export function ResourceEditPage({ resourceId, onNavigate, onHeaderContentChange }: ResourceEditPageProps) {
  const [resource, setResource] = useState<Resource | null>(null);
  const [categories, setCategories] = useState<ResourceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [categoriesError, setCategoriesError] = useState('');

  useEffect(() => {
    onHeaderContentChange?.({
      title: 'Редактирование',
      subtitle: resource ? resource.title : 'Изменение позиции каталога',
      breadcrumbs: [
        { label: 'Каталог', path: '/resources' },
        ...(resource ? [{ label: resource.title, path: `/resources/${resource.resourceId}` }] : []),
        { label: 'Редактирование' },
      ],
    });

    return () => onHeaderContentChange?.(null);
  }, [onHeaderContentChange, resource]);

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
    let cancelled = false;

    setCategoriesLoading(true);
    setCategoriesError('');
    equipmentApi.resourceCategories('equipment')
      .then(nextCategories => {
        if (!cancelled) {
          setCategories(
            nextCategories
              .filter(category => category.status === 'active')
              .sort((a, b) => a.sortOrder - b.sortOrder)
          );
        }
      })
      .catch(err => {
        if (!cancelled) {
          setCategoriesError(err instanceof ApiError
            ? `Не удалось загрузить категории оборудования из API: ${err.message}`
            : 'Не удалось загрузить категории оборудования из API.');
        }
      })
      .finally(() => {
        if (!cancelled) setCategoriesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleUpdate = async (data: ResourceFormData) => {
    if (!resource) return;

    setSaving(true);
    setError('');
    try {
      const nextResource = await resourcesApi.patch(resource.resourceId, {
        title: data.title,
        category: data.categorySlug,
      });
      if (data.attributes) {
        await resourcesApi.putAttributes(resource.resourceId, data.attributes);
      }
      onNavigate(`/resources/${nextResource.resourceId}`);
    } catch {
      setError('Не удалось обновить позицию в API.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          {error && <ResourceError message={error} />}
          {categoriesError && <ResourceError message={categoriesError} />}
          {loading ? (
            <div className="py-12 text-center text-sm text-gray-500">Загружаем позицию...</div>
          ) : resource ? (
            <ResourceForm
              resource={resource}
              categories={categories}
              loadingCategories={categoriesLoading}
              onSubmit={handleUpdate}
              onCancel={() => onNavigate(`/resources/${resource.resourceId}`)}
              submitting={saving}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
