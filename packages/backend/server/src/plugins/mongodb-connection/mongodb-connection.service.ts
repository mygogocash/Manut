import { Injectable, Logger } from '@nestjs/common';

import { Models } from '../../models';
import {
  assertSafeOutboundHost,
  BlockedHostError,
} from '../connections/ssrf-guard';
import type {
  MongoDbConnectionStatus,
  MongoDbConnectionTestResult,
  MongoDbScope,
} from './types';
import { MONGODB_PROVIDER_NAME } from './types';

const MONGODB_URI_REGEX = /^mongodb(\+srv)?:\/\//i;

export class MongoDbConnectionNotConnectedError extends Error {
  constructor() {
    super('MongoDB is not connected for this workspace');
    this.name = 'MongoDbConnectionNotConnectedError';
  }
}

export class MongoDbConnectionInvalidUriError extends Error {
  constructor(detail: string) {
    super(`MongoDB connection string is invalid: ${detail}`);
    this.name = 'MongoDbConnectionInvalidUriError';
  }
}

/**
 * MongoDB connection scaffold.
 *
 * Direct-URI auth (NOT OAuth). Stores a single connection string
 * encrypted at rest in `IntegrationConnection.accessToken` — same
 * column used by OAuth scaffolds, so we inherit the existing AESCBC
 * encryption helper (`integrationConnection.decryptTokens`) without
 * any model changes.
 *
 * Security posture:
 *  - The connection string IS the credential. We treat it as such:
 *    encrypted at rest, never logged, never echoed back to the
 *    frontend. Only the parsed host + database are surfaced.
 *  - The "Test connection" path opens a fresh MongoClient connection,
 *    runs `db.command({ ping: 1 })`, and closes. No write paths are
 *    exercised by the scaffold.
 *
 * IMPORTANT: `mongodb` is a production dependency of @affine/server,
 * but we still load it lazily. Workspaces that never configure MongoDB
 * should not pay connection/client setup cost during normal app usage.
 * If a broken image ever omits the dependency again, `testConnection`
 * returns a friendly configuration error instead of crashing the
 * resolver.
 */
@Injectable()
export class MongoDbConnectionService {
  private readonly logger = new Logger(MongoDbConnectionService.name);

  constructor(private readonly models: Models) {}

  isConfigured(): boolean {
    return true;
  }

  /**
   * Persist a MongoDB connection string for the workspace. The URI is
   * encrypted before storage via the IntegrationConnection encryption
   * helper. No network IO — call `testConnection` to verify.
   *
   * Throws `MongoDbConnectionInvalidUriError` when the URI scheme is
   * not `mongodb://` or `mongodb+srv://`. We deliberately do NOT
   * validate beyond that — driver-level errors surface at test time
   * with full context.
   */
  async setConnection(
    userId: string,
    workspaceId: string,
    uri: string
  ): Promise<MongoDbConnectionStatus> {
    if (!MONGODB_URI_REGEX.test(uri)) {
      throw new MongoDbConnectionInvalidUriError(
        'must start with mongodb:// or mongodb+srv://'
      );
    }

    // SSRF guard: reject loopback / private / metadata hosts before the
    // URI is ever stored (the stored URI is later opened by
    // testConnection + the schema explorer). BlockedHostError is mapped
    // to a friendly BadRequest by the resolver.
    try {
      this.assertOutboundUriAllowed(uri);
    } catch (err) {
      if (err instanceof BlockedHostError) {
        throw new MongoDbConnectionInvalidUriError(
          'host is not allowed (private, loopback, or reserved address)'
        );
      }
      throw err;
    }

    // Parse for display only — discard if invalid; the driver will
    // surface a richer error at test time. Stripping the password
    // from the URL before parsing is unnecessary because URL parsing
    // separates userinfo from host already.
    const parsed = this.parseUriForDisplay(uri);

    await this.models.integrationConnection.upsert({
      userId,
      workspaceId,
      provider: MONGODB_PROVIDER_NAME,
      // We use the parsed host as `externalId` so reconnects with the
      // same host upsert cleanly. A user changing only the password
      // for the same cluster won't create a duplicate row.
      externalId: parsed.host ?? 'mongodb',
      displayName: parsed.host ?? 'MongoDB',
      // ACCESS TOKEN field carries the encrypted URI. Naming is
      // imperfect — the column is reused across token-style and
      // URI-style credentials.
      accessToken: uri,
      refreshToken: undefined,
      tokenExpiresAt: undefined,
      scopes: ['mongodb'],
      metadata: {
        host: parsed.host,
        database: parsed.database,
      },
    });

    this.logger.log(
      // CRITICAL: never log the URI itself — it contains the password.
      // Only the host is safe to log.
      `User ${userId} saved MongoDB connection to ${parsed.host ?? '(unknown host)'} for workspace ${workspaceId}`
    );

    return {
      connected: true,
      host: parsed.host,
      database: parsed.database,
    };
  }

