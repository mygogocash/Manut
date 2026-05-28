import { Button } from '@affine/component';
import {
  SettingHeader,
  SettingWrapper,
} from '@affine/component/setting-components';
import { SWRErrorBoundary } from '@affine/core/components/pure/swr-error-bundary';
import { WorkspacePermissionService } from '@affine/core/modules/permissions';
import { useLiveData, useService } from '@toeverything/infra';
import type { FallbackProps } from 'react-error-boundary';

import { AnalyticsConnectionsPanel } from './panel';
import * as styles from './panel.css';

const AnalyticsConnectionsErrorFallback = ({
  error,
  resetErrorBoundary,
}: FallbackProps) => (
  <SettingWrapper>
    <div
      className={styles.root}
      data-testid="analytics-connections-error-boundary"
    >
      <div className={styles.errorBanner} role="alert">
        Failed to load analytics connections:{' '}
        {error instanceof Error ? error.message : 'Unexpected error'}
      </div>
      <div className={styles.inlineActions}>
        <Button onClick={resetErrorBoundary}>Retry</Button>
      </div>
    </div>
  </SettingWrapper>
);

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
      <SWRErrorBoundary FallbackComponent={AnalyticsConnectionsErrorFallback}>
        <SettingWrapper>
          <AnalyticsConnectionsPanel />
        </SettingWrapper>
      </SWRErrorBoundary>
    </>
  );
};
