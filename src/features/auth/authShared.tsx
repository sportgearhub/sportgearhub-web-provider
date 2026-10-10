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
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  /** Secondary ways out — resend, change the number, skip. Plain links, never buttons. */
  footer?: ReactNode;
  /**
   * What is happening, while it happens. Signing in is the page's work, not a button's: the whole
   * screen is waiting on one request, so the progress runs across the top of it and the step says
   * so underneath, instead of a spinner inside a control nobody is looking at any more.
   */
  busy?: string;
}) {
  return (
    <div className="relative min-h-[100dvh] bg-background lg:grid lg:grid-cols-2" aria-busy={busy ? true : undefined}>
      {busy && <Runner />}

      <div className="flex min-h-[100dvh] flex-col px-5 pb-8 pt-7 sm:px-8 lg:px-14 xl:px-20">
        {/* Centred on a phone, where this is the only thing on screen and a wordmark pinned to
            the left-hand edge reads as the corner of a page whose other half never arrived. */}
        <header className="flex shrink-0 justify-center lg:justify-start">
          <BrandWordmark />
        </header>

        {/* Centred down the page too. Top-aligned left a short form floating under the wordmark
            with the rest of the screen empty below it, which reads as a page that failed. */}
        <main className="flex flex-1 flex-col justify-center py-8 lg:py-0">
          <div className="mx-auto w-full max-w-[380px] text-center lg:mx-0 lg:text-left">
            <h1 className="text-[27px] font-bold leading-[1.15] tracking-tight text-foreground sm:text-[32px]">
              {title}
            </h1>
            {subtitle && <p className="mt-3 text-[15px] leading-6 text-muted-foreground">{subtitle}</p>}

            {/* The controls themselves read left-to-right: a centred label over a full-width
                field is a caption, not a label. */}
            <div className="mt-8 space-y-5 text-left">{children}</div>

            {busy && (
              <p role="status" className="mt-6 text-sm text-muted-foreground">{busy}</p>
            )}

            {footer && (
              <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 lg:justify-start">
                {footer}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* The same picture the landing site uses for продавцам — one promise across the two
          surfaces, rather than a drawing here and a photograph there. Over it, the four rules of
          the platform, which are public and are what a seller is signing in to use. */}
      <aside className="relative hidden overflow-hidden lg:block">
        <img
          src={sellersArtwork}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-x-0 bottom-0 p-8 xl:p-10">
          <div className="grid grid-cols-2 gap-2">
            {SELLER_FACTS.map(fact => (
              <div key={fact.value} className="rounded-2xl bg-white/10 p-3 backdrop-blur-sm">
                <p className="text-lg font-semibold leading-tight text-white">{fact.value}</p>
                <p className="text-[11px] font-medium uppercase tracking-wide text-white/70">{fact.label}</p>
                <p className="mt-1 text-xs leading-4 text-white/85">{fact.text}</p>
              </div>
            ))}
          </div>
        </div>
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

export function IconInput({ icon: Icon, className = '', ...props }: React.ComponentProps<typeof Input> & { icon: AuthInputIcon }) {
  return (
    <div className="relative">
      <Input {...props} className={cn(authControlClass, 'pl-10', className)} />
      <Icon size={16} className="pointer-events-none absolute bottom-[14px] left-3.5 text-muted-foreground" />
    </div>
  );
}
