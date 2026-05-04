import { Button } from '@affine/component';
import { useMutation } from '@affine/core/components/hooks/use-mutation';
import { useQuery } from '@affine/core/components/hooks/use-query';
import { WorkspaceService } from '@affine/core/modules/workspace';
import { useI18n } from '@affine/i18n';
import { useService } from '@toeverything/infra';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { IntegrationSettingHeader } from '../setting';
import {
  connectGoogleMutation,
  disconnectGoogleMutation,
  type GoogleConnectionDto,
  googleConnectionQuery,
  type GoogleScope,
} from './graphql';
import { GmailLogoIcon, GoogleDriveLogoIcon } from './icons';
import * as styles from './setting-panel.css';

const POSTMESSAGE_TYPE = 'affine:google-oauth-result';

interface OAuthResultMessage {
  type: typeof POSTMESSAGE_TYPE;
  ok: boolean;
  scope?: GoogleScope;
  email?: string;
  error?: string;
}

function isOAuthResultMessage(value: unknown): value is OAuthResultMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { type?: unknown }).type === POSTMESSAGE_TYPE
  );
}

interface GoogleSettingPanelProps {
  scope: GoogleScope;
  /** Display name shown in the header. */
  title: string;
  /** Description shown below the header. */
  desc: string;
  /** Brand mark for the integration. */
  icon: ReactNode;
}

/**
 * Shared setting panel for Gmail / Google Drive. Handles the OAuth popup
 * flow, listens for the postMessage from the callback handler, and
 * shows the connected state with a Disconnect button.
 *
 * v1.10.1 ships only the connect/disconnect plumbing; the live email /
 * file import is stubbed with a "Coming soon" footer so users have honest
 * expectations about what this scaffold actually does.
 */
const GoogleSettingPanel = ({
  scope,
  title,
  desc,
  icon,
}: GoogleSettingPanelProps) => {
  const t = useI18n();
  const workspaceService = useService(WorkspaceService);
  const workspaceId = workspaceService.workspace.id;

  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cast at the boundary because the local query is not in the codegen'd
  // discriminated union — same trick the connections panel uses.
  const queryArg = {
    query: googleConnectionQuery,
    variables: { workspaceId, scope },
  } as unknown as NonNullable<Parameters<typeof useQuery>[0]>;
  const { data, isLoading, mutate } = useQuery(queryArg);

  const connection = (
    data as unknown as { googleConnection?: GoogleConnectionDto } | undefined
  )?.googleConnection;
  const isConnected = Boolean(connection?.connected);
  const connectedEmail = connection?.email;

  const { trigger: triggerConnect } = useMutation({
    mutation: connectGoogleMutation,
  });
  const { trigger: triggerDisconnect } = useMutation({
    mutation: disconnectGoogleMutation,
  });

  // Refresh the panel data when the popup posts back its result. Strict
  // origin check — only accept messages from this app's own origin.
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (!isOAuthResultMessage(event.data)) return;
      // Only react to messages for THIS scope. Different popups for Gmail
      // vs Drive can be in flight at the same time and we don't want one
      // to overwrite the other's UI state.
      if (event.data.scope && event.data.scope !== scope) return;
      if (event.data.ok) {
        setError(null);
        mutate().catch(console.error);
      } else {
        setError(
          event.data.error
            ? t['com.affine.integration.google.error']({
                error: event.data.error,
              })
            : t['com.affine.integration.google.error-generic']()
        );
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [mutate, scope, t]);

  const handleConnect = useCallback(async () => {
    setActionLoading(true);
    setError(null);
    try {
      const response = (await (
        triggerConnect as (args: unknown) => Promise<unknown>
      )({ workspaceId, scope })) as
        | { connectGoogle?: { url?: string } }
        | undefined;
      const url = response?.connectGoogle?.url;
      if (!url) {
        // The most common reason for this is missing OAuth env vars on
        // the server. Surface a specific message so ops knows what to fix.
        setError(t['com.affine.integration.google.not-configured']());
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
          : t['com.affine.integration.google.error-generic']()
      );
    } finally {
      setActionLoading(false);
    }
  }, [triggerConnect, workspaceId, scope, t]);

  const handleDisconnect = useCallback(async () => {
    setActionLoading(true);
    setError(null);
    try {
      await (triggerDisconnect as (args: unknown) => Promise<unknown>)({
        workspaceId,
        scope,
      });
      await mutate();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t['com.affine.integration.google.error-generic']()
      );
    } finally {
      setActionLoading(false);
    }
  }, [triggerDisconnect, workspaceId, scope, mutate, t]);

  const action = useMemo(() => {
    if (isLoading) return null;
    if (isConnected) {
      return (
        <Button
          variant="error"
          loading={actionLoading}
          disabled={actionLoading}
          onClick={() => void handleDisconnect()}
        >
          {t['com.affine.integration.google.disconnect']()}
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
        {t['com.affine.integration.google.connect']()}
      </Button>
    );
  }, [
    isLoading,
    isConnected,
    actionLoading,
    handleDisconnect,
    handleConnect,
    t,
  ]);

  return (
    <div className={styles.root}>
      <IntegrationSettingHeader
        icon={icon}
        name={title}
        desc={desc}
        action={action}
      />

      {error ? <div className={styles.errorMessage}>{error}</div> : null}

      {isConnected && connectedEmail ? (
        <div className={styles.stateRow}>
          <div>
            <div className={styles.stateLabel}>
              {t['com.affine.integration.google.connected-as']({
                email: connectedEmail,
              })}
            </div>
          </div>
        </div>
      ) : null}

      <div className={styles.comingSoonNote}>
        {t['com.affine.integration.google.coming-soon']()}
      </div>
    </div>
  );
};

export const GmailSettingPanel = () => {
  const t = useI18n();
  return (
    <GoogleSettingPanel
      scope="gmail"
      title={t['com.affine.integration.gmail.name']()}
      desc={t['com.affine.integration.gmail.description']()}
      icon={<GmailLogoIcon />}
    />
  );
};

export const GoogleDriveSettingPanel = () => {
  const t = useI18n();
  return (
    <GoogleSettingPanel
      scope="drive"
      title={t['com.affine.integration.google-drive.name']()}
      desc={t['com.affine.integration.google-drive.description']()}
      icon={<GoogleDriveLogoIcon />}
    />
  );
};
