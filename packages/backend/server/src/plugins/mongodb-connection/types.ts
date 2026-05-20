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
