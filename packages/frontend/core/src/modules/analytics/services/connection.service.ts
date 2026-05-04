import { Service } from '@toeverything/infra';

import type { GraphQLService } from '../../cloud/services/graphql';
import type { SocialPlatform } from '../entities/analytics-data.entity';
import {
  type PlatformConnection,
  PlatformConnectionEntity,
} from '../entities/platform-connection.entity';

// Round-C wiring. See AnalyticsService for the same hand-rolled pattern.
// TODO: regenerate codegen types — these operations may not exist on
// backend Round C yet (BeginPlatformConnect / ListConnections). Calls fall
// back to a clear NOT_IMPLEMENTED error so the dev sees the gap.
const LIST_CONNECTIONS_QUERY = /* GraphQL */ `
  query listConnections($workspaceId: String!) {
    connections(workspaceId: $workspaceId) {
      id
      workspaceId
      platform
      status
      externalAccountName
      lastSyncAt
      lastError
    }
  }
`;

const BEGIN_PLATFORM_CONNECT_MUTATION = /* GraphQL */ `
  mutation beginPlatformConnect(
    $workspaceId: String!
    $platform: SocialPlatform!
  ) {
    beginPlatformConnect(workspaceId: $workspaceId, platform: $platform) {
      url
    }
  }
`;

const DISCONNECT_PLATFORM_MUTATION = /* GraphQL */ `
  mutation disconnectPlatform($connectionId: String!) {
    disconnectPlatform(connectionId: $connectionId)
  }
`;

interface ListConnectionsResponse {
  connections: PlatformConnection[];
}

interface BeginPlatformConnectResponse {
  beginPlatformConnect: { url: string };
}

interface DisconnectPlatformResponse {
  disconnectPlatform: boolean;
}

const POPUP_FEATURES =
  'popup,width=520,height=720,menubar=no,toolbar=no,location=no,status=no';

/**
 * Message we expect the OAuth callback page to post back via
 * window.opener.postMessage. The shape is informal — any payload with
 * `type: 'analytics:oauth:done'` is treated as success and triggers a
 * `loadConnections` refresh.
 */
interface AnalyticsOAuthMessage {
  type: 'analytics:oauth:done' | 'analytics:oauth:error';
  platform?: SocialPlatform;
  /**
   * Human-readable error description. Backend (oauth-callback.controller.ts)
   * posts this as `message`. Aliased to `error` for older call sites that
   * read either field — both are populated by the message normalizer below.
   */
  message?: string;
  error?: string;
}

const isAnalyticsOAuthMessage = (
  data: unknown
): data is AnalyticsOAuthMessage =>
  typeof data === 'object' &&
  data !== null &&
  'type' in data &&
  ((data as { type: string }).type === 'analytics:oauth:done' ||
    (data as { type: string }).type === 'analytics:oauth:error');

/**
 * ConnectionService is the OAuth + connection management surface for the
 * Analytics module. Wraps the `PlatformConnectionEntity` and exposes
 * `loadConnections` / `beginOAuth(platform)` / `disconnect(id)` against
 * the backend GraphQL.
 */
export class ConnectionService extends Service {
  readonly entity = this.framework.createEntity(PlatformConnectionEntity);

  constructor(private readonly graphql: GraphQLService) {
    super();
  }

