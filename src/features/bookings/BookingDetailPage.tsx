import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ImageOff, Mail, Phone } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { CopyValue } from '../../components/ui/CopyValue';
import { DetailList, DetailRow } from '../../components/ui/DetailList';
import { SkeletonDetail } from '../../components/ui/Skeleton';
import { SectionPage } from '../../components/layout/SectionPage';
import { SettingsCard } from '../../components/layout/SettingsCard';
import { ApiError, bookingsApi, mediaUrl } from '../../lib/api-client';
import type { BookingDetail } from '../../types';
import { bookingStatusMeta, fulfillmentStageMeta, formatWindow } from './bookingMeta';
import { HandoverForm } from './HandoverForm';
import { ReturnForm } from './ReturnForm';
import { CompleteForm } from './CompleteForm';
import { IssueReportForm } from './IssueReportForm';
import { DeclineForm } from './DeclineForm';

type Action = 'handover' | 'return' | 'complete' | 'issue' | 'decline';

/**
 * One booking, in full.
 *
 * The list row carries what identifies a booking; this carries what you need once you have decided
 * to deal with it — the customer's e-mail, which the list deliberately omits, where the handover
 * happens, and the support reference to quote if something has gone wrong.
 */
export function BookingDetailPage({ bookingId, onNavigate }: { bookingId: string; onNavigate: (path: string) => void }) {
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<Action | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setBooking(await bookingsApi.get(bookingId));
    } catch (err) {
      setError(err instanceof ApiError
        ? err.status === 404 ? 'Бронирование не найдено.' : err.message
        : 'Не удалось загрузить бронирование.');
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => { void load(); }, [load]);

  const say = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 4000);
  };

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      await bookingsApi.confirm(bookingId);
      say('Заявка подтверждена — ждём оплату от клиента.');
      void load();
    } catch (err) {
      setError(err instanceof ApiError
        ? err.code === 'booking.not_awaiting_confirmation' ? 'Заявку уже обработали. Обновите страницу.' : err.message
        : 'Не удалось подтвердить заявку.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <SectionPage title="Бронирование" breadcrumb={{ label: 'Заказы', path: '/bookings' }} onNavigate={onNavigate}>
        <SkeletonDetail rows={6} />
      </SectionPage>
    );
  }

  if (!booking) {
    return (
      <SectionPage title="Бронирование" breadcrumb={{ label: 'Заказы', path: '/bookings' }} onNavigate={onNavigate} error={error}>
        <Button variant="secondary" onClick={() => onNavigate('/bookings')}>К заказам</Button>
      </SectionPage>
    );
  }

  const status = bookingStatusMeta(booking.status);
  const stage = fulfillmentStageMeta(booking.fulfillment?.status);
  const awaiting = booking.status === 'awaiting_seller_confirmation';
  const done = (message: string) => () => { setAction(null); say(message); void load(); };

  return (
    <SectionPage
      title={`Бронирование №${booking.bookingNumber}`}
      breadcrumb={{ label: 'Заказы', path: '/bookings' }}
      onNavigate={onNavigate}
      error={error}
      action={
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={status.variant} size="md">{status.label}</Badge>
          {stage && <Badge variant={stage.variant} size="md">{stage.label}</Badge>}
        </div>
      }
    >
      {notice && (
        <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">{notice}</p>
      )}

      {action && (
        <div className="mb-4 max-w-2xl">
          {action === 'handover' && <HandoverForm bookingId={bookingId} onSuccess={done('Выдача записана.')} onCancel={() => setAction(null)} />}
          {action === 'return' && <ReturnForm bookingId={bookingId} onSuccess={done('Возврат записан.')} onCancel={() => setAction(null)} />}
          {action === 'complete' && <CompleteForm bookingId={bookingId} onSuccess={done('Бронирование завершено.')} onCancel={() => setAction(null)} />}
          {action === 'issue' && <IssueReportForm bookingId={bookingId} onSuccess={done('Обращение отправлено.')} onCancel={() => setAction(null)} />}
          {action === 'decline' && <DeclineForm bookingId={bookingId} onSuccess={done('Заявка отклонена.')} onCancel={() => setAction(null)} />}
        </div>
      )}

      {!action && (
        <div className="mb-4 flex flex-wrap gap-2">
          {awaiting && (
            <>
              <Button variant="primary" loading={busy} onClick={() => void confirm()}>Подтвердить заявку</Button>
              <Button variant="secondary" disabled={busy} onClick={() => setAction('decline')}>Отклонить</Button>
            </>
          )}
          {booking.fulfillment?.completionAllowed && (
            <Button variant="primary" onClick={() => setAction('complete')}>Завершить</Button>
          )}
          {!awaiting && (
            <>
              <Button variant="secondary" onClick={() => setAction('handover')}>Записать выдачу</Button>
              <Button variant="secondary" onClick={() => setAction('return')}>Записать возврат</Button>
            </>
          )}
          {booking.fulfillment?.issueReportingAllowed && (
            <Button variant="ghost" onClick={() => setAction('issue')}>
              <AlertCircle size={14} /> Сообщить о проблеме
            </Button>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="space-y-4">
          <SettingsCard title="Товар" description="Что забронировали.">
            <div className="flex gap-3">
              {booking.product.mediaPreviewUrl ? (
                <img
                  src={mediaUrl(booking.product.mediaPreviewUrl)}
                  alt=""
                  className="h-16 w-16 shrink-0 rounded-lg border border-gray-200 object-cover"
                />
              ) : (
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-300">
                  <ImageOff size={18} />
                </span>
              )}
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => onNavigate(`/products/${booking.product.productId}`)}
                  className="text-left text-sm font-medium text-gray-900 hover:text-blue-700 hover:underline"
                >
                  {booking.product.title}
                </button>
                {booking.product.categoryTitle && (
                  <p className="mt-0.5 text-xs text-gray-500">{booking.product.categoryTitle}</p>
                )}
              </div>
            </div>
          </SettingsCard>

          <SettingsCard title="Аренда" description="Сроки и количество.">
            <DetailList>
              <DetailRow label="Период" value={formatWindow(booking.schedule?.startAt, booking.schedule?.endAt)} />
              <DetailRow label="Количество" value={booking.schedule ? `${booking.schedule.quantity} шт` : null} />
              <DetailRow label="Где выдаётся" value={booking.product.fulfillmentLocationName}>
                {booking.product.fulfillmentLocationName && (
                  <>
                    <span className="block text-gray-900">{booking.product.fulfillmentLocationName}</span>
                    {booking.product.fulfillmentLocationAddress && (
                      <CopyValue
                        value={booking.product.fulfillmentLocationAddress}
                        label="Адрес"
                        className="mt-0.5 text-xs"
                      />
                    )}
                  </>
                )}
              </DetailRow>
              {booking.statusReason && <DetailRow label="Причина" value={booking.statusReason} />}
            </DetailList>
          </SettingsCard>

          {booking.fulfillment?.notes && (
            <SettingsCard title="Заметки по выдаче" description="Что записали при выдаче или возврате.">
              <p className="whitespace-pre-line text-sm text-gray-800">{booking.fulfillment.notes}</p>
            </SettingsCard>
          )}
        </div>

        <div className="space-y-4">
          <SettingsCard title="Клиент" description="Кому выдаём.">
            <DetailList>
              <DetailRow label="Имя" value={booking.customer?.fullName} />
              <DetailRow label="Телефон">
                {booking.customer?.phone
                  ? <CopyValue value={booking.customer.phone} label="Телефон клиента" icon={<Phone size={12} />} />
                  : <span className="text-gray-400">Не указан</span>}
              </DetailRow>
              <DetailRow label="Почта">
                {booking.customer?.email
                  ? <CopyValue value={booking.customer.email} label="Почта клиента" icon={<Mail size={12} />} />
                  : <span className="text-gray-400">Не указана</span>}
              </DetailRow>
            </DetailList>
          </SettingsCard>

          {booking.support?.correlationRef && (
            <SettingsCard title="Поддержка" description="Назовите этот номер, если пишете нам о брони.">
              <CopyValue value={booking.support.correlationRef} label="Номер обращения" className="text-xs" />
            </SettingsCard>
          )}
        </div>
      </div>
    </SectionPage>
  );
}
