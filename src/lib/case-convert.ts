// The API speaks snake_case on the wire; this app speaks camelCase internally. Converting once at the
// HTTP boundary keeps every component and type untouched and leaves exactly one place to reason about.
//
// The important subtlety: some payload objects are keyed by DATA, not by contract field names — a locale
// map ({"ru-RU": "Лыжи"}), an attribute map ({"frame_size": "M"}). Renaming those keys corrupts the
// payload, so the fields holding them are listed below and their values are passed through untouched.
//
// The list is matched against the VALUE as well as the field name: `attributes` is a data-keyed map when
// a resource is written ({"frame_size": "M"}) but a contract-shaped array when one is read (the category
// attribute schema, a resource's stored values), and the array's items do need converting.
const DATA_KEYED_MAP_FIELDS = new Set([
  'titles',
  'labels',
  'helpTexts',
  'help_texts',
  'attributes',
]);

export function snakeToCamel(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

export function camelToSnake(key: string): string {
  return key.replace(/([A-Z])/g, (_, c: string) => `_${c.toLowerCase()}`);
}

function convert(value: unknown, mapKey: (key: string) => string): unknown {
  if (Array.isArray(value)) {
    return value.map(item => convert(item, mapKey));
  }

  if (value === null || typeof value !== 'object') {
    return value;
  }

  // Dates, Blobs, FormData and friends must survive untouched.
  if (Object.getPrototypeOf(value) !== Object.prototype) {
    return value;
  }

  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    out[mapKey(key)] = isDataKeyedMap(key, item)
      ? item
      : convert(item, mapKey);
  }
  return out;
}

function isDataKeyedMap(key: string, value: unknown) {
  return DATA_KEYED_MAP_FIELDS.has(key) && !Array.isArray(value);
}

/** Response bodies: snake_case wire shape -> camelCase app shape. */
export function keysToCamel<T>(value: unknown): T {
  return convert(value, snakeToCamel) as T;
}

/** Request bodies: camelCase app shape -> snake_case wire shape. */
export function keysToSnake(value: unknown): unknown {
  return convert(value, camelToSnake);
}
