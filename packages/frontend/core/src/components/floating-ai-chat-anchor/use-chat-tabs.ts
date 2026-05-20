import { GlobalStateService } from '@affine/core/modules/storage';
import { LiveData, useLiveData, useService } from '@toeverything/infra';
import { useCallback, useMemo } from 'react';

// Manut Wave 6 E2.5 — tabbed multi-chat in the floating AI chat panel.
//
// Persistence model:
//   - The ordered list of tab session ids lives at
//     `floatingChat.tabs.${workspaceId}` (string[]).
//   - The active tab id lives at
//     `floatingChat.activeTab.${workspaceId}` (string | null).
//   - Per-tab metadata (title, pinned doc id) is stored alongside under
//     `floatingChat.tabMeta.${workspaceId}.${sessionId}` so the strip
//     can render without round-tripping to the server every open.
//
// The reactive backing is `GlobalState.watch<T>()` (same pattern as
// `useActiveTab` in components/root-app-sidebar). The hook does NOT
// own session creation directly — `onCreate` is a callback that the
// floating panel wires to its existing `createSession()` helper so we
// don't duplicate the GraphQL plumbing here.

export interface ChatTabSnapshot {
  id: string;
  title: string | null;
  pinnedDocId: string | null;
}

interface UseChatTabsArgs {
  workspaceId: string;
}

export interface UseChatTabsResult {
  tabs: readonly ChatTabSnapshot[];
  activeTabId: string | null;
  setActiveTabId: (id: string) => void;
  /** Adds a tab to the strip; caller is responsible for the actual chat-create round-trip. */
  registerTab: (
    snapshot: ChatTabSnapshot,
    options?: { activate?: boolean }
  ) => void;
  /** Removes a tab. If the closed tab was active, hands focus to its neighbor. */
  removeTab: (id: string) => string | null;
  /** Patches the metadata for an existing tab (title / pinnedDocId). No-op for unknown ids. */
  updateTab: (id: string, patch: Partial<Omit<ChatTabSnapshot, 'id'>>) => void;
}

interface StoredMeta {
  title: string | null;
  pinnedDocId: string | null;
}

const tabsKey = (workspaceId: string) => `floatingChat.tabs.${workspaceId}`;
const activeKey = (workspaceId: string) =>
  `floatingChat.activeTab.${workspaceId}`;
const metaKey = (workspaceId: string, sessionId: string) =>
  `floatingChat.tabMeta.${workspaceId}.${sessionId}`;

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(v => typeof v === 'string');
}

function isStoredMeta(value: unknown): value is StoredMeta {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as { title?: unknown; pinnedDocId?: unknown };
  const titleOk = v.title === null || typeof v.title === 'string';
  const pinnedOk = v.pinnedDocId === null || typeof v.pinnedDocId === 'string';
  return titleOk && pinnedOk;
}

/**
 * Reactive accessor for the floating chat's tab strip. Persists the
 * ordered tab list + active tab + per-tab snapshot under workspace-
 * scoped GlobalState keys so a reopened panel restores prior tabs.
 *
 * @remarks
 * Per CLAUDE.md React-19 manual-memo discipline, mutating callbacks
 * (`registerTab`, `removeTab`, `updateTab`, `setActiveTabId`) re-read
 * the current persisted list inside the callback body rather than
 * closing over stale snapshot state. That keeps the deps array small
 * AND avoids "remove the tab I deleted three renders ago" bugs.
 */
