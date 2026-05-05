import { useConfirmModal } from '@affine/component';
import { CloseIcon } from '@blocksuite/icons/rc';
import { useLiveData, useService } from '@toeverything/infra';
import { useCallback, useEffect, useState } from 'react';

import { WorkspaceService } from '../../../workspace';
import { ConnectionStatusBadge } from '../../components/connection-status-badge';
import type { SocialPlatform } from '../../entities/analytics-data.entity';
import type { PlatformConnection } from '../../entities/platform-connection.entity';
import {
  ConnectionService,
  type PendingAccountChoice,
} from '../../services/connection.service';
import { AccountPickerModal } from './account-picker-modal';
import * as styles from './index.css';

interface PendingPickerState {
  pendingId: string;
  platform: SocialPlatform;
  accounts: PendingAccountChoice[];
}

const ALL_PLATFORMS: SocialPlatform[] = [
  'FACEBOOK',
  'INSTAGRAM',
  'THREADS',
  'TIKTOK',
  'LINE_VOOM',
  'GOGOCASH',
];

const PLATFORM_LABEL: Record<SocialPlatform, string> = {
  FACEBOOK: 'Facebook',
  INSTAGRAM: 'Instagram',
  THREADS: 'Threads',
  TIKTOK: 'TikTok',
  LINE_VOOM: 'LINE VOOM',
  GOGOCASH: 'GoGoCash',
};

interface ConnectionsSettingsProps {
  /**
   * Whether the current user can edit connections (owner / admin).
   * If false, all connect/disconnect buttons are disabled and a notice is
   * shown. The parent (`WorkspaceAnalyticsConnections`) computes this from
   * `WorkspacePermissionService` — the wrapping panel is also hidden in
   * the sidebar for non-owners, but we still gate here for deep-links.
   */
  canEdit?: boolean;
}

