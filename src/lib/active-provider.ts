/**
 * Which provider the console is showing. The URL is the source of truth (`/providers/:providerId/…`);
 * the console layout copies the route value here once, so the API client can build scoped URLs
 * without every call site threading an id through.
 */
let activeProviderId: string | null = null;

const LAST_PROVIDER_KEY = 'sportgearhub.provider.last';

export function setActiveProviderId(providerId: string | null) {
  activeProviderId = providerId;
  if (providerId) rememberProvider(providerId);
}

export function getActiveProviderId(): string {
  if (!activeProviderId) {
    throw new Error('No active provider: the call happened outside a /providers/:providerId route.');
  }
  return activeProviderId;
}

export function providerUrl(path: string) {
  return `/api/v1/providers/${encodeURIComponent(getActiveProviderId())}${path}`;
}

/** Remembered per device, never per account: two people sharing a shop laptop must not inherit each other's cabinet. */
export function rememberProvider(providerId: string) {
  try {
    localStorage.setItem(LAST_PROVIDER_KEY, providerId);
  } catch {
    // Storage may be unavailable (private mode); the picker simply shows the list.
  }
}

export function lastProviderId(): string | null {
  try {
    return localStorage.getItem(LAST_PROVIDER_KEY);
  } catch {
    return null;
  }
}
