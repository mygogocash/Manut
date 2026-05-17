import { createHash, randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import type { MnExportSnapshot, Prisma } from '@prisma/client';
import { PrismaClient } from '@prisma/client';

/**
 * M5.3 — Workspace export snapshot service.
 *
 * Produces one row per export, keyed by the SHA-256 of the canonical
 * JSON payload. Re-exporting the same content is idempotent: the
 * `sha256 @unique` constraint makes the second create a guaranteed
 * conflict; we catch it and return the existing row instead so the
 * caller never sees duplicates.
 *
 * The manifest is JSON that describes the export (the producing
 * branch, which workspaces / agents / skills are present, etc.). The
 * payload is the actual content the manifest describes — it lives
 * outside Postgres in object storage for large snapshots, with the
 * pointer stored in `payloadBlobKey`. Small payloads MAY be inlined
 * via the manifest's own structure — we don't dictate that here.
 *
 * CLAUDE.md scars honored:
 *  - `@Injectable()` is present so TS emits `design:paramtypes` and
 *    NestJS DI can resolve `PrismaClient` (v1.12.0 production scar).
 *  - `PrismaClient` is a RUNTIME import (DI target) — never
 *    `import type`. Row types are `import type` (pure type usage).
 */
@Injectable()
export class MnExportSnapshotService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Compute the deterministic SHA-256 over a canonical payload string.
   * Exposed so callers (Branch B export pipeline, tests) can derive a
   * stable id BEFORE attempting the upsert — useful when the snapshot
   * row is created in a separate transaction from the payload upload.
   *
   * The input is treated as raw bytes (UTF-8 string OR `Uint8Array`).
   * Caller is responsible for producing a CANONICAL form (sorted keys,
   * stable whitespace, etc.) — otherwise the hash will differ between
   * runs even for semantically identical exports.
   */
  static computeSha256(payload: string | Uint8Array): string {
    const hash = createHash('sha256');
    hash.update(payload);
    return hash.digest('hex');
  }

  /**
   * Create-or-return-existing snapshot row.
   *
   * Idempotent on `sha256`: if a row with the same SHA already exists
   * for ANY workspace, we return it instead of creating a duplicate.
   * The unique constraint on `sha256` is global; that's intentional —
   * the SHA already includes everything that would make the row
   * different (including the workspace's data).
   *
   * Note: when an existing row is returned, the caller's `workspaceId`
   * / `createdByUserId` / `manifest` / `payloadBlobKey` arguments are
   * IGNORED. The snapshot is keyed by the bytes; you don't get to
   * claim someone else's snapshot under a different workspace.
   */
  async create(args: {
    workspaceId: string;
    createdByUserId: string | null;
    manifest: Prisma.InputJsonValue;
    /**
     * The raw payload to hash. Pass the same canonical bytes you wrote
     * to object storage so the SHA matches what consumers will see.
     */
    payload: string | Uint8Array;
    /**
     * Object storage key, if the payload lives outside Postgres. Null
     * when the manifest itself carries the full payload inline.
     */
    payloadBlobKey?: string | null;
  }): Promise<MnExportSnapshot> {
    const sha256 = MnExportSnapshotService.computeSha256(args.payload);
    const byteSize = byteSizeOf(args.payload);

    const existing = await this.db.mnExportSnapshot.findUnique({
      where: { sha256 },
    });
    if (existing) {
      return existing;
    }

    try {
      return await this.db.mnExportSnapshot.create({
        data: {
          id: randomUUID(),
          workspaceId: args.workspaceId,
          createdByUserId: args.createdByUserId ?? null,
          manifest: args.manifest,
          sha256,
          byteSize,
          payloadBlobKey: args.payloadBlobKey ?? null,
        },
      });
    } catch (err: unknown) {
      // Race condition: a parallel call slipped in between our
      // findUnique and create. Re-read the existing row instead of
      // surfacing the raw Prisma P2002.
      if (isPrismaUniqueViolation(err)) {
        const racedRow = await this.db.mnExportSnapshot.findUnique({
          where: { sha256 },
        });
        if (racedRow) return racedRow;
      }
      throw err;
    }
  }

  /**
   * List snapshots for a workspace, newest first. Pagination is left
   * for the caller — most UIs will only ever surface the most recent
   * handful, and the index `[workspaceId, createdAt(sort: Desc)]`
   * keeps that path cheap.
   */
  async list(workspaceId: string, take = 25): Promise<MnExportSnapshot[]> {
    return this.db.mnExportSnapshot.findMany({
      where: { workspaceId },
      orderBy: [{ createdAt: 'desc' }],
      take,
    });
  }

  /**
   * Get a single snapshot by id, scoped to the calling workspace so
   * cross-workspace dereferences are blocked even if the id leaks.
   */
  async get(
    workspaceId: string,
    snapshotId: string
  ): Promise<MnExportSnapshot | null> {
    const row = await this.db.mnExportSnapshot.findUnique({
      where: { id: snapshotId },
    });
    if (!row || row.workspaceId !== workspaceId) return null;
    return row;
  }

  /**
   * SHA-based lookup. Useful for "did we already export this exact
   * bundle?" probes from import / migration tooling.
   */
  async getBySha256(sha256: string): Promise<MnExportSnapshot | null> {
    return this.db.mnExportSnapshot.findUnique({ where: { sha256 } });
  }
}

/**
 * Best-effort byte count. Strings are UTF-8 encoded; Uint8Arrays are
 * already byte-sized. Anything larger than 2^31-1 bytes is clamped to
 * the max safe int — at that point the manifest is broken anyway and
 * the caller has bigger problems than a slightly inaccurate field.
 */
function byteSizeOf(payload: string | Uint8Array): number {
  if (typeof payload === 'string') {
    return Buffer.byteLength(payload, 'utf8');
  }
  return payload.byteLength;
}

/**
 * Crude duck-type check for Prisma's unique-constraint violation. We
 * don't depend on `Prisma.PrismaClientKnownRequestError` here so the
 * service stays trivially mockable in the test suite (which uses a
 * fake `db` object that doesn't go through Prisma's error wrapping).
 */
function isPrismaUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = (err as { code?: unknown }).code;
  return code === 'P2002';
}
