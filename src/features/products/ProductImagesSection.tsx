import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { AlertCircle, Check, ChevronLeft, ChevronRight, Image as ImageIcon, Pencil, Plus, RotateCw, Trash2, Upload, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { TopSheet } from '../../components/ui/TopSheet';
import { SettingsCard } from '../../components/layout/SettingsCard';
import { ApiError, mediaUrl, productsApi } from '../../lib/api-client';
import type { ProductImage } from '../../types';

const MAX_IMAGES = 10;
const MAX_FILE_MB = 5;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

function reorder<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/**
 * Photos on the product page.
 *
 * The card is a read state — how many there are and what they look like — because a drop zone and
 * a column of advice are an editing tool, and the page is not in editing mode until it is asked to
 * be. Everything that changes the gallery lives in the sheet behind «Редактировать», which is also
 * the only place with room for it: this card sits in a ~360px sidebar.
 */
export function ProductImagesSection({ productId }: { productId: string }) {
  const [images, setImages] = useState<ProductImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const next = await productsApi.images.list(productId);
      setImages(next.slice().sort((a, b) => a.sortOrder - b.sortOrder));
    } catch (err) {
      setError(err instanceof ApiError ? `Не удалось загрузить: ${err.message}` : 'Не удалось загрузить фото.');
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => { void load(); }, [load]);

  return (
    <>
      <SettingsCard
        title="Фото"
        description={
          images.length > 0
            ? `${images.length} из ${MAX_IMAGES} · первое — главное`
            : 'Карточку без фото почти не открывают.'
        }
        action={
          images.length > 0 ? (
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
              <Pencil size={13} /> Редактировать
            </Button>
          ) : null
        }
      >
        {loading ? (
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="aspect-square animate-pulse rounded-lg bg-gray-100" />
            ))}
          </div>
        ) : images.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-gray-400">
              <ImageIcon size={20} />
            </span>
            <p className="text-xs leading-5 text-gray-500">
              Добавьте до {MAX_IMAGES} фото — витрину, детали и снаряжение в деле.
            </p>
            <Button size="sm" variant="primary" onClick={() => setEditing(true)}>
              <Plus size={13} /> Добавить фото
            </Button>
          </div>
        ) : (
          <PhotoCarousel images={images} onEdit={() => setEditing(true)} />
        )}

        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
      </SettingsCard>

      <MediaSheet
        open={editing}
        onClose={() => setEditing(false)}
        productId={productId}
        images={images}
        onImagesChange={setImages}
        onReload={() => void load()}
      />
    </>
  );
}

// ─── Carousel ─────────────────────────────────────────────────────────────────

/** How long each photo holds before the next one, when nobody is touching it. */
const SLIDE_MS = 4000;

/**
 * The gallery as the seller checks it: one photo at a time, large enough to see.
 *
 * Six thumbnails at 90px in a sidebar prove a photo exists without showing what is in it, and a
 * «+1» tile hides the rest behind a guess. This advances on its own so the whole set passes by
 * without being asked, and stops the moment a pointer or a keyboard arrives — an animation that
 * keeps moving while someone is trying to look at one frame is working against them.
 */
