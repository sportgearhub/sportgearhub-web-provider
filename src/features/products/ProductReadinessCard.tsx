import { AlertTriangle, Check } from 'lucide-react';
import { SettingsCard } from '../../components/layout/SettingsCard';
import type { ProductSection } from '../../types';

/**
 * What is still missing before the card can be sent for review.
 *
 * The API decides this and says it in finished Russian: one entry per part of the card, with
 * `is_complete` and a `missing` sentence. It is rendered as sent rather than re-derived from flags
 * here — this is the same computation `submit-for-review` runs, and a checklist that disagrees
 * with the endpoint refusing the card is worse than no checklist at all.
 */
export function ProductReadinessCard({ sections }: { sections: ProductSection[] }) {
  if (sections.length === 0) {
    return (
      <SettingsCard title="Готовность к продаже" description="Проверка платформы.">
        <p className="text-sm text-gray-500">Проверка пока не выполнялась.</p>
      </SettingsCard>
    );
  }

  const missing = sections.filter(section => !section.isComplete);
  const done = sections.length - missing.length;

  return (
    <SettingsCard
      title="Готовность к продаже"
      description={
        missing.length === 0
          ? 'Карточку можно отправить на проверку.'
          : `Заполнено ${done} из ${sections.length}.`
      }
    >
      {missing.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-emerald-700">
          <Check size={15} /> Всё заполнено.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {missing.map(section => (
            <li key={section.key} className="flex items-start gap-2">
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-600" />
              <span>
                <span className="block text-sm font-medium text-gray-950">{section.title}</span>
                {section.missing && (
                  <span className="block text-xs leading-5 text-gray-500">{section.missing}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {missing.length > 0 && done > 0 && (
        <p className="mt-3 flex items-center gap-1.5 border-t border-gray-100 pt-3 text-xs text-gray-500">
          <Check size={13} className="text-emerald-600" />
          Готово: {sections.filter(section => section.isComplete).map(section => section.title.toLowerCase()).join(', ')}.
        </p>
      )}
    </SettingsCard>
  );
}
