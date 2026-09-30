import { AlertTriangle, Check, CircleDashed } from 'lucide-react';
import { SettingsCard } from '../../components/layout/SettingsCard';
import type { ProductRoutability } from '../../types';

const CHECKS: { key: keyof ProductRoutability; label: string; fix: string }[] = [
  { key: 'pricingReady', label: 'Цена указана', fix: 'Добавьте цену в карточке товара.' },
  { key: 'policyReady', label: 'Правила аренды заданы', fix: 'Заполните правила: отмена, залог, запас времени.' },
  { key: 'inventoryReady', label: 'Есть в наличии', fix: 'Укажите количество больше нуля.' },
  { key: 'resolutionReady', label: 'Пункт проката выбран', fix: 'Укажите, откуда клиент забирает снаряжение.' },
  { key: 'capabilityValid', label: 'Категория заполнена', fix: 'Заполните обязательные характеристики категории.' },
];

/**
 * Why a product does or does not take bookings. The API answers with a flag per facet and issues
 * in plain words; this shows the failures first, because a seller opens this only when something
 * is wrong.
 */
export function ProductReadinessCard({ routability }: { routability: ProductRoutability | null }) {
  if (!routability) {
    return (
      <SettingsCard title="Готовность к продаже" description="Проверка платформы.">
        <p className="text-sm text-gray-500">Проверка пока не выполнялась.</p>
      </SettingsCard>
    );
  }

  const failing = CHECKS.filter(check => routability[check.key] === false);
  const passing = CHECKS.filter(check => routability[check.key] === true);

  return (
    <SettingsCard
      title="Готовность к продаже"
      description={
        routability.routable
          ? 'Товар можно бронировать.'
          : 'Пока клиенты не смогут забронировать этот товар.'
      }
    >
      {failing.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-emerald-700">
          <Check size={15} /> Всё готово — блокеров нет.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {failing.map(check => (
            <li key={String(check.key)} className="flex items-start gap-2">
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-600" />
              <span>
                <span className="block text-sm font-medium text-gray-950">{check.label}</span>
                <span className="block text-xs leading-5 text-gray-500">{check.fix}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {routability.issues.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-gray-100 pt-3">
          {routability.issues.map((issue, index) => (
            <li key={index} className="text-xs leading-5 text-gray-600">{issue.message || issue.code}</li>
          ))}
        </ul>
      )}

      {passing.length > 0 && failing.length > 0 && (
        <p className="mt-3 flex items-center gap-1.5 border-t border-gray-100 pt-3 text-xs text-gray-500">
          <CircleDashed size={13} /> Готово: {passing.map(check => check.label.toLowerCase()).join(', ')}.
        </p>
      )}
    </SettingsCard>
  );
}