  async getStatus(
    userId: string,
    workspaceId: string
  ): Promise<MongoDbConnectionStatus> {
    const conn = await this.models.integrationConnection.getByProvider(
      userId,
      workspaceId,
      MONGODB_PROVIDER_NAME
    );
    if (!conn) {
      return { connected: false };
    }
    const metadata = (conn.metadata ?? {}) as {
      host?: string;
      database?: string;
    };
    return {
      connected: true,
      host: metadata.host ?? conn.displayName,
      database: metadata.database,
    };
  }

  async disconnect(userId: string, workspaceId: string): Promise<boolean> {
    try {
      await this.models.integrationConnection.delete(
        userId,
        workspaceId,
        MONGODB_PROVIDER_NAME
      );
      return true;
    } catch (err) {
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: string }).code === 'P2025'
      ) {
        return false;
      }
      this.logger.error(
        `Failed to disconnect MongoDB for user ${userId}: ${err instanceof Error ? err.message : String(err)}`
      );
      throw err;
    }
  }

  /**
   * Test a candidate URI WITHOUT persisting it. Used by the inline
   * "Test" button on the frontend form before the user commits.
   *
   * Loads the `mongodb` driver lazily so the dependency is not
   * required at boot. On any failure (driver missing, URI invalid,
   * auth failed, network unreachable) returns `{ ok: false, error }`
   * with a friendly message — never raw driver text, which can
   * include the URI.
   */
  async testConnection(uri: string): Promise<MongoDbConnectionTestResult> {
    if (!MONGODB_URI_REGEX.test(uri)) {
      return {
        ok: false,
        error: 'Connection string must start with mongodb:// or mongodb+srv://',
      };
    }

    // SSRF guard before opening any socket — block private/loopback/
    // metadata targets a user could probe via this stateless test path.
    try {
      this.assertOutboundUriAllowed(uri);
    } catch (err) {
      if (err instanceof BlockedHostError) {
        return {
          ok: false,
          error:
            'That MongoDB host is not allowed. Use a publicly reachable cluster, not a private, loopback, or reserved address.',
        };
      }
      throw err;
    }

    const parsed = this.parseUriForDisplay(uri);

    // Lazy dynamic import: the `mongodb` driver is NOT a hard dep of
    // @affine/server — see module-level header for the rationale. The
    // `// @ts-expect-error` is REQUIRED because the type checker
    // can't resolve a package that isn't installed; at runtime the
    // dynamic import either succeeds (driver present) or fails
    // gracefully via `.catch(() => null)`. We rely on the stable
    // runtime contract (connect / db / command / close) which is
    // unchanged across every published mongodb driver version.
    type MongoDriver = {
      MongoClient: new (
        uri: string,
        opts?: Record<string, unknown>
      ) => {
        connect(): Promise<unknown>;
        db(name?: string): {
          command(cmd: Record<string, unknown>): Promise<unknown>;
        };
        close(): Promise<unknown>;
      };
    };

    let driver: MongoDriver | null = null;
    try {
      // Load lazily so the driver stays off non-Mongo request paths.
      driver = (await import('mongodb').catch(
        () => null
      )) as MongoDriver | null;
    } catch {
      driver = null;
    }
    if (!driver) {
      return {
        ok: false,
        error:
          'MongoDB driver is unavailable in this server build. Ask an admin to redeploy Manut with @affine/server production dependencies installed.',
      };
    }

    const { MongoClient } = driver;
    let client: InstanceType<typeof MongoClient> | null = null;
    const start = Date.now();
    try {
      client = new MongoClient(uri, {
        // Aggressive timeouts so a broken cluster doesn't hang the
        // request indefinitely. The actual API client gets default
        // timeouts when AI tools land — these are scoped to the test
        // probe only.
        serverSelectionTimeoutMS: 5_000,
        connectTimeoutMS: 5_000,
      });
      await client.connect();
      const db = client.db(parsed.database);
      await db.command({ ping: 1 });
      const pingMs = Date.now() - start;
      return {
        ok: true,
        host: parsed.host,
        database: parsed.database,
        pingMs,
      };
    } catch (err) {
      // Sanitise driver errors: strip URI fragments that may have
      // been included in connection-string error messages. We pattern-
      // match on the known `mongodb` URI prefix and replace.
      const raw = err instanceof Error ? err.message : String(err);
      const safe = raw.replace(/mongodb(\+srv)?:\/\/[^\s]+/gi, 'mongodb://***');
      return { ok: false, error: safe };
    } finally {
      if (client) {
        await client.close().catch(() => {
          /* swallow close errors — test result already determined */
        });
      }
    }
  }

  /**
   * Returns the stored (decrypted) URI for AI tools (when they ship)
   * to consume. NEVER expose this through GraphQL — only internal
   * service-to-service calls.
   */
  async getValidConnectionUri(
    userId: string,
    workspaceId: string,
    _scope: MongoDbScope = 'mongodb'
  ): Promise<string> {
    const conn = await this.models.integrationConnection.getByProvider(
      userId,
      workspaceId,
      MONGODB_PROVIDER_NAME
    );

    if (!conn) {
      throw new MongoDbConnectionNotConnectedError();
    }

    const decrypted = this.models.integrationConnection.decryptTokens(conn);
    if (!decrypted) {
      throw new MongoDbConnectionNotConnectedError();
    }

    return decrypted.accessToken;
  }

  /**
   * SSRF guard for a MongoDB connection string. Mongo URIs can carry
   * multiple comma-separated hosts (replica sets) and an optional
   * `mongodb+srv` scheme, neither of which the WHATWG URL parser
   * handles — so we extract every host from the authority by hand and
   * run each through the shared host guard. Throws BlockedHostError
   * when any host is loopback / private / link-local / metadata.
   * Public so the schema explorer can re-check a stored URI before it
   * opens a client (defense in depth).
   */
  assertOutboundUriAllowed(uri: string): void {
    const withoutScheme = uri.replace(/^mongodb(\+srv)?:\/\//i, '');
    const authority = withoutScheme.split(/[/?]/)[0] ?? '';
    const hostSection = authority.includes('@')
      ? authority.slice(authority.lastIndexOf('@') + 1)
      : authority;
    const hosts = hostSection
      .split(',')
      .map(hostPort => hostPort.replace(/:\d+$/, '').trim())
      .filter(Boolean);
    for (const host of hosts) {
      assertSafeOutboundHost(host);
    }
  }

  /**
   * Parse a connection URI into `{ host, database }` for display.
   * Strips credentials. Falls back to `undefined` on parse failure —
   * the driver surfaces the real error at test time.
   */
  private parseUriForDisplay(uri: string): {
    host?: string;
    database?: string;
  } {
    try {
      // Normalise `mongodb+srv` to `mongodb` for URL parsing; the
      // `+srv` suffix isn't standard URL syntax.
      const normalised = uri.replace(/^mongodb\+srv:\/\//i, 'mongodb://');
      const parsed = new URL(normalised);
      const host = parsed.hostname || undefined;
      // The path component carries the default database. Strip the
      // leading `/` and any `?` query string.
      const dbPart = parsed.pathname.replace(/^\//, '');
      const database = dbPart ? dbPart : undefined;
      return { host, database };
    } catch {
      return {};
    }
  }
}
