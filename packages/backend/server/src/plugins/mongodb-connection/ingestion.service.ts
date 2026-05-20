import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

import { Models } from '../../models';
import { MONGODB_PROVIDER_NAME } from './types';

/**
 * Manut Analytics — MongoDB ingestion service.
 *
 * Pulls documents from connected MongoDB clusters into our Postgres
 * landing table (`mn_mongo_raw_data`). One run per workspace iterates
 * every enabled `MnMongoIngestionConfig` row, opens a MongoClient
 * against the AES-decrypted URI from the existing `IntegrationConnection`
 * row, and pages forward by `cursorField` (default `updatedAt`, falls
 * back to `_id` which embeds a timestamp).
 *
 * CLAUDE.md scars honoured:
 *  - @Injectable() on the provider (v1.12.0 DI scar).
 *  - PrismaClient is a RUNTIME import (no `import type` for DI targets).
 *  - The `mongodb` driver is loaded lazily via dynamic import — same as
 *    `MongoDbConnectionService.testConnection` — so the dep is optional
 *    at boot. Without the driver, runs short-circuit with a warning.
 *  - URIs are NEVER logged: we decrypt via `IntegrationConnectionModel`
 *    and pass straight to `new MongoClient(uri, …)`. Only the parsed
 *    host (already on the IntegrationConnection row) gets logged.
 *
 * Failure isolation:
 *  - One workspace's failure must not break others. The cron drives
 *    `runForWorkspace` per row with its own try/catch.
 *  - Inside a workspace, one bad collection must not break the others.
 *    Each config row gets its own try/catch + counter.
 *  - Per-workspace circuit breaker: after 3 consecutive failures on a
 *    given config row, we flip `enabled=false` and emit telemetry.
 */

/** Maximum docs pulled per collection per run. Keeps memory bounded. */
const PER_RUN_DOC_LIMIT = 1000;

/** Hard ceiling on a single Mongo session so a hung cluster doesn't lock us up. */
const PER_RUN_TIMEOUT_MS = 30_000;

/** Three consecutive failures flips the row's `enabled` flag off. */
const CIRCUIT_BREAKER_FAILURE_THRESHOLD = 3;

/** How many workspaces we process in parallel under `runForAll`. */
const RUN_FOR_ALL_CONCURRENCY = 5;

/** Strip these fields entirely — pattern match (case-insensitive). */
const SENSITIVE_FIELD_PATTERN = /password|secret|token|key/i;

/** Truncate any string field longer than this many bytes. */
const MAX_STRING_FIELD_BYTES = 10 * 1024;

export interface IngestionResult {
  workspaceId: string;
  collectionsProcessed: number;
  docsIngested: number;
  durationMs: number;
  errors: string[];
}

interface IngestionConfigRow {
  id: string;
  workspaceId: string;
  collectionName: string;
  cursorField: string | null;
  lastCursorValue: string | null;
  consecutiveFailures: number;
  enabled: boolean;
}

interface MongoLikeClient {
  connect(): Promise<unknown>;
  db(name?: string): {
    collection(name: string): {
      find(query: Record<string, unknown>): {
        sort(spec: Record<string, 1 | -1>): {
          limit(n: number): {
            toArray(): Promise<unknown[]>;
          };
        };
      };
    };
  };
  close(): Promise<unknown>;
}

interface MongoDriverLike {
  MongoClient: new (
    uri: string,
    opts?: Record<string, unknown>
  ) => MongoLikeClient;
}

/**
 * Lazy driver loader. Returns null if the `mongodb` package is not
 * installed — keeps the dep optional at boot, just like
 * `MongoDbConnectionService.testConnection`.
 *
 * Exported so tests can inject a fake driver without touching globals.
 */
export type MongoDriverLoader = () => Promise<MongoDriverLike | null>;

const defaultDriverLoader: MongoDriverLoader = async () => {
  try {
    // @ts-expect-error — `mongodb` is an optional runtime dep that
    // may not be present in the workspace.
    return (await import('mongodb').catch(
      () => null
    )) as MongoDriverLike | null;
  } catch {
    return null;
  }
};

@Injectable()
export class MongoDbIngestionService {
  private readonly logger = new Logger(MongoDbIngestionService.name);

  /**
   * Override the driver loader in tests. Production callers leave this
   * alone — the dynamic import resolves to the real `mongodb` package.
   */
  driverLoader: MongoDriverLoader = defaultDriverLoader;

