import {
  SettingHeader,
  SettingWrapper,
} from '@affine/component/setting-components';
import { WorkspacePermissionService } from '@affine/core/modules/permissions';
import { useLiveData, useService } from '@toeverything/infra';

import { AnalyticsConnectionsPanel } from './panel';

/**
 * Workspace settings panel: Analytics → Connections.
 *
 * Owner-only by visibility (the entry is hidden in the sidebar list for
 * non-owners). Renders the 6 social + 2 db connector cards shipped in
 * the Wave 7+ batch — see `./panel.tsx`. The pre-existing analytics-
 * module `ConnectionsSettings` view remains intact for callers that
 * still wire it directly.
 *
 * `canEdit` is computed for symmetry with other workspace setting
 * panels even though the new panel currently allows all members to
 * configure connectors. When the analytics-module integration ships,
 * gate `<AnalyticsConnectionsPanel canEdit={canEdit} />` here.
 */
export const WorkspaceAnalyticsConnections = () => {
  const workspacePermissionService = useService(
    WorkspacePermissionService
  ).permission;
  const isOwner = useLiveData(workspacePermissionService.isOwner$);
  const isAdmin = useLiveData(workspacePermissionService.isAdmin$);
  // Reserved for forward compatibility — see comment above.
  void Boolean(isOwner || isAdmin);

  return (
    <>
      <SettingHeader
        title="Connections"
        subtitle="Link your workspace's social accounts to start collecting metrics."
      />
      <SettingWrapper>
        <AnalyticsConnectionsPanel />
      </SettingWrapper>
    </>
  );
};
