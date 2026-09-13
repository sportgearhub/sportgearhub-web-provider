import { useCallback, useEffect, useRef, useState, type DragEvent, type ChangeEvent } from 'react';
import { GripVertical, Plus, Trash2, Upload, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { ApiError, resourcesApi } from '../../lib/api-client';
import type { ResourceImage } from '../../types';

interface ResourceImagesSectionProps {
  resourceId: string;
  compact?: boolean;
}

interface ResourceImageDraftSectionProps {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}

const MAX_IMAGES = 10;

function reorder<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

// ─── Uploaded images section ──────────────────────────────────────────────────

export function ResourceImagesSection({ resourceId }: ResourceImagesSectionProps) {
  const [images, setImages] = useState<ResourceImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const next = await resourcesApi.images.list(resourceId);
      setImages(next.slice().sort((a, b) => a.sortOrder - b.sortOrder));
    } catch (err) {
      setError(err instanceof ApiError ? `Не удалось загрузить: ${err.message}` : 'Не удалось загрузить фото.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [resourceId]);

  const handleUpload = async () => {
    if (pendingFiles.length === 0) return;
    setUploading(true);
    setError('');
    try {
      await resourcesApi.images.upload(resourceId, pendingFiles);
      setPendingFiles([]);
      setUploadOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? `Ошибка загрузки: ${err.message}` : 'Ошибка загрузки.');
    } finally {
      setUploading(false);
    }
  };

  const openUpload = () => { setPendingFiles([]); setUploadOpen(true); };
  const remaining = MAX_IMAGES - images.length;

  const handleDelete = async (imageId: string) => {
    setError('');
    try {
      await resourcesApi.images.delete(resourceId, imageId);
      setImages(cur => cur.filter(img => img.imageId !== imageId).map((img, i) => ({ ...img, sortOrder: i + 1 })));
    } catch (err) {
      setError(err instanceof ApiError ? `Не удалось удалить: ${err.message}` : 'Не удалось удалить фото.');
    }
  };

  const saveOrderRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleReorder = useCallback((from: number, to: number) => {
    setImages(cur => {
      const next = reorder(cur, from, to).map((img, i) => ({ ...img, sortOrder: i + 1 }));
      if (saveOrderRef.current) clearTimeout(saveOrderRef.current);
      saveOrderRef.current = setTimeout(() => {
        void resourcesApi.images.reorder(resourceId, next.map(img => img.imageId)).catch(() => {});
      }, 600);
      return next;
    });
  }, [resourceId]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Фото</h3>
          <p className="mt-0.5 text-xs text-gray-500">{images.length} из {MAX_IMAGES} · первое фото — главное</p>
        </div>
        <Button size="sm" variant="primary" onClick={openUpload} disabled={images.length >= MAX_IMAGES}>
          <Plus size={13} /> Добавить фото
        </Button>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-2 gap-0 divide-x divide-gray-100">
        {/* Left — gallery */}
        <div className="px-6 py-5">
          {loading ? (
            <div className="flex h-48 items-center justify-center text-sm text-gray-500">Загружаем фото...</div>
          ) : images.length === 0 ? (
            <DropZonePlaceholder onFiles={files => { setPendingFiles(files); setUploadOpen(true); }} />
          ) : (
            <PhotoGallery
              images={images}
              onReorder={handleReorder}
              onDelete={imageId => void handleDelete(imageId)}
              onAddClick={openUpload}
              canAdd={images.length < MAX_IMAGES}
            />
          )}
          {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
        </div>

        {/* Right — tips */}
        <div className="px-6 py-5">
          <PhotoTips count={images.length} max={MAX_IMAGES} />
        </div>
      </div>

      {/* Upload modal */}
      <Modal open={uploadOpen} onClose={() => !uploading && setUploadOpen(false)} title="Добавить фото" size="md">
        <UploadPanel
          existingImages={images}
          pendingFiles={pendingFiles}
          remaining={remaining}
          uploading={uploading}
          error={error}
          onFilesChange={setPendingFiles}
          onUpload={() => void handleUpload()}
          onCancel={() => setUploadOpen(false)}
        />
      </Modal>
    </div>
  );
}

// ─── Photo gallery — hero + grid ──────────────────────────────────────────────

function PhotoGallery({
  images,
  onReorder,
  onDelete,
  onAddClick,
  canAdd,
}: {
  images: ResourceImage[];
  onReorder: (from: number, to: number) => void;
  onDelete: (imageId: string) => void;
  onAddClick: () => void;
  canAdd: boolean;
}) {
  const [main, ...rest] = images;
  const slots = Array.from({ length: MAX_IMAGES - 1 });

  return (
    <div className="grid grid-cols-[2fr_repeat(4,1fr)] grid-rows-2 gap-2" style={{ height: '280px' }}>
      {/* Hero — first image, spans 2 rows */}
      <div className="row-span-2">
        <ImageTile
          index={0}
          src={main.url}
          title={main.originalFileName}
          imageId={main.imageId}
          isMain
          onReorder={onReorder}
          onDelete={onDelete}
        />
      </div>

      {/* Rest — 4 columns × 2 rows = 8 slots */}
      {slots.map((_, i) => {
        const img = rest[i];
        if (img) {
          return (
            <ImageTile
              key={img.imageId}
              index={i + 1}
              src={img.url}
              title={img.originalFileName}
              imageId={img.imageId}
              onReorder={onReorder}
              onDelete={onDelete}
            />
          );
        }
        if (i === rest.length && canAdd) {
          return (
            <button
              key={`add-${i}`}
              type="button"
              onClick={onAddClick}
              className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 text-gray-400 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-500"
            >
              <Plus size={20} />
              <span className="mt-1 text-[11px] font-medium">Добавить</span>
            </button>
          );
        }
        return (
          <div key={`empty-${i}`} className="rounded-lg border border-dashed border-gray-100 bg-gray-50/50" />
        );
      })}
    </div>
  );
}

// ─── Drop zone placeholder (no images yet) ────────────────────────────────────

function DropZonePlaceholder({ onFiles }: { onFiles: (files: File[]) => void }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const accept = (files: FileList | null) => {
    if (!files) return;
    onFiles(Array.from(files).filter(f => ['image/jpeg', 'image/png', 'image/webp'].includes(f.type)).slice(0, MAX_IMAGES));
  };

  return (
    <div
      className={`flex h-52 flex-col items-center justify-center rounded-xl border-2 border-dashed transition ${
        dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-gray-50'
      } cursor-pointer`}
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); accept(e.dataTransfer.files); }}
    >
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only"
        onChange={e => accept(e.target.files)} />
      <Upload size={32} className={dragging ? 'text-blue-500' : 'text-gray-400'} />
      <p className="mt-3 text-sm font-medium text-gray-700">Перетащите фото или нажмите для выбора</p>
      <p className="mt-1 text-xs text-gray-500">JPEG, PNG, WebP · до {MAX_IMAGES} фото · макс. 5 МБ каждое</p>
      <p className="mt-1 text-xs text-gray-400">Первое фото станет главным</p>
    </div>
  );
}

