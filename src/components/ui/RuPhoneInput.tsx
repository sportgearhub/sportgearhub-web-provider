type RuPhoneInputProps = {
  label?: string;
  value: string;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
};

export function RuPhoneInput({
  label = 'Телефон',
  value,
  error,
  disabled = false,
  placeholder = '9279383562',
  onChange,
}: RuPhoneInputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-medium text-foreground">{label}</label>}
      <div className="flex">
        <div className="flex h-9 items-center gap-1.5 rounded-l-md border border-r-0 border-input bg-gray-50 px-3 shadow-sm">
          {/* "RU" is a country tag, so it reads as a label; "+7" is part of the number the user is
              typing, so it matches the input text exactly rather than sitting heavier than it. */}
          <span aria-hidden="true" className="text-xs font-medium text-muted-foreground">RU</span>
          <span className="text-sm text-foreground">+7</span>
        </div>
        <input
          value={value}
          onChange={event => onChange(event.target.value.replace(/\D/g, '').slice(0, 10))}
          disabled={disabled}
          inputMode="numeric"
          maxLength={10}
          placeholder={placeholder}
          className={`flex h-9 min-w-0 flex-1 rounded-r-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${
            error ? 'border-destructive focus-visible:ring-destructive/40' : ''
          }`}
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