function formatLastSync(iso: string | null | undefined): string {
  if (!iso) return 'Never synced';
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return 'Never synced';
  const diffMs = Date.now() - ts;
  const minutes = Math.floor(diffMs / (1000 * 60));
  if (minutes < 1) return 'Synced just now';
  if (minutes < 60) return `Synced ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Synced ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `Synced ${days}d ago`;
}

export function ConnectionsSettings({
  canEdit = true,
}: ConnectionsSettingsProps) {
  const connectionService = useService(ConnectionService);
  const workspaceService = useService(WorkspaceService);
  const workspaceId = workspaceService.workspace.id;
  const { openConfirmModal } = useConfirmModal();

  const connections = (useLiveData(connectionService.entity.connections$) ??
    []) as PlatformConnection[];
  const loading = useLiveData(connectionService.entity.loading$) ?? false;
  const entityError = useLiveData(connectionService.entity.error$) ?? null;

  const [busyPlatform, setBusyPlatform] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingPicker, setPendingPicker] = useState<PendingPickerState | null>(
    null
  );

  const displayedError = errorMessage ?? entityError;

  const dismissError = useCallback(() => {
    setErrorMessage(null);
    connectionService.entity.setError(null);
  }, [connectionService]);

  useEffect(() => {
    connectionService.loadConnections(workspaceId).catch(err => {
      console.warn('[analytics] loadConnections failed', err);
    });
  }, [connectionService, workspaceId]);

  const handleConnect = useCallback(
    async (platform: SocialPlatform) => {
      if (!canEdit) return;
      setBusyPlatform(platform);
      setErrorMessage(null);
      connectionService.entity.setError(null);
      try {
        const result = await connectionService.beginOAuth(
          workspaceId,
          platform
        );
        if (result.ok === 'pick-account') {
          // Multi-account Meta — defer to the picker modal. Don't surface
          // an error and don't clear busyPlatform; the modal owns the
          // pending state until the user confirms or cancels.
          setPendingPicker({
            pendingId: result.pendingId,
            platform: result.platform,
            accounts: result.accounts,
          });
        } else if (!result.ok && result.error) {
          setErrorMessage(result.error);
        }
      } catch (err) {
        console.warn(`[analytics] beginOAuth(${platform}) failed`, err);
        setErrorMessage(
          err instanceof Error ? err.message : 'Failed to start OAuth'
        );
      } finally {
        setBusyPlatform(null);
      }
    },
    [canEdit, connectionService, workspaceId]
  );

  const handlePickerConfirm = useCallback(
    async (externalAccountId: string) => {
      if (!pendingPicker) return;
      // Throws on failure → AccountPickerModal catches + displays inline.
      await connectionService.finalizeConnection(
        workspaceId,
        pendingPicker.pendingId,
        externalAccountId
      );
      setPendingPicker(null);
      setErrorMessage(null);
    },
    [connectionService, pendingPicker, workspaceId]
  );

  const handlePickerCancel = useCallback(() => {
    if (!pendingPicker) return;
    const { pendingId } = pendingPicker;
    setPendingPicker(null);
    // Fire-and-forget. cancelPendingOAuth handles its own errors and the
    // cache row will TTL-expire even if the mutation drops.
    connectionService.cancelPendingOAuth(pendingId).catch(() => {
      /* swallow — cache TTL is the safety net */
    });
  }, [connectionService, pendingPicker]);

  const handleDisconnect = useCallback(
    (connection: PlatformConnection) => {
      if (!canEdit) return;
      openConfirmModal({
        title: `Disconnect ${PLATFORM_LABEL[connection.platform] ?? connection.platform}?`,
        description: `Metrics will stop syncing immediately. You can reconnect any time. ${
          connection.externalAccountName ?? connection.accountHandle ?? ''
        }`,
        confirmText: 'Disconnect',
        confirmButtonOptions: {
          variant: 'error',
        },
        cancelText: 'Cancel',
        onConfirm: async () => {
          setBusyPlatform(connection.platform);
          setErrorMessage(null);
          connectionService.entity.setError(null);
          try {
            await connectionService.disconnect(connection.id);
          } catch (err) {
            console.warn(
              `[analytics] disconnect(${connection.id}) failed`,
              err
            );
            setErrorMessage(
              err instanceof Error
                ? err.message
                : 'Failed to disconnect — please try again.'
            );
          } finally {
            setBusyPlatform(null);
          }
        },
      });
    },
    [canEdit, connectionService, openConfirmModal]
  );

  return (
    <div className={styles.root} data-testid="analytics-connections-settings">
      {pendingPicker ? (
        <AccountPickerModal
          open={true}
          platform={pendingPicker.platform}
          accounts={pendingPicker.accounts}
          onConfirm={handlePickerConfirm}
          onCancel={handlePickerCancel}
        />
      ) : null}
      <div className={styles.title}>Connections</div>
      <div className={styles.subtitle}>
        Link your workspace&apos;s social accounts to start collecting metrics.
      </div>
      {!canEdit ? (
        <div className={styles.lockedNotice}>
          Only workspace owners and admins can change connections.
        </div>
      ) : null}
      {displayedError ? (
        <div className={styles.bannerError} role="alert">
          <span className={styles.bannerErrorText}>{displayedError}</span>
          <button
            type="button"
            className={styles.bannerErrorDismiss}
            onClick={dismissError}
            aria-label="Dismiss error"
            data-testid="analytics-connections-error-dismiss"
          >
            <CloseIcon />
          </button>
        </div>
      ) : null}
      {loading && connections.length === 0 ? (
        <div
          className={styles.list}
          data-testid="analytics-connections-loading"
        >
          {ALL_PLATFORMS.map(p => (
            <div key={p} className={styles.skeletonRow} />
          ))}
        </div>
      ) : (
        <div className={styles.list}>
          {ALL_PLATFORMS.map(platform => {
            const connection = connections.find(c => c.platform === platform);
            const status = connection?.status ?? 'NOT_CONNECTED';
            const busy = busyPlatform === platform;
            const accountName =
              connection?.externalAccountName ??
              connection?.accountHandle ??
              null;
            const lastSync = connection?.lastSyncAt ?? connection?.lastSyncedAt;
            const isBroken = status === 'EXPIRED' || status === 'ERROR';
            const bannerClass =
              status === 'EXPIRED'
                ? styles.rowBannerWarning
                : status === 'ERROR'
                  ? styles.rowBannerError
                  : '';
            return (
              <div
                key={platform}
                className={styles.row}
                data-testid={`analytics-connection-row-${platform}`}
              >
                <div className={styles.rowMain}>
                  <span className={styles.platformName}>
                    {PLATFORM_LABEL[platform]}
                  </span>
                  {accountName ? (
                    <span className={styles.accountHandle}>{accountName}</span>
                  ) : null}
                  {connection && status === 'ACTIVE' ? (
                    <span className={styles.lastSync}>
                      {formatLastSync(lastSync)}
                    </span>
                  ) : null}
                </div>
                <div className={styles.actionsRow}>
                  <ConnectionStatusBadge status={status} />
                  {connection && status === 'ACTIVE' ? (
                    <button
                      type="button"
                      className={styles.button}
                      disabled={!canEdit || busy}
                      onClick={() => handleDisconnect(connection)}
                      data-testid={`analytics-disconnect-${platform}`}
                    >
                      {busy ? 'Working…' : 'Disconnect'}
                    </button>
                  ) : connection && isBroken ? (
                    <button
                      type="button"
                      className={`${styles.button} ${styles.buttonPrimary}`}
                      disabled={!canEdit || busy}
                      onClick={() => void handleConnect(platform)}
                      data-testid={`analytics-reconnect-${platform}`}
                    >
                      {busy ? 'Connecting…' : 'Reconnect'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={`${styles.button} ${styles.buttonPrimary}`}
                      disabled={!canEdit || busy}
                      onClick={() => void handleConnect(platform)}
                      data-testid={`analytics-connect-${platform}`}
                    >
                      {busy ? 'Connecting…' : 'Connect'}
                    </button>
                  )}
                </div>
                {isBroken && connection?.lastError ? (
                  <div className={`${styles.rowBanner} ${bannerClass}`}>
                    {connection.lastError}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
