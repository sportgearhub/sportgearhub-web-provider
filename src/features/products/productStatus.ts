import type { ProductStatus } from '../../types';

type BadgeVariant = 'green' | 'yellow' | 'red' | 'blue' | 'gray' | 'orange';

export const productStatusMeta: Record<string, { label: string; variant: BadgeVariant; hint: string }> = {
  draft: { label: 'Черновик', variant: 'gray', hint: 'Виден только вам. Отправьте на проверку, когда заполните карточку.' },
  pending_review: { label: 'На проверке', variant: 'yellow', hint: 'Модератор смотрит карточку. Обычно это занимает один рабочий день.' },
  changes_requested: { label: 'На доработку', variant: 'orange', hint: 'Проверяющий вернул карточку с комментарием — исправьте и отправьте снова.' },
  rejected: { label: 'Отклонён', variant: 'red', hint: 'Карточку не приняли.' },
  active: { label: 'В продаже', variant: 'green', hint: 'Клиенты видят карточку и могут забронировать.' },
  paused: { label: 'Снят с продажи', variant: 'orange', hint: 'Скрыт от клиентов. Вернуть в продажу можно в любой момент.' },
  suspended: { label: 'Заблокирован', variant: 'red', hint: 'Остановлен администратором платформы.' },
  archived: { label: 'В архиве', variant: 'gray', hint: 'Убран из каталога навсегда.' },
};

export function productStatus(status: ProductStatus) {
  return productStatusMeta[status] ?? { label: status, variant: 'gray' as BadgeVariant, hint: '' };
}

export const productStatusFilterOptions = [
  { value: '', label: 'Все статусы' },
  ...Object.entries(productStatusMeta).map(([value, meta]) => ({ value, label: meta.label })),
];

/** Money as a seller reads it: no decimals on whole roubles. */
export function formatPrice(price: number | null | undefined) {
  if (price === null || price === undefined) return null;
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(price)} ₽`;
}
