import { Button } from '@affine/component';
import { WorkspaceService } from '@affine/core/modules/workspace';
import { useService } from '@toeverything/infra';
import { useCallback, useEffect, useState } from 'react';

import type { ConnectedAccount, ProviderInfo } from './types';

const ALL_PROVIDERS: ProviderInfo[] = [
  {
    name: 'github',
    displayName: 'GitHub',
    description:
      'Import repositories, issues, and pull requests from GitHub.',
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

export const ConnectionsSettingPanel = ({
  workspaceId: propWorkspaceId,
}: ConnectionsSettingPanelProps) => {
  const workspaceService = useService(WorkspaceService);
  const workspaceId =
    propWorkspaceId ?? workspaceService.workspace.id;

  const [connections, setConnections] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchConnections = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query ListConnections($workspaceId: String!) {
              listConnections(workspaceId: $workspaceId) {
                id
                provider
                displayName
                scopes
                createdAt
              }
            }
          `,
          variables: { workspaceId },
        }),
      });
      const { data, errors } = (await response.json()) as {
        data?: { listConnections: ConnectedAccount[] };
        errors?: { message: string }[];
      };
      if (errors?.length) {
        setError(errors[0].message);
      } else {
        setConnections(data?.listConnections ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load connections');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void fetchConnections();
    // Check URL params for OAuth callback result
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('connected');
    const oauthError = params.get('error');
    if (connected || oauthError) {
      // Clean up URL params without reload
      const url = new URL(window.location.href);
      url.searchParams.delete('connected');
      url.searchParams.delete('name');
      url.searchParams.delete('error');
      window.history.replaceState({}, '', url.toString());
      if (connected) {
        void fetchConnections();
      }
      if (oauthError) {
        setError(decodeURIComponent(oauthError));
      }
    }
  }, [fetchConnections]);

  const handleConnect = useCallback(
    (providerName: string) => {
      const startUrl = `/api/connections/oauth/${providerName}/start?workspaceId=${encodeURIComponent(workspaceId)}`;
      window.location.href = startUrl;
    },
    [workspaceId]
  );

  const handleDisconnect = useCallback(
    async (providerName: string) => {
      setActionLoading(providerName);
      setError(null);
      try {
        const response = await fetch('/api/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `
              mutation DisconnectProvider($workspaceId: String!, $provider: String!) {
                disconnectProvider(workspaceId: $workspaceId, provider: $provider)
              }
            `,
            variables: { workspaceId, provider: providerName },
          }),
        });
        const { errors } = (await response.json()) as {
          errors?: { message: string }[];
        };
        if (errors?.length) {
          setError(errors[0].message);
        } else {
          await fetchConnections();
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to disconnect provider'
        );
      } finally {
        setActionLoading(null);
      }
    },
    [workspaceId, fetchConnections]
  );

  const connectedProviders = new Set(connections.map(c => c.provider));

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

      {loading ? (
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
                    style={{ fontSize: '24px', width: '32px', textAlign: 'center' }}
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
                      size="small"
                      onClick={() => void handleDisconnect(provider.name)}
                      loading={isActioning}
                      disabled={isActioning}
                    >
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      size="small"
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
