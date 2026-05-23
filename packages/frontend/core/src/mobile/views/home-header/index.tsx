import { Menu, SafeArea } from '@affine/component';
import { NotificationList } from '@affine/core/components/notification/list';
import { WorkspaceDialogService } from '@affine/core/modules/dialogs';
import { NotificationCountService } from '@affine/core/modules/notification';
import { MoreHorizontalIcon, NotificationIcon } from '@blocksuite/icons/rc';
import { useLiveData, useService } from '@toeverything/infra';
import { useCallback } from 'react';

import { WorkspaceSelector } from '../../components';
import * as styles from './styles.css';

/**
 * Contains the mobile workspace identity and top-level account actions.
 */
export const HomeHeader = () => {
  const workspaceDialogService = useService(WorkspaceDialogService);
  const notificationCountService = useService(NotificationCountService);
  const notificationCount = useLiveData(notificationCountService.count$);

  const openSetting = useCallback(() => {
    workspaceDialogService.open('setting', {
      activeTab: 'appearance',
    });
  }, [workspaceDialogService]);

  return (
    <SafeArea top className={styles.root}>
      <div className={styles.headerRow}>
        <WorkspaceSelector className={styles.workspaceChip} />
        <div className={styles.headerActions}>
          <Menu items={<NotificationList />}>
            <button
              className={styles.roundAction}
              type="button"
              aria-label="Open notifications"
            >
              <NotificationIcon width={24} height={24} />
              {notificationCount > 0 && (
                <span
                  className={styles.notificationBadge}
                  style={{
                    fontSize: notificationCount > 99 ? '8px' : '11px',
                  }}
                >
                  {notificationCount > 99 ? '99+' : notificationCount}
                </span>
              )}
            </button>
          </Menu>
          <button
            className={styles.roundAction}
            onClick={openSetting}
            type="button"
            aria-label="Open settings"
            data-testid="settings-button"
          >
            <MoreHorizontalIcon width={24} height={24} />
          </button>
        </div>
      </div>
    </SafeArea>
  );
};
