import { Images, LayoutGrid, MessageSquareQuote, Percent, Plus, Rows3, Image as ImageIcon } from 'lucide-react';
import { Button } from '../../components/ui/Button';

/** The kinds of block a storefront could be built from. None of them exists in the API yet. */
const BLOCKS = [
  { key: 'banner', label: 'Баннер', icon: ImageIcon, note: 'Одна картинка во всю ширину' },
  { key: 'slider', label: 'Слайдер', icon: Images, note: 'Несколько картинок подряд' },
  { key: 'tiles', label: 'Плитки', icon: LayoutGrid, note: 'Подборки по категориям' },
  { key: 'shelf', label: 'Полка', icon: Rows3, note: 'Ряд товаров с прокруткой' },
  { key: 'reviews', label: 'Отзывы', icon: MessageSquareQuote, note: 'Что пишут клиенты' },
];

/**
 * What a seller will arrange their storefront from.
 *
 * A prototype, and it says so: there is no endpoint for blocks or for promotions, so nothing here
 * saves. It is in the console because the shape of the screen is worth agreeing on before the API
 * is written — and because a seller looking at their own storefront asks what they can change
 * about it, which is a better moment to find out than a changelog.
 */
export function StorefrontBlocks() {
  return (
    <aside className="w-full shrink-0 space-y-3 lg:w-72">
      <p className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-xs leading-4 text-gray-600">
        <span className="font-medium text-gray-800">Прототип.</span> Блоки и акции ещё нельзя
        сохранить — показываем, каким станет оформление витрины.
      </p>

      <section className="rounded-2xl bg-white p-4">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
            <Percent size={16} />
          </span>
          <h2 className="text-sm font-semibold text-gray-950">Акции</h2>
        </div>
        <p className="mt-2 text-xs leading-5 text-gray-600">
          Блок появится на витрине, когда у проката есть хотя бы одна активная акция: скидка от
          суммы заказа или по промокоду.
        </p>
        <Button variant="secondary" size="sm" className="mt-3" disabled>
          Создать акцию
        </Button>
      </section>

      <section className="rounded-2xl bg-white p-4">
        <div className="flex items-center gap-2">
          <Plus size={16} className="text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-950">Добавить блок</h2>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {BLOCKS.map(block => (
            <button
              key={block.key}
              type="button"
              disabled
              title={block.note}
              className="flex cursor-not-allowed flex-col items-center gap-2 rounded-xl bg-gray-50 px-2 py-3 text-center opacity-80"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-gray-400">
                <block.icon size={18} />
              </span>
              <span className="text-xs font-medium text-gray-700">{block.label}</span>
            </button>
          ))}
        </div>
      </section>
    </aside>
  );
}
