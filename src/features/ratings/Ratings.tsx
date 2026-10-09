import { ChevronRight, Star } from 'lucide-react';
import { SectionPage } from '../../components/layout/SectionPage';

/**
 * Demo ratings. There is no reviews API yet, so the numbers are seeded — and the screens say so,
 * because an invented 4.8 that a seller starts quoting is worse than an empty state.
 */
const SUMMARY = {
  average: 4.8,
  total: 67,
  distribution: [
    { stars: 5, count: 54 },
    { stars: 4, count: 9 },
    { stars: 3, count: 2 },
    { stars: 2, count: 1 },
    { stars: 1, count: 1 },
  ],
  recent: [
    { id: 'r1', author: 'Олег Р.', stars: 5, text: 'Всё выдали вовремя, снаряжение чистое. Спасибо!', product: 'Прокат горного велосипеда', at: '2 дня назад' },
    { id: 'r2', author: 'Ирина С.', stars: 4, text: 'Хорошо, но пришлось подождать на выдаче минут десять.', product: 'SUP-доска на пляже Солнечный', at: '5 дней назад' },
    { id: 'r3', author: 'Пётр В.', stars: 5, text: 'Второй раз берём, всё отлично.', product: 'Прокат горных лыж на день', at: 'неделю назад' },
  ],
};

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${value} из 5`}>
      {[1, 2, 3, 4, 5].map(star => (
        <Star
          key={star}
          size={size}
          className={star <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}
        />
      ))}
    </span>
  );
}

/**
 * The rating, on the screen a seller opens first.
 *
 * One number is what they want at a glance — it is the thing customers see and the thing that
 * moves bookings — and everything behind it is one tap away rather than on screen competing with
 * it. Full width and rounded on every corner, so it reads as its own block rather than a cell in
 * the grid of counts above it.
 */
export function RatingsSection({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <section className="overflow-hidden rounded-2xl bg-white">
      <div className="flex flex-wrap items-center gap-4 p-4">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold text-gray-950">{SUMMARY.average}</span>
          <span className="text-sm text-gray-500">из 5</span>
        </div>

        <div className="min-w-0 flex-1">
          <Stars value={SUMMARY.average} size={16} />
          <p className="mt-1 text-xs text-gray-500">{SUMMARY.total} оценок · прототип</p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('/ratings')}
          className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-blue-700 transition hover:bg-blue-50"
        >
          Подробнее <ChevronRight size={15} />
        </button>
      </div>
    </section>
  );
}

export function RatingsPage() {
  const max = Math.max(...SUMMARY.distribution.map(row => row.count));

  return (
    <SectionPage title="Оценки" description="Что клиенты говорят о прокате.">
      <p className="mb-4 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-2.5 text-xs leading-5 text-gray-600">
        <span className="font-medium text-gray-800">Прототип.</span> Отзывов пока нет в API — цифры
        демонстрационные.
      </p>

      <div className="max-w-3xl space-y-4">
        <section className="rounded-2xl bg-white p-4">
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <p className="text-4xl font-semibold text-gray-950">{SUMMARY.average}</p>
              <Stars value={SUMMARY.average} size={16} />
              <p className="mt-1 text-xs text-gray-500">{SUMMARY.total} оценок</p>
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              {SUMMARY.distribution.map(row => (
                <div key={row.stars} className="flex items-center gap-2">
                  <span className="w-3 text-right text-xs text-gray-500">{row.stars}</span>
                  <Star size={11} className="shrink-0 fill-amber-400 text-amber-400" />
                  <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <span
                      className="block h-full rounded-full bg-amber-400"
                      style={{ width: `${max > 0 ? (row.count / max) * 100 : 0}%` }}
                    />
                  </span>
                  <span className="w-6 text-right text-xs text-gray-500">{row.count}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl bg-white">
          <p className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-950">Последние отзывы</p>
          <ul className="divide-y divide-gray-100">
            {SUMMARY.recent.map(review => (
              <li key={review.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Stars value={review.stars} />
                  <span className="text-sm font-medium text-gray-900">{review.author}</span>
                  <span className="text-xs text-gray-400">{review.at}</span>
                </div>
                <p className="mt-1.5 text-sm leading-5 text-gray-800">{review.text}</p>
                <p className="mt-1 text-xs text-gray-500">{review.product}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </SectionPage>
  );
}
