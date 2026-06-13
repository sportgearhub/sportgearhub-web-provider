import {
  ShoppingBag,
  CheckSquare,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  Package,
  Clock,
  RotateCcw,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useAuth } from '../../context/useAuth';
import type { Booking, DashboardStats, FulfillmentItem } from '../../types';

interface DashboardPageProps {
  onNavigate: (path: string) => void;
}

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const { user, activeMembership } = useAuth();
  const stats: DashboardStats = {
    activeBookings: 0,
    pendingHandovers: 0,
    pendingReturns: 0,
    totalRevenueMTD: 0,
    currency: 'RUB',
    catalogReadiness: 0,
    openIssues: 0,
  };
  const fulfillmentQueue: FulfillmentItem[] = [];
  const bookings: Booking[] = [];
  const pendingHandovers = fulfillmentQueue.filter(f => f.status === 'pending_handover');
  const pendingReturns = fulfillmentQueue.filter(f => f.status === 'pending_return');
  const recentBookings = bookings.slice(0, 4);

  const today = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          Доброе утро, {user?.name.split(' ')[0]}
        </h2>
        <p className="text-sm text-gray-500">{today} · {activeMembership?.displayName ?? 'Кабинет партнера'}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Активные бронирования"
          value={stats.activeBookings}
          icon={<ShoppingBag size={18} className="text-blue-500" />}
          color="blue"
          onClick={() => onNavigate('/fulfillment')}
        />
        <StatCard
          label="Ожидают выдачи"
          value={stats.pendingHandovers}
          icon={<Clock size={18} className="text-amber-500" />}
          color="amber"
          alert={stats.pendingHandovers > 0}
          onClick={() => onNavigate('/fulfillment')}
        />
        <StatCard
          label="Ожидают возврата"
          value={stats.pendingReturns}
          icon={<RotateCcw size={18} className="text-teal-500" />}
          color="teal"
          onClick={() => onNavigate('/fulfillment')}
        />
        <StatCard
          label="Выручка за месяц"
          value={`${stats.totalRevenueMTD.toLocaleString()} ${stats.currency}`}
          icon={<TrendingUp size={18} className="text-green-500" />}
          color="green"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card padding={false}>
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Очередь выдачи</h3>
              <p className="text-xs text-gray-500 mt-0.5">Действия на сегодня</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => onNavigate('/fulfillment')}>
              Все <ArrowRight size={12} />
            </Button>
          </div>
          <div>
            {pendingHandovers.length === 0 && pendingReturns.length === 0 ? (
              <div className="py-8 text-center">
                <CheckSquare size={24} className="mx-auto text-gray-300 mb-2" />
                <p className="text-xs text-gray-500">Нет ожидающих действий</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {[...pendingHandovers, ...pendingReturns].map(item => (
                  <div
                    key={item.bookingId}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => onNavigate('/fulfillment')}
                  >
                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                      item.status === 'pending_handover' ? 'bg-amber-400' : 'bg-teal-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">{item.customer.name}</p>
                      <p className="text-[11px] text-gray-500 truncate">{item.selection.offerTitle}</p>
                    </div>
                    <Badge variant={item.status === 'pending_handover' ? 'yellow' : 'teal'}>
                      {item.status === 'pending_handover' ? 'Выдача' : 'Возврат'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card padding={false}>
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Последние бронирования</h3>
              <p className="text-xs text-gray-500 mt-0.5">Недавняя активность</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => onNavigate('/fulfillment')}>
              Все <ArrowRight size={12} />
            </Button>
          </div>
          <div className="divide-y divide-gray-50">
            {recentBookings.map(b => (
              <div
                key={b.id}
                className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => onNavigate('/fulfillment')}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-mono text-gray-600">{b.ref}</p>
                    <BookingStatusBadge status={b.status} />
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{b.customer.name} · {b.selection.offerTitle}</p>
                </div>
                <p className="text-xs font-medium text-gray-900 shrink-0">
                  {b.totalAmount.toLocaleString()} {b.currency}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Готовность каталога</h3>
            <Package size={16} className="text-gray-400" />
          </div>
          <div className="flex items-end gap-2 mb-2">
            <span className="text-2xl font-bold text-gray-900">{stats.catalogReadiness}%</span>
            <span className="text-xs text-gray-500 mb-0.5">готово</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2 mb-3">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all"
              style={{ width: `${stats.catalogReadiness}%` }}
            />
          </div>
          <Button size="sm" variant="ghost" className="w-full justify-center" onClick={() => onNavigate('/resources')}>
            Управлять инвентарем
          </Button>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Открытые обращения</h3>
            <AlertTriangle size={16} className={stats.openIssues > 0 ? 'text-amber-400' : 'text-gray-400'} />
          </div>
          <div className="flex items-end gap-2 mb-3">
            <span className={`text-2xl font-bold ${stats.openIssues > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
              {stats.openIssues}
            </span>
            <span className="text-xs text-gray-500 mb-0.5">открыто</span>
          </div>
          {stats.openIssues > 0 ? (
            <div className="text-xs text-amber-700 bg-amber-50 rounded-md px-3 py-2 mb-3">
              Обращение по бронированию SGH-20240416-003
            </div>
          ) : (
            <p className="text-xs text-gray-500 mb-3">Все спокойно — открытых обращений нет</p>
          )}
          <Button size="sm" variant="ghost" className="w-full justify-center" onClick={() => onNavigate('/fulfillment')}>
            К выдаче
          </Button>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Быстрый переход</h3>
          </div>
          <div className="space-y-1">
            {[
              { label: 'Инвентарь', path: '/resources' },
              { label: 'Предложения и цены', path: '/resources' },
            ].map(link => (
              <button
                key={link.path}
                onClick={() => onNavigate(link.path)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
              >
                <span>{link.label}</span>
                <ArrowRight size={12} className="text-gray-400" />
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
  alert,
  onClick,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  alert?: boolean;
  onClick?: () => void;
}) {
  return (
    <Card className={`cursor-pointer hover:shadow-md transition-shadow ${onClick ? '' : ''}`} padding>
      <div className="flex items-start justify-between mb-2" onClick={onClick}>
        <div className={`p-2 rounded-lg bg-${color}-50`}>{icon}</div>
        {alert && <div className="w-2 h-2 rounded-full bg-amber-400 mt-1" />}
      </div>
      <p className="text-xl font-bold text-gray-900 leading-none">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </Card>
  );
}

function BookingStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: 'green' | 'yellow' | 'red' | 'blue' | 'gray' }> = {
    confirmed: { label: 'Подтверждено', variant: 'green' },
    pending: { label: 'Ожидает', variant: 'yellow' },
    cancelled: { label: 'Отменено', variant: 'red' },
    completed: { label: 'Завершено', variant: 'blue' },
    no_show: { label: 'Неявка', variant: 'gray' },
  };
  const s = map[status] || { label: status, variant: 'gray' as const };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}
