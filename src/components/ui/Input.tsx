import { InputHTMLAttributes, forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '../../lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = '', type, disabled, ...props }, ref) => {
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const hasPasswordToggle = type === 'password';
    const inputType = hasPasswordToggle && isPasswordVisible ? 'text' : type;
    const ToggleIcon = isPasswordVisible ? EyeOff : Eye;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-xs font-medium text-foreground">{label}</label>
        )}
        <div className="relative">
          <input
            ref={ref}
            {...props}
            type={inputType}
            disabled={disabled}
            className={cn(
              'flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
              error && 'border-destructive focus-visible:ring-destructive/40',
              hasPasswordToggle && 'pr-10',
              className
            )}
          />
          {hasPasswordToggle && (
            <button
              type="button"
              onClick={() => setIsPasswordVisible(current => !current)}
              disabled={disabled}
              className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={isPasswordVisible ? 'Скрыть пароль' : 'Показать пароль'}
              aria-pressed={isPasswordVisible}
            >
              <ToggleIcon size={16} />
            </button>
          )}
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
