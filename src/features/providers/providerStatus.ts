import type { ProviderStatus, SellerKind } from '../../types';

type BadgeVariant = 'green' | 'yellow' | 'red' | 'blue' | 'gray' | 'orange';

/** One status, one word on screen: what a person with three cabinets needs to see at a glance. */
export const providerStatusMeta: Record<string, { label: string; variant: BadgeVariant; hint: string }> = {
  draft: { label: 'Черновик', variant: 'gray', hint: 'Заполните кабинет и отправьте его на проверку.' },
  pending_review: { label: 'На проверке', variant: 'yellow', hint: 'Обычно проверяем за один рабочий день.' },
  changes_requested: { label: 'Нужны правки', variant: 'orange', hint: 'Проверяющий оставил замечания — исправьте и отправьте снова.' },
  rejected: { label: 'Отклонён', variant: 'red', hint: 'Кабинет отклонён. Вы можете создать другой кабинет.' },
  active: { label: 'Активен', variant: 'green', hint: 'Предложения видны клиентам.' },
  suspended: { label: 'Приостановлен', variant: 'orange', hint: 'Публикация приостановлена платформой.' },
  archived: { label: 'В архиве', variant: 'gray', hint: 'Кабинет закрыт.' },
};

export function statusMeta(status: ProviderStatus) {
  return providerStatusMeta[status] ?? { label: status, variant: 'gray' as BadgeVariant, hint: '' };
}

export const sellerKindLabels: Record<string, string> = {
  self_employed: 'Самозанятый',
  sole_proprietor: 'ИП',
  company: 'Организация',
};

export function kindLabel(kind: SellerKind | null | undefined) {
  return kind ? sellerKindLabels[kind] ?? kind : '—';
}

export const memberRoleLabels: Record<string, string> = {
  owner: 'владелец',
  manager: 'менеджер',
  staff: 'сотрудник',
  finance: 'финансы',
};

export function roleLabel(role: string) {
  return memberRoleLabels[role.toLowerCase()] ?? role;
}

export const taxationSystemOptions = [
  { value: 'usn', label: 'УСН' },
  { value: 'osn', label: 'ОСН' },
  { value: 'psn', label: 'ПСН' },
  { value: 'ausn', label: 'АУСН' },
  { value: 'eskhn', label: 'ЕСХН' },
];

export const vatRateOptions = [
  { value: 'none', label: 'Без НДС' },
  { value: 'vat5', label: '5 %' },
  { value: 'vat7', label: '7 %' },
  { value: 'vat10', label: '10 %' },
  { value: 'vat20', label: '20 %' },
];

export const DOCS_BASE_URL = (import.meta.env.VITE_DOCS_BASE_URL || 'https://docs.sportgearhub.ru').replace(/\/$/, '');
export const AGREEMENT_URL = `${DOCS_BASE_URL}/docs/legal/providers/provider-agreement`;

/** ИНН checksum as the ФНС defines it: 10 digits for organisations, 12 for people and ИП. */
export function isValidInn(value: string) {
  const inn = value.replace(/\D/g, '');
  const control = (weights: number[]) =>
    (weights.reduce((sum, weight, index) => sum + weight * Number(inn[index]), 0) % 11) % 10;
  if (inn.length === 10) return control([2, 4, 10, 3, 5, 9, 4, 6, 8]) === Number(inn[9]);
  if (inn.length === 12) {
    return control([7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) === Number(inn[10])
      && control([3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) === Number(inn[11]);
  }
  return false;
}