// ─── Upload modal panel ───────────────────────────────────────────────────────

function UploadPanel({
  existingImages,
  pendingFiles,
  remaining,
  uploading,
  error,
  onFilesChange,
  onUpload,
  onCancel,
}: {
  existingImages: ResourceImage[];
  pendingFiles: File[];
  remaining: number;
  uploading: boolean;
  error: string;
  onFilesChange: (files: File[]) => void;
  onUpload: () => void;
  onCancel: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const valid = Array.from(fileList)
      .filter(f => ['image/jpeg', 'image/png', 'image/webp'].includes(f.type))
      .slice(0, Math.max(remaining - pendingFiles.length, 0));
    if (valid.length > 0) onFilesChange([...pendingFiles, ...valid]);
  };

  const removeFile = (index: number) => {
    onFilesChange(pendingFiles.filter((_, i) => i !== index));
  };

  const canUpload = pendingFiles.length > 0 && pendingFiles.length <= remaining;

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        className={`flex h-32 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition ${
          dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:border-gray-400'
        }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
      >
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only"
          onChange={(e: ChangeEvent<HTMLInputElement>) => addFiles(e.target.files)} />
        <Upload size={22} className={dragging ? 'text-blue-500' : 'text-gray-400'} />
        <p className="mt-2 text-sm font-medium text-gray-700">Выберите или перетащите файлы</p>
        <p className="mt-0.5 text-xs text-gray-500">Осталось слотов: {remaining - pendingFiles.length} · JPEG, PNG, WebP</p>
      </div>

      {/* Pending file previews */}
      {pendingFiles.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-gray-700">Выбрано для загрузки: {pendingFiles.length}</p>
          <div className="flex flex-wrap gap-2">
            {pendingFiles.map((file, i) => (
              <PendingThumb key={`${file.name}-${file.size}`} file={file} onRemove={() => removeFile(i)} />
            ))}
          </div>
        </div>
      )}

      {/* Existing images strip */}
      {existingImages.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-gray-500">Уже загружено: {existingImages.length}</p>
          <div className="flex flex-wrap gap-1.5">
            {existingImages.map(img => (
              <img key={img.imageId} src={img.url} alt={img.originalFileName}
                className="h-12 w-12 rounded-md border border-gray-200 object-cover" />
            ))}
          </div>
        </div>
      )}

      {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

      <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
        <Button variant="secondary" onClick={onCancel} disabled={uploading}>Отмена</Button>
        <Button variant="primary" onClick={onUpload} loading={uploading} disabled={!canUpload}>
          Загрузить {pendingFiles.length > 0 ? `(${pendingFiles.length})` : ''}
        </Button>
      </div>
    </div>
  );
}

// ─── Pending file thumbnail (with preview) ────────────────────────────────────

function PendingThumb({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [src, setSrc] = useState('');

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
      {src && <img src={src} alt={file.name} className="h-full w-full object-cover" />}
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-gray-600 shadow-sm opacity-0 transition group-hover:opacity-100 hover:text-red-600"
      >
        <X size={11} />
      </button>
      <div className="absolute inset-x-0 bottom-0 bg-black/40 px-1 py-0.5 text-[9px] text-white truncate opacity-0 group-hover:opacity-100 transition">
        {(file.size / 1024).toFixed(0)} КБ
      </div>
    </div>
  );
}

// ─── Draggable image tile ─────────────────────────────────────────────────────

function ImageTile({
  index,
  src,
  title,
  imageId,
  isMain = false,
  onReorder,
  onDelete,
}: {
  index: number;
  src: string;
  title: string;
  imageId: string;
  isMain?: boolean;
  onReorder: (from: number, to: number) => void;
  onDelete: (imageId: string) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      draggable
      onDragStart={e => {
        e.dataTransfer.setData('text/plain', String(index));
        e.dataTransfer.effectAllowed = 'move';
        setDragging(true);
      }}
      onDragEnd={() => { setDragging(false); setDragOver(false); }}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => {
        e.preventDefault();
        setDragOver(false);
        const from = Number(e.dataTransfer.getData('text/plain'));
        if (!Number.isNaN(from)) onReorder(from, index);
      }}
      className={`group relative h-full w-full overflow-hidden rounded-lg border bg-gray-100 transition
        ${dragOver ? 'border-blue-400 ring-2 ring-blue-200' : 'border-gray-200'}
        ${dragging ? 'opacity-40' : ''}
        cursor-grab active:cursor-grabbing`}
      title={title}
    >
      <img src={src} alt={title} className="h-full w-full object-cover transition group-hover:scale-[1.03]" />

      {/* Main badge */}
      {isMain && (
        <span className="absolute left-2 top-2 rounded-md bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-gray-800 shadow-sm">
          Главное
        </span>
      )}

      {/* Delete button */}
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onDelete(imageId); }}
        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md bg-white/90 text-gray-500 shadow-sm opacity-0 transition group-hover:opacity-100 hover:bg-red-50 hover:text-red-600"
        aria-label="Удалить фото"
      >
        <Trash2 size={13} />
      </button>

      {/* Drag handle */}
      <div className="absolute bottom-2 left-2 flex h-7 w-7 items-center justify-center rounded-md bg-white/90 text-gray-500 opacity-0 shadow-sm transition group-hover:opacity-100">
        <GripVertical size={14} />
      </div>

      {/* Filename overlay */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 pb-2 pt-6 opacity-0 transition group-hover:opacity-100">
        <p className="truncate pl-8 text-[11px] text-white">{title}</p>
      </div>
    </div>
  );
}

// ─── Photo tips sidebar ───────────────────────────────────────────────────────

function PhotoTips({ count, max }: { count: number; max: number }) {
  const tips = [
    {
      title: 'Первое фото — главное',
      body: 'Оно отображается в списках и каталоге. Перетащите лучшее фото на первое место.',
    },
    {
      title: 'Рекомендуемое соотношение сторон',
      body: '4:3 или квадрат. Горизонтальные фото смотрятся лучше на большинстве устройств.',
    },
    {
      title: 'Качество важно',
      body: 'Минимум 800×600 px. Хорошее освещение, без водяных знаков и лишнего фона.',
    },
    {
      title: 'Покажите товар с разных сторон',
      body: 'Добавьте фото спереди, сбоку, деталей и в использовании — это повышает доверие.',
    },
  ];

  const pct = Math.round((count / max) * 100);
  const pctColor = count === 0 ? 'text-gray-400' : count < 3 ? 'text-amber-600' : 'text-emerald-600';

  return (
    <div className="space-y-5">
      {/* Progress */}
      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="font-medium text-gray-700">Заполненность</span>
          <span className={`font-semibold ${pctColor}`}>{pct}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-full rounded-full transition-all ${count === 0 ? 'bg-gray-200' : count < 3 ? 'bg-amber-400' : 'bg-emerald-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-gray-400">{count} из {max} фото добавлено</p>
      </div>

      {/* Tips */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Рекомендации</p>
        {tips.map(tip => (
          <div key={tip.title} className="flex gap-2.5">
            <div className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
            <div>
              <p className="text-xs font-medium text-gray-800">{tip.title}</p>
              <p className="mt-0.5 text-xs leading-4 text-gray-500">{tip.body}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Requirements */}
      <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 space-y-1.5">
        <p className="text-xs font-medium text-gray-700">Требования к файлам</p>
        {[
          ['Форматы', 'JPEG, PNG, WebP'],
          ['Размер', 'до 5 МБ каждый'],
          ['Количество', `до ${max} фото`],
          ['Минимум', '800 × 600 px'],
        ].map(([label, value]) => (
          <div key={label} className="flex items-center justify-between text-xs">
            <span className="text-gray-500">{label}</span>
            <span className="font-medium text-gray-700">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Draft section (used in resource create form) ─────────────────────────────

export function ResourceImageDraftSection({ files, onChange, disabled = false }: ResourceImageDraftSectionProps) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previews, setPreviews] = useState<Array<{ file: File; url: string }>>([]);

  useEffect(() => {
    const next = files.map(f => ({ file: f, url: URL.createObjectURL(f) }));
    setPreviews(next);
    return () => next.forEach(p => URL.revokeObjectURL(p.url));
  }, [files]);

  const appendFiles = (next: File[]) => {
    const accepted = next
      .filter(f => ['image/jpeg', 'image/png', 'image/webp'].includes(f.type))
      .slice(0, Math.max(MAX_IMAGES - files.length, 0));
    if (accepted.length > 0) onChange([...files, ...accepted]);
  };

  const removeFile = (index: number) => onChange(files.filter((_, i) => i !== index));
  const reorderFile = (from: number, to: number) => onChange(reorder(files, from, to));
  const canAdd = !disabled && files.length < MAX_IMAGES;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-medium text-gray-700">Фото</span>
          <span className="ml-2 text-xs text-gray-400">{files.length}/{MAX_IMAGES}</span>
        </div>
        <Button type="button" size="sm" variant="secondary" onClick={() => setUploadOpen(true)} disabled={!canAdd}>
          <Plus size={13} /> Добавить
        </Button>
      </div>

      {files.length === 0 ? (
        <DropZonePlaceholder onFiles={f => { onChange(f); }} />
      ) : (
        <div className="grid grid-cols-5 gap-2" style={{ height: '100px' }}>
          {Array.from({ length: MAX_IMAGES }).map((_, i) => {
            const preview = previews[i];
            if (preview) {
              return (
                <div
                  key={`${preview.file.name}-${i}`}
                  draggable={!disabled}
                  onDragStart={(event: DragEvent<HTMLDivElement>) => {
                    event.dataTransfer.setData('text/plain', String(i));
                    event.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragOver={(event: DragEvent<HTMLDivElement>) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                  }}
                  onDrop={(event: DragEvent<HTMLDivElement>) => {
                    event.preventDefault();
                    const from = Number(event.dataTransfer.getData('text/plain'));
                    if (!Number.isNaN(from) && from !== i) reorderFile(from, i);
                  }}
                  className="group relative h-full cursor-grab overflow-hidden rounded-lg border border-gray-200 bg-gray-100 active:cursor-grabbing"
                >
                  <img src={preview.url} alt={preview.file.name} className="h-full w-full object-cover" />
                  {i === 0 && <span className="absolute left-1 top-1 rounded bg-white/90 px-1 text-[10px] font-semibold text-gray-700">Главное</span>}
                  <button type="button" onClick={() => removeFile(i)}
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-gray-600 opacity-0 group-hover:opacity-100 hover:text-red-600 transition">
                    <X size={10} />
                  </button>
                  <div className="absolute bottom-1 left-1 flex h-5 w-5 items-center justify-center rounded bg-white/90 text-gray-500 opacity-0 transition group-hover:opacity-100">
                    <GripVertical size={11} />
                  </div>
                </div>
              );
            }
            if (i === files.length && canAdd) {
              return (
                <button key={`add-${i}`} type="button" onClick={() => setUploadOpen(true)}
                  className="flex h-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 text-gray-400 hover:border-blue-300 hover:text-blue-500 transition">
                  <Plus size={16} />
                </button>
              );
            }
            return <div key={`empty-${i}`} className="rounded-lg border border-dashed border-gray-100 bg-gray-50/30" />;
          })}
        </div>
      )}

      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title="Добавить фото" size="sm">
        <DraftFilePicker
          remaining={MAX_IMAGES - files.length}
          onFiles={f => { appendFiles(f); setUploadOpen(false); }}
          onCancel={() => setUploadOpen(false)}
        />
      </Modal>
    </div>
  );
}

function DraftFilePicker({ remaining, onFiles, onCancel }: { remaining: number; onFiles: (f: File[]) => void; onCancel: () => void }) {
  const [picked, setPicked] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const accept = (list: FileList | null) => {
    if (!list) return;
    setPicked(Array.from(list).filter(f => ['image/jpeg', 'image/png', 'image/webp'].includes(f.type)).slice(0, remaining));
  };

  return (
    <div className="space-y-4">
      <div
        className={`flex h-28 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition ${dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:border-gray-400'}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); accept(e.dataTransfer.files); }}
      >
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only"
          onChange={e => accept(e.target.files)} />
        <Upload size={20} className="text-gray-400" />
        <p className="mt-1.5 text-sm font-medium text-gray-700">Выберите или перетащите</p>
        <p className="text-xs text-gray-500">Осталось: {remaining} · JPEG, PNG, WebP</p>
      </div>

      {picked.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {picked.map((f, i) => <PendingThumb key={`${f.name}-${i}`} file={f} onRemove={() => setPicked(p => p.filter((_, j) => j !== i))} />)}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Отмена</Button>
        <Button variant="primary" onClick={() => onFiles(picked)} disabled={picked.length === 0}>
          Добавить {picked.length > 0 ? `(${picked.length})` : ''}
        </Button>
      </div>
    </div>
  );
}
