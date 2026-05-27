import { Injectable, Logger } from '@nestjs/common';

import { MongoDbConnectionService } from './mongodb-connection.service';
import type { MongoCollectionInfo, MongoSampleDocs } from './types';

/**
 * Minimal runtime shape of the `mongodb` driver we need. Mirrors the
 * narrow contract used by `MongoDbConnectionService.testConnection` so
 * the dynamic-import dance stays consistent.
 *
 * The driver is an OPTIONAL runtime dep — we never bind to its types
 * at compile time because the package may not be installed (CLAUDE.md
 * §6c). The `// @ts-expect-error` on the dynamic import is required.
 */
interface MongoDriver {
  MongoClient: new (
    uri: string,
    opts?: Record<string, unknown>
  ) => MongoClientInstance;
}

interface MongoClientInstance {
  connect(): Promise<unknown>;
  db(name?: string): MongoDbHandle;
  close(): Promise<unknown>;
}

interface MongoDbHandle {
  listCollections(
    filter?: Record<string, unknown>,
    opts?: Record<string, unknown>
  ): {
    toArray(): Promise<Array<{ name: string; type?: string }>>;
  };
  collection(name: string): MongoCollectionHandle;
}

interface MongoCollectionHandle {
  estimatedDocumentCount(opts?: { maxTimeMS?: number }): Promise<number>;
  aggregate(
    pipeline: Array<Record<string, unknown>>,
    opts?: { maxTimeMS?: number }
  ): {
    toArray(): Promise<unknown[]>;
  };
}

/**
 * Sentinel value returned when an estimated-count call refuses to
 * complete inside the timeout. We keep the row in the result set so
 * the picker UI still shows the collection — count is decorative.
 */
const COUNT_TIMEOUT_MS = 3_000;
const SAMPLE_TIMEOUT_MS = 5_000;
const DEFAULT_SAMPLE_SIZE = 5;
/**
 * Hard cap on sample size so a malicious / mistaken caller cannot pull
 * down arbitrary numbers of documents through the picker UI.
 */
const MAX_SAMPLE_SIZE = 20;

export class MongoDbDriverMissingError extends Error {
  constructor() {
    super(
      'MongoDB driver is not installed on the server. Ask an admin to add the `mongodb` package to @affine/server.'
    );
    this.name = 'MongoDbDriverMissingError';
  }
}

/**
 * Schema-explorer for connected MongoDB clusters — drives the
 * collection-picker UI (Manut analytics Wave 2 / M3 E3.4).
 *
 * Two responsibilities:
 *
 * 1. `listCollections(workspaceId)` — opens a fresh MongoClient
 *    against the workspace's stored URI, calls `db.listCollections()`,
 *    and decorates each entry with an `estimatedDocumentCount` (3s
 *    timeout per collection so a slow shard doesn't gum up the call).
 * 2. `sampleDocs(workspaceId, collectionName, limit)` — runs
 *    `[{ $sample: { size } }]` with a 5s timeout, sanitises ObjectIds
 *    and Dates to strings, and JSON-stringifies each document so the
 *    wire format is plain UTF-8 (no BSON helpers needed on the
 *    frontend).
 *
 * Security posture:
 *  - The connection URI is decrypted on demand via
 *    `MongoDbConnectionService.getValidConnectionUri`. We NEVER log
 *    it, NEVER echo it back to the frontend, and NEVER include it in
 *    error messages.
 *  - Driver errors are sanitised by `sanitiseDriverError` before
 *    being propagated — the same regex the existing
 *    `MongoDbConnectionService.testConnection` uses.
 *  - The driver is imported lazily via `await import('mongodb')` so a
 *    workspace that never opens this panel never pays the bundle
 *    cost (matches the rationale in
 *    `mongodb-connection.service.ts`'s module header).
 */
@Injectable()
export class MongoSchemaExplorerService {
  private readonly logger = new Logger(MongoSchemaExplorerService.name);

  constructor(private readonly connection: MongoDbConnectionService) {}

  /**
   * Lazy-load the `mongodb` driver. Returns `null` if the package isn't
   * installed — callers map this to a friendly error.
   */
  private async loadDriver(): Promise<MongoDriver | null> {
    try {
      // `mongodb` is optional; null here means "driver not installed".
      // eslint-disable-next-line import-x/no-extraneous-dependencies
      const mod = (await import('mongodb').catch(
        () => null
      )) as MongoDriver | null;
      return mod;
    } catch {
      return null;
    }
  }

