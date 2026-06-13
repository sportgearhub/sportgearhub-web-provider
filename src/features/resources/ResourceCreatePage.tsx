import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { ResourceForm, type ResourceFormData } from './ResourceForm';
import { ApiError, equipmentApi, resourcesApi, type ResourceCategory } from '../../lib/api-client';

interface ResourceCreatePageProps {
  onNavigate: (path: string) => void;
  onHeaderContentChange?: (content: { title: string; subtitle?: string; breadcrumbs?: { label: string; path?: string }[] } | null) => void;
}

export function ResourceCreatePage({ onNavigate, onHeaderContentChange }: ResourceCreatePageProps) {
  const [categories, setCategories] = useState<ResourceCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [categoriesError, setCategoriesError] = useState('');
  const createInFlightRef = useRef(false);

  useEffect(() => {
    onHeaderContentChange?.({
      title: 'Создание',
      subtitle: 'Добавьте позицию в каталог.',
      breadcrumbs: [
        { label: 'Каталог', path: '/resources' },
        { label: 'Создание' },
      ],
    });

    return () => onHeaderContentChange?.(null);
  }, [onHeaderContentChange]);

  useEffect(() => {
    let cancelled = false;

    const loadCategories = async () => {
      setCategoriesError('');
      setCategoriesLoading(true);
      try {
        const nextCategories = await equipmentApi.resourceCategories('equipment');
        if (!cancelled) {
          setCategories(
            nextCategories
              .filter(category => category.status === 'active')
              .sort((a, b) => a.sortOrder - b.sortOrder)
          );
        }
      } catch (err) {
        if (!cancelled) {
          setCategories([]);
          setCategoriesError(err instanceof ApiError
            ? `Не удалось загрузить категории оборудования из API: ${err.message}`
            : 'Не удалось загрузить категории оборудования из API.');
        }
      } finally {
        if (!cancelled) setCategoriesLoading(false);
      }
    };

    void loadCategories();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleCreate = async (data: ResourceFormData) => {
    if (createInFlightRef.current) return;
    createInFlightRef.current = true;
    setError('');
    setSaving(true);
    try {
      const newResource = await resourcesApi.create({
        resourceType: data.resourceType,
        capacityMode: data.capacityMode,
        category: data.categorySlug,
        title: data.title,
        attributes: data.attributes,
      });

      if (data.imageFiles?.length) {
        await resourcesApi.images.upload(newResource.resourceId, data.imageFiles);
      }

      onNavigate('/resources');
    } catch (err) {
      setError(err instanceof ApiError
        ? `Не удалось создать позицию в API: ${err.message}`
        : err instanceof Error
          ? err.message
          : 'Не удалось создать позицию в API.');
    } finally {
      setSaving(false);
      createInFlightRef.current = false;
    }
  };

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          {error && <ResourceCreateError message={error} />}
          {categoriesError && <ResourceCreateError message={categoriesError} />}
          <ResourceForm
            categories={categories}
            loadingCategories={categoriesLoading}
            onSubmit={handleCreate}
            onCancel={() => onNavigate('/resources')}
            submitting={saving}
          />
        </div>
      </div>
    </div>
  );
}

function ResourceCreateError({ message }: { message: string }) {
  return (
    <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
      <AlertTriangle size={14} className="shrink-0 text-red-600" />
      <p className="text-xs text-red-700">{message}</p>
    </div>
  );
}
