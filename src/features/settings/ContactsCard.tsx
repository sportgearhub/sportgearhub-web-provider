import { useEffect, useState } from 'react';
import {
  AtSign,
  ChevronDown,
  ChevronUp,
  Globe,
  Instagram,
  Link2,
  MessageCircle,
  Phone,
  Send,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { SectionEdit, SettingsCard } from '../../components/layout/SettingsCard';
import { Skeleton } from '../../components/ui/Skeleton';
import { ApiError, contactsApi } from '../../lib/api-client';
import type { ContactKind, SellerContact, SellerContactInput } from '../../types';

/** The eight kinds, with what each one is called and how it is written. */
const KINDS: { value: ContactKind; label: string; icon: LucideIcon; placeholder: string }[] = [
  { value: 'phone', label: 'Телефон', icon: Phone, placeholder: '+7 999 123-45-67' },
  { value: 'email', label: 'Почта', icon: AtSign, placeholder: 'rent@example.com' },
  { value: 'telegram', label: 'Telegram', icon: Send, placeholder: 'https://t.me/sportgearhub' },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, placeholder: '+7 999 123-45-67' },
  { value: 'max', label: 'MAX', icon: MessageCircle, placeholder: 'https://max.ru/sportgearhub' },
  { value: 'vk', label: 'ВКонтакте', icon: Globe, placeholder: 'https://vk.com/sportgearhub' },
  { value: 'instagram', label: 'Instagram', icon: Instagram, placeholder: 'https://instagram.com/sportgearhub' },
  { value: 'link', label: 'Сайт или ссылка', icon: Link2, placeholder: 'https://example.com' },
];

/** Messengers exist to be written to; a phone and an e-mail are usually a sole trader's own. */
const PUBLIC_BY_DEFAULT: ContactKind[] = ['telegram', 'whatsapp', 'max', 'vk', 'instagram', 'link'];

const kindMeta = (kind: ContactKind) => KINDS.find(item => item.value === kind) ?? KINDS[KINDS.length - 1];

type Row = { kind: ContactKind; value: string; label: string; isPublic: boolean };

/**
 * Контакты и ссылки — how customers reach the rental, and which of those the platform uses.
 *
 * The endpoint replaces the whole set on every save, and **the order of the list is the display
 * order**, which is also how «which phone is ours» is decided: the first of a kind is the one the
 * platform registers with the acquirer and sends bookings to. So the editor moves rows rather than
 * offering a «primary» switch that would be a second way to say the same thing.
 */
export function ContactsCard() {
  const [contacts, setContacts] = useState<SellerContact[] | null>(null);
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => contactsApi.list().then(setContacts).catch(() => setContacts([]));
  useEffect(() => { void load(); }, []);

  const open = () => {
    setRows((contacts ?? []).map(contact => ({
      kind: contact.kind,
      value: contact.value,
      label: contact.label ?? '',
      isPublic: contact.isPublic,
    })));
    setError('');
    setEditing(true);
  };

  const patch = (index: number, next: Partial<Row>) =>
    setRows(current => current.map((row, i) => (i === index ? { ...row, ...next } : row)));

  const move = (index: number, by: -1 | 1) =>
    setRows(current => {
      const next = [...current];
      const target = index + by;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const save = async () => {
    setSaving(true);
    setError('');
    const payload: SellerContactInput[] = rows
      .filter(row => row.value.trim())
      .map(row => ({
        kind: row.kind,
        value: row.value.trim(),
        label: row.label.trim() || undefined,
        isPublic: row.isPublic,
      }));
    try {
      // The response is the normalised set — a phone as E.164, a Telegram link as a username — so
      // it is what goes on screen, not what was typed into the form.
      setContacts(await contactsApi.put(payload));
      setEditing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить контакты.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsCard
      title="Контакты и ссылки"
      description="Как с вами связаться и где вас найти. Первый телефон и первую почту площадка использует сама — для эквайринга и писем о бронях."
      action={<SectionEdit onClick={open} empty={(contacts?.length ?? 0) === 0} label="Редактировать контакты" />}
    >
      {contacts === null ? (
        <Skeleton className="h-16 w-full" />
      ) : contacts.length === 0 ? (
        <p className="text-sm text-gray-500">
          Ничего не указано. Клиенты увидят только то, что вы добавите.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {contacts.map(contact => {
            const meta = kindMeta(contact.kind);
            return (
              <li key={contact.contactId} className="flex items-center gap-3 py-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-600">
                  <meta.icon size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-gray-900">{contact.value}</span>
                  <span className="block truncate text-xs text-gray-500">
                    {contact.label || meta.label}
                    {contact.isPrimary && (contact.kind === 'phone' || contact.kind === 'email')
                      ? ' · основной для площадки'
                      : ''}
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded-lg px-2 py-0.5 text-[11px] font-medium ${
                    contact.isPublic ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {contact.isPublic ? 'виден клиентам' : 'скрыт'}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <BottomSheet
        open={editing}
        onClose={() => setEditing(false)}
        title="Контакты и ссылки"
        center
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1 justify-center" onClick={() => setEditing(false)}>
              Отмена
            </Button>
            <Button variant="primary" className="flex-1 justify-center" loading={saving} onClick={() => void save()}>
              Сохранить
            </Button>
          </div>
        }
      >
        <div className="space-y-3 px-5 pb-4 pt-1">
          {error && <p className="text-sm text-red-600">{error}</p>}

          {rows.length === 0 && (
            <p className="text-sm text-gray-500">Добавьте телефон, мессенджер или ссылку на страницу проката.</p>
          )}

          {rows.map((row, index) => {
            const meta = kindMeta(row.kind);
            return (
              <div key={index} className="rounded-xl border border-gray-200 p-3">
                <div className="flex gap-2">
                  <div className="w-36 shrink-0">
                    <Select
                      label="Что это"
                      value={row.kind}
                      options={KINDS.map(item => ({ value: item.value, label: item.label }))}
                      onChange={event => {
                        const kind = event.target.value as ContactKind;
                        patch(index, { kind, isPublic: PUBLIC_BY_DEFAULT.includes(kind) });
                      }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <Input
                      label="Значение"
                      value={row.value}
                      placeholder={meta.placeholder}
                      onChange={event => patch(index, { value: event.target.value })}
                    />
                  </div>
                </div>

                <div className="mt-2 flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <Input
                      label="Подпись, необязательно"
                      value={row.label}
                      placeholder="Прокат на Ленина"
                      onChange={event => patch(index, { label: event.target.value })}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label="Выше"
                    className="mb-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 disabled:opacity-30"
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === rows.length - 1}
                    aria-label="Ниже"
                    className="mb-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 disabled:opacity-30"
                  >
                    <ChevronDown size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setRows(current => current.filter((_, i) => i !== index))}
                    aria-label="Убрать"
                    className="mb-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <label className="mt-2 flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={row.isPublic}
                    onChange={event => patch(index, { isPublic: event.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  Показывать клиентам
                </label>
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => setRows(current => [...current, { kind: 'telegram', value: '', label: '', isPublic: true }])}
            className="text-sm font-medium text-blue-700"
          >
            + Добавить контакт
          </button>

          <p className="text-xs leading-5 text-gray-500">
            Порядок важен: первый телефон и первая почта — те, по которым площадка связывается с вами
            и регистрирует эквайринг. Перетащить порядок можно стрелками.
          </p>
        </div>
      </BottomSheet>
    </SettingsCard>
  );
}
