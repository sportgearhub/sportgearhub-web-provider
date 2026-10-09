import { useCallback, useEffect, useRef, useState } from 'react';
import { CameraOff, Keyboard, Loader2, QrCode, ScanLine } from 'lucide-react';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { ApiError, bookingsApi } from '../../lib/api-client';
import { cn } from '../../lib/utils';
import type { BookingListItem } from '../../types';

/**
 * `BarcodeDetector` is a browser API rather than a library, and it is not in the DOM typings yet.
 * Chrome and Android ship it; Safari does not.
 */
type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>;
};
declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats: string[] }) => BarcodeDetectorLike;
  }
}

/**
 * The decoder, native where there is one.
 *
 * Writing a QR decoder is not the shortcut it looks like — finder patterns, perspective
 * correction, version and mask detection, then Reed-Solomon over a Galois field, every one of them
 * a place to be subtly wrong on a creased screen in bad light. `barcode-detector` is ZXing-C++
 * compiled to WebAssembly behind the exact API the browser exposes, so the code below does not
 * know which one it got.
 *
 * It is imported only when the native one is missing: a phone that has it never downloads the
 * WebAssembly. The binary is served from our own origin rather than the package's default CDN —
 * a counter on hotel wifi should not depend on jsDelivr being reachable, and Vite fingerprints and
 * caches it like any other asset.
 */
async function loadDetector(): Promise<BarcodeDetectorLike> {
  if (window.BarcodeDetector) return new window.BarcodeDetector({ formats: ['qr_code'] });

  const [{ BarcodeDetector, prepareZXingModule }, { default: wasmUrl }] = await Promise.all([
    import('barcode-detector/ponyfill'),
    import('zxing-wasm/reader/zxing_reader.wasm?url'),
  ]);
  prepareZXingModule({
    overrides: {
      locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path),
    },
  });
  return new BarcodeDetector({ formats: ['qr_code'] });
}

/**
 * Пропуск клиента — a counter tool, and the whole screen while it is open.
 *
 * The operator has the gear in one hand and a phone in the other; the booking number is on the
 * customer's screen. So the camera is the page: a bar with a way back, and under it nothing but
 * what the lens sees. No section bar at the bottom — a viewfinder with navigation across it is a
 * form, and this is a thing you point.
 *
 * What the code contains is the booking's number — the same `SGH-…` printed on the customer's
 * confirmation. It is looked up through the ordinary bookings list, so this needs nothing from the
 * API that does not already exist; when a scanning endpoint arrives, only `findBooking` changes.
 */
