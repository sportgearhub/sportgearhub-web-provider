import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ImageOff, Mail, MoreHorizontal, Package, Phone, XCircle, type LucideIcon } from 'lucide-react';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { SubPageHeader } from '../../components/layout/SubPageHeader';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { CopyValue } from '../../components/ui/CopyValue';
import { DetailList, DetailRow } from '../../components/ui/DetailList';
import { SkeletonDetail } from '../../components/ui/Skeleton';
import { SectionPage } from '../../components/layout/SectionPage';
import { SettingsCard } from '../../components/layout/SettingsCard';
import { ApiError, bookingsApi, mediaUrl } from '../../lib/api-client';
import { useGoBack } from '../../lib/useGoBack';
import type { BookingDetail, FulfillmentDetail } from '../../types';
import { bookingStatusMeta, fulfillmentStageMeta, formatWindow } from './bookingMeta';
import { BookingProductPanel } from './BookingProductPanel';
import { HandoverForm } from './HandoverForm';
import { ReturnForm } from './ReturnForm';
import { IssueReportForm } from './IssueReportForm';
import { DeclineForm } from './DeclineForm';

type Action = 'handover' | 'return' | 'issue' | 'decline';

const ACTION_TITLES: Record<Action, string> = {
  handover: 'Выдача',
  return: 'Возврат',
  issue: 'Сообщить о проблеме',
  decline: 'Отклонить заявку',
};

/**
 * One booking, in full.
 *
 * The list row carries what identifies a booking; this carries what you need once you have decided
 * to deal with it — the customer's e-mail, which the list deliberately omits, where the handover
 * happens, and the support reference to quote if something has gone wrong.
 */