  constructor(
    private readonly db: PrismaClient,
    private readonly models: Models
  ) {}

  /**
   * Pull one workspace's worth of MongoDB documents into the landing
   * table. Returns counters; never throws — per-collection failures
   * are captured as `errors` entries and don't abort the workspace.
   *
   * The workspace's connection URI is looked up via the *workspace
   * owner's* IntegrationConnection row. The ingestion-config row
   * carries the userId so we know which connection to use.
   */
  async runForWorkspace(workspaceId: string): Promise<IngestionResult> {
    const start = Date.now();
    const result: IngestionResult = {
      workspaceId,
      collectionsProcessed: 0,
      docsIngested: 0,
      durationMs: 0,
      errors: [],
    };

    const configs = await this.findEnabledConfigs(workspaceId);
    if (configs.length === 0) {
      result.durationMs = Date.now() - start;
      return result;
    }

    const driver = await this.driverLoader();
    if (!driver) {
      // No driver — record the failure as an error per config row and
      // bail out. This is treated the same as a connection failure for
      // the circuit-breaker.
      const message = 'mongodb driver not installed on the server';
      for (const cfg of configs) {
        result.errors.push(`${cfg.collectionName}: ${message}`);
        await this.recordFailure(cfg, message);
      }
      result.durationMs = Date.now() - start;
      this.logger.warn(
        `MongoDB ingestion skipped for workspace=${workspaceId}: ${message}`
      );
      return result;
    }

    const uri = await this.lookupConnectionUri(workspaceId, configs);
    if (!uri) {
      const message = 'no MongoDB connection configured for workspace';
      for (const cfg of configs) {
        result.errors.push(`${cfg.collectionName}: ${message}`);
        await this.recordFailure(cfg, message);
      }
      result.durationMs = Date.now() - start;
      this.logger.warn(`${message}: workspace=${workspaceId}`);
      return result;
    }

    const { MongoClient } = driver;
    let client: MongoLikeClient | null = null;
    try {
      client = new MongoClient(uri, {
        serverSelectionTimeoutMS: 10_000,
        connectTimeoutMS: 10_000,
        // Overall socket timeout — the explicit per-run guard wraps
        // each find() too, but this is a safety net.
        socketTimeoutMS: PER_RUN_TIMEOUT_MS,
      });
      await client.connect();

      for (const cfg of configs) {
        try {
          const ingested = await this.ingestOneCollection(client, cfg);
          result.collectionsProcessed++;
          result.docsIngested += ingested;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          result.errors.push(`${cfg.collectionName}: ${message}`);
          await this.recordFailure(cfg, message);
          this.logger.error(
            `MongoDB ingest failed: workspace=${workspaceId} collection=${cfg.collectionName}: ${message}`
          );
        }
      }
    } catch (err) {
      // Connection-level failure — affects every config row.
      const message = err instanceof Error ? err.message : String(err);
      for (const cfg of configs) {
        result.errors.push(`${cfg.collectionName}: ${message}`);
        await this.recordFailure(cfg, message);
      }
      this.logger.error(
        `MongoDB connection failed: workspace=${workspaceId}: ${message}`
      );
    } finally {
      if (client) {
        await client.close().catch(() => {
          /* close errors are non-fatal */
        });
      }
    }

    result.durationMs = Date.now() - start;
    this.emitTelemetry(result);
    return result;
  }

  /**
   * Find all workspaces that have an active MongoDB IntegrationConnection
   * and drive `runForWorkspace` against each. Bounded concurrency keeps
   * a 100-workspace tenant from forking 100 simultaneous TCP connections
   * to Atlas.
   */
  async runForAll(): Promise<void> {
    const workspaceIds = await this.listWorkspacesWithMongoDb();
    if (workspaceIds.length === 0) {
      return;
    }

    // Chunked Promise.allSettled — process RUN_FOR_ALL_CONCURRENCY
    // workspaces in parallel, advance to the next chunk only when the
    // current one settles. allSettled means one failure can't break
    // the chain.
    for (let i = 0; i < workspaceIds.length; i += RUN_FOR_ALL_CONCURRENCY) {
      const chunk = workspaceIds.slice(i, i + RUN_FOR_ALL_CONCURRENCY);
      await Promise.allSettled(
        chunk.map(workspaceId =>
          this.runForWorkspace(workspaceId).catch(err => {
            // Defensive: runForWorkspace shouldn't throw, but if it
            // does we log and swallow so the surrounding loop keeps
            // going.
            this.logger.error(
              `runForWorkspace threw unexpectedly: workspace=${workspaceId}: ${
                err instanceof Error ? err.message : String(err)
              }`
            );
          })
        )
      );
    }
  }

