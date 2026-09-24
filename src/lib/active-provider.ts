import { useSyncExternalStore } from 'react';

/**
 * Which cabinet the console is showing. Like Ozon Seller, the URL does not carry it: the choice
 * lives on this device (localStorage) and every scoped API call reads it from here. Remembered
 * per device, never per account — two people sharing a shop laptop must not inherit each other's
 * cabinet, so sign-out clears it.
 */
const SELECTED_KEY = 'sportgearhub.provider.selected';
const listeners = new Set<() => void>();

function read(): string | null {
  try {
    return localStorage.getItem(SELECTED_KEY);
  } catch {
    return null;
  }
}

function write(providerId: string | null) {
  try {
    if (providerId) localStorage.setItem(SELECTED_KEY, providerId);
    else localStorage.removeItem(SELECTED_KEY);
  } catch {
    // Storage may be unavailable (private mode); the in-memory value still serves this tab.
  }
}

let selected: string | null = read();

export function selectedProviderId(): string | null {
  return selected;
}

export function selectProvider(providerId: string) {
  if (selected === providerId) return;
  selected = providerId;
  write(providerId);
  listeners.forEach(listener => listener());
}

export function clearSelectedProvider() {
  if (selected === null) return;
  selected = null;
  write(null);
  listeners.forEach(listener => listener());
}

/** Re-renders when the selection changes, so the layout follows a switch without a reload. */
export function useSelectedProviderId(): string | null {
  return useSyncExternalStore(
    listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    selectedProviderId,
    selectedProviderId
  );
}

export function getActiveProviderId(): string {
  if (!selected) {
    throw new Error('No cabinet is selected: scoped API calls are only possible inside the console.');
  }
  return selected;
}

export function providerUrl(path: string) {
  return `/api/v1/providers/${encodeURIComponent(getActiveProviderId())}${path}`;
}
