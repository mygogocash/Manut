import {
  SettingHeader,
  SettingWrapper,
} from '@affine/component/setting-components';
import { ConnectionsSettings } from '@affine/core/modules/analytics/views/connections-settings';
import { WorkspacePermissionService } from '@affine/core/modules/permissions';
import { useLiveData, useService } from '@toeverything/infra';

/**
 * Workspace settings panel: Analytics → Connections.
 *
 * Owner-only by visibility (the entry is hidden in the sidebar list for
 * non-owners), but we additionally gate the action buttons via `canEdit`
 * so a deep-link to the panel surface still respects permissions.
 */
export const WorkspaceAnalyticsConnections = () => {
  const workspacePermissionService = useService(WorkspacePermissionService)
    .permission;
  const isOwner = useLiveData(workspacePermissionService.isOwner$);
  const isAdmin = useLiveData(workspacePermissionService.isAdmin$);
  const canEdit = Boolean(isOwner || isAdmin);

  return (
    <>
      <SettingHeader
        title="Analytics · Connections"
        subtitle="Connect this workspace's social platforms to enable metric ingestion and AI insights."
      />
      <SettingWrapper>
        <ConnectionsSettings canEdit={canEdit} />
      </SettingWrapper>
    </>
  );
};
