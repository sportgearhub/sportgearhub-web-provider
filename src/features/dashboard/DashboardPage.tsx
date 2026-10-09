import { useEffect, useState } from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, Circle, Clock, Package, Send, ShoppingBag } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import { useAuth } from '../../context/useAuth';
import { ApiError, bookingsApi, dashboardApi, providerApi } from '../../lib/api-client';
import type { DashboardResponse, ProviderReadiness, ProviderReadinessItem } from '../../types';
import { useProvider } from '../providers/ProviderContext';
import { CabinetHeader } from '../../components/layout/CabinetHeader';
import { RatingsSection } from '../ratings/Ratings';
import { dayBounds } from '../bookings/bookingMeta';
import { statusMeta } from '../providers/providerStatus';
import { useWorkspace } from '../workspace/workspace';
import { homeShortcuts } from '../menu/menuGroups';

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
  const { reloadSession } = useAuth();
  const provider = useProvider();
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [today, setToday] = useState<{ handover: number; ret: number; awaiting: number } | null>(null);
  const { workspace } = useWorkspace();

  const load = async () => {
    try {
      setDashboard(await dashboardApi.get());
      setError('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить дашборд.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [provider.providerId]);

  // What the counter actually needs to know before anything else: what is going out today, what is
  // coming back, and who is waiting on an answer. The list endpoint counts without fetching rows.
  useEffect(() => {
    let cancelled = false;
    const { from, to } = dayBounds();
    const count = (filter: string) =>
      bookingsApi.list({ filter, pageSize: 1 }).then(result => result.pagination?.totalItems ?? 0).catch(() => 0);

    void Promise.all([
      count(`status==confirmed;start_at=ge=${from};start_at=lt=${to}`),
      count(`end_at=ge=${from};end_at=lt=${to}`),
      count('status==awaiting_seller_confirmation'),
    ]).then(([handover, ret, awaiting]) => {
      if (!cancelled) setToday({ handover, ret, awaiting });
    });
    return () => { cancelled = true; };
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
  const todayLabel = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="space-y-4 px-3 pb-6 pt-3 lg:space-y-6 lg:p-6">
      <CabinetHeader onNavigate={onNavigate} workspaceToggle className="-mx-3 -mt-3" />

      {/* The scanner left the navigation bar: it is one job, done at a counter, not one of the
          four places this console is. It lives here, first, because the screen a seller lands on
          is the one they open with a customer in front of them. Joined to the block above, the
          way the catalogue's shortcuts are. */}
      <div className="-mx-3 -mt-4 rounded-b-2xl bg-white pb-3 pt-4 lg:hidden">
        <div className="flex gap-2 overflow-x-auto px-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {homeShortcuts[workspace].map(item => (
            <button
              key={item.path}
              type="button"
              onClick={() => onNavigate(item.path)}
              className="flex h-[5.5rem] w-[5.5rem] shrink-0 flex-col items-center justify-center gap-2 rounded-2xl bg-gray-50 px-2 text-center transition active:bg-gray-100"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <item.icon size={22} />
              </span>
              <span className="text-[11px] font-medium leading-tight text-gray-800">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      <p className="hidden text-sm text-gray-500 lg:block">{todayLabel}</p>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
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

      {/* Before the catalogue's numbers, the day's. A seller opening the console at nine in the
          morning is asking «что сегодня», not «сколько у меня карточек». */}
      <section>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-semibold text-gray-900">Сегодня</h3>
          <button type="button" onClick={() => onNavigate('/scan')} className="text-sm font-medium text-blue-700 hover:underline">
            Сканировать QR
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <TodayTile label="Выдать" value={today?.handover} onClick={() => onNavigate('/bookings')} />
          <TodayTile label="Принять" value={today?.ret} onClick={() => onNavigate('/bookings')} />
          <TodayTile label="Заявки" value={today?.awaiting} tone={today?.awaiting ? 'warn' : 'plain'} onClick={() => onNavigate('/bookings')} />
        </div>
      </section>

      <RatingsSection onNavigate={onNavigate} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard loading={loading} label="Товары в каталоге" value={dashboard?.counts?.activeProducts} total={dashboard?.counts?.totalProducts} icon={<Package size={18} className="text-blue-500" />} onClick={() => onNavigate('/products')} />
        <StatCard loading={loading} label="Черновики" value={dashboard?.counts?.draftProducts} icon={<ShoppingBag size={18} className="text-teal-500" />} onClick={() => onNavigate('/products')} />
        <StatCard loading={loading} label="Предстоящие бронирования" value={dashboard?.counts?.upcomingBookings} icon={<Clock size={18} className="text-amber-500" />} onClick={() => onNavigate('/bookings')} />
        <StatCard loading={loading} label="Всего бронирований" value={dashboard?.counts?.totalBookings} icon={<CheckCircle2 size={18} className="text-green-500" />} onClick={() => onNavigate('/bookings')} />
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
        <div className="mx-5 mt-4 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-900">
          <p className="font-semibold">Комментарий проверяющего</p>
          <p className="mt-0.5 whitespace-pre-line">{review.message}</p>
        </div>
      )}
      <ul className="divide-y divide-gray-100">
        {readiness.items.map(item => (
          <ChecklistRow key={item.key} item={item} onNavigate={onNavigate} />
        ))}
        <ChecklistRow item={{ key: 'locations', status: 'optional', hint: null }} onNavigate={onNavigate} title="Пункт проката" path="/settings/locations" note="адрес, где вы выдаёте снаряжение — нужен товарам, но не проверке" />
        <ChecklistRow item={{ key: 'products', status: 'optional', hint: null }} onNavigate={onNavigate} title="Первый товар" path="/products" note="можно добавить до проверки — станет видно после" />
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

/** One number from the day, big enough to read at arm's length across a counter. */
function TodayTile({
  label,
  value,
  onClick,
  tone = 'plain',
}: {
  label: string;
  value?: number;
  onClick: () => void;
  tone?: 'plain' | 'warn';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-3 text-left transition ${
        tone === 'warn' ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-white hover:border-blue-200'
      }`}
    >
      <span className="block text-xs text-gray-500">{label}</span>
      {value === undefined
        ? <Skeleton className="mt-1.5 h-6 w-8" />
        : <span className={`mt-1 block text-2xl font-semibold ${tone === 'warn' ? 'text-amber-900' : 'text-gray-900'}`}>{value}</span>}
    </button>
  );
}

function StatCard({
  label,
  value,
  total,
  icon,
  onClick,
  loading,
}: {
  label: string;
  value?: number;
  total?: number;
  icon: React.ReactNode;
  onClick?: () => void;
  loading?: boolean;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">{label}</span>
        {icon}
      </div>
      {/* A zero while loading is not a placeholder, it is a wrong number that looks like a right
          one — and it reads the same as a seller who genuinely has none. */}
      {loading || value === undefined ? (
        <Skeleton className="mt-3 h-6 w-12" />
      ) : (
        <p className="mt-2 text-2xl font-semibold text-gray-900">
          {value}
          {total !== undefined && total !== value && <span className="ml-1 text-sm font-normal text-gray-400">из {total}</span>}
        </p>
      )}
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