export function BookingDetailPage({ bookingId, onNavigate }: { bookingId: string; onNavigate: (path: string) => void }) {
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [fulfillment, setFulfillment] = useState<FulfillmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<Action | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const goBack = useGoBack('/bookings');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [next, state] = await Promise.all([
        bookingsApi.get(bookingId),
        // No row yet simply means nothing has been handed over — not an error.
        bookingsApi.getFulfillment(bookingId).catch(() => null),
      ]);
      setBooking(next);
      setFulfillment(state);
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
      <>
        <SubPageHeader title="Бронирование" onBack={goBack} />
        <SectionPage title="Бронирование" breadcrumb={{ label: 'Заказы', path: '/bookings' }} onNavigate={onNavigate}>
          <SkeletonDetail rows={6} />
        </SectionPage>
      </>
    );
  }

  if (!booking) {
    return (
      <>
        <SubPageHeader title="Бронирование" onBack={goBack} />
        <SectionPage title="Бронирование" breadcrumb={{ label: 'Заказы', path: '/bookings' }} onNavigate={onNavigate} error={error}>
          <Button variant="secondary" onClick={() => onNavigate('/bookings')}>К заказам</Button>
        </SectionPage>
      </>
    );
  }

  const status = bookingStatusMeta(booking.status);
  const stage = fulfillmentStageMeta(booking.fulfillment?.status);
  const awaiting = booking.status === 'awaiting_seller_confirmation';
  const done = (message: string) => () => { setAction(null); say(message); void load(); };

  const canDecline = awaiting;
  const canIssue = Boolean(booking.fulfillment?.issueReportingAllowed);

  /**
   * The one move the booking is waiting for, in the order it is waited for. The API's own flags
   * decide which are open — the same rules the command endpoints enforce — so this picks from
   * its answer rather than deriving one from the status.
   */
  const primary: { label: string; run: () => void } | null = awaiting
    ? { label: 'Подтвердить заявку', run: () => void confirm() }
    : fulfillment?.handover?.handoverAllowed
      ? { label: 'Записать выдачу', run: () => setAction('handover') }
      : fulfillment?.return?.returnAllowed
        ? { label: 'Принять возврат', run: () => setAction('return') }
        : null;

  return (
    <>
      {/* The same bar as everywhere one level in: a way back, the number, and what can be done
          to this booking in the corner. */}
      <SubPageHeader
        title={`№${booking.bookingNumber}`}
        onBack={goBack}
        action={
          (canDecline || canIssue) ? (
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Действия с бронированием"
              className="rounded-lg p-2 text-gray-600 transition active:bg-gray-100"
            >
              <MoreHorizontal size={20} strokeWidth={2.5} />
            </button>
          ) : undefined
        }
      />

    <SectionPage
      title={`Бронирование №${booking.bookingNumber}`}
      breadcrumb={{ label: 'Заказы', path: '/bookings' }}
      onNavigate={onNavigate}
      error={error}
      bare
      action={
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={status.variant} size="md">{status.label}</Badge>
          {stage && <Badge variant={stage.variant} size="md">{stage.label}</Badge>}
        </div>
      }
    >
      {notice && (
        <p className="mx-3 mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800 sm:mx-0">
          {notice}
        </p>
      )}

      {/* What was booked, at the top of its own page: the photo, the name in full, the state, the
          window and who is coming for it. The bar above has room for the number alone. */}
      <section className="mb-2 bg-white p-4 sm:hidden">
        <div className="flex gap-3">
          {booking.product.mediaPreviewUrl ? (
            <img
              src={mediaUrl(booking.product.mediaPreviewUrl)}
              alt=""
              className="h-20 w-20 shrink-0 rounded-xl border border-gray-200 object-cover"
            />
          ) : (
            <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-gray-300">
              <ImageOff size={22} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-1">
              <Badge variant={status.variant} size="xs" tone="strong" shape="square">{status.label}</Badge>
              {stage && <Badge variant={stage.variant} size="xs" tone="strong" shape="square">{stage.label}</Badge>}
            </span>
            <h1 className="mt-1.5 text-base font-semibold leading-5 text-gray-950">{booking.product.title}</h1>
            <p className="mt-1 text-xs font-medium text-gray-900">
              {formatWindow(booking.schedule?.startAt, booking.schedule?.endAt) ?? '—'}
            </p>
            <p className="mt-0.5 truncate text-xs text-gray-500">
              {booking.customer?.fullName ?? 'Клиент'}
              {(booking.schedule?.quantity ?? 1) > 1 ? ` · ${booking.schedule?.quantity} шт` : ''}
            </p>
          </div>
        </div>
      </section>

      {/* The moves that are open, on a desktop where there is a row to put them in. On a phone
          the first of them is a bar at the bottom and the rest are behind the dots. */}
      <div className="mb-4 hidden flex-wrap gap-2 sm:flex">
          {awaiting && (
            <>
              <Button variant="primary" loading={busy} onClick={() => void confirm()}>Подтвердить заявку</Button>
              <Button variant="secondary" disabled={busy} onClick={() => setAction('decline')}>
                Отклонить
              </Button>
            </>
          )}
          {/* The API decides which moves are open — the same rules the commands enforce. */}
          {fulfillment?.handover?.handoverAllowed && (
            <Button variant="primary" onClick={() => setAction('handover')}>Записать выдачу</Button>
          )}
          {fulfillment?.return?.returnAllowed && (
            <Button variant="primary" onClick={() => setAction('return')}>Принять возврат</Button>
          )}
          {canIssue && (
            <Button variant="ghost" onClick={() => setAction('issue')} className="hidden lg:inline-flex">
              <AlertCircle size={14} /> Сообщить о проблеме
            </Button>
          )}
      </div>

      <div className="max-w-3xl space-y-2 sm:space-y-4">
        <SettingsCard title="Товар" description="Что забронировали.">
          <div className="flex gap-3">
            {/* The hero above already showed it; on a phone this card is the detail, not the
                picture again. */}
            {booking.product.mediaPreviewUrl ? (
              <img
                src={mediaUrl(booking.product.mediaPreviewUrl)}
                alt=""
                className="hidden h-16 w-16 shrink-0 rounded-lg border border-gray-200 object-cover sm:block"
              />
            ) : (
              <span className="hidden h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-300 sm:flex">
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

            {/* The booking says which card; the card says what is in the kit and what deposit to
                take. Those are the questions asked across a counter, so they are fetched here
                rather than left on another screen. */}
            <div className="mt-4 border-t border-gray-100 pt-4">
              <BookingProductPanel
                productId={booking.product.productId}
                open
                onOpenProduct={() => onNavigate(`/products/${booking.product.productId}`)}
              />
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
                        label="адрес"
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

          <SettingsCard title="Клиент" description="Кому выдаём.">
            <DetailList>
              <DetailRow label="Имя" value={booking.customer?.fullName} />
              <DetailRow label="Телефон">
                {booking.customer?.phone
                  ? <CopyValue value={booking.customer.phone} label="телефон клиента" icon={<Phone size={12} />} />
                  : <span className="text-gray-400">Не указан</span>}
              </DetailRow>
              <DetailRow label="Почта">
                {booking.customer?.email
                  ? <CopyValue value={booking.customer.email} label="почту клиента" icon={<Mail size={12} />} />
                  : <span className="text-gray-400">Не указана</span>}
              </DetailRow>
            </DetailList>
          </SettingsCard>

          {booking.receipts?.length > 0 && (
          <SettingsCard title="Чеки" description="Фискальные чеки по этой брони.">
            <DetailList>
              {booking.receipts.map(receipt => (
                <DetailRow key={receipt.receiptId} label={receipt.operation === 'refund' ? 'Возврат' : 'Оплата'}>
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-medium text-gray-900">{receipt.total} ₽</span>
                    <Badge variant={receipt.status === 'completed' ? 'green' : 'gray'}>{receipt.status}</Badge>
                    {receipt.ofdReceiptUrl && (
                      <a
                        href={receipt.ofdReceiptUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium text-blue-700 hover:underline"
                      >
                        Открыть чек
                      </a>
                    )}
                  </span>
                </DetailRow>
              ))}
            </DetailList>
          </SettingsCard>
        )}

        {booking.support?.correlationRef && (
            <SettingsCard title="Поддержка" description="Назовите этот номер, если пишете нам о брони.">
              <CopyValue value={booking.support.correlationRef} label="номер обращения" className="text-xs" />
            </SettingsCard>
          )}
        {/* Room at the end for the bar below. */}
        <div className={primary ? 'h-16 sm:hidden' : 'hidden'} />
      </div>
    </SectionPage>

    {/* The one move this booking is waiting for, where a thumb is. The rest — decline, report a
        problem — are behind the dots in the bar above. */}
    {primary && (
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden">
        <Button
          variant="primary"
          loading={busy}
          onClick={primary.run}
          className="h-11 w-full justify-center"
        >
          {primary.label}
        </Button>
      </div>
    )}

    {/* Handover, return, decline and issue: the command's own fields in a sheet, which is a
        centred dialog on a desktop. They used to replace the page above them, so the booking you
        were reading disappeared the moment you acted on it. */}
    <BottomSheet
      open={action !== null}
      onClose={() => setAction(null)}
      title={action ? ACTION_TITLES[action] : ''}
      center
    >
      {action === 'handover' && (
        <HandoverForm bookingId={bookingId} onSuccess={done('Выдача записана.')} onCancel={() => setAction(null)} />
      )}
      {action === 'return' && (
        <ReturnForm bookingId={bookingId} onSuccess={done('Возврат принят — аренда завершена.')} onCancel={() => setAction(null)} />
      )}
      {action === 'issue' && (
        <IssueReportForm bookingId={bookingId} onSuccess={done('Обращение отправлено.')} onCancel={() => setAction(null)} />
      )}
      {action === 'decline' && (
        <DeclineForm bookingId={bookingId} onSuccess={done('Заявка отклонена.')} onCancel={() => setAction(null)} />
      )}
    </BottomSheet>

    <BottomSheet
      open={menuOpen}
      onClose={() => setMenuOpen(false)}
      title={`№${booking.bookingNumber}`}
      center
      footer={
        <Button variant="secondary" className="w-full justify-center" onClick={() => setMenuOpen(false)}>
          Закрыть
        </Button>
      }
    >
      <ul className="divide-y divide-gray-100 border-y border-gray-100">
        <SheetRow
          icon={Package}
          title="Открыть товар"
          note="Карточка целиком: состав комплекта, цены и правила."
          onClick={() => { setMenuOpen(false); onNavigate(`/products/${booking.product.productId}`); }}
        />
        {canDecline && (
          <SheetRow
            icon={XCircle}
            title="Отклонить заявку"
            note="Снаряжение освободится, клиент получит уведомление."
            onClick={() => { setMenuOpen(false); setAction('decline'); }}
          />
        )}
        {canIssue && (
          <SheetRow
            icon={AlertCircle}
            title="Сообщить о проблеме"
            note="Поломка, опоздание, спор — зафиксировать по этой брони."
            onClick={() => { setMenuOpen(false); setAction('issue'); }}
          />
        )}
      </ul>
    </BottomSheet>
    </>
  );
}

function SheetRow({
  icon: Icon,
  title,
  note,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  note: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 px-5 py-3 text-left transition active:bg-gray-50"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
          <Icon size={19} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-gray-950">{title}</span>
          <span className="mt-0.5 block text-xs leading-4 text-gray-500">{note}</span>
        </span>
      </button>
    </li>
  );
}
