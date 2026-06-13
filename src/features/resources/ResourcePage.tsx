import { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Search,
  ChevronDown,
  AlertTriangle,
  ImageOff,
} from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ResourceError } from './ResourcePageChrome';
import { ApiError, equipmentApi, resourcesApi, type ResourceCategory } from '../../lib/api-client';
import type { Resource, ResourceStatus } from '../../types';


type SortColumn = 'title' | 'updated' | null;
type SortOrder = 'asc' | 'desc';

interface ColumnFlyoutState {
  column: string | null;
  position: { top: number; left: number } | null;
}

interface ResourcesPageProps {
  onHeaderContentChange?: (content: { title: string; subtitle?: string } | null) => void;
  onNavigate: (path: string) => void;
}

const statusBadge: Record<ResourceStatus, { label: string; variant: 'green' | 'yellow' | 'gray' | 'blue' }> = {
  active: { label: 'Активен', variant: 'green' },
  draft: { label: 'Черновик', variant: 'yellow' },
  inactive: { label: 'Отключен', variant: 'gray' },
  archived: { label: 'В архиве', variant: 'gray' },
};

export function ResourcesPage({ onHeaderContentChange, onNavigate }: ResourcesPageProps) {
  const [resources, setResources] = useState<Resource[]>([]);
  const [categories, setCategories] = useState<ResourceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [categoriesError, setCategoriesError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [flyoutState, setFlyoutState] = useState<ColumnFlyoutState>({ column: null, position: null });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const loadResources = async () => {
    setError('');
    setLoading(true);
    try {
      const nextResources = await resourcesApi.list();
      setResources(nextResources);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 403
        ? 'Для этого аккаунта недоступен доступ партнера.'
        : 'Не удалось загрузить каталог из API.');
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    setCategoriesError('');
    try {
      const nextCategories = await equipmentApi.resourceCategories('equipment');
      setCategories(
        nextCategories
          .filter(category => category.status === 'active')
          .sort((a, b) => a.sortOrder - b.sortOrder)
      );
    } catch (err) {
      setCategories([]);
      setCategoriesError(err instanceof ApiError
        ? `Не удалось загрузить категории оборудования из API: ${err.message}`
        : 'Не удалось загрузить категории оборудования из API.');
    }
  };

  useEffect(() => {
    void loadResources();
    void loadCategories();
  }, []);

  useEffect(() => {
    if (!onHeaderContentChange) return undefined;

    onHeaderContentChange(null);

    return () => onHeaderContentChange(null);
  }, [onHeaderContentChange]);

  const categoryFilterOptions = useMemo(
    () => categories.map(category => ({ value: category.title, label: category.title })),
    [categories]
  );

  const filtered = resources.filter(resource => {
    const categoryName = resource.categoryName ?? resource.resourceType;
    const matchesSearch =
      !search ||
      resource.title.toLowerCase().includes(search.toLowerCase()) ||
      categoryName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || resource.status === statusFilter;
    const matchesCategory = !categoryFilter || categoryName === categoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const sorted = useMemo(() => {
    const result = [...filtered];
    if (sortColumn) {
      result.sort((a, b) => {
        if (sortColumn === 'title') {
          return sortOrder === 'asc' ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title);
        }
        const aVal = new Date(a.updatedAt).getTime();
        const bVal = new Date(b.updatedAt).getTime();
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      });
    }
    return result;
  }, [filtered, sortColumn, sortOrder]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paginated = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [categoryFilter, pageSize, search, sortColumn, sortOrder, statusFilter]);

  const handleBulkStatus = async (status: ResourceStatus) => {
    setError('');
    setSaving(true);
    try {
      const selectedResources = resources.filter(resource => selectedIds.includes(resource.id));
      const updatedResources = await Promise.all(
        selectedResources.map(resource => resourcesApi.patch(resource.resourceId, { status }))
      );
      const updatedById = new Map(updatedResources.map(resource => [resource.id, resource]));
      setResources(prev => prev.map(resource => updatedById.get(resource.id) ?? resource));
      setSelectedIds([]);
    } catch {
      setError('Не удалось обновить выбранные позиции в API.');
    } finally {
      setSaving(false);
    }
  };

  const handleBulkArchive = async () => {
    setError('');
    setSaving(true);
    try {
      const selectedResources = resources.filter(resource => selectedIds.includes(resource.id));
      const updatedResources = await Promise.all(
        selectedResources.map(resource => resourcesApi.archive(resource.resourceId, 'provider_requested'))
      );
      const updatedById = new Map(updatedResources.map(resource => [resource.id, resource]));
      setResources(prev => prev.map(resource => updatedById.get(resource.id) ?? resource));
      setSelectedIds([]);
    } catch {
      setError('Не удалось архивировать выбранные позиции в API.');
    } finally {
      setSaving(false);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id)
        ? prev.filter(selectedId => selectedId !== id)
        : [...prev, id]
    );
  };

  const openDetail = (resource: Resource) => {
    onNavigate(`/resources/${resource.resourceId}`);
  };

  const handleColumnOpen = (e: React.MouseEvent, column: string) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const left = Math.min(rect.left, window.innerWidth - 240);
    setFlyoutState({
      column,
      position: { top: rect.bottom + 6, left: Math.max(8, left) },
    });
  };

  const handleSort = (column: SortColumn, order?: SortOrder) => {
    setSortColumn(column);
    setSortOrder(order ?? (sortColumn === column && sortOrder === 'asc' ? 'desc' : 'asc'));
    setFlyoutState({ column: null, position: null });
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-gray-50">
      {/* Compact Navbar */}
      <nav className="border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between px-6 py-3">
          {/* Left: Title & Stats */}
          <div>
            <h1 className="text-sm font-semibold text-gray-900">Каталог</h1>
            <p className="text-xs text-gray-500">
              {loading ? 'Загружаем каталог...' : `${filtered.length} из ${resources.length}`}
            </p>
          </div>

          {/* Center: Search */}
          <div className="relative flex-1 mx-6">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Поиск по каталогу..."
              className="w-full rounded border border-gray-300 bg-white px-8 py-2 text-sm text-gray-900 transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <Button variant="primary" size="sm" onClick={() => onNavigate('/resources/create')}>
              <Plus size={13} /> Создать
            </Button>
          </div>
        </div>

        {/* Bulk Actions & Quick Filters */}
        {selectedIds.length > 0 || search || statusFilter || categoryFilter ? (
          <div className="border-t border-gray-100 px-6 py-2 flex items-center gap-2 flex-wrap text-sm">
            {selectedIds.length > 0 && (
              <>
                <Button size="sm" variant="secondary" loading={saving} onClick={() => void handleBulkStatus('active')}>Включить</Button>
                <Button size="sm" variant="secondary" loading={saving} onClick={() => void handleBulkStatus('inactive')}>Отключить</Button>
                <Button size="sm" variant="secondary" loading={saving} onClick={() => void handleBulkArchive()}>В архив</Button>
                <div className="ml-auto">
                  <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>Сбросить</Button>
                </div>
              </>
            )}
          </div>
        ) : null}
      </nav>

      {/* Table Area */}
      <div className="relative flex min-h-0 flex-1 flex-col bg-white">
        {error && <ResourceError message={error} />}
        {categoriesError && <ResourceError message={categoriesError} />}
        {loading ? (
          <div className="flex h-full flex-col items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            <p className="mt-3 text-sm font-medium text-gray-900">Загружаем каталог...</p>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full table-fixed border-collapse text-sm">
              <colgroup>
                <col className="w-16" />
                <col />
                <col className="w-40" />
                <col className="w-32" />
                <col className="w-28" />
              </colgroup>
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {/* Image column */}
                  <th className="border-r border-gray-200" />

                  {/* Resource (title) */}
                  <th className="border-r border-gray-200 px-2 py-1.5 text-left text-xs font-semibold text-gray-700 relative">
                    <button
                      onClick={(e) => handleColumnOpen(e, 'resource')}
                      className="flex items-center gap-1 px-1.5 py-1 rounded hover:bg-gray-200 transition text-gray-700 relative"
                    >
                      Позиция
                      <ChevronDown size={13} className={sortColumn === 'title' ? 'text-blue-600' : 'text-gray-400'} />
                    </button>
                    <ColumnFlyout
                      isOpen={flyoutState.column === 'resource'}
                      position={flyoutState.position}
                      options={[
                        { label: 'Сортировать А-Я', value: 'asc' },
                        { label: 'Сортировать Я-А', value: 'desc' },
                      ]}
                      onSort={(order) => handleSort('title', order)}
                      activeOrder={sortColumn === 'title' ? sortOrder : null}
                    />
                  </th>

                  {/* Category */}
                  <th className="border-r border-gray-200 px-2 py-1.5 text-left text-xs font-semibold text-gray-700 relative">
                    <button
                      onClick={(e) => handleColumnOpen(e, 'category')}
                      className="flex items-center gap-1 px-1.5 py-1 rounded hover:bg-gray-200 transition text-gray-700"
                    >
                      Категория
                      <ChevronDown size={13} className={categoryFilter ? 'text-blue-600' : 'text-gray-400'} />
                    </button>
                    <CategoryFilterFlyout
                      isOpen={flyoutState.column === 'category'}
                      position={flyoutState.position}
                      value={categoryFilter}
                      onChange={(val) => {
                        setCategoryFilter(val);
                        setFlyoutState({ column: null, position: null });
                      }}
                      options={categoryFilterOptions}
                    />
                  </th>

                  {/* Status */}
                  <th className="border-r border-gray-200 px-2 py-1.5 text-left text-xs font-semibold text-gray-700 relative">
                    <button
                      onClick={(e) => handleColumnOpen(e, 'status')}
                      className="flex items-center gap-1 px-1.5 py-1 rounded hover:bg-gray-200 transition text-gray-700"
                    >
                      Статус
                      <ChevronDown size={13} className={statusFilter ? 'text-blue-600' : 'text-gray-400'} />
                    </button>
                    <StatusFilterFlyout
                      isOpen={flyoutState.column === 'status'}
                      position={flyoutState.position}
                      value={statusFilter}
                      onChange={(val) => {
                        setStatusFilter(val);
                        setFlyoutState({ column: null, position: null });
                      }}
                    />
                  </th>

                  {/* Updated */}
                  <th className="px-2 py-1.5 text-left text-xs font-semibold text-gray-700 relative">
                    <button
                      onClick={(e) => handleColumnOpen(e, 'updated')}
                      className="flex items-center gap-1 px-1.5 py-1 rounded hover:bg-gray-200 transition text-gray-700"
                    >
                      Обновлено
                      <ChevronDown size={13} className={sortColumn === 'updated' ? 'text-blue-600' : 'text-gray-400'} />
                    </button>
                    <ColumnFlyout
                      isOpen={flyoutState.column === 'updated'}
                      position={flyoutState.position}
                      options={[
                        { label: 'Сначала старые', value: 'asc' },
                        { label: 'Сначала новые', value: 'desc' },
                      ]}
                      onSort={(order) => handleSort('updated', order)}
                      activeOrder={sortColumn === 'updated' ? sortOrder : null}
                    />
                  </th>

                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-14 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <AlertTriangle size={40} className="text-gray-300" />
                        <p className="mt-3 text-sm font-medium text-gray-900">Позиции не найдены</p>
                        <p className="text-xs text-gray-500">Измените фильтры или добавьте позицию</p>
                      </div>
                    </td>
                  </tr>
                ) : paginated.map(resource => {
                  const status = statusBadge[resource.status];
                  const isSelected = selectedIds.includes(resource.id);

                  return (
                    <tr
                      key={resource.id}
                      onClick={event => {
                        if (event.metaKey || event.ctrlKey) {
                          toggleSelection(resource.id);
                          return;
                        }
                        openDetail(resource);
                      }}
                      className={`cursor-pointer border-b border-gray-100 transition ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                    >
                      {/* Image (flush square) */}
                      <td className="h-16 w-16 border-r border-gray-100 p-0">
                        {resource.mediaPreviewUrl ? (
                          <img src={resource.mediaPreviewUrl} alt={resource.title} className="block h-16 w-16 object-cover" />
                        ) : (
                          <div className="flex h-16 w-16 items-center justify-center bg-gray-50 text-gray-300">
                            <ImageOff size={22} />
                          </div>
                        )}
                      </td>

                      {/* Title */}
                      <td className="border-r border-gray-100 px-4 py-2">
                        <p className="truncate text-sm font-medium text-gray-900">{resource.title}</p>
                      </td>

                      {/* Category */}
                      <td className="truncate border-r border-gray-100 px-4 py-2 text-sm text-gray-700">{resource.categoryName}</td>

                      {/* Status */}
                      <td className="border-r border-gray-100 px-4 py-2">
                        <Badge variant={status.variant} size="sm">{status.label}</Badge>
                      </td>

                      {/* Updated */}
                      <td className="px-4 py-2 text-sm text-gray-700">
                        {new Date(resource.updatedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex shrink-0 flex-col gap-3 border-t border-gray-100 bg-white px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-gray-500">
            {loading
              ? 'Загружаем строки...'
              : sorted.length === 0
                ? 'Нет строк'
                : `${(currentPage - 1) * pageSize + 1}-${Math.min(currentPage * pageSize, sorted.length)} из ${sorted.length}`}
          </div>
          <div className="flex items-center justify-end gap-2">
            <select
              value={pageSize}
              onChange={event => setPageSize(Number(event.target.value))}
              className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              <option value={10}>10 строк</option>
              <option value={25}>25 строк</option>
              <option value={50}>50 строк</option>
              <option value={100}>100 строк</option>
            </select>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setPage(value => Math.max(1, value - 1))}
              disabled={loading || currentPage === 1}
            >
              Назад
            </Button>
            <span className="min-w-16 text-center text-xs text-gray-500">
              {currentPage}/{pageCount}
            </span>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setPage(value => Math.min(pageCount, value + 1))}
              disabled={loading || currentPage === pageCount}
            >
              Далее
            </Button>
          </div>
        </div>
      </div>

      {/* Backdrop to close flyout */}
      {flyoutState.column && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setFlyoutState({ column: null, position: null })}
        />
      )}
    </div>
  );
}

// Improved Flyout components
function ColumnFlyout({
  isOpen,
  position,
  options,
  onSort,
  activeOrder,
}: {
  isOpen: boolean;
  position: { top: number; left: number } | null;
  options: { label: string; value: SortOrder }[];
  onSort: (order: SortOrder) => void;
  activeOrder: SortOrder | null;
}) {
  if (!isOpen || !position) return null;

  return (
    <div
      className="fixed z-[80] w-44 rounded-lg border border-gray-200 bg-white shadow-xl"
      style={{ top: `${position.top}px`, left: `${position.left}px` }}
      onClick={event => event.stopPropagation()}
    >
      <div className="p-2 space-y-1">
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => onSort(opt.value)}
            className={`w-full text-left px-3 py-2 rounded text-sm transition ${
              activeOrder === opt.value ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-100 text-gray-700'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function CategoryFilterFlyout({
  isOpen,
  position,
  value,
  onChange,
  options,
}: {
  isOpen: boolean;
  position: { top: number; left: number } | null;
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
}) {
  const [search, setSearch] = useState('');
  if (!isOpen || !position) return null;

  const filtered = options.filter(opt => opt.label.toLowerCase().includes(search.toLowerCase()));

  return (
    <div
      className="fixed z-[80] w-52 rounded-lg border border-gray-200 bg-white shadow-xl"
      style={{ top: `${position.top}px`, left: `${position.left}px` }}
      onClick={event => event.stopPropagation()}
    >
      <div className="p-3 border-b border-gray-100">
        <input
          type="text"
          placeholder="Поиск..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
          className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:border-blue-400 focus:outline-none"
        />
      </div>
      <div className="max-h-48 overflow-y-auto p-2 space-y-1">
        <button
          onClick={() => onChange('')}
          className={`w-full text-left px-3 py-2 rounded text-sm transition ${
            value === '' ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-100 text-gray-700'
          }`}
        >
          Все категории
        </button>
        {filtered.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`w-full text-left px-3 py-2 rounded text-sm transition ${
              value === opt.value ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-100 text-gray-700'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function StatusFilterFlyout({
  isOpen,
  position,
  value,
  onChange,
}: {
  isOpen: boolean;
  position: { top: number; left: number } | null;
  value: string;
  onChange: (val: string) => void;
}) {
  if (!isOpen || !position) return null;

  const options = [
    { value: '', label: 'Все статусы' },
    { value: 'active', label: 'Активен' },
    { value: 'draft', label: 'Черновик' },
    { value: 'inactive', label: 'Отключен' },
  ];

  return (
    <div
      className="fixed z-[80] w-44 rounded-lg border border-gray-200 bg-white shadow-xl"
      style={{ top: `${position.top}px`, left: `${position.left}px` }}
      onClick={event => event.stopPropagation()}
    >
      <div className="p-2 space-y-1">
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`w-full text-left px-3 py-2 rounded text-sm transition ${
              value === opt.value ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-100 text-gray-700'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

