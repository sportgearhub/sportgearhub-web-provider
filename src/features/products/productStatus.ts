import type { ProductSection, ProductStatus } from '../../types';

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

/**
 * Why a card would not go to review, in the words the endpoint judged it by.
 *
 * `submit-for-review` refuses with a status, not a list. The card's own `sections` are the same
 * computation it ran, so they are read back rather than guessed at — and read back *after* the
 * refusal, because what was missing a second ago is the whole question.
 */
export async function submitRefusalMessage(
  productId: string,
  fallback: string,
  load: (id: string) => Promise<{ sections?: ProductSection[] }>
): Promise<string> {
  const gaps = await load(productId)
    .then(saved => (saved.sections ?? []).filter(section => !section.isComplete))
    .catch(() => [] as ProductSection[]);

  return gaps.length > 0
    ? `Не хватает: ${gaps.map(gap => gap.title.toLowerCase()).join(', ')}.`
    : fallback;
}
