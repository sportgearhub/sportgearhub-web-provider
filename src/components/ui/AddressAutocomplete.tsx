import { useEffect, useState } from 'react';
import { Input } from './Input';
import { addressesApi, ApiError, type RuAddressSuggestion } from '../../lib/api-client';

interface AddressAutocompleteProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  /** Called when a suggestion is picked (with the full address object). */
  onSelect?: (suggestion: RuAddressSuggestion) => void;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
  hint?: string;
}

/** Text input with Russian address (DaData) autocomplete. */
export function AddressAutocomplete({
  label,
  value,
  onChange,
  onSelect,
  error,
  disabled = false,
  placeholder,
  hint,
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<RuAddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestError, setSuggestError] = useState('');
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const query = value.trim();
    if (!focused || query.length < 3) {
      setSuggestions([]);
      setOpen(false);
      setSuggestError('');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await addressesApi.ruSuggestions(query, 7);
        if (cancelled) return;
        setSuggestions(response.suggestions);
        setSuggestError('');
        setOpen(true);
      } catch (err) {
        if (cancelled) return;
        setSuggestions([]);
        setSuggestError(err instanceof ApiError ? err.message : 'Не удалось загрузить адреса.');
        setOpen(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [focused, value]);

  return (
    <div className="relative">
      <Input
        label={label}
        value={value}
        error={error}
        disabled={disabled}
        placeholder={placeholder}
        hint={hint}
        onChange={event => {
          onChange(event.target.value);
          setFocused(true);
          setOpen(true);
        }}
        onFocus={() => {
          setFocused(true);
          if (suggestions.length > 0 || suggestError) setOpen(true);
        }}
        onBlur={() => {
          setFocused(false);
          setOpen(false);
        }}
      />
      {open && (loading || suggestions.length > 0 || suggestError) && (
        <div className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg">
          {loading && <div className="px-3 py-2 text-xs text-gray-500">Ищем адрес...</div>}
          {!loading && suggestError && <div className="px-3 py-2 text-xs text-red-600">{suggestError}</div>}
          {!loading && !suggestError && suggestions.map(suggestion => (
            <button
              key={`${suggestion.fiasId ?? suggestion.value}-${suggestion.unrestrictedValue}`}
              type="button"
              onMouseDown={event => event.preventDefault()}
              onClick={() => {
                onChange(suggestion.value);
                onSelect?.(suggestion);
                setSuggestions([]);
                setOpen(false);
                setSuggestError('');
              }}
              className="w-full px-3 py-2 text-left transition hover:bg-blue-50"
            >
              <span className="block truncate text-sm font-medium text-gray-900">{suggestion.value}</span>
              {suggestion.unrestrictedValue && suggestion.unrestrictedValue !== suggestion.value && (
                <span className="mt-0.5 block truncate text-[11px] text-gray-500">{suggestion.unrestrictedValue}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
