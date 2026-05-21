import { Service } from '@toeverything/infra';
import type { WorkspaceServerService } from '../../cloud';
import type { SocialPlatform } from '../entities/analytics-data.entity';
import { PlatformConnectionEntity } from '../entities/platform-connection.entity';
/**
 * True when the GraphQL error indicates the server's schema is missing an
 * analytics field — i.e. the analytics module is not loaded. We recognise
 * two signatures emitted by the server:
 *   1. `name === 'GRAPHQL_BAD_REQUEST'` with `data.code ===
 *      'GRAPHQL_VALIDATION_FAILED'` (the canonical extension shape
 *      surfaced through `UserFriendlyError`).
 *   2. A bare GraphQL validation message — fallback for cases where
 *      the error fell through the `fromAny` classifier and only the
 *      `.message` survived.
 *
 * The fallback matchers are deliberately schema-field-agnostic: both the
 * `connections` (settings panel) and `getOverview` (analytics dashboard)
 * loaders consume this classifier, and adding a new analytics resolver
 * MUST NOT require a parallel edit here. We match the generic Apollo
 * validation phrase plus the structured error code so future fields are
 * covered automatically.
 *
 * Used by `loadConnections` / `loadOverview` to flip an `unavailable` flag
 * instead of showing the generic "Unhandled error raised" banner. Public
 * so the settings view can also classify the synchronous `beginOAuth`
 * error path identically.
 */
export declare function isAnalyticsFeatureUnavailableError(err: unknown): boolean;
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
 * Resolved value of `beginOAuth`. The Meta multi-account branch returns
 * `kind: 'pick-account'` so the caller can render a picker. All other
 * branches resolve to the historical `{ ok, error? }` shape so no existing
 * call sites need to change for LINE / TikTok / single-account Meta.
 */
export type BeginOAuthResult = {
    ok: true;
    error?: undefined;
} | {
    ok: false;
    error?: string;
} | {
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
export declare class ConnectionService extends Service {
    private readonly serverService;
    readonly entity: PlatformConnectionEntity;
    constructor(serverService: WorkspaceServerService);
    private graphql;
    loadConnections: (workspaceId: string) => Promise<void>;
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
    beginOAuth: (workspaceId: string, platform: SocialPlatform) => Promise<BeginOAuthResult>;
    /**
     * Bind the user-picked account to a SocialConnection. Called from the
     * picker modal after `beginOAuth` resolved with `ok: 'pick-account'`.
     */
    finalizeConnection: (workspaceId: string, pendingId: string, externalAccountId: string) => Promise<void>;
    /**
     * Discard a pending Meta OAuth picker session. Fire-and-forget — if the
     * mutation fails (network drop, TTL race), the cache row will expire on
     * its own; the user can retry by clicking Connect again.
     */
    cancelPendingOAuth: (pendingId: string) => Promise<void>;
    disconnect: (connectionId: string) => Promise<void>;
}
//# sourceMappingURL=connection.service.d.ts.map