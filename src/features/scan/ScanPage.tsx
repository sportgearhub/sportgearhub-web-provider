import { useCallback, useState } from 'react';
import { CameraOff, Loader2, QrCode, ScanLine } from 'lucide-react';
import { ApiError, bookingsApi } from '../../lib/api-client';
import { cn } from '../../lib/utils';
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
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 pb-10">
      {/* The viewfinder, in the middle of the screen — one object on the ground, under a bar that
          floats on the same ground. A black rectangle filling every edge is a broken page; a
          square you hold a phone up to is a thing you point. */}
      <ScanFrame
        videoRef={camera.videoRef}
        scanning={camera.scanning}
        busy={looking}
        busyLabel="Ищем бронирование…"
        className="w-full max-w-sm"
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

      <p className="mt-5 max-w-xs text-center text-sm leading-5 text-gray-600">
        Наведите камеру на QR-код в приложении клиента — откроем его бронирование.
      </p>

      {error && (
        <p className="mt-3 w-full max-w-sm rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm leading-5 text-red-700">
          {error}
        </p>
      )}

      {/* One action under the frame, never two: whichever of the two states it is in. */}
      {camera.status !== 'starting' && !looking && (
        camera.scanning ? (
          <button
            type="button"
            onClick={camera.pause}
            className="mt-4 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-gray-900 shadow-sm transition active:bg-gray-100"
          >
            Остановить
          </button>
        ) : (
          <button
            type="button"
            onClick={() => { setError(''); camera.restart(); }}
            className={cn(
              'mt-4 flex items-center gap-1.5 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition active:bg-blue-700'
            )}
          >
            <ScanLine size={16} /> {camera.status === 'denied' ? 'Попробовать снова' : 'Сканировать'}
          </button>
        )
      )}
    </div>
  );
}