export function useChatTabs({
  workspaceId,
}: UseChatTabsArgs): UseChatTabsResult {
  const globalStateService = useService(GlobalStateService);
  const globalState = globalStateService.globalState;

  const tabsStorageKey = tabsKey(workspaceId);
  const activeStorageKey = activeKey(workspaceId);

  // LiveData mirrors of the persisted keys.
  const tabIds$ = useMemo(
    () =>
      LiveData.from<string[] | undefined>(
        globalState.watch<string[]>(tabsStorageKey),
        undefined
      ),
    [globalState, tabsStorageKey]
  );
  const activeId$ = useMemo(
    () =>
      LiveData.from<string | null | undefined>(
        globalState.watch<string | null>(activeStorageKey),
        undefined
      ),
    [globalState, activeStorageKey]
  );

  const rawTabIds = useLiveData(tabIds$);
  const rawActiveId = useLiveData(activeId$);

  // Memoise the validated id list using a stable join-key so identical
  // contents don't churn `useMemo` deps every render. Without this the
  // `snapshots$` useMemo below would re-create its LiveData.computed
  // on each render (the array identity changes even when contents do
  // not), busting the snapshots cache.
  const tabIdsKey = isStringArray(rawTabIds) ? rawTabIds.join('|') : '';
  const tabIds = useMemo(
    () => (tabIdsKey ? tabIdsKey.split('|') : []),
    [tabIdsKey]
  );

  // Materialise tab snapshots from the per-tab meta blobs. We use a
  // fresh `LiveData.computed` instance keyed on the current id list so
  // changes to any single tab's meta propagate through React renders.
  // Note: `LiveData.computed`'s `get` only accepts LiveData, so wrap
  // each per-tab GlobalState watch through `LiveData.from(observable,
  // undefined)` before passing it in. (Same wrapping pattern used by
  // `useActiveTab` for the activeTab key.)
  const snapshots$ = useMemo(
    () =>
      LiveData.computed(get => {
        return tabIds.map<ChatTabSnapshot>(id => {
          const meta$ = LiveData.from<StoredMeta | undefined>(
            globalState.watch<StoredMeta>(metaKey(workspaceId, id)),
            undefined
          );
          const meta = get(meta$);
          if (isStoredMeta(meta)) {
            return { id, title: meta.title, pinnedDocId: meta.pinnedDocId };
          }
          return { id, title: null, pinnedDocId: null };
        });
      }),
    [globalState, tabIds, workspaceId]
  );

  const tabs = useLiveData(snapshots$);

  // Active id falls back to the first tab when nothing is persisted.
  // Use `=== undefined` so an explicit `null` (e.g. last tab removed)
  // still resolves to "no active tab" rather than auto-promoting.
  const activeTabId =
    rawActiveId === undefined
      ? (tabIds[0] ?? null)
      : (rawActiveId as string | null);

  const setActiveTabId = useCallback(
    (id: string) => {
      globalState.set(activeStorageKey, id);
    },
    [globalState, activeStorageKey]
  );

  const registerTab = useCallback(
    (snapshot: ChatTabSnapshot, options?: { activate?: boolean }) => {
      // Read current list fresh inside the callback (R19 preserve-manual-
      // memo discipline — see CLAUDE.md hook scars). Stale closure here
      // would drop concurrent registers.
      const current = globalState.get<string[]>(tabsStorageKey) ?? [];
      const next = current.includes(snapshot.id)
        ? current
        : [...current, snapshot.id];
      globalState.set(tabsStorageKey, next);
      globalState.set<StoredMeta>(metaKey(workspaceId, snapshot.id), {
        title: snapshot.title,
        pinnedDocId: snapshot.pinnedDocId,
      });
      if (options?.activate !== false) {
        globalState.set(activeStorageKey, snapshot.id);
      }
    },
    [globalState, tabsStorageKey, activeStorageKey, workspaceId]
  );

  const removeTab = useCallback(
    (id: string): string | null => {
      const current = globalState.get<string[]>(tabsStorageKey) ?? [];
      const idx = current.indexOf(id);
      if (idx < 0) return null;
      const next = current.filter(v => v !== id);
      globalState.set(tabsStorageKey, next);
      // Clear per-tab metadata so we don't leak GlobalState rows for
      // removed sessions.
      globalState.del(metaKey(workspaceId, id));
      // If the closed tab was active, hand focus to the neighbor —
      // prefer the tab to the right, fall back to the left, then null.
      const wasActive = globalState.get<string | null>(activeStorageKey) === id;
      if (wasActive) {
        const successor = next[idx] ?? next[idx - 1] ?? null;
        globalState.set(activeStorageKey, successor);
        return successor;
      }
      return null;
    },
    [globalState, tabsStorageKey, activeStorageKey, workspaceId]
  );

  const updateTab = useCallback(
    (id: string, patch: Partial<Omit<ChatTabSnapshot, 'id'>>) => {
      const stored = globalState.get<StoredMeta>(metaKey(workspaceId, id));
      const base: StoredMeta = isStoredMeta(stored)
        ? stored
        : { title: null, pinnedDocId: null };
      const merged: StoredMeta = {
        title: patch.title !== undefined ? patch.title : base.title,
        pinnedDocId:
          patch.pinnedDocId !== undefined
            ? patch.pinnedDocId
            : base.pinnedDocId,
      };
      globalState.set<StoredMeta>(metaKey(workspaceId, id), merged);
    },
    [globalState, workspaceId]
  );

  return {
    tabs,
    activeTabId,
    setActiveTabId,
    registerTab,
    removeTab,
    updateTab,
  };
}
