import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  ChevronRight,
  ImageOff,
  Mail,
  MoreHorizontal,
  Package,
  Phone,
  ReceiptRussianRuble,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { SubPageHeader } from '../../components/layout/SubPageHeader';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { CopyValue } from '../../components/ui/CopyValue';
import { SkeletonDetail } from '../../components/ui/Skeleton';
import { SectionPage } from '../../components/layout/SectionPage';
import { SettingsCard } from '../../components/layout/SettingsCard';
import { ApiError, bookingsApi, mediaUrl } from '../../lib/api-client';
import { useGoBack } from '../../lib/useGoBack';
import type { BookingDetail, FulfillmentDetail } from '../../types';
import { bookingStatusMeta, fulfillmentStageMeta, formatWindow, rentalLength, requestClock } from './bookingMeta';
import { BookingProductPanel } from './BookingProductPanel';
import { HandoverForm } from './HandoverForm';
import { ReturnForm } from './ReturnForm';
import { DeclineForm } from './DeclineForm';
import { CancelForm } from './CancelForm';

type Action = 'handover' | 'return' | 'decline' | 'cancel';

const ACTION_TITLES: Record<Action, string> = {
  handover: 'Выдача',
  return: 'Возврат',
  decline: 'Отклонить заявку',
  cancel: 'Отменить бронь',
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
  // Declining answers a request; cancelling undoes a booking that was paid for. A rental already
  // handed over is included on purpose — that is exactly when gear breaks.
  const canCancel = booking.status === 'pending' || booking.status === 'confirmed';
  const clock = awaiting ? requestClock(booking.createdAt) : null;
  const hasMenu = canDecline || canCancel;
  const length = rentalLength(booking.schedule?.startAt, booking.schedule?.endAt);

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
          // The bar at the bottom carries the dots whenever it is on screen; up here they would
          // be the same menu twice, a thumb's length apart.
          (hasMenu && !primary) ? (
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
      {/* The hero is the way to the card: tapping what was booked opens what was booked, which is
          where its description, photos and rules live. A pencil in a section header below said the
          same thing in a smaller target. */}
      <section className="mb-2 rounded-2xl bg-white sm:hidden">
        <button
          type="button"
          onClick={() => onNavigate(`/products/${booking.product.productId}`)}
          className="flex w-full gap-3 p-4 text-left transition active:bg-gray-50"
        >
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
              {length ? <span className="text-gray-500"> · {length}</span> : null}
            </p>
            <p className="mt-0.5 truncate text-xs text-gray-500">
              {booking.customer?.fullName ?? 'Клиент'}
              {(booking.schedule?.quantity ?? 1) > 1 ? ` · ${booking.schedule?.quantity} шт` : ''}
            </p>
          </div>
          <ChevronRight size={16} className="mt-1 shrink-0 self-start text-gray-400" />
        </button>
      </section>

      {/* A request answers itself after 24 hours — the booking expires, the item is released and
          the customer is told nobody replied. That clock is invisible unless it is on screen. */}
      {clock && (
        <p
          className={`mx-3 mb-2 rounded-xl px-4 py-2.5 text-sm font-medium sm:mx-0 sm:mb-4 ${
            clock.urgent ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-900'
          }`}
        >
          {clock.label} — иначе заявка истечёт сама и снаряжение освободится.
        </p>
      )}

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-4">
        <div className="space-y-2 sm:space-y-4">
        {/* The number, in full, first. The bar above truncates it to fit beside the arrow, and it
            is the one thing a seller reads out to a client or to support — so it is a labelled
            line to read from rather than a section with a heading of its own. */}
        <section className="rounded-2xl bg-white px-4 py-3 text-sm sm:rounded-xl sm:border sm:border-gray-200 sm:px-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <span className="text-xs text-gray-500">Номер брони</span>
            <CopyValue value={booking.bookingNumber} label="номер брони" className="font-medium" />
          </div>
          {booking.support?.correlationRef && (
            <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-t border-gray-100 pt-1.5 text-xs">
              <span className="text-gray-500">Для поддержки</span>
              <CopyValue value={booking.support.correlationRef} label="номер для поддержки" className="text-xs" />
            </div>
          )}
        </section>

        {/* What is handed over. The questions asked across a counter are what is in the kit and
            what deposit to take — both live on the card, so they are fetched by its id and shown
            here rather than left a screen away. The card's own description is not among them:
            marketing copy is for the customer deciding, not for the person handing the bike over. */}
        <SettingsCard title="Что выдать" description="Комплект и залог по карточке товара.">
          {/* The photo and the name, on the screens that have no hero above: a phone shows them
              at the top of the page, a desktop has nowhere else to show them at all. */}
          <button
            type="button"
            onClick={() => onNavigate(`/products/${booking.product.productId}`)}
            className="-mx-2 mb-3 hidden w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-gray-50 sm:flex"
          >
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
              <p className="text-sm font-medium text-gray-900">{booking.product.title}</p>
              <p className="mt-0.5 text-xs text-gray-500">
                {booking.schedule ? `${booking.schedule.quantity} шт` : '1 шт'}
                {booking.product.categoryTitle ? ` · ${booking.product.categoryTitle}` : ''}
              </p>
            </div>
            <ChevronRight size={16} className="ml-auto shrink-0 text-gray-400" />
          </button>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pb-3 text-sm sm:hidden">
            <span className="font-medium text-gray-950">
              {booking.schedule ? `${booking.schedule.quantity} шт` : '1 шт'}
            </span>
            {booking.product.categoryTitle && (
              <span className="text-gray-500">{booking.product.categoryTitle}</span>
            )}
          </div>

          <div className="border-t border-gray-100 pt-3">
            <BookingProductPanel productId={booking.product.productId} open hideProductHeader />
          </div>
        </SettingsCard>

        {/* The client, compactly: three facts, each one tap to copy. A label column down the left
            for «Имя», «Телефон», «Почта» spends half the width naming what the value obviously
            is, on the screen where the operator is reading it aloud. */}
        <SettingsCard title="Клиент">
          <p className="text-base font-medium text-gray-950">
            {booking.customer?.fullName ?? 'Клиент'}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {booking.customer?.phone && (
              <CopyValue
                value={booking.customer.phone}
                label="телефон клиента"
                icon={<Phone size={12} />}
                className="rounded-lg bg-gray-50 px-2.5 py-1.5 text-sm"
              />
            )}
            {booking.customer?.email && (
              <CopyValue
                value={booking.customer.email}
                label="почту клиента"
                icon={<Mail size={12} />}
                className="rounded-lg bg-gray-50 px-2.5 py-1.5 text-sm"
              />
            )}
          </div>
          {!booking.customer?.phone && !booking.customer?.email && (
            <p className="mt-1 text-sm text-gray-500">Контакты не указаны.</p>
          )}
        </SettingsCard>

        <SettingsCard title="Аренда">
          <dl className="divide-y divide-gray-100 text-sm">
            <Row label="Период" value={formatWindow(booking.schedule?.startAt, booking.schedule?.endAt) ?? '—'} />
            {/* What the two ends of the window add up to — the figure the price was taken for. */}
            <Row label="Длительность" value={length ?? '—'} />
            <Row label="Количество" value={booking.schedule ? `${booking.schedule.quantity} шт` : '—'} />
            {booking.product.fulfillmentLocationName && (
              <div className="py-2.5">
                <dt className="text-xs text-gray-500">Где выдаётся</dt>
                <dd className="mt-0.5 text-gray-900">
                  {booking.product.fulfillmentLocationName}
                  {booking.product.fulfillmentLocationAddress && (
                    <CopyValue
                      value={booking.product.fulfillmentLocationAddress}
                      label="адрес"
                      className="mt-0.5 text-xs"
                    />
                  )}
                </dd>
              </div>
            )}
            {booking.statusReason && <Row label="Причина" value={booking.statusReason} />}
          </dl>
        </SettingsCard>

        {booking.fulfillment?.notes && (
          <SettingsCard title="Заметки по выдаче" description="Что записали при выдаче или возврате.">
            <p className="whitespace-pre-line text-sm text-gray-800">{booking.fulfillment.notes}</p>
          </SettingsCard>
        )}

        {/* Receipts are accounting, not counter work: a row through to them keeps this screen
            about handing the gear over. */}
        {booking.receipts.length > 0 && (
          <LinkRow
            icon={ReceiptRussianRuble}
            title="Чеки"
            note={`${booking.receipts.length} ${receiptWord(booking.receipts.length)} по этой брони`}
            onClick={() => onNavigate(`/bookings/${bookingId}/receipts`)}
          />
        )}

        {/* A problem gets a place of its own, not a line in a menu: breakage, a late return or an
            argument is written down while the client is still standing there, and whoever writes
            it should not have to find it behind three dots. */}
        {canIssue && (
          <LinkRow
            icon={AlertTriangle}
            title="Сообщить о проблеме"
            note="Поломка, опоздание, спор — опишите, что случилось."
            onClick={() => onNavigate(`/bookings/${bookingId}/issue`)}
            tone="warning"
          />
        )}

        {/* Room at the end for the bar that sits over it, so the last section is not under it. */}
        <div className={primary ? 'h-24 lg:hidden' : 'hidden'} />
        </div>

        {/* The rail: what this booking is waiting for, and everything that can be done to it.
            A desktop had the same buttons in a row above the content, where they scrolled away
            from the thing they act on — and two of them were only ever on the phone. */}
        <aside className="hidden lg:sticky lg:top-4 lg:block">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-sm font-semibold text-gray-950">Что дальше</p>

            <div className="mt-3 space-y-2 [&>button]:w-full [&>button]:justify-center">
              {awaiting && (
                <Button variant="primary" loading={busy} onClick={() => void confirm()}>
                  Подтвердить заявку
                </Button>
              )}
              {/* The API decides which moves are open — the same rules the commands enforce. */}
              {fulfillment?.handover?.handoverAllowed && (
                <Button variant="primary" onClick={() => setAction('handover')}>Записать выдачу</Button>
              )}
              {fulfillment?.return?.returnAllowed && (
                <Button variant="primary" onClick={() => setAction('return')}>Принять возврат</Button>
              )}
              {canDecline && (
                <Button variant="secondary" disabled={busy} onClick={() => setAction('decline')}>
                  Отклонить заявку
                </Button>
              )}
              {canCancel && (
                <Button variant="secondary" onClick={() => setAction('cancel')}>Отменить бронь</Button>
              )}
              {canIssue && (
                <Button variant="ghost" onClick={() => onNavigate(`/bookings/${bookingId}/issue`)}>
                  <AlertTriangle size={14} /> Сообщить о проблеме
                </Button>
              )}
              {!awaiting && !canCancel && !canIssue
                && !fulfillment?.handover?.handoverAllowed && !fulfillment?.return?.returnAllowed && (
                <p className="text-sm text-gray-500">По этой брони делать нечего — она закрыта.</p>
              )}
            </div>

            {canCancel && (
              <p className="mt-3 text-xs leading-4 text-gray-500">
                При отмене клиенту возвращается вся сумма, включая залог.
              </p>
            )}
          </div>
        </aside>
      </div>
    </SectionPage>

    {/* The one move this booking is waiting for, as a bar across the bottom where the navigation
        bar would be — a booking is opened to be acted on, and the action should be under the thumb
        without hunting for it. Everything else it can do is behind the dots at its right, so one
        bar covers both and the header above keeps only the number. */}
    {primary && (
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 border-t border-gray-200 bg-white/95 px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        <Button
          variant="primary"
          loading={busy}
          onClick={primary.run}
          className="h-12 flex-1 justify-center rounded-xl text-base"
        >
          {primary.label}
        </Button>
        {hasMenu && (
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Другие действия"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-700 transition active:bg-gray-200"
          >
            <MoreHorizontal size={22} strokeWidth={2.5} />
          </button>
        )}
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
      {action === 'decline' && (
        <DeclineForm bookingId={bookingId} onSuccess={done('Заявка отклонена.')} onCancel={() => setAction(null)} />
      )}
      {action === 'cancel' && (
        <CancelForm
          bookingId={bookingId}
          onSuccess={done('Бронь отменена, клиенту вернутся деньги.')}
          onCancel={() => setAction(null)}
        />
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
        {canCancel && (
          <SheetRow
            icon={Ban}
            title="Отменить бронь"
            note="Если выдать не получится. Клиенту вернётся вся сумма, включая залог."
            onClick={() => { setMenuOpen(false); setAction('cancel'); }}
          />
        )}
      </ul>
    </BottomSheet>
    </>
  );
}

/**
 * A row that leads somewhere: an icon, what is there, one line about it, an arrow.
 *
 * Receipts and problem reports are not sections of this page — they are other screens, and a row
 * that looks like a link is the honest way to say so. Both in one shape, so a tap on either lands
 * where the eye expects.
 */
function LinkRow({
  icon: Icon,
  title,
  note,
  onClick,
  tone = 'plain',
}: {
  icon: LucideIcon;
  title: string;
  note: string;
  onClick: () => void;
  tone?: 'plain' | 'warning';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3.5 text-left transition hover:bg-gray-50 sm:rounded-xl sm:border sm:border-gray-200 sm:px-5"
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
        tone === 'warning' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600'
      }`}>
        <Icon size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-gray-950">{title}</span>
        <span className="block text-xs leading-4 text-gray-500">{note}</span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-gray-400" />
    </button>
  );
}

/** «1 чек», «2 чека», «5 чеков» — a count in Russian needs all three. */
function receiptWord(count: number) {
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 14) return 'чеков';
  const mod10 = count % 10;
  if (mod10 === 1) return 'чек';
  if (mod10 >= 2 && mod10 <= 4) return 'чека';
  return 'чеков';
}

/** Label over value, which is what fits on a phone — a label column eats half the width. */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 py-2.5">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="text-gray-900">{value}</dd>
    </div>
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
