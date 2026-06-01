import { SafeArea } from '@affine/component';
import { NotificationCountService } from '@affine/core/modules/notification';
import { useI18n } from '@affine/i18n';
import {
  ChatPanelIcon,
  HomeIcon,
  InboxIcon,
  TodayIcon,
} from '@blocksuite/icons/rc';
import { useLiveData, useService } from '@toeverything/infra';
import type { ReactElement } from 'react';

import { WorkspaceSelector } from '../../components';
import * as styles from './styles.css';

export type MobileHomeMenu = 'home' | 'chats' | 'meetings' | 'inbox';

interface MobileHomeMenuItem {
  id: MobileHomeMenu;
  icon: ReactElement;
}

const MENU_ITEMS: readonly MobileHomeMenuItem[] = [
  { id: 'home', icon: <HomeIcon /> },
  { id: 'chats', icon: <ChatPanelIcon /> },
  { id: 'meetings', icon: <TodayIcon /> },
  { id: 'inbox', icon: <InboxIcon /> },
];

interface HomeHeaderProps {
  activeMenu?: MobileHomeMenu;
  onMenuChange?: (menu: MobileHomeMenu) => void;
}

/**
 * Contains the mobile workspace identity and top-level account actions.
 */
export const HomeHeader = ({
  activeMenu = 'home',
  onMenuChange,
}: HomeHeaderProps) => {
  const t = useI18n();
  const notificationCountService = useService(NotificationCountService);
  const notificationCount = useLiveData(notificationCountService.count$);

  const menuLabels: Record<MobileHomeMenu, string> = {
    home: t['com.manut.mobile.menu.home'](),
    chats: t['com.manut.mobile.menu.chats'](),
    meetings: t['com.manut.mobile.menu.calendar'](),
    inbox: t['com.manut.mobile.menu.inbox'](),
  };

  return (
    <SafeArea top className={styles.root}>
      <div className={styles.headerRow}>
        <WorkspaceSelector className={styles.workspaceChip} compact />
        <nav
          className={styles.menuRail}
          aria-label={t['com.manut.mobile.menu.nav']()}
        >
          {MENU_ITEMS.map(item => {
            const isActive = item.id === activeMenu;
            const showInboxDot = item.id === 'inbox' && notificationCount > 0;
            const label = menuLabels[item.id];
            // P10 a11y — fold the unread count into the Inbox button's
            // accessible name (mirrors desktop tab-strip); the dot stays
            // decorative / aria-hidden.
            const ariaLabel =
              showInboxDot && item.id === 'inbox'
                ? t['com.manut.mobile.menu.inboxUnread']({
                    count:
                      notificationCount > 99 ? '99+' : `${notificationCount}`,
                  })
                : label;
            return (
              <button
                key={item.id}
                className={styles.menuButton}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                aria-label={ariaLabel}
                data-active={isActive ? 'true' : 'false'}
                data-testid={`mobile-home-menu-${item.id}`}
                onClick={() => onMenuChange?.(item.id)}
              >
                <span className={styles.menuIcon}>
                  {item.icon}
                  {showInboxDot ? (
                    <span
                      className={styles.notificationBadge}
                      aria-hidden="true"
                    />
                  ) : null}
                </span>
                <span className={styles.menuLabel}>{label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </SafeArea>
  );
};
