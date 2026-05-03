import { Button } from '@affine/component';
import { notifyWithUndo } from '@affine/core/components/affine/undo-toast';
import { useMutation } from '@affine/core/components/hooks/use-mutation';
import { useQuery } from '@affine/core/components/hooks/use-query';
import { WorkspaceService } from '@affine/core/modules/workspace';
import { useService } from '@toeverything/infra';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  type ConnectedAccountDto,
  disconnectProviderMutation,
  listConnectionsQuery,
} from '../graphql';
import type { ProviderInfo } from './types';

const POSTMESSAGE_TYPE = 'affine:connection-oauth-result';

const ALL_PROVIDERS: ProviderInfo[] = [
  {
    name: 'github',
    displayName: 'GitHub',
    description: 'Import repositories, issues, and pull requests from GitHub.',
    icon: '🐙',
  },
  {
    name: 'slack',
    displayName: 'Slack',
    description: 'Browse and import messages and files from Slack channels.',
    icon: '💬',
  },
  {
    name: 'linear',
    displayName: 'Linear',
    description: 'Sync issues and projects from Linear into AFFiNE.',
    icon: '📐',
  },
  {
    name: 'figma',
    displayName: 'Figma',
    description: 'Access and embed Figma files and designs.',
    icon: '🎨',
  },
];

interface ConnectionsSettingPanelProps {
  workspaceId?: string;
}

interface OAuthResultMessage {
  type: typeof POSTMESSAGE_TYPE;
  ok: boolean;
  provider?: string;
  displayName?: string;
  error?: string;
}

function isOAuthResultMessage(value: unknown): value is OAuthResultMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { type?: unknown }).type === POSTMESSAGE_TYPE
  );
}

export const ConnectionsSettingPanel = ({
  workspaceId: propWorkspaceId,
}: ConnectionsSettingPanelProps) => {
  const workspaceService = useService(WorkspaceService);
  const workspaceId = propWorkspaceId ?? workspaceService.workspace.id;

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Local query objects aren't part of the codegen'd `Queries` /
  // `Mutations` discriminated unions, so the framework infers
  // `variables: undefined`. Cast at the boundary with a clear comment;
  // remove these casts once `yarn build` in @affine/graphql picks up the
  // listConnections / disconnectProvider operations.
  const queryArg = {
    query: listConnectionsQuery,
    variables: { workspaceId },
  } as unknown as NonNullable<Parameters<typeof useQuery>[0]>;
  const { data, isLoading, mutate } = useQuery(queryArg);

  const connections = ((
    data as unknown as { listConnections?: ConnectedAccountDto[] } | undefined
  )?.listConnections ?? []) as ConnectedAccountDto[];

  const { trigger: triggerDisconnect } = useMutation({
    mutation: disconnectProviderMutation,
  });

  // Listen for OAuth callback postMessage from the popup. Strict origin check
  // — only accept messages from this app's own origin (the callback HTML is
  // served from the same origin).
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (!isOAuthResultMessage(event.data)) return;
      if (event.data.ok) {
        setError(null);
        void mutate();
      } else {
        setError(
          event.data.error
            ? `Connection failed: ${event.data.error}`
            : 'Connection failed.'
        );
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [mutate]);

  const handleConnect = useCallback(
    (providerName: string) => {
      const startUrl = `/api/connections/oauth/${encodeURIComponent(
        providerName
      )}/start?workspaceId=${encodeURIComponent(workspaceId)}`;
      const popup = window.open(
        startUrl,
        '_blank',
        'popup=yes,width=600,height=720,noopener=no'
      );
      if (!popup) {
        // Popup blocked — fall back to full-page navigation. We accept the
        // worse UX (leaving the settings dialog) when the browser refuses
        // popups; the postMessage path handles the popup case.
        window.location.href = startUrl;
        return;
      }
      setError(null);
    },
    [workspaceId]
  );

  const handleDisconnect = useCallback(
    async (providerName: string, displayName: string) => {
      setActionLoading(providerName);
      setError(null);
      try {
        await (triggerDisconnect as (args: unknown) => Promise<unknown>)({
          workspaceId,
          provider: providerName,
        });
        await mutate();
        // Show "Disconnected — Undo" toast. Undo re-opens the OAuth start
        // URL via the same `handleConnect` flow used by the Connect button,
        // since OAuth requires a fresh user-initiated popup; we cannot
        // restore tokens locally.
        notifyWithUndo({
          message: `${displayName} disconnected`,
          onUndo: () => handleConnect(providerName),
        });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to disconnect provider.'
        );
      } finally {
        setActionLoading(null);
      }
    },
    [workspaceId, triggerDisconnect, mutate, handleConnect]
  );

  const connectedProviders = useMemo(
    () => new Set(connections.map(c => c.provider)),
    [connections]
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '8px 0',
      }}
    >
      <div>
        <h2
          style={{
            fontSize: '15px',
            fontWeight: 600,
            margin: '0 0 4px 0',
          }}
        >
          Connections
        </h2>
        <p
          style={{
            fontSize: '13px',
            color: 'var(--affine-text-secondary-color)',
            margin: 0,
          }}
        >
          Connect external services to import and sync data into AFFiNE.
        </p>
      </div>

      {error ? (
        <div
          style={{
            padding: '8px 12px',
            borderRadius: '4px',
            background: 'var(--affine-background-error-color, #fff0f0)',
            color: 'var(--affine-error-color, #e06b6b)',
            fontSize: '13px',
          }}
        >
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div
          style={{
            fontSize: '13px',
            color: 'var(--affine-text-secondary-color)',
          }}
        >
          Loading connections…
        </div>
      ) : (
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {ALL_PROVIDERS.map(provider => {
            const isConnected = connectedProviders.has(provider.name);
            const connectedAccount = connections.find(
              c => c.provider === provider.name
            );
            const isActioning = actionLoading === provider.name;

            return (
              <li
                key={provider.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--affine-border-color)',
                  background: 'var(--affine-background-primary-color)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '24px',
                      width: '32px',
                      textAlign: 'center',
                    }}
                    aria-hidden
                  >
                    {provider.icon}
                  </span>
                  <div>
                    <div
                      style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: 'var(--affine-text-primary-color)',
                      }}
                    >
                      {provider.displayName}
                      {isConnected && connectedAccount ? (
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 400,
                            color: 'var(--affine-text-secondary-color)',
                            marginLeft: '8px',
                          }}
                        >
                          Connected as {connectedAccount.displayName}
                        </span>
                      ) : null}
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: 'var(--affine-text-secondary-color)',
                        marginTop: '2px',
                      }}
                    >
                      {provider.description}
                    </div>
                  </div>
                </div>

                <div>
                  {isConnected ? (
                    <Button
                      size="default"
                      onClick={() =>
                        void handleDisconnect(
                          provider.name,
                          provider.displayName
                        )
                      }
                      loading={isActioning}
                      disabled={isActioning}
                    >
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      size="default"
                      variant="primary"
                      onClick={() => handleConnect(provider.name)}
                      disabled={isActioning}
                    >
                      Connect
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
