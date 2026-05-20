import { Button } from '@affine/component';
import { useMutation } from '@affine/core/components/hooks/use-mutation';
import { useQuery } from '@affine/core/components/hooks/use-query';
import { WorkspaceService } from '@affine/core/modules/workspace';
import { useService } from '@toeverything/infra';
import { useCallback, useEffect, useState } from 'react';

import { IntegrationSettingHeader } from '../setting';
import {
  connectSlackMutation,
  disconnectSlackMutation,
  type SlackConnectionDto,
  slackConnectionQuery,
} from './graphql';
import { SlackLogoIcon } from './icons';
import * as styles from './setting-panel.css';

const POSTMESSAGE_TYPE = 'affine:slack-oauth-result';

interface OAuthResultMessage {
  type: typeof POSTMESSAGE_TYPE;
  ok: boolean;
  teamName?: string;
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
 * Slack integration card. Mirrors the v1.13.x GitHub OAuth scaffold
 * `GithubSettingPanel` (CLAUDE.md §6): connect/disconnect plumbing
 * via GraphQL, OAuth popup with postMessage callback, "Live import
 * is rolling out soon" footer for honest user expectations.
 */
export const SlackSettingPanel = () => {
  const workspaceService = useService(WorkspaceService);
  const workspaceId = workspaceService.workspace.id;

  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cast at the boundary because the local query is not in the
  // codegen'd discriminated union — same trick the GitHub panel uses.
  const queryArg = {
    query: slackConnectionQuery,
    variables: { workspaceId },
  } as unknown as NonNullable<Parameters<typeof useQuery>[0]>;
  const { data, isLoading, mutate } = useQuery(queryArg);

  const connection = (
    data as unknown as { slackConnection?: SlackConnectionDto } | undefined
  )?.slackConnection;
  const isConnected = Boolean(connection?.connected);
  const connectedTeamName = connection?.teamName;

  const { trigger: triggerConnect } = useMutation({
    mutation: connectSlackMutation,
  });
  const { trigger: triggerDisconnect } = useMutation({
    mutation: disconnectSlackMutation,
  });

  // Refresh the panel data when the popup posts back its result.
  // Strict origin check — only accept messages from this app's own
  // origin.
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
            ? `Slack connection failed: ${event.data.error}`
            : 'Slack connection failed.'
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
      )({ workspaceId })) as { connectSlack?: { url?: string } } | undefined;
      const url = response?.connectSlack?.url;
      if (!url) {
        setError(
          'Slack OAuth is not configured on this server. Ask an admin to set SLACK_OAUTH_CLIENT_ID / SLACK_OAUTH_CLIENT_SECRET.'
        );
        return;
      }
      const popup = window.open(
        url,
        '_blank',
        'popup=yes,width=600,height=720,noopener=no'
      );
      if (!popup) {
        // Popup blocked → fall back to full-page redirect.
        window.location.href = url;
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not start the Slack OAuth flow.'
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
        err instanceof Error ? err.message : 'Could not disconnect Slack.'
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
        icon={<SlackLogoIcon />}
        name="Slack"
        desc="Connect your Slack workspace to let AI search channels and read messages on your behalf."
        action={action}
      />

      {error ? <div className={styles.errorMessage}>{error}</div> : null}

      {isConnected && connectedTeamName ? (
        <div className={styles.stateRow}>
          <div>
            <div className={styles.stateLabel}>
              {`Connected to ${connectedTeamName}`}
            </div>
          </div>
        </div>
      ) : null}

      <div className={styles.comingSoonNote}>
        Live import is rolling out soon. For now, the AI assistant will be able
        to search channels and read messages once you connect.
      </div>
    </div>
  );
};
