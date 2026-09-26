import { useEffect, useState } from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, Circle, Clock, Package, Send, ShoppingBag } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../context/useAuth';
import { ApiError, dashboardApi, providerApi } from '../../lib/api-client';
import type { DashboardResponse, ProviderReadiness, ProviderReadinessItem } from '../../types';
import { useProvider } from '../providers/ProviderContext';
import { statusMeta } from '../providers/providerStatus';

interface DashboardPageProps {
  onNavigate: (path: string) => void;
}

// The setup guide: every line is a page the seller can revisit, and the list is computed from what
// is saved, never from "steps completed".
const checklistMeta: Record<string, { title: string; path: string; hints: Record<string, string> }> = {
  profile: {
    title: 'Профиль',
    path: '/settings/shop',
    hints: { description: 'добавьте описание', email: 'подтвердите почту — акты и отчёты уходят на неё' },
  },
  seller_profile: { title: 'Продавец', path: '/settings/seller', hints: {} },
  payout: {
    title: 'Выплаты',
    path: '/settings/payouts',
    hints: { sbp: 'номер телефона для СБП', bank_account: 'расчётный счёт и БИК' },
  },
};

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const { user, reloadSession } = useAuth();
  const provider = useProvider();
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    try {
      setDashboard(await dashboardApi.get());
      setError('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить дашборд.');
    }
  };

  useEffect(() => {
    void load();
  }, [provider.providerId]);

  const submit = async () => {
    setSubmitting(true);
    setError('');
    try {
      await providerApi.submitForReview();
      await Promise.all([load(), reloadSession()]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось отправить на проверку.');
    } finally {
      setSubmitting(false);
    }
  };

  const readiness = dashboard?.readiness ?? null;
  const today = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Добрый день, {user?.name.split(' ')[0]}</h2>
        <p className="text-sm text-gray-500">{today} · {provider.displayName}</p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {readiness && !readiness.isPublic && (
        <SetupGuide readiness={readiness} onNavigate={onNavigate} onSubmit={submit} submitting={submitting} />
      )}

      {readiness?.isPublic && readiness.items.some(item => item.status !== 'ready') && (
        <Card className="border-amber-200 bg-amber-50">
          <p className="text-sm font-medium text-amber-900">Кабинет в каталоге, но не всё настроено</p>
          <ul className="mt-2 space-y-1 text-xs text-amber-900">
            {readiness.items.filter(item => item.status !== 'ready').map(item => (
              <li key={item.key}>
                <button type="button" className="font-medium underline-offset-2 hover:underline" onClick={() => onNavigate(checklistMeta[item.key]?.path ?? '/')}>
                  {checklistMeta[item.key]?.title ?? item.key}
                </button>
                {' — '}{itemHint(item)}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Позиции в каталоге" value={dashboard?.counts.activeResources ?? 0} total={dashboard?.counts.totalResources} icon={<Package size={18} className="text-blue-500" />} onClick={() => onNavigate('/resources')} />
        <StatCard label="Активные предложения" value={dashboard?.counts.activeOffers ?? 0} total={dashboard?.counts.totalOffers} icon={<ShoppingBag size={18} className="text-teal-500" />} onClick={() => onNavigate('/offers')} />
        <StatCard label="Предстоящие бронирования" value={dashboard?.counts.upcomingBookings ?? 0} icon={<Clock size={18} className="text-amber-500" />} onClick={() => onNavigate('/fulfillment')} />
        <StatCard label="Всего бронирований" value={dashboard?.counts.totalBookings ?? 0} icon={<CheckCircle2 size={18} className="text-green-500" />} />
      </div>
    </div>
  );
}

function SetupGuide({
  readiness,
  onNavigate,
  onSubmit,
  submitting,
}: {
  readiness: ProviderReadiness;
  onNavigate: (path: string) => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const meta = statusMeta(readiness.status);
  const review = readiness.latestReview;
  const canSubmitFrom = readiness.status === 'draft' || readiness.status === 'changes_requested';
  return (
    <Card padding={false}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-5 pb-3 pt-4">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            Настройка кабинета <Badge variant={meta.variant}>{meta.label}</Badge>
          </h3>
          <p className="mt-0.5 text-xs text-gray-500">{meta.hint}</p>
        </div>
        {canSubmitFrom && (
          <Button type="button" variant="primary" size="sm" disabled={!readiness.canSubmit} loading={submitting} onClick={onSubmit}>
            <Send size={13} /> {readiness.status === 'changes_requested' ? 'Отправить снова' : 'Отправить на проверку'}
          </Button>
        )}
      </div>
      {review?.message && (readiness.status === 'changes_requested' || readiness.status === 'rejected') && (
        <div className="mx-5 mt-4 rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-900">
          <p className="font-semibold">Комментарий проверяющего</p>
          <p className="mt-0.5 whitespace-pre-line">{review.message}</p>
        </div>
      )}
      <ul className="divide-y divide-gray-100">
        {readiness.items.map(item => (
          <ChecklistRow key={item.key} item={item} onNavigate={onNavigate} />
        ))}
        <ChecklistRow item={{ key: 'locations', status: 'optional', hint: null }} onNavigate={onNavigate} title="Пункт проката" path="/settings/locations" note="адрес, где вы выдаёте снаряжение — нужен предложениям, но не проверке" />
        <ChecklistRow item={{ key: 'offers', status: 'optional', hint: null }} onNavigate={onNavigate} title="Первое предложение" path="/resources" note="можно создать до проверки — станет видно после" />
      </ul>
    </Card>
  );
}

function ChecklistRow({
  item,
  onNavigate,
  title,
  path,
  note,
}: {
  item: ProviderReadinessItem;
  onNavigate: (path: string) => void;
  title?: string;
  path?: string;
  note?: string;
}) {
  const meta = checklistMeta[item.key];
  const ready = item.status === 'ready';
  const optional = item.status === 'optional';
  // The profile line can be complaining about two different pages. A missing description belongs
  // to the shop profile; an unverified e-mail is attached from the account, and sending the seller
  // to the shop profile to look for an e-mail field they will not find is worse than not linking.
  const target = path
    ?? (item.key === 'profile' && item.hint?.includes('email') ? '/settings/account' : undefined)
    ?? meta?.path
    ?? '/';
  return (
    <li>
      <button
        type="button"
        onClick={() => onNavigate(target)}
        className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-gray-50"
      >
        {ready ? (
          <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
        ) : (
          <Circle size={18} className={`shrink-0 ${optional ? 'text-gray-300' : 'text-amber-500'}`} />
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-gray-900">{title ?? meta?.title ?? item.key}</span>
          <span className="block text-xs text-gray-500">{note ?? (ready ? 'готово' : itemHint(item))}</span>
        </span>
        <ArrowRight size={14} className="shrink-0 text-gray-400" />
      </button>
    </li>
  );
}

function itemHint(item: ProviderReadinessItem) {
  const meta = checklistMeta[item.key];
  if (item.status === 'awaiting_registration') return 'реквизиты сохранены, ждём подключения банка';
  if (!item.hint) return 'не заполнено';
  return item.hint.split(',').map(part => meta?.hints[part.trim()] ?? part.trim()).join(', ');
}

function StatCard({
  label,
  value,
  total,
  icon,
  onClick,
}: {
  label: string;
  value: number;
  total?: number;
  icon: React.ReactNode;
  onClick?: () => void;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">{label}</span>
        {icon}
      </div>
      <p className="mt-2 text-2xl font-semibold text-gray-900">
        {value}
        {total !== undefined && total !== value && <span className="ml-1 text-sm font-normal text-gray-400">из {total}</span>}
      </p>
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="rounded-lg border bg-card p-4 text-left shadow-sm transition hover:border-blue-200">
      {body}
    </button>
  ) : (
    <Card>{body}</Card>
  );
}
