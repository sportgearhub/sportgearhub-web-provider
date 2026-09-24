import { createContext, useContext, type ReactNode } from 'react';
import type { ProviderSummary } from '../../types';

/** The cabinet the console is showing — the route's provider, as /auth/me described it. */
export const ProviderContext = createContext<ProviderSummary | null>(null);

export function ProviderContextProvider({ provider, children }: { provider: ProviderSummary; children: ReactNode }) {
  return <ProviderContext.Provider value={provider}>{children}</ProviderContext.Provider>;
}

export function useProvider(): ProviderSummary {
  const provider = useContext(ProviderContext);
  if (!provider) throw new Error('useProvider must be used inside a /providers/:providerId route.');
  return provider;
}
