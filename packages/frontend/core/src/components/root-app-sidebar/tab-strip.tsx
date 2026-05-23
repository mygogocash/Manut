import { NotificationCountService } from '@affine/core/modules/notification';
import { CMDKQuickSearchService } from '@affine/core/modules/quicksearch/services/cmdk';
import { trackEvent } from '@affine/core/modules/telemetry';
import {
  ChatPanelIcon,
  HomeIcon,
  InboxIcon,
  SearchIcon,
  TodayIcon,
} from '@blocksuite/icons/rc';
import { useLiveData, useService } from '@toeverything/infra';
import type { ReactElement, ReactNode } from 'react';

import { tabBadgeDot, tabButton, tabStripRoot } from './tab-strip.css';
import {
  resolveSidebarTabClick,
  type SidebarTabButton,
} from './tab-strip-behavior';
import { useActiveTab } from './use-active-tab';

interface TabDescriptor {
  id: SidebarTabButton;
  label: string;
  icon: ReactNode;
}

const TABS: readonly TabDescriptor[] = [
  { id: 'home', label: 'Home', icon: <HomeIcon /> },
  { id: 'chat', label: 'Chat', icon: <ChatPanelIcon /> },
  { id: 'meetings', label: 'Calendar', icon: <TodayIcon /> },
  { id: 'inbox', label: 'Inbox', icon: <InboxIcon /> },
  { id: 'search', label: 'Search', icon: <SearchIcon /> },
];

/**
 * Five-icon tab strip for the sidebar quick actions. Each icon swaps the
 * active tab globalState so the related menu renders inside the sidebar body.
 * Search is the exception: it opens the global Notion-style CMDK modal.
 */
export function TabStrip(): ReactElement {
  const { activeTab, setActiveTab } = useActiveTab();
  const cMDKQuickSearchService = useService(CMDKQuickSearchService);
  // Inbox tab decoration — show a small red dot when there are unread
  // notifications. `count$` is a `LiveData<number>` that the service polls
  // every 30s + revalidates on focus/server-start; `useLiveData` keeps the
  // dot in sync without imperative subscriptions. Finnish notation `$` is
  // required on the Observable-typed member (rxjs/finnish — CLAUDE.md §6).
  const notificationCountService = useService(NotificationCountService);
  const notificationCount = useLiveData(notificationCountService.count$);

  return (
    <div
      className={tabStripRoot}
      role="tablist"
      aria-label="Sidebar navigation"
      data-testid="sidebar-tab-strip"
    >
      {TABS.map(({ id, label, icon }) => {
        const isActive = id !== 'search' && id === activeTab;
        const showInboxDot = id === 'inbox' && notificationCount > 0;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-label={
              showInboxDot
                ? `${label} (${notificationCount > 99 ? '99+' : notificationCount} unread)`
                : label
            }
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
              const action = resolveSidebarTabClick(activeTab, id);
              if (action.openQuickSearch) {
                cMDKQuickSearchService.toggle();
              }
              setActiveTab(action.nextActiveTab);
            }}
          >
            {icon}
            {showInboxDot ? (
              <span
                className={tabBadgeDot}
                data-testid="sidebar-tab-inbox-dot"
                aria-hidden="true"
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