  // -------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------

  /**
   * Pull docs for ONE collection, deserialize + sanitize + upsert into
   * `mn_mongo_raw_data`, then advance the cursor on the config row.
   * Throws on any IO error — the caller's try/catch logs + counts.
   */
  private async ingestOneCollection(
    client: MongoLikeClient,
    cfg: IngestionConfigRow
  ): Promise<number> {
    const cursorField = cfg.cursorField ?? 'updatedAt';
    const query = this.buildCursorQuery(cursorField, cfg.lastCursorValue);

    const docs = await this.runWithTimeout(
      client
        .db()
        .collection(cfg.collectionName)
        .find(query)
        .sort({ [cursorField]: 1 })
        .limit(PER_RUN_DOC_LIMIT)
        .toArray(),
      PER_RUN_TIMEOUT_MS,
      `find(${cfg.collectionName})`
    );

    if (docs.length === 0) {
      // No-op success — clear failure counter, leave cursor untouched.
      await this.recordSuccess(cfg.id, cfg.lastCursorValue);
      return 0;
    }

    let lastCursor: string | null = cfg.lastCursorValue;
    const ingestedAt = new Date();
    for (const doc of docs) {
      const docId = this.extractDocId(doc);
      const cursorValue = this.extractCursorValue(doc, cursorField);
      if (cursorValue !== null) {
        lastCursor = cursorValue;
      }

      const sanitized = this.sanitize(doc);
      const payload = this.safeStringify(sanitized);

      await this.db.$executeRaw`
        INSERT INTO mn_mongo_raw_data (
          workspace_id, collection_name, doc_id, payload, ingested_at
        ) VALUES (
          ${cfg.workspaceId}, ${cfg.collectionName}, ${docId}, ${payload}::jsonb, ${ingestedAt}
        )
        ON CONFLICT (workspace_id, collection_name, doc_id) DO UPDATE SET
          payload = EXCLUDED.payload,
          ingested_at = EXCLUDED.ingested_at
      `;
    }

    await this.recordSuccess(cfg.id, lastCursor);
    return docs.length;
  }

  /**
   * Build the Mongo find() query for the next cursor window.
   *
   * - First run (no `lastCursorValue`): we filter for docs that HAVE
   *   the cursor field (`{$exists: true}`), but no `$gt` clause —
   *   combined with `sort + limit(1000)` this picks up the oldest
   *   thousand docs as the seed window. Without this, the entire
   *   history would stream in.
   * - Subsequent runs: `{$gt: lastCursorValue}` advances by one.
   */
  private buildCursorQuery(
    cursorField: string,
    lastCursorValue: string | null
  ): Record<string, unknown> {
    if (lastCursorValue === null) {
      return { [cursorField]: { $exists: true } };
    }
    // We try to interpret the stored cursor as a Date first; if it
    // parses, we use the Date object (so the driver matches against
    // BSON Date fields). Otherwise we pass the raw string, which is
    // the right shape for ObjectId-string cursors as long as the
    // collection's _id was used as the cursor.
    const asDate = new Date(lastCursorValue);
    const isISODate =
      !Number.isNaN(asDate.getTime()) &&
      /^\d{4}-\d{2}-\d{2}T/.test(lastCursorValue);
    const cursor: unknown = isISODate ? asDate : lastCursorValue;
    return { [cursorField]: { $gt: cursor } };
  }

  /** ObjectId → String, leave plain strings alone. */
  private extractDocId(doc: unknown): string {
    if (doc === null || typeof doc !== 'object') {
      return 'unknown';
    }
    const id = (doc as Record<string, unknown>)._id;
    if (id === null || id === undefined) {
      return 'unknown';
    }
    // ObjectId instances stringify to 24-char hex.
    return String(id);
  }

