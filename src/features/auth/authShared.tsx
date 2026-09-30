import { type ReactNode } from 'react';
import { Mail } from 'lucide-react';
import { Input } from '../../components/ui/Input';
import { BrandWordmark } from '../../components/layout/BrandWordmark';
import { cn } from '../../lib/utils';
import { AuthArtwork } from './AuthArtwork';

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
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  /** Secondary ways out — resend, change the number, skip. Plain links, never buttons. */
  footer?: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-2">
      <div className="flex min-h-screen flex-col px-5 pb-10 pt-7 sm:px-8 lg:px-14 xl:px-20">
        <header className="shrink-0">
          <BrandWordmark />
        </header>

        <main className="flex flex-1 flex-col pt-10 lg:justify-center lg:pt-0">
          <div className="w-full max-w-[380px]">
            <h1 className="text-[27px] font-bold leading-[1.15] tracking-tight text-foreground sm:text-[32px]">
              {title}
            </h1>
            {subtitle && <p className="mt-3 text-[15px] leading-6 text-muted-foreground">{subtitle}</p>}

            <div className="mt-8 space-y-5">{children}</div>

            {footer && (
              <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">{footer}</div>
            )}
          </div>
        </main>
      </div>

      <aside className="relative hidden overflow-hidden lg:block">
        <AuthArtwork className="absolute inset-0 h-full w-full" />
      </aside>
    </div>
  );
}

/**
 * The auth screens use taller controls than the console does — they are touched on a phone, and
 * they are the only thing on the page. The console's own forms stay compact, so this is applied
 * here rather than changed in the primitives.
 */
export const authControlClass = 'h-12 rounded-xl text-[15px]';

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

export function LoadingNotice({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="flex items-center gap-2.5 text-sm text-muted-foreground">
      <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-muted border-t-primary" />
      {children}
    </p>
  );
}
