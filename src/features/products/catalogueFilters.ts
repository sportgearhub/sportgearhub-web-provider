import { useSyncExternalStore } from 'react';

/**
 * What the filters screen chose, kept outside the catalogue.
 *
 * The screen that edits them is a route of its own, so the two components never share a parent
 * that could hold this: a module store is what is left, and it is enough — one value, a set of
 * listeners, and `useSyncExternalStore` to read it without tearing. It is deliberately not in the
 * URL. These are a seller's working preferences on one device, not something to link to, and the
 * catalogue already keeps its columns and page size the same way.
 */
export type Availability = 'any' | 'in_stock' | 'out';

/** The field names the endpoint's RSQL profile allows for ordering, with how to say them. */
export const SORTS = [
  { value: '-updated_at', label: 'Сначала изменённые' },
  { value: '-created_at', label: 'Сначала новые' },
  { value: 'created_at', label: 'Сначала старые' },
  { value: 'title', label: 'По названию, А–Я' },
  { value: '-title', label: 'По названию, Я–А' },
  { value: 'quantity', label: 'Сначала где мало' },
  { value: '-quantity', label: 'Сначала где много' },
] as const;

export type CatalogueFilters = {
  categoryIds: string[];
  locationIds: string[];
  availability: Availability;
  /** The `sort` parameter itself, since on a phone this screen is the only thing that sets it. */
  sort: string;
};

export const EMPTY_FILTERS: CatalogueFilters = {
  categoryIds: [],
  locationIds: [],
  availability: 'any',
  sort: '-updated_at',
};

/** How many of them are doing something — the number on the badge beside the filter button. */
export function countActive(filters: CatalogueFilters) {
  return (
    (filters.categoryIds.length > 0 ? 1 : 0) +
    (filters.locationIds.length > 0 ? 1 : 0) +
    (filters.availability !== 'any' ? 1 : 0)
  );
}

/** The chosen filters as RSQL terms, each a field the endpoint's profile allows. */
export function filtersToRsql(filters: CatalogueFilters): string[] {
  const parts: string[] = [];
  if (filters.categoryIds.length > 0) parts.push(`category_id=in=(${filters.categoryIds.join(',')})`);
  if (filters.locationIds.length > 0) {
    parts.push(`fulfillment_location_id=in=(${filters.locationIds.join(',')})`);
  }
  if (filters.availability === 'in_stock') parts.push('quantity>0');
  if (filters.availability === 'out') parts.push('quantity==0');
  return parts;
}

let current: CatalogueFilters = EMPTY_FILTERS;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useCatalogueFilters() {
  return useSyncExternalStore(subscribe, () => current);
}

export function setCatalogueFilters(next: CatalogueFilters) {
  current = next;
  listeners.forEach(listener => listener());
}