function PhotoCarousel({ images, onEdit }: { images: ProductImage[]; onEdit: () => void }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const count = images.length;
  const go = useCallback((next: number) => setIndex(((next % count) + count) % count), [count]);

  useEffect(() => { if (index > count - 1) setIndex(0); }, [count, index]);

  useEffect(() => {
    if (paused || count < 2) return;
    const timer = setTimeout(() => setIndex(current => (current + 1) % count), SLIDE_MS);
    return () => clearTimeout(timer);
  }, [index, paused, count]);

  const current = images[index] ?? images[0];
  if (!current) return null;

  return (
    <div
      className="group relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <button
        type="button"
        onClick={onEdit}
        aria-label="Редактировать фото"
        className="block w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
      >
        <span className="relative block aspect-[4/3]">
          {/* Every frame stays mounted and fades, so switching does not flash a blank box while
              the next file is fetched. */}
          {images.map((image, position) => (
            <img
              key={image.imageId}
              src={mediaUrl(image.url)}
              alt=""
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
                position === index ? 'opacity-100' : 'opacity-0'
              }`}
            />
          ))}
          {index === 0 && (
            <span className="absolute left-2 top-2 rounded-lg bg-gray-950/60 px-2 py-0.5 text-[10px] font-medium text-white">
              Главное
            </span>
          )}
        </span>
      </button>

      {count > 1 && (
        <>
          <CarouselArrow side="left" onClick={() => go(index - 1)} />
          <CarouselArrow side="right" onClick={() => go(index + 1)} />

          <div className="mt-2 flex items-center justify-center gap-1.5">
            {images.map((image, position) => (
              <button
                key={image.imageId}
                type="button"
                onClick={() => go(position)}
                aria-label={`Фото ${position + 1} из ${count}`}
                aria-current={position === index}
                className={`h-1.5 rounded-full transition-all ${
                  position === index ? 'w-5 bg-gray-800' : 'w-1.5 bg-gray-300 hover:bg-gray-400'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CarouselArrow({ side, onClick }: { side: 'left' | 'right'; onClick: () => void }) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === 'left' ? 'Предыдущее фото' : 'Следующее фото'}
      className={`absolute top-[calc(50%-0.5rem)] flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-gray-700 shadow-sm transition hover:bg-white focus-visible:opacity-100 group-hover:opacity-100 sm:opacity-0 ${
        side === 'left' ? 'left-2' : 'right-2'
      }`}
    >
      <Icon size={16} />
    </button>
  );
}

// ─── Upload queue ─────────────────────────────────────────────────────────────

type QueueItem = {
  id: string;
  file: File;
  preview: string;
  status: 'queued' | 'uploading' | 'done' | 'error';
  error?: string;
};

let queueSeq = 0;

/**
 * Files are sent one at a time rather than in a single batch.
 *
 * The endpoint takes many at once, but then ten files share one outcome: a single reject loses the
 * nine that were fine, and there is nothing to retry but the whole set. One request per file gives
 * every row its own state and its own second chance, which is what a person dropping a folder of
 * photos over a hotel wifi actually needs.
 */
function useUploadQueue(productId: string, onUploaded: () => void) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  // The pump reads the queue between awaits, and it must see the newest one — files can arrive
  // while it is working — so state is mirrored into a ref rather than captured in a closure.
  const queueRef = useRef<QueueItem[]>([]);
  const running = useRef(false);

  const write = useCallback((update: (current: QueueItem[]) => QueueItem[]) => {
    queueRef.current = update(queueRef.current);
    setQueue(queueRef.current);
  }, []);

  const patch = useCallback((id: string, changes: Partial<QueueItem>) => {
    write(current => current.map(item => (item.id === id ? { ...item, ...changes } : item)));
  }, [write]);

  // Object URLs are released when their row goes away, and whatever is left over on unmount.
  useEffect(() => () => { queueRef.current.forEach(item => URL.revokeObjectURL(item.preview)); }, []);

  const pump = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      for (;;) {
        const next = queueRef.current.find(item => item.status === 'queued');
        if (!next) break;

        patch(next.id, { status: 'uploading', error: undefined });
        try {
          await productsApi.images.upload(productId, [next.file]);
          patch(next.id, { status: 'done' });
          onUploaded();
        } catch (err) {
          patch(next.id, {
            status: 'error',
            error: err instanceof ApiError ? err.message : 'Не удалось загрузить',
          });
        }
      }
    } finally {
      running.current = false;
    }
  }, [productId, onUploaded, patch]);

  const add = useCallback((files: File[]) => {
    if (files.length === 0) return;
    write(current => [
      ...current,
      ...files.map(file => ({
        id: `q${++queueSeq}`,
        file,
        preview: URL.createObjectURL(file),
        status: 'queued' as const,
      })),
    ]);
    void pump();
  }, [write, pump]);

  const retry = useCallback((id: string) => {
    patch(id, { status: 'queued', error: undefined });
    void pump();
  }, [patch, pump]);

  const release = (items: QueueItem[]) => items.forEach(item => URL.revokeObjectURL(item.preview));

  const drop = useCallback((id: string) => {
    write(current => {
      release(current.filter(item => item.id === id));
      return current.filter(item => item.id !== id);
    });
  }, [write]);

  const clearFinished = useCallback(() => {
    write(current => {
      release(current.filter(item => item.status === 'done'));
      return current.filter(item => item.status !== 'done');
    });
  }, [write]);

  return {
    queue,
    add,
    retry,
    drop,
    clearFinished,
    busy: queue.some(item => item.status === 'uploading' || item.status === 'queued'),
  };
}

