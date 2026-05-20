import { MenuItem } from '@affine/component';
import { ServerService, UserFeatureService } from '@affine/core/modules/cloud';
import { WorkspaceDialogService } from '@affine/core/modules/dialogs';
import { useI18n } from '@affine/i18n';
import { track } from '@affine/track';
import {
  AccountIcon,
  AdminIcon,
  SettingsIcon,
  SignOutIcon,
} from '@blocksuite/icons/rc';
import { useLiveData, useService } from '@toeverything/infra';
import { useCallback, useEffect } from 'react';

import { useSignOut } from '../../hooks/affine/use-sign-out';

export const AccountMenu = () => {
  const workspaceDialogService = useService(WorkspaceDialogService);
  const openSignOutModal = useSignOut();
  const serverService = useService(ServerService);
  const userFeatureService = useService(UserFeatureService);
  const isAFFiNEAdmin = useLiveData(userFeatureService.userFeature.isAdmin$);

  const onOpenAccountSetting = useCallback(() => {
    track.$.navigationPanel.profileAndBadge.openSettings({ to: 'account' });
    workspaceDialogService.open('setting', {
      activeTab: 'account',
    });
  }, [workspaceDialogService]);

  // Mirrors the legacy sidebar Settings entry (decision #20). Lands on
  // the appearance tab to match what users saw when the trigger lived
  // in the sidebar's main flow.
  const onOpenSettings = useCallback(() => {
    track.$.navigationPanel.$.openSettings();
    workspaceDialogService.open('setting', {
      activeTab: 'appearance',
    });
  }, [workspaceDialogService]);

  const onOpenAdminPanel = useCallback(() => {
    window.open(`${serverService.server.baseUrl}/admin`, '_blank');
  }, [serverService.server.baseUrl]);

  const t = useI18n();

  useEffect(() => {
    userFeatureService.userFeature.revalidate();
  }, [userFeatureService]);

  return (
    <>
      <MenuItem
        prefixIcon={<AccountIcon />}
        data-testid="workspace-modal-account-settings-option"
        onClick={onOpenAccountSetting}
      >
        {t['com.affine.workspace.cloud.account.settings']()}
      </MenuItem>
      <MenuItem
        prefixIcon={<SettingsIcon />}
        data-testid="settings-modal-trigger"
        onClick={onOpenSettings}
      >
        {t['com.affine.settingSidebar.title']()}
      </MenuItem>
      {isAFFiNEAdmin ? (
        <MenuItem
          prefixIcon={<AdminIcon />}
          data-testid="workspace-modal-account-admin-option"
          onClick={onOpenAdminPanel}
        >
          {t['com.affine.workspace.cloud.account.admin']()}
        </MenuItem>
      ) : null}
      <MenuItem
        prefixIcon={<SignOutIcon />}
        data-testid="workspace-modal-sign-out-option"
        onClick={openSignOutModal}
      >
        {t['com.affine.workspace.cloud.account.logout']()}
      </MenuItem>
    </>
  );
};
