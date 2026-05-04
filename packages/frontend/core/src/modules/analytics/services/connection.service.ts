import {
  beginPlatformConnectMutation,
  cancelPlatformConnectMutation,
  disconnectPlatformMutation,
  finalizePlatformConnectMutation,
  listConnectionsQuery,
  type SocialPlatform as GqlSocialPlatform,
} from '@affine/graphql';
import { Service } from '@toeverything/infra';

import type { WorkspaceServerService } from '../../cloud';
import { GraphQLService } from '../../cloud/services/graphql';
import type { SocialPlatform } from '../entities/analytics-data.entity';
import {
  type PlatformConnection,
  PlatformConnectionEntity,
} from '../entities/platform-connection.entity';

const POPUP_FEATURES =
  'popup,width=520,height=720,menubar=no,toolbar=no,location=no,status=no';

/**
 * Pickable account in the multi-account Meta picker. Backend caps the
 * list at 50 and sanitises both fields to printable ASCII before posting,
 * so the frontend can trust the strings for direct rendering.
 */
export interface PendingAccountChoice {
  externalAccountId: string;
  externalAccountName: string;
}

/**
 * Message we expect the OAuth callback page to post back via
 * window.opener.postMessage. The shape is informal — any payload with
 * `type: 'analytics:oauth:done'` is treated as success and triggers a
 * `loadConnections` refresh. `analytics:oauth:choose-account` is the
 * Meta multi-account picker hop — the popup posts the pendingId + the
 * eligible accounts, the frontend renders a modal, and a follow-up
 * mutation finalises the binding.
 */
interface AnalyticsOAuthMessage {
  type:
    | 'analytics:oauth:done'
    | 'analytics:oauth:error'
    | 'analytics:oauth:choose-account';
  platform?: SocialPlatform;
  /**
   * Human-readable error description. Backend (oauth-callback.controller.ts)
   * posts this as `message`. Aliased to `error` for older call sites that
   * read either field — both are populated by the message normalizer below.
   */
  message?: string;
  error?: string;
  pendingId?: string;
  accounts?: PendingAccountChoice[];
}

const isAnalyticsOAuthMessage = (
  data: unknown
): data is AnalyticsOAuthMessage => {
  if (typeof data !== 'object' || data === null || !('type' in data)) {
    return false;
  }
  const type = (data as { type: string }).type;
  return (
    type === 'analytics:oauth:done' ||
    type === 'analytics:oauth:error' ||
    type === 'analytics:oauth:choose-account'
  );
};

/**
 * Resolved value of `beginOAuth`. The Meta multi-account branch returns
 * `kind: 'pick-account'` so the caller can render a picker. All other
 * branches resolve to the historical `{ ok, error? }` shape so no existing
 * call sites need to change for LINE / TikTok / single-account Meta.
 */
export type BeginOAuthResult =
  | { ok: true; error?: undefined }
  | { ok: false; error?: string }
  | {
      ok: 'pick-account';
      pendingId: string;
      platform: SocialPlatform;
      accounts: PendingAccountChoice[];
    };

/**
 * ConnectionService is the OAuth + connection management surface for the
 * Analytics module. Wraps the `PlatformConnectionEntity` and exposes
 * `loadConnections` / `beginOAuth(platform)` / `disconnect(id)` against
 * the backend GraphQL.
 */
export class ConnectionService extends Service {
  readonly entity = this.framework.createEntity(PlatformConnectionEntity);

  constructor(private readonly serverService: WorkspaceServerService) {
    super();
  }

  // GraphQLService lives in ServerScope; route through the workspace's
  // bound server. See AnalyticsService for the explanation.
  private get graphql(): GraphQLService {
    const server = this.serverService.server;
    if (!server) {
      throw new Error('WorkspaceServerService.server not bound yet');
    }
    return server.scope.get(GraphQLService);
  }

