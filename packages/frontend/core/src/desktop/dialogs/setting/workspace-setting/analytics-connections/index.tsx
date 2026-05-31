import { Button } from '@affine/component';
import {
  SettingHeader,
  SettingWrapper,
} from '@affine/component/setting-components';
import { SWRErrorBoundary } from '@affine/core/components/pure/swr-error-bundary';
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
 * Visibility is gated to owners/admins by the sidebar list — the
 * `workspace:analytics-connections` entry is only added in
 * `useWorkspaceSettingList` when `isOwner || isAdmin` (see
 * `../index.tsx`). Once visible, the panel allows any member to
 * configure connectors; there is no per-control edit gate today, so the
 * panel takes no `canEdit` prop. If a finer-grained member-level edit
 * model is needed later, add a `canEdit` prop to
 * `AnalyticsConnectionsPanel` and compute the permission here.
 *
 * Renders the 6 social + 2 db connector cards shipped in the Wave 7+
 * batch — see `./panel.tsx`. The pre-existing analytics-module
 * `ConnectionsSettings` view remains intact for callers that still wire
 * it directly.
 */
export const WorkspaceAnalyticsConnections = () => {
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