  /**
   * List collections in the workspace's MongoDB cluster, plus an
   * estimated document count for each. Per-collection count call is
   * capped at 3s so a single slow collection doesn't block the picker.
   *
   * Caller MUST be authenticated and authorised for the workspace —
   * gate at the resolver, not here.
   */
  async listCollections(
    userId: string,
    workspaceId: string
  ): Promise<MongoCollectionInfo[]> {
    const driver = await this.loadDriver();
    if (!driver) {
      throw new MongoDbDriverMissingError();
    }
    // Throws MongoDbConnectionNotConnectedError if no row — let the
    // resolver translate.
    const uri = await this.connection.getValidConnectionUri(
      userId,
      workspaceId
    );

    const { MongoClient } = driver;
    let client: MongoClientInstance | null = null;
    try {
      client = new MongoClient(uri, {
        serverSelectionTimeoutMS: 5_000,
        connectTimeoutMS: 5_000,
      });
      await client.connect();
      const db = client.db();
      // Filter system collections to keep the picker focused on the
      // user's data. The `system.*` namespace and Mongo's `_oplog` etc.
      // are never useful to ingest.
      const collections = await db
        .listCollections(
          {},
          {
            nameOnly: true,
            authorizedCollections: true,
          }
        )
        .toArray();

      const userCollections = collections.filter(
        c => typeof c.name === 'string' && !c.name.startsWith('system.')
      );

      // Best-effort count per collection. We fan out with
      // `Promise.all` so the total wall-clock is at most COUNT_TIMEOUT_MS,
      // not COUNT_TIMEOUT_MS × N.
      const counts = await Promise.all(
        userCollections.map(async c => {
          try {
            const count = await db.collection(c.name).estimatedDocumentCount({
              maxTimeMS: COUNT_TIMEOUT_MS,
            });
            return { name: c.name, count };
          } catch (err) {
            this.logger.warn(
              `estimatedDocumentCount failed for ${c.name} in workspace ${workspaceId}: ${err instanceof Error ? err.message : String(err)}`
            );
            return { name: c.name, count: undefined };
          }
        })
      );

      // The resolver layer joins ingestion-config rows on top of this
      // (enabled / cursorField / lastSyncedAt) — we leave them defaulted
      // here.
      return counts.map(({ name, count }) => ({
        name,
        estimatedCount: count,
        enabled: false,
      }));
    } catch (err) {
      throw new Error(this.sanitiseDriverError(err));
    } finally {
      if (client) {
        await client.close().catch(() => {
          /* swallow — result already determined */
        });
      }
    }
  }

  /**
   * Return N sampled documents from the named collection. ObjectIds
   * and Dates are stringified server-side. Hard-capped at 5s
   * (`maxTimeMS`) so a missing index on `$sample` can't hang the
   * picker.
   */
  async sampleDocs(
    userId: string,
    workspaceId: string,
    collectionName: string,
    limit: number = DEFAULT_SAMPLE_SIZE
  ): Promise<MongoSampleDocs> {
    const size = Math.min(Math.max(1, limit), MAX_SAMPLE_SIZE);
    const driver = await this.loadDriver();
    if (!driver) {
      throw new MongoDbDriverMissingError();
    }
    const uri = await this.connection.getValidConnectionUri(
      userId,
      workspaceId
    );

    const { MongoClient } = driver;
    let client: MongoClientInstance | null = null;
    try {
      client = new MongoClient(uri, {
        serverSelectionTimeoutMS: 5_000,
        connectTimeoutMS: 5_000,
      });
      await client.connect();
      const db = client.db();
      const docs = await db
        .collection(collectionName)
        .aggregate([{ $sample: { size } }], {
          maxTimeMS: SAMPLE_TIMEOUT_MS,
        })
        .toArray();

      const documents = docs.map(d => JSON.stringify(sanitiseDoc(d)));
      return { collectionName, documents };
    } catch (err) {
      throw new Error(this.sanitiseDriverError(err));
    } finally {
      if (client) {
        await client.close().catch(() => {
          /* swallow */
        });
      }
    }
  }

  /**
   * Strip any `mongodb://` / `mongodb+srv://` URIs from driver error
   * messages — the credentials live inside the URI and must NEVER be
   * propagated. Same regex used by
   * `MongoDbConnectionService.testConnection`.
   */
  private sanitiseDriverError(err: unknown): string {
    const raw = err instanceof Error ? err.message : String(err);
    return raw.replace(/mongodb(\+srv)?:\/\/[^\s]+/gi, 'mongodb://***');
  }
}

/**
 * Recursively convert ObjectIds and Dates to plain strings inside a
 * Mongo document. Everything else passes through. We avoid pulling
 * `bson` directly — checking for `_bsontype === 'ObjectId'` is the
 * documented duck-type for ObjectIds across every published driver
 * version.
 */
function sanitiseDoc(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown> & { _bsontype?: string };
    // ObjectId — drivers expose `_bsontype` and a `toHexString()` method
    if (
      obj._bsontype === 'ObjectId' &&
      typeof (obj as { toHexString?: () => string }).toHexString === 'function'
    ) {
      return (obj as { toHexString: () => string }).toHexString();
    }
    // Decimal128 / Long / etc. — fall back to .toString() if present.
    if (
      typeof obj._bsontype === 'string' &&
      typeof (obj as { toString?: () => string }).toString === 'function'
    ) {
      return String(obj);
    }
    if (Array.isArray(value)) {
      return value.map(sanitiseDoc);
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = sanitiseDoc(v);
    }
    return out;
  }
  return value;
}
