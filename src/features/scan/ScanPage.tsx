import { useCallback, useState } from 'react';
import { CameraOff, Loader2, QrCode, ScanLine } from 'lucide-react';
import { ApiError, bookingsApi } from '../../lib/api-client';
import type { BookingListItem } from '../../types';
import { ScanFrame } from './ScanFrame';
import { useCodeScanner } from './useCodeScanner';

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
  const [looking, setLooking] = useState(false);
  const [error, setError] = useState('');

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

  const camera = useCodeScanner({ active: true, onFound: findBooking });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* The lens takes everything under the bar. A camera in a box on a page is a page about a
          camera; this is the camera, and the square in the middle is where to hold the code. */}
      <ScanFrame
        videoRef={camera.videoRef}
        scanning={camera.scanning}
        busy={looking}
        busyLabel="Ищем бронирование…"
        fill
        overlay={
          /* Laid over the picture, because there is no page left beside it. */
          <>
            {camera.scanning && (
              <p className="pointer-events-none absolute inset-x-0 top-6 px-8 text-center text-sm leading-5 text-white/90">
                Наведите камеру на QR-код в приложении клиента
              </p>
            )}

            {error && (
              <p className="absolute inset-x-4 top-4 rounded-xl bg-red-600 px-3 py-2.5 text-sm leading-5 text-white shadow-lg">
                {error}
              </p>
            )}

            {/* One action, never two: whichever of the two states it is in. */}
            {camera.status !== 'starting' && !looking && (
              <div className="absolute inset-x-0 bottom-0 flex justify-center p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                {camera.scanning ? (
                  <button
                    type="button"
                    onClick={camera.pause}
                    className="rounded-full bg-white/15 px-5 py-2.5 text-sm font-medium text-white backdrop-blur transition active:bg-white/25"
                  >
                    Остановить
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setError(''); camera.restart(); }}
                    className="flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-gray-900 shadow-lg transition active:bg-gray-200"
                  >
                    <ScanLine size={16} /> {camera.status === 'denied' ? 'Попробовать снова' : 'Сканировать'}
                  </button>
                )}
              </div>
            )}
          </>
        }
      >
        <div className="flex flex-col items-center gap-3 p-8 text-center">
          {camera.status === 'denied' ? (
            <CameraOff size={30} className="text-gray-500" />
          ) : camera.status === 'starting' ? (
            <Loader2 size={30} className="animate-spin text-gray-500" />
          ) : (
            <QrCode size={30} className="text-gray-500" />
          )}
          <p className="max-w-[16rem] text-sm leading-5 text-gray-300">
            {camera.status === 'denied'
              ? 'Нет доступа к камере. Разрешите его в настройках браузера.'
              : camera.status === 'starting'
                ? 'Готовим камеру…'
                : 'Камера выключена.'}
          </p>
        </div>

      </ScanFrame>
    </div>
  );
}
