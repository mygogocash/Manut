import { LiveData, useLiveData, useService } from '@toeverything/infra';
import { useCallback, useMemo } from 'react';

import { GlobalStateService } from '../../modules/storage';
import { WorkspaceService } from '../../modules/workspace';
import {
  isSidebarSectionKey,
  legacyHiddenSectionsStorageKeyFor,
  moveSidebarMenuItem,
  normalizeSidebarMenuPreferences,
  type SidebarMenuItemKey,
  type SidebarMenuPreferences,
  sidebarMenuStorageKeyFor,
  type SidebarSectionKey,
  toggleSidebarMenuItem,
} from './sidebar-menu-customization';

/**
 * Reactive accessor for the per-workspace menu customization. Stored as a
 * JSON-serialisable object in `GlobalState`; legacy hidden-section storage is
 * read as a fallback so existing section visibility choices still apply.
 */
export function useSidebarMenuPreferences(): {
  preferences: Required<SidebarMenuPreferences>;
  hidden: ReadonlySet<SidebarMenuItemKey>;
  toggle: (key: SidebarMenuItemKey) => void;
  move: (key: SidebarMenuItemKey, direction: 'up' | 'down') => void;
} {
  const globalStateService = useService(GlobalStateService);
  const workspaceService = useService(WorkspaceService);
  const workspaceId = workspaceService.workspace.id;
  const storageKey = sidebarMenuStorageKeyFor(workspaceId);
  const legacyStorageKey = legacyHiddenSectionsStorageKeyFor(workspaceId);

  const preferences$ = useMemo(
    () =>
      LiveData.from<SidebarMenuPreferences | undefined>(
        globalStateService.globalState.watch<SidebarMenuPreferences>(
          storageKey
        ),
        undefined
      ),
    [globalStateService, storageKey]
  );
  const legacyHidden$ = useMemo(
    () =>
      LiveData.from<string[] | undefined>(
        globalStateService.globalState.watch<string[]>(legacyStorageKey),
        undefined
      ),
    [globalStateService, legacyStorageKey]
  );
  const rawPreferences = useLiveData(preferences$);
  const legacyHidden = useLiveData(legacyHidden$);

  const preferences = useMemo(
    () =>
      normalizeSidebarMenuPreferences(
        rawPreferences ??
          (legacyHidden?.length
            ? { hidden: legacyHidden as SidebarMenuItemKey[] }
            : undefined)
      ),
    [legacyHidden, rawPreferences]
  );
  const hidden: ReadonlySet<SidebarMenuItemKey> = useMemo(
    () => new Set(preferences.hidden),
    [preferences.hidden]
  );

  const toggle = useCallback(
    (key: SidebarMenuItemKey) => {
      const stored =
        globalStateService.globalState.get<SidebarMenuPreferences>(storageKey);
      globalStateService.globalState.set(
        storageKey,
        toggleSidebarMenuItem(stored, key)
      );
    },
    [globalStateService, storageKey]
  );

  const move = useCallback(
    (key: SidebarMenuItemKey, direction: 'up' | 'down') => {
      const stored =
        globalStateService.globalState.get<SidebarMenuPreferences>(storageKey);
      globalStateService.globalState.set(
        storageKey,
        moveSidebarMenuItem(stored, key, direction)
      );
    },
    [globalStateService, storageKey]
  );

  return { preferences, hidden, toggle, move };
}

export function useHiddenSections(): {
  hidden: ReadonlySet<SidebarSectionKey>;
  toggle: (key: SidebarSectionKey) => void;
} {
  const { hidden, toggle } = useSidebarMenuPreferences();
  const sections = useMemo(
    () =>
      new Set(
        [...hidden].filter((key): key is SidebarSectionKey =>
          isSidebarSectionKey(key)
        )
      ),
    [hidden]
  );

  return { hidden: sections, toggle };
}