export function ScanPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [manual, setManual] = useState('');
  const [typing, setTyping] = useState(false);
  const [status, setStatus] = useState<'starting' | 'scanning' | 'paused' | 'denied'>('starting');
  const [looking, setLooking] = useState(false);
  const [error, setError] = useState('');
  // Bumped to ask for the camera again after it was refused or switched off.
  const [attempt, setAttempt] = useState(0);
  const [paused, setPaused] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const findBooking = useCallback(async (code: string) => {
    const number = code.trim().split(/[/\s]/).pop() ?? code.trim();
    if (!number) return;
    setLooking(true);
    setError('');
    try {
      // The number is the thing the customer can show; `booking_number` is in the filter allowlist.
      const found = await bookingsApi.list({ filter: `booking_number=="${number}"`, pageSize: 1 });
      const booking: BookingListItem | undefined = found.items?.[0];
      if (!booking) {
        setError(`Бронирование ${number} не найдено. Проверьте номер или найдите его в заказах.`);
        return;
      }
      onNavigate(`/bookings/${booking.bookingId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось найти бронирование.');
    } finally {
      setLooking(false);
    }
  }, [onNavigate]);

  // Read through a ref: the lookup closes over `onNavigate`, which is a new function on every
  // render of the layout above. As a dependency it would tear the camera down and ask for
  // permission again several times a second.
  const findRef = useRef(findBooking);
  findRef.current = findBooking;

  /**
   * The camera's whole life, in one effect.
   *
   * It starts on its own — the page is for scanning, and asking the operator to tap a button to
   * turn on the thing they came for is a step for nobody. Everything it opens is closed by the
   * cleanup, which is also what makes it survive React's double mount in development and a tap on
   * «Назад» mid-frame.
   */
  useEffect(() => {
    if (paused) return;
    let cancelled = false;
    let stream: MediaStream | null = null;
    let frame = 0;
    setStatus('starting');

    const run = async () => {
      try {
        // The back camera is the one pointed at the counter.
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (cancelled) { stream.getTracks().forEach(track => track.stop()); return; }
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        const detector = await loadDetector();
        if (cancelled) return;
        setStatus('scanning');

        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const value = (await detector.detect(videoRef.current))[0]?.rawValue;
            if (value) {
              // Pausing tears this effect down, which stops the stream — the camera does not keep
              // running behind the booking that is about to open.
              setPaused(true);
              void findRef.current(value);
              return;
            }
          } catch {
            // A frame that cannot be read is not a failure; the next one usually can.
          }
          frame = requestAnimationFrame(() => void tick());
        };
        void tick();
      } catch {
        if (!cancelled) setStatus('denied');
      }
    };
    void run();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach(track => track.stop());
    };
  }, [attempt, paused]);

  const resume = () => { setError(''); setPaused(false); setAttempt(count => count + 1); };
  const scanning = status === 'scanning' && !paused;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* The frame is the content. Full-bleed on a phone; inset on a desktop, where a black
          rectangle from edge to edge would be a mistake rather than a viewfinder. */}
      <div className="relative min-h-0 flex-1 overflow-hidden bg-gray-950 lg:m-6 lg:rounded-2xl">
        <video
          ref={videoRef}
          playsInline
          muted
          className={cn('absolute inset-0 h-full w-full object-cover transition-opacity', scanning ? 'opacity-100' : 'opacity-0')}
        />

        {scanning && (
          <>
            {/* A window to aim through: the brackets are where the code has to be, and the dimmed
                surround is everything the detector is being shown but need not read. */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative h-60 w-60 max-w-[72vw] rounded-3xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                <Corner className="left-0 top-0 rounded-tl-2xl border-l-4 border-t-4" />
                <Corner className="right-0 top-0 rounded-tr-2xl border-r-4 border-t-4" />
                <Corner className="bottom-0 left-0 rounded-bl-2xl border-b-4 border-l-4" />
                <Corner className="bottom-0 right-0 rounded-br-2xl border-b-4 border-r-4" />
              </div>
            </div>
            <p className="pointer-events-none absolute inset-x-0 top-6 px-8 text-center text-sm leading-5 text-white/90">
              Наведите камеру на QR-код в приложении клиента
            </p>
          </>
        )}

        {!scanning && !looking && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center">
            {status === 'denied' ? (
              <CameraOff size={30} className="text-gray-500" />
            ) : status === 'starting' ? (
              <Loader2 size={30} className="animate-spin text-gray-500" />
            ) : (
              <QrCode size={30} className="text-gray-500" />
            )}
            <p className="max-w-xs text-sm leading-5 text-gray-300">
              {status === 'denied'
                ? 'Нет доступа к камере. Разрешите его в настройках браузера или введите номер вручную.'
                : status === 'starting'
                  ? 'Готовим камеру…'
                  : 'Камера выключена.'}
            </p>
            {status !== 'starting' && (
              <button
                type="button"
                onClick={resume}
                className="mt-1 flex items-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 transition active:bg-gray-200"
              >
                <ScanLine size={16} /> Включить камеру
              </button>
            )}
          </div>
        )}

        {looking && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-950/80">
            <Loader2 size={26} className="animate-spin text-white" />
            <p className="text-sm text-white">Ищем бронирование…</p>
          </div>
        )}

        {error && (
          <p className="absolute inset-x-4 top-4 rounded-xl bg-red-600 px-3 py-2.5 text-sm leading-5 text-white shadow-lg">
            {error}
          </p>
        )}

        {/* The two things to do over a viewfinder, over the picture rather than beside it. */}
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => setTyping(true)}
            className="flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-2.5 text-sm font-medium text-white backdrop-blur transition active:bg-white/25"
          >
            <Keyboard size={16} /> Ввести номер
          </button>
          {scanning ? (
            <button
              type="button"
              onClick={() => setPaused(true)}
              className="rounded-full bg-white/15 px-4 py-2.5 text-sm font-medium text-white backdrop-blur transition active:bg-white/25"
            >
              Остановить
            </button>
          ) : (
            status !== 'starting' && (
              <button
                type="button"
                onClick={resume}
                className="rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 transition active:bg-gray-200"
              >
                Сканировать
              </button>
            )
          )}
        </div>
      </div>

      <BottomSheet
        open={typing}
        onClose={() => setTyping(false)}
        title="Номер бронирования"
        description="Если сканировать нечем — номер есть у клиента в подтверждении."
      >
        <form
          onSubmit={event => {
            event.preventDefault();
            setTyping(false);
            setPaused(true);
            void findRef.current(manual);
          }}
          className="px-3 pb-4 pt-1"
        >
          <div className="relative">
            <Keyboard size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={manual}
              onChange={event => setManual(event.target.value)}
              placeholder="SGH-20260926083813816"
              inputMode="text"
              autoComplete="off"
              autoFocus
              className="h-11 w-full rounded-xl border border-gray-300 bg-white pl-9 pr-3 text-base outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
            />
          </div>
          <Button type="submit" variant="primary" loading={looking} disabled={!manual.trim()} className="mt-3 h-11 w-full justify-center">
            Найти
          </Button>
          <p className="mt-3 text-xs leading-5 text-gray-500">
            Прототип. Читается номер бронирования — тот же, что клиент видит в подтверждении.
            Отдельной ручки для сканирования в API пока нет: найденное открывается как обычное
            бронирование, где уже есть выдача, возврат и обращение.
          </p>
        </form>
      </BottomSheet>
    </div>
  );
}

function Corner({ className }: { className: string }) {
  return <span className={cn('absolute h-8 w-8 border-white', className)} />;
}
