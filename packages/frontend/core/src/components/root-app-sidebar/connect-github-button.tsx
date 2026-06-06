import { MenuItem } from '@affine/core/modules/app-sidebar/views';
import { WorkspaceDialogService } from '@affine/core/modules/dialogs';
import { WorkspaceService } from '@affine/core/modules/workspace';
import { useService } from '@toeverything/infra';
import { useCallback } from 'react';

import { GITHUB_INTEGRATION_SCROLL_ANCHOR } from '../../desktop/dialogs/setting/navigation-constants';
import { GithubLogoIcon } from '../../desktop/dialogs/setting/workspace-setting/integration/github/icons';

export const ConnectGithubButton = () => {
  const workspace = useService(WorkspaceService).workspace;
  const isLocal = workspace.flavour === 'local';
  const dialogService = useService(WorkspaceDialogService);

  const onOpenGithubIntegration = useCallback(() => {
    dialogService.open('setting', {
      activeTab: 'workspace:integrations',
      scrollAnchor: GITHUB_INTEGRATION_SCROLL_ANCHOR,
    });
  }, [dialogService]);

  if (isLocal) {
    return null;
  }

  return (
    <MenuItem
      data-testid="slider-bar-connect-github-button"
      icon={<GithubLogoIcon />}
      onClick={onOpenGithubIntegration}
    >
      Connect GitHub
    </MenuItem>
  );
};
