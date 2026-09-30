type RuPhoneInputProps = {
  label?: string;
  value: string;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
  /** `lg` is for the auth screens, where the field is the only thing on the page. */
  size?: 'md' | 'lg';
  onChange: (value: string) => void;
};

export function RuPhoneInput({
  label = 'Телефон',
  value,
  error,
  disabled = false,
  placeholder = '9279383562',
  size = 'md',
  onChange,
}: RuPhoneInputProps) {
  const control = size === 'lg' ? 'h-12 text-[15px]' : 'h-9 text-sm';
  const corners = size === 'lg' ? ['rounded-l-xl', 'rounded-r-xl'] : ['rounded-l-md', 'rounded-r-md'];
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-medium text-foreground">{label}</label>}
      <div className="flex">
        <div className={`flex items-center gap-1.5 border border-r-0 border-input bg-gray-50 px-3.5 shadow-sm ${control} ${corners[0]}`}>
          {/* "RU" is a country tag, so it reads as a label; "+7" is part of the number the user is
              typing, so it matches the input text exactly rather than sitting heavier than it. */}
          <span aria-hidden="true" className="text-xs font-medium text-muted-foreground">RU</span>
          <span className="text-foreground">+7</span>
        </div>
        <input
          value={value}
          onChange={event => onChange(event.target.value.replace(/\D/g, '').slice(0, 10))}
          disabled={disabled}
          inputMode="numeric"
          maxLength={10}
          placeholder={placeholder}
          className={`flex min-w-0 flex-1 border border-input bg-background px-3.5 py-2 text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${control} ${corners[1]} ${
            error ? 'border-destructive focus-visible:ring-destructive/40' : ''
          }`}
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
