import { Injectable, Logger } from '@nestjs/common';
import type { MnMongoIngestionConfig } from '@prisma/client';
import { PrismaClient } from '@prisma/client';

import type {
  MongoIngestionConfig,
  SetMongoIngestionConfigInput,
} from './types';

/**
 * Prisma CRUD on `MnMongoIngestionConfig` rows — the user-curated
 * picker of "which Mongo collections do we ingest" (Manut analytics
 * Wave 2 / M3 E3.4).
 *
 * Invariants enforced here so direct service callers (the future
 * ingestion worker, the CLI) get the same guarantees as GraphQL
 * clients:
 *
 *   1. (workspaceId, collectionName) is unique — upserts collapse to
 *      the existing row instead of duplicating. Matches the
 *      `@@unique` constraint in schema.prisma.
 *   2. `cursorField` falls back to `"updatedAt"` if the caller passes
 *      an empty string — the picker UI lets the user override but
 *      defaults to the AFFiNE/Mongo convention.
 *   3. Returned shapes match `MongoIngestionConfig` (no Prisma row
 *      leakage) so the resolver can hand them through to ObjectType
 *      mapping unchanged.
 *
 * CLAUDE.md scars honored:
 *  - `@Injectable()` is present so TS emits `design:paramtypes` and
 *    NestJS DI can resolve `PrismaClient` (v1.12.0 production scar).
 *  - `PrismaClient` is a RUNTIME import, not `import type`, so the
 *    constructor parameter metadata reflects the real class (same scar).
 *  - Row types like `MnMongoIngestionConfig` ARE imported via
 *    `import type` — pure type usage, no DI target.
 */
@Injectable()
export class MongoIngestionConfigService {
  private readonly logger = new Logger(MongoIngestionConfigService.name);

  constructor(private readonly db: PrismaClient) {}

  /**
   * List all ingestion-config rows for the workspace, ordered by
   * collection name. Used by the picker UI to overlay
   * enabled/cursorField/lastSyncedAt on top of the schema-explorer's
   * collection list.
   */
  async list(workspaceId: string): Promise<MongoIngestionConfig[]> {
    const rows = await this.db.mnMongoIngestionConfig.findMany({
      where: { workspaceId },
      orderBy: { collectionName: 'asc' },
    });
    return rows.map(rowToDto);
  }

  /**
   * Upsert a config row. The (workspaceId, collectionName) pair is the
   * unique key, so calling this with the same pair twice updates the
   * existing row in place.
   *
   * `cursorField` is trimmed; empty input falls back to the default.
   */
  async upsert(
    workspaceId: string,
    input: SetMongoIngestionConfigInput
  ): Promise<MongoIngestionConfig> {
    const collectionName = input.collectionName.trim();
    if (!collectionName) {
      throw new Error('collectionName must not be empty');
    }
    const cursorField = input.cursorField.trim() || 'updatedAt';

    const row = await this.db.mnMongoIngestionConfig.upsert({
      where: {
        workspaceId_collectionName: {
          workspaceId,
          collectionName,
        },
      },
      create: {
        workspaceId,
        collectionName,
        enabled: input.enabled,
        cursorField,
      },
      update: {
        enabled: input.enabled,
        cursorField,
      },
    });

    this.logger.log(
      `Workspace ${workspaceId} upserted ingestion config for collection ${collectionName} (enabled=${input.enabled})`
    );

    return rowToDto(row);
  }

  /**
   * Delete a config row. Returns `true` when a row was deleted and
   * `false` when no row matched — the resolver maps this to a Boolean
   * mutation result so the UI can show "Removed" vs "Not configured".
   */
  async delete(workspaceId: string, collectionName: string): Promise<boolean> {
    const trimmed = collectionName.trim();
    if (!trimmed) {
      return false;
    }
    try {
      await this.db.mnMongoIngestionConfig.delete({
        where: {
          workspaceId_collectionName: {
            workspaceId,
            collectionName: trimmed,
          },
        },
      });
      return true;
    } catch (err) {
      // P2025 = record-not-found in Prisma. Treat as a no-op delete
      // instead of propagating so the mutation is idempotent.
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: string }).code === 'P2025'
      ) {
        return false;
      }
      throw err;
    }
  }
}

function rowToDto(row: MnMongoIngestionConfig): MongoIngestionConfig {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    collectionName: row.collectionName,
    enabled: row.enabled,
    cursorField: row.cursorField,
    lastSyncedAt: row.lastSyncedAt ?? undefined,
    lastCursorValue: row.lastCursorValue ?? undefined,
    consecutiveFailures: row.consecutiveFailures,
    lastError: row.lastError ?? undefined,
    lastErrorAt: row.lastErrorAt ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
