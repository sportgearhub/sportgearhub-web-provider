import { cn } from '../../lib/utils';

/**
 * The product's wordmark, kept identical to the customer app's (sportgearhub-web-app,
 * components/layout/BrandWordmark) so the two surfaces carry one brand. Change it there first.
 */
type BrandWordmarkProps = { tone?: 'dark' | 'light'; size?: 'sm' | 'md'; className?: string };

export function BrandWordmark({ tone = 'dark', size = 'md', className }: BrandWordmarkProps) {
  const text = tone === 'light' ? 'text-white' : 'text-foreground';
  const hub = tone === 'light' ? 'bg-white text-slate-950' : 'bg-primary text-primary-foreground';
  return (
    <span className={cn('inline-flex items-center gap-1 font-black uppercase tracking-wide', size === 'sm' ? 'text-sm' : 'text-lg', className)}>
      <span className={cn('italic', text)}>
        Sport
        <span className="relative inline-block">
          gear
          <span className={cn('absolute bottom-0 left-0 h-0.5 w-full rounded-full', tone === 'light' ? 'bg-white/85' : 'bg-primary')} />
        </span>
      </span>
      <span className={cn('inline-block -skew-x-6 rounded-lg shadow-sm', hub, size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-0.5 text-base leading-none')}>
        hub
      </span>
    </span>
  );
}
