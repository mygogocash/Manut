import { CMDKQuickSearchService } from '@affine/core/modules/quicksearch/services/cmdk';
import { trackEvent } from '@affine/core/modules/telemetry';
import {
  ChatPanelIcon,
  HomeIcon,
  InboxIcon,
  SearchIcon,
  TodayIcon,
} from '@blocksuite/icons/rc';
import { useService } from '@toeverything/infra';
import type { ReactElement, ReactNode } from 'react';
import { useCallback } from 'react';

import { tabButton, tabStripRoot } from './tab-strip.css';
import type { SidebarTab } from './use-active-tab';
import { useActiveTab } from './use-active-tab';

interface TabDescriptor {
  id: SidebarTab | 'search';
  label: string;
  icon: ReactNode;
}

const TABS: readonly TabDescriptor[] = [
  { id: 'home', label: 'Home', icon: <HomeIcon /> },
  { id: 'chat', label: 'Chat', icon: <ChatPanelIcon /> },
  { id: 'meetings', label: 'Meetings', icon: <TodayIcon /> },
  { id: 'inbox', label: 'Inbox', icon: <InboxIcon /> },
  { id: 'search', label: 'Search', icon: <SearchIcon /> },
];

/**
 * Five-icon tab strip at the top of the sidebar. Four of the icons swap
 * the active tab globalState — Search is an outlier that opens the CMDK
 * quick-search modal as an overlay and never owns the sidebar body. The
 * active tab is therefore preserved across Search interactions.
 */
export function TabStrip(): ReactElement {
  const { activeTab, setActiveTab } = useActiveTab();
  const cMDKQuickSearchService = useService(CMDKQuickSearchService);

  const openSearch = useCallback(() => {
    cMDKQuickSearchService.toggle();
  }, [cMDKQuickSearchService]);

  return (
    <div
      className={tabStripRoot}
      role="tablist"
      aria-label="Sidebar navigation"
      data-testid="sidebar-tab-strip"
    >
      {TABS.map(({ id, label, icon }) => {
        const isSearch = id === 'search';
        const isActive = !isSearch && id === activeTab;
        return (
          <button
            key={id}
            type="button"
            role={isSearch ? 'button' : 'tab'}
            aria-selected={isSearch ? undefined : isActive}
            aria-label={label}
            data-active={isActive ? 'true' : 'false'}
            data-testid={`sidebar-tab-${id}`}
            className={tabButton}
            onClick={() => {
              // M3 E3.5 — fire telemetry for every nav click so we can
              // measure which sidebar surfaces actually get used. `item`
              // mirrors the tab id; `tab` is the active strip name
              // ("sidebar") so downstream analytics can distinguish
              // this surface from future tab strips.
              trackEvent('sidebar_nav_clicked', { tab: 'sidebar', item: id });
              if (isSearch) {
                openSearch();
                return;
              }
              setActiveTab(id);
            }}
          >
            {icon}
          </button>
        );
      })}
    </div>
  );
}
