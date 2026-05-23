import { SafeArea } from '@affine/component';
import { NotificationCountService } from '@affine/core/modules/notification';
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
  label: string;
}

const MENU_ITEMS: readonly MobileHomeMenuItem[] = [
  { id: 'home', icon: <HomeIcon />, label: 'Home' },
  { id: 'chats', icon: <ChatPanelIcon />, label: 'Chats' },
  { id: 'meetings', icon: <TodayIcon />, label: 'Meetings' },
  { id: 'inbox', icon: <InboxIcon />, label: 'Inbox' },
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
  const notificationCountService = useService(NotificationCountService);
  const notificationCount = useLiveData(notificationCountService.count$);

  return (
    <SafeArea top className={styles.root}>
      <div className={styles.headerRow}>
        <WorkspaceSelector className={styles.workspaceChip} compact />
        <nav className={styles.menuRail} aria-label="Home menu">
          {MENU_ITEMS.map(item => {
            const isActive = item.id === activeMenu;
            const showInboxDot = item.id === 'inbox' && notificationCount > 0;
            return (
              <button
                key={item.id}
                className={styles.menuButton}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                aria-label={item.label}
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
                <span className={styles.menuLabel}>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </SafeArea>
  );
};
