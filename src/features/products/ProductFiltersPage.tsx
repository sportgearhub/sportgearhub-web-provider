import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { locationsApi, productCategoriesApi } from '../../lib/api-client';
import type { ProductCategory, ProviderLocation } from '../../types';
import {
  EMPTY_FILTERS,
  SORTS,
  countActive,
  setCatalogueFilters,
  useCatalogueFilters,
  type Availability,
  type CatalogueFilters,
} from './catalogueFilters';

const AVAILABILITY: { value: Availability; label: string }[] = [
  { value: 'any', label: 'Любое' },
  { value: 'in_stock', label: 'В наличии' },
  { value: 'out', label: 'Нет в наличии' },
];

/**
 * The filters, as a screen rather than a menu.
 *
 * Column menus are a desktop idea: they need a pointer and a table to hang off. On a phone the
 * same job is a page you go to and come back from — everything legible at once, scrolled with a
 * thumb, and nothing applied until the bar at the bottom says so. Only the fields the endpoint's
 * RSQL profile allows are offered, because an unlisted one is a 400 naming it, not a filter that
 * quietly does nothing.
 */
export function ProductFiltersPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const applied = useCatalogueFilters();
  const [draft, setDraft] = useState<CatalogueFilters>(applied);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [locations, setLocations] = useState<ProviderLocation[]>([]);

  useEffect(() => {
    let cancelled = false;
    productCategoriesApi.list()
      .then(next => { if (!cancelled) setCategories(next); })
      .catch(() => { /* a filter with nothing to offer is left out below */ });
    locationsApi.list()
      .then(next => { if (!cancelled) setLocations(next); })
      .catch(() => { /* same */ });
    return () => { cancelled = true; };
  }, []);

  const toggle = (key: 'categoryIds' | 'locationIds', id: string) =>
    setDraft(current => ({
      ...current,
      [key]: current[key].includes(id) ? current[key].filter(item => item !== id) : [...current[key], id],
    }));

  const apply = () => {
    setCatalogueFilters(draft);
    onNavigate('/products');
  };

  const active = countActive(draft);

  return (
    // Slides in from the right, the way a phone opens the thing underneath what you tapped.
    <div className="flex min-h-0 flex-1 animate-in flex-col duration-200 slide-in-from-right-4">
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6 pt-3">
        <div className="space-y-3">
          <Section title="Сортировка">
            {SORTS.map(option => (
              <Row
                key={option.value}
                label={option.label}
                chosen={draft.sort === option.value}
                radio
                onClick={() => setDraft(current => ({ ...current, sort: option.value }))}
              />
            ))}
          </Section>

          <Section title="Наличие">
            {AVAILABILITY.map(option => (
              <Row
                key={option.value}
                label={option.label}
                chosen={draft.availability === option.value}
                radio
                onClick={() => setDraft(current => ({ ...current, availability: option.value }))}
              />
            ))}
          </Section>

          {categories.length > 0 && (
            <Section title="Категория" note="Можно выбрать несколько">
              {categories.map(category => (
                <Row
                  key={category.categoryId}
                  label={category.name}
                  chosen={draft.categoryIds.includes(category.categoryId)}
                  onClick={() => toggle('categoryIds', category.categoryId)}
                />
              ))}
            </Section>
          )}

          {locations.length > 0 && (
            <Section title="Пункт выдачи" note="Можно выбрать несколько">
              {locations.map(location => (
                <Row
                  key={location.locationId}
                  label={location.name}
                  note={location.address}
                  chosen={draft.locationIds.includes(location.locationId)}
                  onClick={() => toggle('locationIds', location.locationId)}
                />
              ))}
            </Section>
          )}
        </div>
      </div>

      {/* The bar that commits them. Nothing above it has changed the list yet. */}
      <div className="flex shrink-0 items-center gap-2 border-t border-gray-200 bg-white px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => setDraft({ ...EMPTY_FILTERS, sort: draft.sort })}
          disabled={active === 0}
          className="shrink-0 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-600 transition active:bg-gray-100 disabled:text-gray-300"
        >
          Сбросить
        </button>
        <Button variant="primary" onClick={apply} className="h-11 min-w-0 flex-1 justify-center">
          Применить{active > 0 ? ` · ${active}` : ''}
        </Button>
      </div>
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl bg-white">
      <div className="px-4 pb-1 pt-3">
        <p className="text-sm font-semibold text-gray-950">{title}</p>
        {note && <p className="mt-0.5 text-xs text-gray-500">{note}</p>}
      </div>
      <ul className="divide-y divide-gray-100 border-t border-gray-100">{children}</ul>
    </section>
  );
}

function Row({
  label,
  note,
  chosen,
  radio,
  onClick,
}: {
  label: string;
  note?: string;
  chosen: boolean;
  /** One of the set, rather than any number of them. */
  radio?: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition active:bg-gray-50"
      >
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-sm ${chosen ? 'font-medium text-gray-950' : 'text-gray-800'}`}>
            {label}
          </span>
          {note && <span className="mt-0.5 block truncate text-xs text-gray-500">{note}</span>}
        </span>
        {radio ? (
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
              chosen ? 'border-blue-600' : 'border-gray-300'
            }`}
          >
            {chosen && <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />}
          </span>
        ) : (
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition ${
              chosen ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300'
            }`}
          >
            {chosen && <Check size={13} strokeWidth={3} />}
          </span>
        )}
      </button>
    </li>
  );
}
