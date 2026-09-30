import { useState, type ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '../../lib/utils';

export type ActionMenuItem = {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
};

interface ActionMenuProps {
  label: string;
  items: ActionMenuItem[];
  disabled?: boolean;
  className?: string;
}

export function ActionMenu({ label, items, disabled = false, className }: ActionMenuProps) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const open = Boolean(position);

  const close = () => setPosition(null);

  const openMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setPosition({
      top: rect.bottom + 6,
      left: Math.min(Math.max(8, rect.right - 208), window.innerWidth - 216),
    });
  };

  const run = (item: ActionMenuItem) => (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    close();
    item.onClick();
  };

  return (
    <div className={cn('inline-flex', className)} onClick={event => event.stopPropagation()}>
      <button
        type="button"
        onClick={openMenu}
        disabled={disabled}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 shadow-sm transition hover:bg-gray-50 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
        title={label}
        aria-label={label}
        aria-expanded={open}
      >
        <MoreHorizontal size={15} />
      </button>

      {open && position && (
        <>
          <div className="fixed inset-0 z-40" onClick={close} />
          <div
            className="fixed z-50 w-52 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
            style={{ top: position.top, left: position.left }}
          >
            {items.map((item, index) => (
              <button
                key={`${item.label}-${index}`}
                type="button"
                onClick={run(item)}
                disabled={item.disabled}
                className={cn(
                  'flex h-9 w-full items-center gap-2 px-3 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-50',
                  item.danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50 hover:text-gray-950'
                )}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
