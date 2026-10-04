import { useCallback, useEffect, useRef, useState } from 'react';
import { CameraOff, Keyboard, QrCode, ScanLine } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { SectionPage } from '../../components/layout/SectionPage';
import { SettingsCard } from '../../components/layout/SettingsCard';
import { ApiError, bookingsApi } from '../../lib/api-client';
import type { BookingListItem } from '../../types';

/**
 * `BarcodeDetector` is a browser API, not a library, and it is not in the DOM typings yet. Chrome
 * and Android have it; Safari does not, which is why the typed entry below the camera is a first
 *-class way in rather than an apology.
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
 * Пропуск клиента — a counter tool.
 *
 * The operator has the gear in one hand and a phone in the other; the booking number is on the
 * customer's screen. Scanning it beats reading twenty digits aloud, so the camera is the default
 * and typing is the fallback, not the other way round.
 *
 * What the code contains is the booking's number — the same `SGH-…` printed on the customer's
 * confirmation. It is looked up through the ordinary bookings list, so this needs nothing from the
 * API that does not already exist; when a scanning endpoint arrives, only `findBooking` changes.
 */
export function ScanPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [manual, setManual] = useState('');
  const [status, setStatus] = useState<'idle' | 'starting' | 'scanning' | 'unsupported' | 'denied'>('idle');
  const [looking, setLooking] = useState(false);
  const [error, setError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopped = useRef(false);

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

  const stop = useCallback(() => {
    stopped.current = true;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  const start = async () => {
    if (!window.BarcodeDetector) {
      setStatus('unsupported');
      return;
    }
    setStatus('starting');
    setError('');
    stopped.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // The back camera is the one pointed at the counter.
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStatus('scanning');

      const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      const tick = async () => {
        if (stopped.current || !videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          const value = codes[0]?.rawValue;
          if (value) {
            stop();
            setStatus('idle');
            void findBooking(value);
            return;
          }
        } catch {
          // A frame that cannot be read is not a failure; the next one usually can.
        }
        requestAnimationFrame(() => void tick());
      };
      void tick();
    } catch {
      setStatus('denied');
    }
  };

  return (
    <SectionPage
      title="Сканер"
      description="Отсканируйте QR клиента, чтобы открыть его бронирование."
      error={error}
    >
      <div className="max-w-xl space-y-4">
        <SettingsCard title="Камера" description="Наведите на QR-код в приложении клиента.">
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-gray-900">
            <video
              ref={videoRef}
              playsInline
              muted
              className={`h-full w-full object-cover ${status === 'scanning' ? '' : 'opacity-0'}`}
            />

            {status !== 'scanning' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                {status === 'unsupported' || status === 'denied' ? (
                  <CameraOff size={28} className="text-gray-500" />
                ) : (
                  <QrCode size={28} className="text-gray-500" />
                )}
                <p className="text-sm leading-5 text-gray-300">
                  {status === 'unsupported'
                    ? 'Этот браузер не умеет читать QR. Введите номер вручную — поле ниже.'
                    : status === 'denied'
                      ? 'Нет доступа к камере. Разрешите его в настройках браузера или введите номер вручную.'
                      : status === 'starting'
                        ? 'Включаем камеру…'
                        : 'Камера выключена.'}
                </p>
                {status !== 'unsupported' && (
                  <Button variant="secondary" size="sm" loading={status === 'starting'} onClick={() => void start()}>
                    <ScanLine size={14} /> Включить камеру
                  </Button>
                )}
              </div>
            )}

            {status === 'scanning' && (
              <>
                {/* A window to aim through: the frame is where the code has to be, and the dimmed
                    surround is what the detector is ignoring. */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-48 w-48 rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
                </div>
                <button
                  type="button"
                  onClick={() => { stop(); setStatus('idle'); }}
                  className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-lg bg-white/90 px-3 py-1.5 text-sm font-medium text-gray-900"
                >
                  Остановить
                </button>
              </>
            )}
          </div>
        </SettingsCard>

        <SettingsCard title="Номер бронирования" description="Если сканировать нечем — номер есть у клиента в подтверждении.">
          <form
            onSubmit={event => { event.preventDefault(); void findBooking(manual); }}
            className="flex flex-col gap-2 sm:flex-row"
          >
            <div className="relative min-w-0 flex-1">
              <Keyboard size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={manual}
                onChange={event => setManual(event.target.value)}
                placeholder="SGH-20260926083813816"
                inputMode="text"
                autoComplete="off"
                className="h-11 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-base outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 sm:text-sm"
              />
            </div>
            <Button type="submit" variant="primary" loading={looking} disabled={!manual.trim()} className="h-11 sm:h-9">
              Найти
            </Button>
          </form>
        </SettingsCard>

        <p className="px-1 text-xs leading-5 text-gray-500">
          Прототип. Читается номер бронирования — тот же, что клиент видит в подтверждении. Отдельной
          ручки для сканирования в API пока нет: найденное открывается как обычное бронирование, где
          уже есть выдача, возврат и обращение.
        </p>
      </div>
    </SectionPage>
  );
}
