import { Plus, Trash2 } from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';

interface StringListEditorProps {
  label?: string;
  hint?: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  addLabel?: string;
  maxItems?: number;
  maxLength?: number;
}

/** Edits an ordered list of short text values (e.g. offer inclusions). Order = display order. */
export function StringListEditor({
  label,
  hint,
  items,
  onChange,
  placeholder,
  addLabel = 'Добавить',
  maxItems = 50,
  maxLength = 280,
}: StringListEditorProps) {
  const update = (index: number, value: string) => onChange(items.map((item, i) => (i === index ? value : item)));
  const remove = (index: number) => onChange(items.filter((_, i) => i !== index));
  const add = () => { if (items.length < maxItems) onChange([...items, '']); };

  return (
    <div className="space-y-2">
      {label && <p className="text-xs font-medium text-gray-700">{label}</p>}
      {hint && <p className="text-[11px] leading-4 text-gray-500">{hint}</p>}
      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="flex-1">
                <Input
                  value={item}
                  maxLength={maxLength}
                  placeholder={placeholder}
                  onChange={event => update(index, event.target.value)}
                />
              </div>
              <Button size="sm" variant="ghost" onClick={() => remove(index)} aria-label="Удалить">
                <Trash2 size={13} />
              </Button>
            </div>
          ))}
        </div>
      )}
      <Button size="sm" variant="secondary" onClick={add} disabled={items.length >= maxItems}>
        <Plus size={12} /> {addLabel}
      </Button>
    </div>
  );
}
