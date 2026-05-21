import { Entity, LiveData } from '@toeverything/infra';
import type { SocialPlatform } from './analytics-data.entity';
export type ConnectionStatus = 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'ERROR' | 'NOT_CONNECTED';
/**
 * Mirrors backend `PlatformConnection` DTO. Round-C field names:
 *  - `externalAccountName` (was `accountHandle` in scaffolding)
 *  - `lastSyncAt` (was `lastSyncedAt`)
 *  - `lastError` newly added
 *
 * Legacy aliases are kept optional so existing UI keeps compiling while we
 * migrate. New code should reference the canonical names.
 */
export interface PlatformConnection {
    id: string;
    workspaceId: string;
    platform: SocialPlatform;
    status: ConnectionStatus;
    externalAccountName?: string | null;
    /** Legacy alias for externalAccountName. */
    accountHandle?: string | null;
    lastSyncAt?: string | null;
    /** Legacy alias for lastSyncAt. */
    lastSyncedAt?: string | null;
    lastError?: string | null;
}
/**
 * PlatformConnectionEntity holds the list of platform OAuth connections
 * for the active workspace. One row per platform + account.
 * Round-C wiring: data is provided externally via `setConnections` from
 * ConnectionService.loadConnections.
 */
export declare class PlatformConnectionEntity extends Entity {
    readonly connections$: LiveData<PlatformConnection[]>;
    readonly loading$: LiveData<boolean>;
    readonly error$: LiveData<string | null>;
    /**
     * True when the backend GraphQL schema does not expose `connections`.
     * That happens when the analytics module is disabled on the server
     * (e.g. `ENABLE_ANALYTICS_MODULE=false`, or an old image that pre-dates
     * the resolver). The settings view renders a friendly notice instead
     * of the generic "Unhandled error raised" banner so operators get a
     * useful message and the panel doesn't look broken.
     */
    readonly unavailable$: LiveData<boolean>;
    setLoading(loading: boolean): void;
    setError(error: string | null): void;
    setUnavailable(unavailable: boolean): void;
    setConnections(connections: PlatformConnection[]): void;
    removeConnection(id: string): void;
}
//# sourceMappingURL=platform-connection.entity.d.ts.map