/** Splits a drop or a file picker into what we can take and a sentence about what we cannot. */
function sift(files: File[], slots: number) {
  const wrongType = files.filter(file => !ACCEPTED.includes(file.type));
  const right = files.filter(file => ACCEPTED.includes(file.type));
  const tooBig = right.filter(file => file.size > MAX_FILE_MB * 1024 * 1024);
  const fits = right.filter(file => file.size <= MAX_FILE_MB * 1024 * 1024);
  const accepted = fits.slice(0, Math.max(slots, 0));

  const problems: string[] = [];
  if (wrongType.length > 0) problems.push(`${wrongType.length} не в JPEG, PNG или WebP`);
  if (tooBig.length > 0) problems.push(`${tooBig.length} тяжелее ${MAX_FILE_MB} МБ`);
  if (fits.length > accepted.length) problems.push(`свободных мест осталось ${Math.max(slots, 0)}`);

  return { accepted, problem: problems.length > 0 ? `Пропустили: ${problems.join(', ')}.` : '' };
}

// ─── The sheet ────────────────────────────────────────────────────────────────

function MediaSheet({
  open,
  onClose,
  productId,
  images,
  onImagesChange,
  onReload,
}: {
  open: boolean;
  onClose: () => void;
  productId: string;
  images: ProductImage[];
  onImagesChange: (next: ProductImage[]) => void;
  onReload: () => void;
}) {
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { queue, add, retry, drop, clearFinished, busy } = useUploadQueue(productId, onReload);
  const waiting = queue.filter(item => item.status !== 'done').length;
  const slots = MAX_IMAGES - images.length - waiting;
  const full = slots <= 0;

  const accept = useCallback((files: File[]) => {
    const { accepted, problem } = sift(files, MAX_IMAGES - images.length - waiting);
    setNotice(problem);
    add(accepted);
  }, [images.length, waiting, add]);

  // Screenshots go to the clipboard, not to a folder — pasting one straight in saves a round trip
  // through the file system.
  useEffect(() => {
    if (!open) return;
    const onPaste = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.files ?? []);
      if (files.length > 0) accept(files);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [open, accept]);

  useEffect(() => { if (!open) { setNotice(''); setError(''); clearFinished(); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const remove = async (imageId: string) => {
    setError('');
    const previous = images;
    onImagesChange(images.filter(image => image.imageId !== imageId).map((image, i) => ({ ...image, sortOrder: i + 1 })));
    try {
      await productsApi.images.remove(productId, imageId);
    } catch (err) {
      onImagesChange(previous);
      setError(err instanceof ApiError ? `Не удалось удалить: ${err.message}` : 'Не удалось удалить фото.');
    }
  };

  // Dragging a tile settles quickly, so the order is saved once the user stops, not on every hop.
  const saveOrderRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (saveOrderRef.current) clearTimeout(saveOrderRef.current); }, []);

  const move = (from: number, to: number) => {
    const next = reorder(images, from, to).map((image, i) => ({ ...image, sortOrder: i + 1 }));
    onImagesChange(next);
    if (saveOrderRef.current) clearTimeout(saveOrderRef.current);
    saveOrderRef.current = setTimeout(() => {
      void productsApi.images.reorder(productId, next.map(image => image.imageId))
        .catch(() => setError('Не удалось сохранить порядок. Попробуйте ещё раз.'));
    }, 600);
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (!full) accept(Array.from(event.dataTransfer.files));
  };

  return (
    <TopSheet
      open={open}
      onClose={onClose}
      title="Фото товара"
      description={`До ${MAX_IMAGES} фото · JPEG, PNG или WebP · до ${MAX_FILE_MB} МБ каждое`}
      footer={
        <Button variant={busy ? 'secondary' : 'primary'} onClick={onClose}>
          {busy ? 'Свернуть' : 'Готово'}
        </Button>
      }
    >
      {/* The whole sheet is the drop target, not just the dashed box — a file let go anywhere in
          here plainly means "take this". */}
      <div
        onDragOver={event => { event.preventDefault(); if (!full) setDragging(true); }}
        onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }}
        onDrop={onDrop}
        className={`relative space-y-5 rounded-xl transition ${dragging ? 'ring-2 ring-blue-400 ring-offset-4' : ''}`}
      >
        {dragging && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-blue-50/85">
            <p className="text-sm font-medium text-blue-700">Отпустите, чтобы загрузить</p>
          </div>
        )}

        <div
          role="button"
          tabIndex={full ? -1 : 0}
          aria-disabled={full}
          onClick={() => !full && inputRef.current?.click()}
          onKeyDown={event => {
            if (full) return;
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-9 text-center transition ${
            full
              ? 'cursor-not-allowed border-gray-200 bg-gray-50 opacity-70'
              : 'cursor-pointer border-gray-300 bg-gray-50/70 hover:border-blue-300 hover:bg-blue-50/40'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED.join(',')}
            multiple
            className="sr-only"
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              accept(Array.from(event.target.files ?? []));
              event.target.value = '';
            }}
          />
          <Upload size={26} className="text-gray-400" />
          <p className="mt-2.5 text-sm font-medium text-gray-800">
            {full ? `Достигнут предел в ${MAX_IMAGES} фото` : 'Перетащите фото сюда или нажмите, чтобы выбрать'}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {full
              ? 'Удалите лишнее, чтобы добавить новое.'
              : `Можно вставить из буфера — Ctrl+V · свободных мест: ${slots}`}
          </p>
        </div>

        {queue.length > 0 && <UploadQueue items={queue} onRetry={retry} onDrop={drop} onClearFinished={clearFinished} />}

        {notice && (
          <p className="flex items-start gap-2 text-xs text-amber-700">
            <AlertCircle size={14} className="mt-px shrink-0" /> {notice}
          </p>
        )}
        {error && (
          <p className="flex items-start gap-2 text-xs text-red-600">
            <AlertCircle size={14} className="mt-px shrink-0" /> {error}
          </p>
        )}

        <div>
          <div className="mb-2.5 flex items-baseline justify-between gap-3">
            <h3 className="text-sm font-semibold text-gray-900">
              {images.length > 0 ? `Загружено: ${images.length} из ${MAX_IMAGES}` : 'Пока ничего не загружено'}
            </h3>
            {images.length > 1 && <p className="text-xs text-gray-500">Перетащите, чтобы изменить порядок</p>}
          </div>

          {images.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-200 px-4 py-10 text-center text-xs text-gray-500">
              Первое загруженное фото станет главным — его видно в каталоге и в списках.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5 lg:grid-cols-6">
              {images.map((image, index) => (
                <ImageTile
                  key={image.imageId}
                  index={index}
                  image={image}
                  onReorder={move}
                  onDelete={() => void remove(image.imageId)}
                />
              ))}
            </div>
          )}
        </div>

        <VideoPrototype />

        <PhotoTips />
      </div>
    </TopSheet>
  );
}

