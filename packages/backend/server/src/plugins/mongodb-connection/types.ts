/**
 * MongoDB connection scaffold — direct-URI auth (NOT OAuth).
 *
 * Storage shape: the workspace stores a single connection string
 * (e.g. `mongodb://user:pass@host:port/db` or
 * `mongodb+srv://user:pass@cluster/db`) encrypted at rest in the
 * existing `IntegrationConnection` table — same column AESCBC-encryption
 * helper used for OAuth access tokens. The string is opaque to the
 * server; we never log it, parse it, or echo it to the frontend.
 *
 * Test flow: a "Test connection" mutation drives MongoClient.connect →
 * db.command({ ping: 1 }) → disconnect. The test path NEVER writes
 * to the workspace database; it only proves credentials work.
 *
 * Security posture:
 *  - Connection string IS the credential. Encrypt at rest.
 *  - NEVER log the URI even at error level — the password lives inside.
 *  - Surface to the frontend only as `connected: bool` + `host: string`
 *    (the parsed host without credentials).
 */

export type MongoDbScope = 'mongodb';

export const MONGODB_PROVIDER_NAME = 'mongodb';

export interface MongoDbConnectionStatus {
  connected: boolean;
  /**
   * The MongoDB host (e.g. `cluster0.abcde.mongodb.net`) parsed from
   * the connection string, with credentials stripped. Returned for the
   * "Connected to {host}" UI label. NEVER includes the password.
   */
  host?: string;
  /**
   * The database name (e.g. `analytics`) parsed from the connection
   * string. Optional — bare connection strings without a default
   * database may omit this.
   */
  database?: string;
}

/**
 * Input for the `setMongoDbConnection` mutation. Only the URI; the
 * server parses host + database for display.
 */
export interface MongoDbConnectionInput {
  uri: string;
}

/**
 * Result of a connection test. `ok=false` carries a friendly error
 * (no raw URI / no driver stack) so the frontend can render it
 * directly.
 */
export interface MongoDbConnectionTestResult {
  ok: boolean;
  error?: string;
  host?: string;
  database?: string;
  /** Round-trip latency of the `ping` command in milliseconds. */
  pingMs?: number;
}

// ============================================================================
// Schema-explorer + ingestion-config (Manut analytics Wave 2 / M3 E3.4)
// ============================================================================

/**
 * One row in the `db.listCollections()` result, plus an estimated
 * document count and (if the user has already opted in) the persisted
 * ingestion-config metadata.
 *
 * `estimatedCount` is `null` when the count call timed out or the
 * collection refused the command — the schema-explorer is best-effort
 * and we never block the picker UI on a slow count.
 */
export interface MongoCollectionInfo {
  name: string;
  estimatedCount?: number;
  enabled: boolean;
  cursorField?: string;
  lastSyncedAt?: Date;
  consecutiveFailures?: number;
  lastError?: string;
  lastErrorAt?: Date;
}

/**
 * Sampled documents, ObjectIds + Dates already string-serialised so the
 * frontend can `JSON.stringify` them without driver-specific helpers.
 */
export interface MongoSampleDocs {
  collectionName: string;
  /**
   * Each entry is the document JSON-stringified by the server (we do
   * the sanitisation server-side so the wire format is plain UTF-8).
   */
  documents: string[];
}

/**
 * Persisted ingestion-config row, surfaced verbatim to the frontend.
 * Mirrors the Prisma row shape — see `MnMongoIngestionConfig` in
 * schema.prisma.
 */
export interface MongoIngestionConfig {
  id: string;
  workspaceId: string;
  collectionName: string;
  enabled: boolean;
  cursorField: string;
  lastSyncedAt?: Date;
  lastCursorValue?: string;
  consecutiveFailures: number;
  lastError?: string;
  lastErrorAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input shape for the `setMongoIngestionConfig` mutation. Either
 * inserts a new (workspaceId, collectionName) row or updates the
 * existing one.
 */
export interface SetMongoIngestionConfigInput {
  collectionName: string;
  enabled: boolean;
  cursorField: string;
}
