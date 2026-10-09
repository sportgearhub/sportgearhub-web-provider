import { CameraOff, Loader2, ScanBarcode } from 'lucide-react';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { ScanFrame } from './ScanFrame';
import { PRODUCT_CODES, useCodeScanner, type CodeFormat } from './useCodeScanner';

/**
 * Scanning without leaving the page that asked for it.
 *
 * The catalogue's own search field is where the answer goes, so the camera comes to the list
 * rather than the list going to the camera: a sheet, the same square to point, and the value as
 * soon as it reads one. The camera is only alive while the sheet is open — `active` sees to that,
 * and closing the sheet stops the stream.
 */
export function ScanSheet({
  open,
  onClose,
  onFound,
  title = 'Поиск по штрихкоду',
  hint = 'Наведите камеру на штрихкод или QR-код на бирке товара.',
  formats = PRODUCT_CODES,
}: {
  open: boolean;
  onClose: () => void;
  onFound: (value: string) => void;
  title?: string;
  hint?: string;
  formats?: CodeFormat[];
}) {
  const camera = useCodeScanner({
    active: open,
    formats,
    onFound: value => { onFound(value); onClose(); },
  });

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={title}
      center
      footer={
        <Button variant="secondary" className="w-full justify-center" onClick={onClose}>
          Закрыть
        </Button>
      }
    >
      <div className="flex flex-col items-center px-5 pb-2 pt-1">
        <ScanFrame videoRef={camera.videoRef} scanning={camera.scanning} className="w-full max-w-[17rem]">
          <div className="flex flex-col items-center gap-2.5 p-6 text-center">
            {camera.status === 'denied' ? (
              <CameraOff size={26} className="text-gray-500" />
            ) : camera.status === 'starting' ? (
              <Loader2 size={26} className="animate-spin text-gray-500" />
            ) : (
              <ScanBarcode size={26} className="text-gray-500" />
            )}
            <p className="max-w-[14rem] text-sm leading-5 text-gray-300">
              {camera.status === 'denied'
                ? 'Нет доступа к камере. Разрешите его в настройках браузера.'
                : camera.status === 'starting'
                  ? 'Готовим камеру…'
                  : 'Камера выключена.'}
            </p>
            {camera.status === 'denied' && (
              <button
                type="button"
                onClick={camera.restart}
                className="mt-1 rounded-full bg-white px-4 py-2 text-sm font-semibold text-gray-900"
              >
                Попробовать снова
              </button>
            )}
          </div>
        </ScanFrame>
        <p className="mt-4 max-w-xs text-center text-sm leading-5 text-gray-600">{hint}</p>
      </div>
    </BottomSheet>
  );
}