  loadConnections = async (workspaceId: string): Promise<void> => {
    this.entity.setLoading(true);
    this.entity.setError(null);
    try {
      const result = await this.graphql.gql<{
        id: 'listConnections';
        op: 'query';
        query: typeof LIST_CONNECTIONS_QUERY;
      }>({
        query: {
          id: 'listConnections',
          op: 'query',
          query: LIST_CONNECTIONS_QUERY,
        } as any,
        variables: { workspaceId } as any,
      } as any);

      const data = result as unknown as ListConnectionsResponse;
      this.entity.setConnections(data.connections ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.entity.setError(message);
      this.entity.setConnections([]);
      // Don't throw — empty connection list is the natural fallback.
      // eslint-disable-next-line no-console
      console.warn('[analytics] loadConnections failed', err);
    } finally {
      this.entity.setLoading(false);
    }
  };

  /**
   * Start the OAuth handshake for the given platform. The backend returns
   * a hosted-redirect URL the frontend opens in a popup; once the platform
   * redirects back to the AFFiNE callback page, the callback page should
   * `postMessage({ type: 'analytics:oauth:done' }, window.location.origin)`
   * to the opener so the connections list can be refreshed.
   *
   * Returns a promise that resolves when the popup is closed or a
   * postMessage success/error arrives.
   */
  beginOAuth = async (
    workspaceId: string,
    platform: SocialPlatform
  ): Promise<{ ok: boolean; error?: string }> => {
    const result = await this.graphql.gql<{
      id: 'beginPlatformConnect';
      op: 'mutation';
      query: typeof BEGIN_PLATFORM_CONNECT_MUTATION;
    }>({
      query: {
        id: 'beginPlatformConnect',
        op: 'mutation',
        query: BEGIN_PLATFORM_CONNECT_MUTATION,
      } as any,
      variables: { workspaceId, platform } as any,
    } as any);

    const data = result as unknown as BeginPlatformConnectResponse;
    const url = data.beginPlatformConnect?.url;
    if (!url) {
      throw new Error(
        `beginPlatformConnect did not return a redirect URL for ${platform}`
      );
    }

    const popup = window.open(url, '_blank', POPUP_FEATURES);
    if (!popup) {
      // Popup blocked. Fall back to opening in a new tab; caller still
      // gets a resolved promise so the UI doesn't hang.
      window.open(url, '_blank', 'noopener,noreferrer');
      return {
        ok: false,
        error:
          'Popup was blocked. Opened the OAuth flow in a new tab — return here and refresh once you finish.',
      };
    }

    return await new Promise<{ ok: boolean; error?: string }>(resolve => {
      let settled = false;
      const settle = (value: { ok: boolean; error?: string }) => {
        if (settled) return;
        settled = true;
        window.removeEventListener('message', onMessage);
        clearInterval(closedTimer);
        resolve(value);
      };

      const onMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        if (!isAnalyticsOAuthMessage(event.data)) return;
        if (event.data.type === 'analytics:oauth:done') {
          // Refresh on success so the new ACTIVE row appears.
          this.loadConnections(workspaceId).catch(() => {
            /* loadConnections handles its own errors; swallow here */
          });
          settle({ ok: true });
        } else {
          // Backend posts `message`; tolerate `error` for backwards compat.
          const detail = event.data.message ?? event.data.error;
          settle({ ok: false, error: detail });
        }
        try {
          popup.close();
        } catch {
          /* ignore */
        }
      };

      window.addEventListener('message', onMessage);

      // Polling fallback: if the user closes the popup without postMessage,
      // we still want to refresh + resolve.
      const closedTimer = window.setInterval(() => {
        if (popup.closed) {
          this.loadConnections(workspaceId).catch(() => {
            /* loadConnections handles its own errors; swallow here */
          });
          settle({ ok: true });
        }
      }, 500);
    });
  };

  disconnect = async (connectionId: string): Promise<void> => {
    const result = await this.graphql.gql<{
      id: 'disconnectPlatform';
      op: 'mutation';
      query: typeof DISCONNECT_PLATFORM_MUTATION;
    }>({
      query: {
        id: 'disconnectPlatform',
        op: 'mutation',
        query: DISCONNECT_PLATFORM_MUTATION,
      } as any,
      variables: { connectionId } as any,
    } as any);
    const data = result as unknown as DisconnectPlatformResponse;
    if (data.disconnectPlatform === false) {
      throw new Error('Server refused to disconnect the platform');
    }
    this.entity.removeConnection(connectionId);
  };
}
