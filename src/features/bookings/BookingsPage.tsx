import { CalendarCheck } from 'lucide-react';
import { Button } from '../../components/ui/Button';

/**
 * Заказы — placeholder. The section has its place in the navigation before it has a screen, so
 * the tab does not appear later out of nowhere; nothing here pretends to show real bookings.
 */
export function BookingsPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="max-w-md text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-500">
          <CalendarCheck size={22} />
        </span>
        <h2 className="mt-4 text-lg font-semibold text-gray-950">Заказы скоро появятся</h2>
        <p className="mt-2 text-sm leading-6 text-gray-500">
          Здесь будут бронирования клиентов: состав заказа, сроки аренды и статус оплаты.
          Пока выдачи и возвраты по текущим броням живут в разделе «Выдача».
        </p>
        <Button className="mt-5" variant="secondary" onClick={() => onNavigate('/fulfillment')}>
          Перейти к выдаче
        </Button>
      </div>
    </div>
  );
}
