import { useCallback, useEffect, useRef, useState } from 'react';
import { CameraOff, Loader2, QrCode, ScanLine } from 'lucide-react';
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
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 pb-10">
      {/* The viewfinder, in the middle of the screen — one object on the ground, under a bar that
          floats on the same ground. A black rectangle filling every edge is a broken page; a
          square you hold a phone up to is a thing you point. */}
      <div className="relative aspect-square w-full max-w-sm overflow-hidden rounded-3xl bg-gray-950 shadow-lg">
        <video
          ref={videoRef}
          playsInline
          muted
          className={cn(
            'absolute inset-0 h-full w-full object-cover transition-opacity',
            scanning ? 'opacity-100' : 'opacity-0'
          )}
        />

        {/* The frame is the aim: the brackets mark where the code has to be, with nothing dimmed,
            because everything inside this square is being read. */}
        {scanning && (
          <div className="pointer-events-none absolute inset-6">
            <Corner className="left-0 top-0 rounded-tl-xl border-l-4 border-t-4" />
            <Corner className="right-0 top-0 rounded-tr-xl border-r-4 border-t-4" />
            <Corner className="bottom-0 left-0 rounded-bl-xl border-b-4 border-l-4" />
            <Corner className="bottom-0 right-0 rounded-br-xl border-b-4 border-r-4" />
          </div>
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
            <p className="max-w-[16rem] text-sm leading-5 text-gray-300">
              {status === 'denied'
                ? 'Нет доступа к камере. Разрешите его в настройках браузера.'
                : status === 'starting'
                  ? 'Готовим камеру…'
                  : 'Камера выключена.'}
            </p>
          </div>
        )}

        {looking && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-950/80">
            <Loader2 size={26} className="animate-spin text-white" />
            <p className="text-sm text-white">Ищем бронирование…</p>
          </div>
        )}
      </div>

      <p className="mt-5 max-w-xs text-center text-sm leading-5 text-gray-600">
        Наведите камеру на QR-код в приложении клиента — откроем его бронирование.
      </p>

      {error && (
        <p className="mt-3 w-full max-w-sm rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm leading-5 text-red-700">
          {error}
        </p>
      )}

      {/* One action under the frame, never two: whichever of the two states it is in. */}
      {status !== 'starting' && !looking && (
        scanning ? (
          <button
            type="button"
            onClick={() => setPaused(true)}
            className="mt-4 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-gray-900 shadow-sm transition active:bg-gray-100"
          >
            Остановить
          </button>
        ) : (
          <button
            type="button"
            onClick={resume}
            className="mt-4 flex items-center gap-1.5 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition active:bg-blue-700"
          >
            <ScanLine size={16} /> {status === 'denied' ? 'Попробовать снова' : 'Сканировать'}
          </button>
        )
      )}
    </div>
  );
}

function Corner({ className }: { className: string }) {
  return <span className={cn('absolute h-8 w-8 border-white', className)} />;
}
