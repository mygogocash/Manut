import type { SidebarTab } from './use-active-tab';

export type SidebarTabButton = SidebarTab | 'search';

export interface SidebarTabClickAction {
  nextActiveTab: SidebarTab;
  openQuickSearch: boolean;
}

export function resolveSidebarTabClick(
  activeTab: SidebarTab,
  targetTab: SidebarTabButton
): SidebarTabClickAction {
  if (targetTab === 'search') {
    return {
      nextActiveTab: activeTab,
      openQuickSearch: true,
    };
  }

  return {
    nextActiveTab: targetTab,
    openQuickSearch: false,
  };
}
