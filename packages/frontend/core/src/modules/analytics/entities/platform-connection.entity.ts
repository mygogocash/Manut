import { Entity, LiveData } from '@toeverything/infra';

import type { SocialPlatform } from './analytics-data.entity';

export type ConnectionStatus =
  | 'ACTIVE'
  | 'PAUSED'
  | 'EXPIRED'
  | 'ERROR'
  | 'NOT_CONNECTED';

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
export class PlatformConnectionEntity extends Entity {
  readonly connections$ = new LiveData<PlatformConnection[]>([]);
  readonly loading$ = new LiveData<boolean>(false);
  readonly error$ = new LiveData<string | null>(null);

  setLoading(loading: boolean): void {
    this.loading$.next(loading);
  }

  setError(error: string | null): void {
    this.error$.next(error);
  }

  setConnections(connections: PlatformConnection[]): void {
    this.connections$.next(connections);
  }

  removeConnection(id: string): void {
    const current = this.connections$.value;
    this.connections$.next(current.filter(c => c.id !== id));
  }
}
