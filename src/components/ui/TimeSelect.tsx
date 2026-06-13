import { useMemo, useState } from 'react';
import { Clock } from 'lucide-react';

const pad = (n: number) => String(n).padStart(2, '0');

/** Normalize any `HH:mm` / `HH:mm:ss` value to `HH:mm` for display. */
export function toHhMm(value: string): string {
  if (!value) return '';
  const [h, m] = value.split(':');
  if (h === undefined || m === undefined) return '';
  return `${pad(Number(h))}:${pad(Number(m))}`;
}

type TimeSelectProps = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  /** Minutes between options (default 30). */
  stepMinutes?: number;
  disabled?: boolean;
};

export function TimeSelect({ label, value, onChange, stepMinutes = 30, disabled = false }: TimeSelectProps) {
  const [open, setOpen] = useState(false);
  const current = toHhMm(value);

  const options = useMemo(() => {
    const out: string[] = [];
    for (let mins = 0; mins < 24 * 60; mins += stepMinutes) {
      out.push(`${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`);
    }
    return out;
  }, [stepMinutes]);

  return (
    <div className="relative flex flex-col gap-1.5" onBlur={() => window.setTimeout(() => setOpen(false), 120)}>
      {label && <label className="text-xs font-medium text-foreground">{label}</label>}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(c => !c)}
        className="flex h-9 w-full items-center justify-between gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-left text-sm shadow-sm transition hover:border-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={current ? 'text-foreground' : 'text-muted-foreground'}>{current || '--:--'}</span>
        <Clock size={14} className="shrink-0 text-gray-400" />
      </button>
      {open && !disabled && (
        <div role="listbox" className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-auto rounded-md border border-gray-200 bg-white p-1 shadow-lg">
          {options.map(opt => {
            const isSelected = opt === current;
            return (
              <button
                key={opt}
                type="button"
                role="option"
                aria-selected={isSelected}
                onMouseDown={e => e.preventDefault()}
                onClick={() => { onChange(opt); setOpen(false); }}
                className={`block w-full rounded px-2.5 py-1.5 text-left text-sm transition ${
                  isSelected ? 'bg-blue-50 font-medium text-blue-900' : 'text-gray-800 hover:bg-gray-50'
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