// ─── Queue list ───────────────────────────────────────────────────────────────

function UploadQueue({
  items,
  onRetry,
  onDrop,
  onClearFinished,
}: {
  items: QueueItem[];
  onRetry: (id: string) => void;
  onDrop: (id: string) => void;
  onClearFinished: () => void;
}) {
  const done = items.filter(item => item.status === 'done').length;
  const failed = items.filter(item => item.status === 'error').length;

  return (
    <div className="rounded-xl border border-gray-200">
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-2.5">
        <p className="text-xs font-medium text-gray-700">
          Загрузка: {done} из {items.length}
          {failed > 0 && <span className="ml-2 text-red-600">· с ошибкой: {failed}</span>}
        </p>
        {done > 0 && (
          <Button size="sm" variant="ghost" onClick={onClearFinished}>Скрыть готовые</Button>
        )}
      </div>
      <ul className="divide-y divide-gray-50">
        {items.map(item => (
          <li key={item.id} className="flex items-center gap-3 px-4 py-2.5">
            <img src={item.preview} alt="" className="h-10 w-10 shrink-0 rounded-lg border border-gray-200 object-cover" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-gray-800">{item.file.name}</p>
              <p className="text-[11px] text-gray-500">
                {(item.file.size / 1024 / 1024).toFixed(1)} МБ
                {item.status === 'error' && item.error && <span className="text-red-600"> · {item.error}</span>}
              </p>
            </div>
            <QueueStatus status={item.status} />
            {item.status === 'error' && (
              <button
                type="button"
                onClick={() => onRetry(item.id)}
                className="rounded-lg p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
                aria-label="Повторить"
              >
                <RotateCw size={14} />
              </button>
            )}
            {item.status !== 'uploading' && (
              <button
                type="button"
                onClick={() => onDrop(item.id)}
                className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                aria-label="Убрать из списка"
              >
                <X size={14} />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function QueueStatus({ status }: { status: QueueItem['status'] }) {
  if (status === 'uploading') {
    return <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />;
  }
  if (status === 'done') {
    return <Check size={16} className="shrink-0 text-emerald-600" />;
  }
  if (status === 'error') {
    return <AlertCircle size={16} className="shrink-0 text-red-600" />;
  }
  return <span className="shrink-0 text-[11px] text-gray-400">в очереди</span>;
}

// ─── Tiles ────────────────────────────────────────────────────────────────────

function ImageTile({
  index,
  image,
  onReorder,
  onDelete,
}: {
  index: number;
  image: ProductImage;
  onReorder: (from: number, to: number) => void;
  onDelete: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const title = image.originalFileName ?? 'Фото';

  return (
    <div
      draggable
      onDragStart={event => {
        event.dataTransfer.setData('text/plain', String(index));
        event.dataTransfer.effectAllowed = 'move';
        setDragging(true);
      }}
      onDragEnd={() => { setDragging(false); setDragOver(false); }}
      onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={event => {
        event.preventDefault();
        event.stopPropagation();
        setDragOver(false);
        const from = Number(event.dataTransfer.getData('text/plain'));
        if (!Number.isNaN(from)) onReorder(from, index);
      }}
      title={title}
      className={`group relative aspect-square cursor-grab overflow-hidden rounded-lg border bg-gray-100 transition active:cursor-grabbing ${
        dragOver ? 'border-blue-400 ring-2 ring-blue-200' : 'border-gray-200'
      } ${dragging ? 'opacity-40' : ''}`}
    >
      <img src={mediaUrl(image.url)} alt={title} className="h-full w-full object-cover" />

      {index === 0 && (
        <span className="absolute inset-x-0 bottom-0 bg-gray-950/55 py-0.5 text-center text-[10px] font-medium text-white">
          Главное
        </span>
      )}

      <button
        type="button"
        onClick={event => { event.stopPropagation(); onDelete(); }}
        className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 text-gray-500 opacity-0 shadow-sm transition hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 group-hover:opacity-100"
        aria-label={`Удалить ${title}`}
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

// ─── Video (prototype) ────────────────────────────────────────────────────────

const VIDEO_SLOTS = 5;

/**
 * Video, as a prototype.
 *
 * There is no endpoint for it yet — /products/{id}/images is the whole media API — so nothing here
 * is sent anywhere and a chosen file lives until the sheet closes. It is built now so the shape of
 * the screen is settled before the API arrives; the badge says so plainly rather than letting a
 * seller believe a video was saved.
 */
function VideoPrototype() {
  const [picked, setPicked] = useState<{ name: string; url: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { picked.forEach(item => URL.revokeObjectURL(item.url)); }, [picked]);

  return (
    <section>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900">Видео</h3>
          <span className="rounded-lg bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
            Скоро
          </span>
        </div>
        <Button size="sm" variant="secondary" onClick={() => inputRef.current?.click()}>
          <Plus size={13} /> Добавить видео
        </Button>
      </div>
      <p className="mb-3 text-xs text-gray-500">
        Короткий ролик показывает снаряжение в деле. Загрузка ещё не подключена — выбранное здесь не сохраняется.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime"
        multiple
        className="sr-only"
        onChange={event => {
          const files = Array.from(event.target.files ?? []).slice(0, VIDEO_SLOTS - picked.length);
          setPicked(current => [...current, ...files.map(file => ({ name: file.name, url: URL.createObjectURL(file) }))]);
          event.target.value = '';
        }}
      />
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5">
        {Array.from({ length: VIDEO_SLOTS }, (_, index) => {
          const item = picked[index];
          if (!item) {
            return <div key={index} className="aspect-video rounded-lg border border-dashed border-gray-200 bg-gray-50/70" />;
          }
          return (
            <div key={item.url} className="group relative aspect-video overflow-hidden rounded-lg border border-gray-200 bg-gray-900">
              <video src={item.url} className="h-full w-full object-cover" muted />
              <button
                type="button"
                onClick={() => setPicked(current => current.filter((_, i) => i !== index))}
                className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-lg bg-white/90 text-gray-600 opacity-0 transition hover:text-red-600 group-hover:opacity-100"
                aria-label={`Убрать ${item.name}`}
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── Advice ───────────────────────────────────────────────────────────────────

const TIPS = [
  ['Первое фото — главное', 'Его видно в каталоге и в списках. Перетащите лучшее на первое место.'],
  ['Горизонтальные кадры', '4:3 или квадрат, минимум 800 × 600 px.'],
  ['Снаряжение в деле', 'Общий план, детали и кадр в использовании — так меньше вопросов при выдаче.'],
];

/** Advice belongs with the tool it is about, so it lives in the sheet and not on the page. */
function PhotoTips() {
  return (
    <details className="rounded-lg border border-gray-200 bg-gray-50/70 px-4 py-3">
      <summary className="cursor-pointer text-xs font-medium text-gray-700 marker:text-gray-400">
        Как снять хорошее фото
      </summary>
      <ul className="mt-3 space-y-2.5">
        {TIPS.map(([title, body]) => (
          <li key={title} className="flex gap-2.5">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
            <span>
              <span className="block text-xs font-medium text-gray-800">{title}</span>
              <span className="mt-0.5 block text-xs leading-4 text-gray-500">{body}</span>
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
