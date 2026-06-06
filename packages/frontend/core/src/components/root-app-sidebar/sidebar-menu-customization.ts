import type { ReactNode } from 'react';

export type SidebarMenuItemKey =
  | 'aiChat'
  | 'quickSearchAndNewDoc'
  | 'notifications'
  | 'allDocs'
  | 'graph'
  | 'analytics'
  | 'projects'
  | 'crm'
  | 'reminders'
  | 'routines'
  | 'releaseRuns'
  | 'journals'
  | 'agents'
  | 'favorites'
  | 'organize'
  | 'migrationFavorites'
  | 'tags'
  | 'collections'
  | 'trash'
  | 'import'
  | 'inviteMembers'
  | 'connectGithub'
  | 'templates'
  | 'learnMore'
  | 'newDoc'
  | 'downloadApp';

export type SidebarSectionKey =
  | 'favorites'
  | 'organize'
  | 'migrationFavorites'
  | 'tags'
  | 'collections';

export interface SidebarMenuPreferences {
  hidden?: SidebarMenuItemKey[];
  order?: SidebarMenuItemKey[];
}

export interface SidebarMenuItem<TValue = ReactNode> {
  key: SidebarMenuItemKey;
  value: TValue;
}

export const DEFAULT_SIDEBAR_MENU_ORDER: readonly SidebarMenuItemKey[] = [
  'aiChat',
  'quickSearchAndNewDoc',
  'notifications',
  'allDocs',
  'graph',
  'analytics',
  'projects',
  'crm',
  'reminders',
  'routines',
  'releaseRuns',
  'journals',
  'agents',
  'favorites',
  'organize',
  'migrationFavorites',
  'tags',
  'collections',
  'trash',
  'import',
  'inviteMembers',
  'connectGithub',
  'templates',
  'learnMore',
  'newDoc',
  'downloadApp',
];

export const SIDEBAR_SECTION_KEYS: readonly SidebarSectionKey[] = [
  'favorites',
  'organize',
  'migrationFavorites',
  'tags',
  'collections',
];

const SIDEBAR_MENU_KEY_SET = new Set<SidebarMenuItemKey>(
  DEFAULT_SIDEBAR_MENU_ORDER
);

export function isSidebarMenuItemKey(
  value: unknown
): value is SidebarMenuItemKey {
  return typeof value === 'string' && SIDEBAR_MENU_KEY_SET.has(value as never);
}

export function isSidebarSectionKey(
  value: unknown
): value is SidebarSectionKey {
  return (
    typeof value === 'string' &&
    (SIDEBAR_SECTION_KEYS as readonly string[]).includes(value)
  );
}

export function sidebarMenuStorageKeyFor(workspaceId: string): string {
  return `sidebar.menuPreferences.${workspaceId}`;
}

export function legacyHiddenSectionsStorageKeyFor(workspaceId: string): string {
  return `sidebar.hiddenSections.${workspaceId}`;
}

function uniqueValidKeys(values: unknown[] | undefined): SidebarMenuItemKey[] {
  const next: SidebarMenuItemKey[] = [];
  const seen = new Set<SidebarMenuItemKey>();

  for (const value of values ?? []) {
    if (!isSidebarMenuItemKey(value) || seen.has(value)) {
      continue;
    }
    seen.add(value);
    next.push(value);
  }

  return next;
}

export function normalizeSidebarMenuPreferences(
  preferences: SidebarMenuPreferences | undefined
): Required<SidebarMenuPreferences> {
  const hidden = uniqueValidKeys(preferences?.hidden);
  const order = uniqueValidKeys(preferences?.order);
  const orderSet = new Set(order);

  for (const key of DEFAULT_SIDEBAR_MENU_ORDER) {
    if (!orderSet.has(key)) {
      order.push(key);
    }
  }

  return { hidden, order };
}

export function toggleSidebarMenuItem(
  preferences: SidebarMenuPreferences | undefined,
  key: SidebarMenuItemKey
): Required<SidebarMenuPreferences> {
  const normalized = normalizeSidebarMenuPreferences(preferences);
  const hidden = new Set(normalized.hidden);

  if (hidden.has(key)) {
    hidden.delete(key);
  } else {
    hidden.add(key);
  }

  return {
    ...normalized,
    hidden: Array.from(hidden),
  };
}

export function moveSidebarMenuItem(
  preferences: SidebarMenuPreferences | undefined,
  key: SidebarMenuItemKey,
  direction: 'up' | 'down'
): Required<SidebarMenuPreferences> {
  const normalized = normalizeSidebarMenuPreferences(preferences);
  const order = [...normalized.order];
  const index = order.indexOf(key);
  const target = direction === 'up' ? index - 1 : index + 1;

  if (index < 0 || target < 0 || target >= order.length) {
    return normalized;
  }

  [order[index], order[target]] = [order[target], order[index]];

  return {
    ...normalized,
    order,
  };
}

export function getVisibleSidebarMenuItems<TValue>(
  items: readonly SidebarMenuItem<TValue>[],
  preferences: SidebarMenuPreferences | undefined
): SidebarMenuItem<TValue>[] {
  const normalized = normalizeSidebarMenuPreferences(preferences);
  const hidden = new Set(normalized.hidden);
  const byKey = new Map(items.map(item => [item.key, item]));
  const visible: SidebarMenuItem<TValue>[] = [];

  for (const key of normalized.order) {
    const item = byKey.get(key);
    if (item && !hidden.has(key)) {
      visible.push(item);
    }
  }

  return visible;
}
