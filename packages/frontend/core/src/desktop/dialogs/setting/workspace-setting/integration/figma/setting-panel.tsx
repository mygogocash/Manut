import { Button } from '@affine/component';
import { useMutation } from '@affine/core/components/hooks/use-mutation';
import { useQuery } from '@affine/core/components/hooks/use-query';
import { WorkspaceService } from '@affine/core/modules/workspace';
import { useService } from '@toeverything/infra';
import { useCallback, useEffect, useState } from 'react';

import { IntegrationSettingHeader } from '../setting';
import {
  connectFigmaMutation,
  disconnectFigmaMutation,
  type FigmaConnectionDto,
  figmaConnectionQuery,
} from './graphql';
import { FigmaLogoIcon } from './icons';
import * as styles from './setting-panel.css';

const POSTMESSAGE_TYPE = 'affine:figma-oauth-result';

interface OAuthResultMessage {
  type: typeof POSTMESSAGE_TYPE;
  ok: boolean;
  handle?: string;
  error?: string;
}

function isOAuthResultMessage(value: unknown): value is OAuthResultMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { type?: unknown }).type === POSTMESSAGE_TYPE
  );
}

/**
 * Figma integration card. Mirrors the v1.13.x GitHub OAuth scaffold
 * `GithubSettingPanel` (CLAUDE.md §6).
 */
export const FigmaSettingPanel = () => {
  const workspaceService = useService(WorkspaceService);
  const workspaceId = workspaceService.workspace.id;

  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queryArg = {
    query: figmaConnectionQuery,
    variables: { workspaceId },
  } as unknown as NonNullable<Parameters<typeof useQuery>[0]>;
  const { data, isLoading, mutate } = useQuery(queryArg);

  const connection = (
    data as unknown as { figmaConnection?: FigmaConnectionDto } | undefined
  )?.figmaConnection;
  const isConnected = Boolean(connection?.connected);
  const connectedHandle = connection?.handle;
  const connectedEmail = connection?.email;

  const { trigger: triggerConnect } = useMutation({
    mutation: connectFigmaMutation,
  });
  const { trigger: triggerDisconnect } = useMutation({
    mutation: disconnectFigmaMutation,
  });

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (!isOAuthResultMessage(event.data)) return;
      if (event.data.ok) {
        setError(null);
        mutate().catch(() => undefined);
      } else {
        setError(
          event.data.error
            ? `Figma connection failed: ${event.data.error}`
            : 'Figma connection failed.'
        );
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [mutate]);

  const handleConnect = useCallback(async () => {
    setActionLoading(true);
    setError(null);
    try {
      const response = (await (
        triggerConnect as (args: unknown) => Promise<unknown>
      )({ workspaceId })) as { connectFigma?: { url?: string } } | undefined;
      const url = response?.connectFigma?.url;
      if (!url) {
        setError(
          'Figma OAuth is not configured on this server. Ask an admin to set FIGMA_OAUTH_CLIENT_ID / FIGMA_OAUTH_CLIENT_SECRET.'
        );
        return;
      }
      const popup = window.open(
        url,
        '_blank',
        'popup=yes,width=600,height=720,noopener=no'
      );
      if (!popup) {
        window.location.href = url;
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not start the Figma OAuth flow.'
      );
    } finally {
      setActionLoading(false);
    }
  }, [triggerConnect, workspaceId]);

  const handleDisconnect = useCallback(async () => {
    setActionLoading(true);
    setError(null);
    try {
      await (triggerDisconnect as (args: unknown) => Promise<unknown>)({
        workspaceId,
      });
      await mutate();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not disconnect Figma.'
      );
    } finally {
      setActionLoading(false);
    }
  }, [triggerDisconnect, workspaceId, mutate]);

  const action = (() => {
    if (isLoading) return null;
    if (isConnected) {
      return (
        <Button
          variant="error"
          loading={actionLoading}
          disabled={actionLoading}
          onClick={() => void handleDisconnect()}
        >
          Disconnect
        </Button>
      );
    }
    return (
      <Button
        variant="primary"
        loading={actionLoading}
        disabled={actionLoading}
        onClick={() => void handleConnect()}
      >
        Connect
      </Button>
    );
  })();

  return (
    <div className={styles.root}>
      <IntegrationSettingHeader
        icon={<FigmaLogoIcon />}
        name="Figma"
        desc="Connect your Figma account to let AI search files and read frames on your behalf."
        action={action}
      />

      {error ? <div className={styles.errorMessage}>{error}</div> : null}

      {isConnected && connectedHandle ? (
        <div className={styles.stateRow}>
          <div>
            <div className={styles.stateLabel}>
              {`Connected as ${connectedHandle}`}
            </div>
            {connectedEmail ? (
              <div className={styles.stateSubLabel}>{connectedEmail}</div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className={styles.comingSoonNote}>
        Live import is rolling out soon. For now, the AI assistant will be able
        to read Figma files and frames once you connect.
      </div>
    </div>
  );
};
