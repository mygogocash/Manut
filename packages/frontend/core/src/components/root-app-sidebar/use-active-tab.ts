import { LiveData, useLiveData, useService } from '@toeverything/infra';
import { useCallback, useMemo } from 'react';

import { GlobalStateService } from '../../modules/storage';
import { WorkspaceService } from '../../modules/workspace';

// Sidebar tab union — every quick action owns the sidebar body. Search uses an
// inline CMDK surface instead of opening the global modal overlay.
export type SidebarTab = 'home' | 'chat' | 'meetings' | 'inbox' | 'search';

const DEFAULT_TAB: SidebarTab = 'home';

const ALLOWED_TABS: ReadonlySet<SidebarTab> = new Set<SidebarTab>([
  'home',
  'chat',
  'meetings',
  'inbox',
  'search',
]);

function isSidebarTab(value: unknown): value is SidebarTab {
  return typeof value === 'string' && ALLOWED_TABS.has(value as SidebarTab);
}

export interface UseActiveTabResult {
  activeTab: SidebarTab;
  setActiveTab: (tab: SidebarTab) => void;
}

/**
 * Reactive accessor for the sidebar's active tab. Persisted in `GlobalState`
 * under the workspace-scoped key `sidebar.activeTab.${workspaceId}` so each
 * workspace remembers its last-opened tab independently. Default: `'home'`.
 *
 * Every tab swaps the sidebar body; Search renders an inline CMDK instance
 * that is scoped to the sidebar.
 */
export function useActiveTab(): UseActiveTabResult {
  const globalStateService = useService(GlobalStateService);
  const workspaceService = useService(WorkspaceService);
  const workspaceId = workspaceService.workspace.id;
  const storageKey = `sidebar.activeTab.${workspaceId}`;

  // `globalState.watch<T>()` emits `T | undefined` (undefined before any
  // value lands, so we widen the LiveData generic and coerce to the
  // valid union via `isSidebarTab`. Matches the pattern used by
  // `AIToolsConfigService` in `modules/ai-button/services/tools-config.ts`.
  const tab$ = useMemo(
    () =>
      LiveData.from<SidebarTab | undefined>(
        globalStateService.globalState.watch<SidebarTab>(storageKey),
        undefined
      ),
    [globalStateService, storageKey]
  );

  const rawActive = useLiveData(tab$);
  const activeTab: SidebarTab = isSidebarTab(rawActive)
    ? rawActive
    : DEFAULT_TAB;

  const setActiveTab = useCallback(
    (tab: SidebarTab) => {
      globalStateService.globalState.set(storageKey, tab);
    },
    [globalStateService, storageKey]
  );

  return { activeTab, setActiveTab };
}