  loadConnections = async (workspaceId: string): Promise<void> => {
    this.entity.setLoading(true);
    this.entity.setError(null);
    try {
      const data = await this.graphql.gql({
        query: listConnectionsQuery,
        variables: { workspaceId },
      });
      // The wire shape from `connections(...)` is a strict subset of
      // `PlatformConnection` — same field names, same types — so the
      // generated type is structurally assignable.
      this.entity.setConnections(
        (data.connections ?? []) as PlatformConnection[]
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.entity.setError(message);
      this.entity.setConnections([]);
      // Don't throw — empty connection list is the natural fallback.
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
  ): Promise<BeginOAuthResult> => {
    const data = await this.graphql.gql({
      query: beginPlatformConnectMutation,
      variables: {
        workspaceId,
        platform: platform as GqlSocialPlatform,
      },
    });
    const url = data.beginPlatformConnect.url;
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

    return await new Promise<BeginOAuthResult>(resolve => {
      let settled = false;
      const settle = (value: BeginOAuthResult) => {
        if (settled) return;
        settled = true;
        window.removeEventListener('message', onMessage);
        clearInterval(closedTimer);
        resolve(value);
      };

      const onMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        if (!isAnalyticsOAuthMessage(event.data)) return;
        const msg = event.data;
        if (msg.type === 'analytics:oauth:done') {
          // Refresh on success so the new ACTIVE row appears.
          this.loadConnections(workspaceId).catch(() => {
            /* loadConnections handles its own errors; swallow here */
          });
          settle({ ok: true });
        } else if (msg.type === 'analytics:oauth:choose-account') {
          // Multi-account Meta — defer settle to a typed pick-account
          // result; do NOT loadConnections here (no row exists yet) and do
          // NOT close the popup before reading the message (Chrome closes
          // it for us as part of the script in oauth-callback.controller).
          const accounts = Array.isArray(msg.accounts) ? msg.accounts : [];
          if (!msg.pendingId || accounts.length === 0) {
            // Defensive: the backend already filters these but we don't
            // want to land the user in a modal with no choices.
            settle({
              ok: false,
              error: 'No selectable accounts returned from the provider.',
            });
          } else {
            settle({
              ok: 'pick-account',
              pendingId: msg.pendingId,
              platform,
              accounts,
            });
          }
        } else {
          // Backend posts `message`; tolerate `error` for backwards compat.
          const detail = msg.message ?? msg.error;
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
      // we still want to refresh + resolve. We don't know which branch the
      // popup intended to take — refresh the connection list and resolve
      // ok:true so the UI doesn't hang. If the popup was the choose-account
      // path, the cached pending row will TTL-expire on its own.
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

  /**
   * Bind the user-picked account to a SocialConnection. Called from the
   * picker modal after `beginOAuth` resolved with `ok: 'pick-account'`.
   */
  finalizeConnection = async (
    workspaceId: string,
    pendingId: string,
    externalAccountId: string
  ): Promise<void> => {
    const data = await this.graphql.gql({
      query: finalizePlatformConnectMutation,
      variables: {
        input: { pendingId, externalAccountId },
      },
    });
    if (!data.finalizePlatformConnect?.id) {
      throw new Error(
        'finalizePlatformConnect did not return a connection row.'
      );
    }
    // Re-fetch the workspace's connection list so the new ACTIVE row
    // appears in the settings panel and any sibling views.
    await this.loadConnections(workspaceId);
  };

  /**
   * Discard a pending Meta OAuth picker session. Fire-and-forget — if the
   * mutation fails (network drop, TTL race), the cache row will expire on
   * its own; the user can retry by clicking Connect again.
   */
  cancelPendingOAuth = async (pendingId: string): Promise<void> => {
    try {
      await this.graphql.gql({
        query: cancelPlatformConnectMutation,
        variables: {
          input: { pendingId },
        },
      });
    } catch (err) {
      // Best-effort. The cache row will TTL-expire either way.
      console.warn(`[analytics] cancelPendingOAuth(${pendingId}) failed`, err);
    }
  };

  disconnect = async (connectionId: string): Promise<void> => {
    const data = await this.graphql.gql({
      query: disconnectPlatformMutation,
      variables: { connectionId },
    });
    if (data.disconnectPlatform === false) {
      throw new Error('Server refused to disconnect the platform');
    }
    this.entity.removeConnection(connectionId);
  };
}
