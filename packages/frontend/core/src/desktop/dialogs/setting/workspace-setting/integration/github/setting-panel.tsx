import { Button } from '@affine/component';
import { useMutation } from '@affine/core/components/hooks/use-mutation';
import { useQuery } from '@affine/core/components/hooks/use-query';
import { WorkspaceService } from '@affine/core/modules/workspace';
import { useService } from '@toeverything/infra';
import { useCallback, useEffect, useState } from 'react';

import { looksLikeNotConfigured } from '../_shared/error-classifier';
import { IntegrationSettingHeader } from '../setting';
import {
  connectGithubMutation,
  disconnectGithubMutation,
  type GithubConnectionDto,
  githubConnectionQuery,
} from './graphql';
import { GithubLogoIcon } from './icons';
import * as styles from './setting-panel.css';

const POSTMESSAGE_TYPE = 'affine:github-oauth-result';

const GITHUB_ENV_VARS = [
  'GITHUB_OAUTH_CLIENT_ID',
  'GITHUB_OAUTH_CLIENT_SECRET',
] as const;

interface OAuthResultMessage {
  type: typeof POSTMESSAGE_TYPE;
  ok: boolean;
  login?: string;
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
 * GitHub integration card. Mirrors the v1.10.1 Google OAuth scaffold
 * `GoogleSettingPanel` (CLAUDE.md §6): connect/disconnect plumbing
 * via GraphQL, OAuth popup with postMessage callback, "Live import
 * is rolling out soon" footer for honest user expectations.
 */
export const GithubSettingPanel = () => {
  const workspaceService = useService(WorkspaceService);
  const workspaceId = workspaceService.workspace.id;

  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Split out from `error` so the "not configured" empty state can
  // replace the Connect action entirely (admin task, not a transient
  // failure the user can retry).
  const [notConfigured, setNotConfigured] = useState(false);

  // Cast at the boundary because the local query is not in the
  // codegen'd discriminated union — same trick the Google panel uses.
  const queryArg = {
    query: githubConnectionQuery,
    variables: { workspaceId },
  } as unknown as NonNullable<Parameters<typeof useQuery>[0]>;
  const { data, isLoading, mutate } = useQuery(queryArg);

  const connection = (
    data as unknown as { githubConnection?: GithubConnectionDto } | undefined
  )?.githubConnection;
  const isConnected = Boolean(connection?.connected);
  const connectedLogin = connection?.login;

  const { trigger: triggerConnect } = useMutation({
    mutation: connectGithubMutation,
  });
  const { trigger: triggerDisconnect } = useMutation({
    mutation: disconnectGithubMutation,
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
            ? `GitHub connection failed: ${event.data.error}`
            : 'GitHub connection failed.'
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
      )({ workspaceId })) as { connectGithub?: { url?: string } } | undefined;
      const url = response?.connectGithub?.url;
      if (!url) {
        // Defensive: the resolver shouldn't return a successful
        // mutation with an empty URL — but if it does, treat it the
        // same as the typed "not configured" error.
        setNotConfigured(true);
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
      if (looksLikeNotConfigured(err, GITHUB_ENV_VARS)) {
        // Don't set `error` — the dedicated empty state replaces the
        // connect action entirely. Generic red banner would mislead
        // users into thinking they could retry their way out of this.
        setNotConfigured(true);
        return;
      }
      setError(
        err instanceof Error
          ? err.message
          : 'Could not start the GitHub OAuth flow.'
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
        err instanceof Error ? err.message : 'Could not disconnect GitHub.'
      );
    } finally {
      setActionLoading(false);
    }
  }, [triggerDisconnect, workspaceId, mutate]);

  const action = (() => {
    if (isLoading) return null;
    // "Not configured" suppresses the Connect button — no recoverable
    // action the user can take from this UI. The empty state below
    // tells them what the admin needs to set instead.
    if (notConfigured) return null;
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
        icon={<GithubLogoIcon />}
        name="GitHub"
        desc="Connect your GitHub account to let AI search issues, PRs, and repositories on your behalf."
        action={action}
      />

      {notConfigured ? (
        <div
          className={styles.notConfiguredPlate}
          data-testid="github-integration-not-configured"
        >
          <div className={styles.notConfiguredIcon} aria-hidden="true">
            <GithubLogoIcon width={20} height={20} />
          </div>
          <div className={styles.notConfiguredTitle}>
            GitHub OAuth not configured
          </div>
          <div className={styles.notConfiguredCopy}>
            An admin needs to set{' '}
            <span className={styles.notConfiguredEnv}>
              GITHUB_OAUTH_CLIENT_ID
            </span>{' '}
            and{' '}
            <span className={styles.notConfiguredEnv}>
              GITHUB_OAUTH_CLIENT_SECRET
            </span>{' '}
            in the server config to enable this integration.
          </div>
        </div>
      ) : null}

      {error ? <div className={styles.errorMessage}>{error}</div> : null}

      {isConnected && connectedLogin ? (
        <div className={styles.stateRow}>
          <div>
            <div className={styles.stateLabel}>
              {`Connected as ${connectedLogin}`}
            </div>
          </div>
        </div>
      ) : null}

      <div className={styles.comingSoonNote}>
        Live import is rolling out soon. For now, the AI assistant can search
        and read issues, PRs, and repositories once you connect.
      </div>
    </div>
  );
};
