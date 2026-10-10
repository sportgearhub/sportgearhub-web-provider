import { type ReactNode } from 'react';
import { Mail } from 'lucide-react';
import { Input } from '../../components/ui/Input';
import { BrandWordmark } from '../../components/layout/BrandWordmark';
import { cn } from '../../lib/utils';
import sellersArtwork from '../../assets/auth-sellers.png';

/**
 * The four rules of the platform, as the landing site states them publicly. Kept in step with
 * `SELLERS.numbers` there — a claim a seller reads before signing in and after should be one claim.
 */
const SELLER_NOTE = 'Без абонентской платы · Работает в браузере · Самозанятые, ИП и организации';

const SELLER_FACTS = [
  { value: '0 ₽', label: 'в месяц', text: 'Платите только комиссию с состоявшихся броней' },
  { value: '24/7', label: 'онлайн-брони', text: 'Клиенты бронируют и платят даже когда пункт закрыт' },
  { value: 'СБП', label: 'или расчётный счёт', text: 'Выручка приходит сама — туда, куда вам удобно' },
  { value: 'Авто', label: 'оплата, чеки, выплаты', text: 'Всё проходит без вашего участия' },
];

type AuthInputIcon = typeof Mail;

/**
 * Every auth step — sign-in, the SMS code, registration, the passcode — is one of these.
 *
 * On a phone it is the whole screen and reads like an app: the wordmark at the top, a large title
 * under it, then the one thing being asked for. There is no card, because a white panel on a white
 * page is a border drawn for its own sake. On a wide screen the same column sits in the left half
 * and a picture takes the right, which keeps the form at a readable width instead of stranding a
 * narrow box in the middle of a desktop monitor.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  busy,
  promo = false,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  /** Secondary ways out — resend, change the number, skip. Plain links, never buttons. */
  footer?: ReactNode;
  /**
   * That the page is working. It draws the bar across the top and marks the page busy; the words
   * it is given are for assistive technology, not for the screen — a line under the form saying
   * «отправляем код» is narration of something the button is already showing.
   */
  busy?: string;
  /**
   * The claims beside the form. Only the screen that asks for a credential shows them: once a code
   * has been sent, the person is signing in, and an advertisement is in the way of that.
   */
  promo?: boolean;
}) {
  return (
    <div className="relative min-h-[100dvh] bg-background lg:grid lg:grid-cols-2" aria-busy={busy ? true : undefined}>
      {busy && <Runner />}
      {busy && <span role="status" className="sr-only">{busy}</span>}

      <div className="flex min-h-[100dvh] flex-col px-5 pb-8 pt-7 sm:px-8 lg:px-14 xl:px-20">
        {/* Centred on a phone, where this is the only thing on screen and a wordmark pinned to
            the left-hand edge reads as the corner of a page whose other half never arrived. */}
        <header className="flex shrink-0 justify-center lg:justify-start">
          <BrandWordmark />
        </header>

        {/* Centred down the page too. Top-aligned left a short form floating under the wordmark
            with the rest of the screen empty below it, which reads as a page that failed. */}
        <main className="flex flex-1 flex-col justify-center py-8 lg:py-0">
          <div className="mx-auto w-full max-w-[380px] text-center lg:text-left">
            <h1 className="text-[27px] font-bold leading-[1.15] tracking-tight text-foreground sm:text-[32px]">
              {title}
            </h1>
            {subtitle && <p className="mt-3 text-[15px] leading-6 text-muted-foreground">{subtitle}</p>}

            {/* The controls themselves read left-to-right: a centred label over a full-width
                field is a caption, not a label. */}
            <div className="mt-8 space-y-5 text-left">{children}</div>

            {footer && (
              <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 lg:justify-start">
                {footer}
              </div>
            )}

            {/* The four rules of the platform, on the column that has room for them. Not on a
                phone: a person signing in has decided already, and this is the screen where they
                were asked for nothing but a number. */}
            {promo && (
              <div className="mt-10 hidden lg:block">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Прокату на платформе
                </p>
                {/* One list rather than four boxes: the figure, then what it is, on a line each.
                    Four cards in a grid at this width gave every claim three words and a wrap. */}
                <dl className="mt-2 divide-y divide-border">
                  {SELLER_FACTS.map(fact => (
                    <div key={fact.value} className="flex items-baseline gap-3 py-2">
                      <dt className="w-14 shrink-0 text-base font-semibold text-foreground">{fact.value}</dt>
                      <dd className="min-w-0 flex-1 text-xs leading-5 text-muted-foreground">
                        <span className="text-foreground">{fact.label}</span> — {fact.text}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{SELLER_NOTE}</p>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* The picture whole, not cropped: it carries its own headline, and `object-cover` cut it in
          half while the cards sat on top of the words. White around it, so it reads as a poster
          propped beside the form rather than a background the form is floating on. */}
      <aside className="hidden max-h-[100dvh] items-center justify-center overflow-hidden bg-background p-10 lg:flex xl:p-14">
        <img
          src={sellersArtwork}
          alt="Больше клиентов для вашего проката"
          /* Capped against the viewport rather than the column: the row's height comes from its
             content, so `max-h-full` here would be measured against a height this image is itself
             deciding — and a 9:16 poster in a half-width column is taller than the screen. */
          className="max-h-[calc(100dvh-5rem)] w-auto rounded-2xl object-contain shadow-sm xl:max-h-[calc(100dvh-7rem)]"
        />
      </aside>
    </div>
  );
}

/**
 * The progress of the page, across the top of the page.
 *
 * Indeterminate on purpose: nothing here can report a percentage, and a bar that invents one is
 * worse than a bar that only says «идёт». Fixed, so it stays put while the step under it changes.
 */
function Runner() {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-primary/15">
      <div className="h-full w-full origin-left bg-primary animate-runner" />
    </div>
  );
}

/**
 * The auth screens use taller controls than the console does — they are touched on a phone, and
 * they are the only thing on the page. The console's own forms stay compact, so this is applied
 * here rather than changed in the primitives.
 */
export const authControlClass = 'h-12 rounded-xl text-base';

/** A secondary action: a link, since nothing here competes with the primary button. */
export function AuthLink({
  onClick,
  children,
  disabled,
  tone = 'accent',
}: {
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  tone?: 'accent' | 'muted';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'text-sm font-medium underline-offset-4 transition-colors hover:underline disabled:opacity-50',
        tone === 'accent' ? 'text-primary hover:text-primary/80' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {children}
    </button>
  );
}

export function IconInput({
  icon: Icon,
  className = '',
  ...props
}: Omit<React.ComponentProps<typeof Input>, 'icon'> & { icon: AuthInputIcon }) {
  // The icon goes to the field, which knows where its own middle is. Positioned here it was
  // measured against the whole control — label, input and hint — and sat under the hint.
  return <Input {...props} icon={<Icon size={16} />} className={cn(authControlClass, className)} />;
}
