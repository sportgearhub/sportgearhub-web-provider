import { useEffect, useState } from 'react';
import { Save, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { StringListEditor } from '../../components/ui/StringListEditor';
import { ApiError, productsApi } from '../../lib/api-client';
import type { OfferInfoSection } from '../../types';
import { INFO_SECTION_KINDS } from './infoSections';

/** «Что входит» and its three siblings: four short lists, edited together or not at all. */
export function ProductInfoSectionsDialog({
  open,
  productId,
  sections,
  onClose,
  onSaved,
  primaryLabel,
}: {
  open: boolean;
  productId: string;
  sections: OfferInfoSection[];
  onClose: () => void;
  onSaved: (next: OfferInfoSection[]) => void;
  /** «Сохранить и отправить», when saving is only half of what the card needs. */
  primaryLabel?: string;
}) {
  const [items, setItems] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    const next: Record<string, string[]> = {};
    INFO_SECTION_KINDS.forEach(({ kind }) => {
      next[kind] = sections.find(section => section.kind === kind)?.items ?? [];
    });
    setItems(next);
    setError('');
  }, [open, sections]);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = INFO_SECTION_KINDS
        .map(({ kind }) => ({ kind, items: (items[kind] ?? []).map(item => item.trim()).filter(Boolean) }))
        .filter(section => section.items.length > 0);
      const next = await productsApi.putInfoSections(productId, payload);
      onSaved(next ?? payload);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Что входит" size="md">
      {error && <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="space-y-5">
        {INFO_SECTION_KINDS.map(({ kind, label, placeholder }) => (
          <div key={kind}>
            <p className="mb-1.5 text-sm font-medium text-gray-900">{label}</p>
            <StringListEditor
              items={items[kind] ?? []}
              onChange={next => setItems(current => ({ ...current, [kind]: next }))}
              placeholder={placeholder}
            />
          </div>
        ))}
        <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
          <Button variant="secondary" disabled={saving} onClick={onClose}><X size={14} /> Отмена</Button>
          <Button variant="primary" loading={saving} onClick={() => void save()}><Save size={14} /> {primaryLabel ?? 'Сохранить'}</Button>
        </div>
      </div>
    </Modal>
  );
}