  /**
   * Pull the cursor value out of the doc for the next run. Returns an
   * ISO date string for `Date` fields, the raw stringification for
   * ObjectIds, or null if the field is missing.
   */
  private extractCursorValue(doc: unknown, cursorField: string): string | null {
    if (doc === null || typeof doc !== 'object') {
      return null;
    }
    const value = (doc as Record<string, unknown>)[cursorField];
    if (value === null || value === undefined) {
      return null;
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    return String(value);
  }

  /**
   * Recursively scrub a document into a JSON-safe shape:
   *  - ObjectId → string
   *  - Date → ISO string
   *  - Binary / Buffer / Uint8Array → "[binary]" placeholder
   *  - Sensitive fields stripped by name (case-insensitive)
   *  - Strings > MAX_STRING_FIELD_BYTES truncated with a `[truncated]` tail
   *
   * Pure function, no driver dependency.
   */
  private sanitize(value: unknown): unknown {
    return this.sanitizeInternal(value, new WeakSet());
  }

  private sanitizeInternal(value: unknown, seen: WeakSet<object>): unknown {
    if (value === null || value === undefined) {
      return value;
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === 'string') {
      if (Buffer.byteLength(value, 'utf8') > MAX_STRING_FIELD_BYTES) {
        return value.slice(0, MAX_STRING_FIELD_BYTES) + '…[truncated]';
      }
      return value;
    }
    if (
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      typeof value === 'bigint'
    ) {
      return typeof value === 'bigint' ? value.toString() : value;
    }
    // Binary / Buffer / Uint8Array → placeholder.
    if (
      value instanceof Uint8Array ||
      (typeof Buffer !== 'undefined' && Buffer.isBuffer(value))
    ) {
      return '[binary]';
    }
    if (Array.isArray(value)) {
      // Cycle guard — arrays can be self-referential too.
      if (seen.has(value)) return '[cycle]';
      seen.add(value);
      return value.map(v => this.sanitizeInternal(v, seen));
    }
    if (typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      // Mongo ObjectId class quacks like { toHexString(): string } —
      // detect by duck-typing because we don't import the driver type.
      const toHex = (obj as { toHexString?: unknown }).toHexString;
      if (typeof toHex === 'function') {
        try {
          return (toHex as () => string).call(obj);
        } catch {
          return String(obj);
        }
      }
      if (seen.has(obj)) return '[cycle]';
      seen.add(obj);
      const out: Record<string, unknown> = {};
      for (const [key, v] of Object.entries(obj)) {
        if (SENSITIVE_FIELD_PATTERN.test(key)) {
          // Drop entirely — no `[redacted]` placeholder, since we
          // don't want to confirm the field's existence either.
          continue;
        }
        out[key] = this.sanitizeInternal(v, seen);
      }
      return out;
    }
    // Functions, Symbols, etc. — drop.
    return null;
  }

  /**
   * JSON.stringify with a hard fallback. Anything that throws (e.g.
   * a BigInt slipping through the sanitizer) gets recorded as the
   * stringified error so we still write a row.
   */
  private safeStringify(value: unknown): string {
    try {
      return JSON.stringify(value);
    } catch (err) {
      return JSON.stringify({
        _serializationError: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Wrap a promise in a hard timeout. We use this around the Mongo
   * find() so a hung cluster can't pin a workspace open indefinitely.
   */
  private async runWithTimeout<T>(
    p: Promise<T>,
    timeoutMs: number,
    label: string
  ): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(
        () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
        timeoutMs
      );
    });
    try {
      return await Promise.race([p, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /**
   * Reset the failure counter and advance the cursor pointer for the
   * config row. Uses raw SQL because Agent A's Prisma model isn't
   * landed yet — this keeps the implementation independent of the
   * migration.
   */
  private async recordSuccess(
    configId: string,
    lastCursorValue: string | null
  ): Promise<void> {
    await this.db.$executeRaw`
      UPDATE mn_mongo_ingestion_config
      SET
        last_synced_at = NOW(),
        last_cursor_value = ${lastCursorValue},
        consecutive_failures = 0,
        last_error = NULL
      WHERE id = ${configId}
    `;
  }

  /**
   * Bump the failure counter. When it reaches CIRCUIT_BREAKER_FAILURE_THRESHOLD
   * we flip `enabled=false` and log + emit telemetry.
   */
  private async recordFailure(
    cfg: IngestionConfigRow,
    message: string
  ): Promise<void> {
    const nextCount = cfg.consecutiveFailures + 1;
    const shouldDisable = nextCount >= CIRCUIT_BREAKER_FAILURE_THRESHOLD;
    await this.db.$executeRaw`
      UPDATE mn_mongo_ingestion_config
      SET
        consecutive_failures = ${nextCount},
        last_error = ${message},
        last_error_at = NOW(),
        enabled = ${!shouldDisable}
      WHERE id = ${cfg.id}
    `;
    if (shouldDisable) {
      this.logger.warn(
        `MongoDB ingestion circuit-breaker tripped: workspace=${cfg.workspaceId} collection=${cfg.collectionName} after ${nextCount} consecutive failures — disabling.`
      );
      this.emitCircuitBreakerEvent(cfg);
    }
  }

  /**
   * Look up the decrypted URI for the workspace via the existing
   * IntegrationConnection model. We use the configuredBy userId on
   * the first config row — every config row in a workspace shares
   * the same underlying connection.
   */
  private async lookupConnectionUri(
    workspaceId: string,
    configs: IngestionConfigRow[]
  ): Promise<string | null> {
    if (configs.length === 0) return null;
    // Find ANY MongoDB connection row for this workspace. We don't
    // tie a specific userId to a specific config — the
    // IntegrationConnection table has a composite unique on
    // (userId, workspaceId, provider) and we just need ONE row for
    // this workspace+provider tuple.
    const conn = await this.db.integrationConnection.findFirst({
      where: { workspaceId, provider: MONGODB_PROVIDER_NAME },
    });
    if (!conn) return null;
    const decrypted = this.models.integrationConnection.decryptTokens(conn);
    if (!decrypted) return null;
    return decrypted.accessToken;
  }

  /**
   * Find enabled ingestion-config rows for a workspace.
   * Raw SQL because Agent A's Prisma model isn't merged yet.
   */
  private async findEnabledConfigs(
    workspaceId: string
  ): Promise<IngestionConfigRow[]> {
    const rows = await this.db.$queryRaw<
      Array<{
        id: string;
        workspace_id: string;
        collection_name: string;
        cursor_field: string | null;
        last_cursor_value: string | null;
        consecutive_failures: number;
        enabled: boolean;
      }>
    >`
      SELECT
        id,
        workspace_id,
        collection_name,
        cursor_field,
        last_cursor_value,
        consecutive_failures,
        enabled
      FROM mn_mongo_ingestion_config
      WHERE workspace_id = ${workspaceId} AND enabled = TRUE
    `;
    return rows.map(r => ({
      id: r.id,
      workspaceId: r.workspace_id,
      collectionName: r.collection_name,
      cursorField: r.cursor_field,
      lastCursorValue: r.last_cursor_value,
      consecutiveFailures: r.consecutive_failures,
      enabled: r.enabled,
    }));
  }

  /**
   * Return the distinct set of workspaceIds that have a non-empty
   * MongoDB IntegrationConnection row. We deduplicate because the
   * IntegrationConnection table is keyed by (userId, workspaceId,
   * provider) — one workspace can have multiple users with their own
   * rows, but they share the same provider URI.
   */
  private async listWorkspacesWithMongoDb(): Promise<string[]> {
    const conns = await this.db.integrationConnection.findMany({
      where: { provider: MONGODB_PROVIDER_NAME },
      select: { workspaceId: true },
      distinct: ['workspaceId'],
    });
    return conns.map(c => c.workspaceId);
  }

  /**
   * Per-run telemetry event. Logs at info on success, warn on partial,
   * error on full failure. Emitted as a structured log line so the
   * downstream log pipeline can rip the fields back out.
   */
  private emitTelemetry(result: IngestionResult): void {
    const payload = JSON.stringify({
      event: 'mongo_ingestion_run',
      workspaceId: result.workspaceId,
      collectionsProcessed: result.collectionsProcessed,
      docsIngested: result.docsIngested,
      durationMs: result.durationMs,
      errorCount: result.errors.length,
    });
    if (result.errors.length === 0) {
      this.logger.log(payload);
    } else if (result.collectionsProcessed > 0) {
      this.logger.warn(payload);
    } else {
      this.logger.error(payload);
    }
  }

  /**
   * Circuit-breaker tripping is its own structured event so the
   * downstream alerting can fan out on it.
   */
  private emitCircuitBreakerEvent(cfg: IngestionConfigRow): void {
    this.logger.warn(
      JSON.stringify({
        event: 'mongo_ingestion_circuit_breaker',
        workspaceId: cfg.workspaceId,
        collectionName: cfg.collectionName,
        configId: cfg.id,
      })
    );
  }
}
