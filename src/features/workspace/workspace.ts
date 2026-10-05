import { createContext, useContext } from 'react';

/**
 * The two businesses a seller can run from one cabinet.
 *
 * Прокат rents a thing: stock, a pickup point, a card that is in sale or is not. Впечатления sell
 * a departure: a time, a guide, seats that fill up. They share a company, a payout account and a
 * legal party, and share almost nothing else — which is why this is a switch between workspaces
 * rather than another tab inside one.
 */
export type Workspace = 'rental' | 'experience';

export const WORKSPACE_STORAGE_KEY = 'sportgearhub.workspace';

export const workspaceMeta: Record<Workspace, { label: string; hint: string }> = {
  rental: { label: 'Прокат', hint: 'Снаряжение напрокат' },
  experience: { label: 'Впечатления', hint: 'Туры, занятия и экскурсии' },
};

export function readWorkspace(): Workspace {
  try {
    return localStorage.getItem(WORKSPACE_STORAGE_KEY) === 'experience' ? 'experience' : 'rental';
  } catch {
    return 'rental';
  }
}

export const WorkspaceContext = createContext<{
  workspace: Workspace;
  setWorkspace: (next: Workspace) => void;
}>({ workspace: 'rental', setWorkspace: () => {} });

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
