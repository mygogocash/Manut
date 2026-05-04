import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient, SocialPlatform } from '@prisma/client';

import { Config } from '../../../base';
// Analytics config (including `analytics.kms`) is declared and registered in
// `../config.ts` to avoid TypeScript declaration-merging conflicts that
// previously forced runtime casts. See plugins/analytics/config.ts.
import '../config';

/**
 * Public interface for the analytics token store.
 *
 * Agent 2 (connections service / OAuth controllers) consumes this interface
 * via NestJS DI; never reach into the underlying KMS client directly.
 *
 * Per docs/analytics-platform.md §6 ("Auth & token security"):
 *   - All ciphertexts on disk are KMS-wrapped (envelope encryption is left to
 *     the KMS key policy — symmetric primary version is sufficient for v1).
 *   - Every successful decrypt MUST emit an audit-log row.
 *   - Tokens are NEVER logged in plaintext.
 */
export interface ITokenStore {
  encrypt(plaintext: string): Promise<string>;
  decrypt(ciphertext: string): Promise<string>;
}

/**
 * Optional per-call audit context. Provided by callers that have a request /
 * workspace scope (the OAuth controller, the refresh cron). The decrypt
 * implementation logs whatever it gets — missing fields fall back to a
 * "system" audit row so we never silently drop the audit log.
 */
export interface AuditContext {
  workspaceId?: string;
  userId?: string;
  platform?: SocialPlatform;
  requestId?: string;
  reason?: string;
}

/**
 * Lazy import the GCP KMS SDK so the server boots even if the package is
 * missing at runtime (e.g. in a fresh dev install before `yarn install`).
 * Real production builds bundle `@google-cloud/kms` via package.json.
 */
type KmsClient = {
  encrypt(req: {
    name: string;
    plaintext: Buffer;
  }): Promise<[{ ciphertext?: Buffer | string | Uint8Array | null }]>;
  decrypt(req: {
    name: string;
    ciphertext: Buffer;
  }): Promise<[{ plaintext?: Buffer | string | Uint8Array | null }]>;
};

@Injectable()
export class TokenStore implements ITokenStore, OnModuleInit {
  private readonly logger = new Logger(TokenStore.name);
  private client: KmsClient | undefined;
  private keyName: string = '';

  constructor(
    private readonly config: Config,
    private readonly db: PrismaClient
  ) {}

  async onModuleInit(): Promise<void> {
    const cfg = this.config.analytics?.kms;
    this.keyName = cfg?.keyName ?? '';

    if (!this.keyName) {
      // Fail-soft on boot. A missing key only matters when an OAuth flow
      // actually tries to encrypt — at that point we throw a clear error.
      this.logger.warn(
        'analytics.kms.keyName is not configured; token encryption will fail at runtime until set'
      );
      return;
    }

    try {
      // Dynamic import keeps the dependency optional at import time. The
      // @ts-ignore is necessary because the package may not yet be installed
      // in every environment (CI typecheck without `yarn install`); it IS in
      // package.json and present in production images.
      // @ts-ignore -- optional runtime dep declared in package.json
      const mod = await import('@google-cloud/kms');
      const KeyManagementServiceClient =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mod as any).KeyManagementServiceClient ??
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mod as any).default?.KeyManagementServiceClient;

      if (!KeyManagementServiceClient) {
        throw new Error(
          'KeyManagementServiceClient not exported from @google-cloud/kms'
        );
      }

      this.client = new KeyManagementServiceClient() as KmsClient;
      this.logger.log(
        `TokenStore initialized with KMS key ${this.redactKeyName(this.keyName)}`
      );
    } catch (error: unknown) {
      this.logger.error(
        'Failed to initialize @google-cloud/kms client',
        error instanceof Error ? error.stack : String(error)
      );
    }
  }

  async encrypt(plaintext: string): Promise<string> {
    if (typeof plaintext !== 'string' || plaintext.length === 0) {
      throw new Error('TokenStore.encrypt: plaintext must be a non-empty string');
    }

    const client = this.requireClient();
    const [result] = await client.encrypt({
      name: this.keyName,
      plaintext: Buffer.from(plaintext, 'utf8'),
    });

    const ciphertext = this.coerceToBuffer(result.ciphertext);
    if (!ciphertext) {
      throw new Error('KMS encrypt returned no ciphertext');
    }
    return ciphertext.toString('base64');
  }

  async decrypt(ciphertext: string): Promise<string> {
    return this.decryptWithAudit(ciphertext, undefined);
  }

  /**
   * Decrypt with an explicit audit context. Use this overload from any caller
   * that knows which workspace / user the decrypt is for so the audit row is
   * meaningful. The plain `decrypt()` method is provided to satisfy the
   * `ITokenStore` interface for cases where the caller has no context handy.
   */
  async decryptWithAudit(
    ciphertext: string,
    context: AuditContext | undefined
  ): Promise<string> {
    if (typeof ciphertext !== 'string' || ciphertext.length === 0) {
      throw new Error(
        'TokenStore.decrypt: ciphertext must be a non-empty string'
      );
    }

    const client = this.requireClient();
    const buf = Buffer.from(ciphertext, 'base64');

    let plaintext: string;
    try {
      const [result] = await client.decrypt({
        name: this.keyName,
        ciphertext: buf,
      });
      const out = this.coerceToBuffer(result.plaintext);
      if (!out) {
        throw new Error('KMS decrypt returned no plaintext');
      }
      plaintext = out.toString('utf8');
    } catch (error: unknown) {
      // Audit even on failure so a forensic trail exists for repeated
      // failures (could indicate tampering or rotated keys).
      await this.writeAuditRow(context, 'TOKEN_DECRYPT_FAILED').catch(err =>
        this.logger.error('Audit write failed', err instanceof Error ? err.stack : String(err))
      );
      throw error;
    }

    // Audit only on success path runs to here; failure path audited above.
    await this.writeAuditRow(context, 'TOKEN_DECRYPT').catch(err =>
      this.logger.error('Audit write failed', err instanceof Error ? err.stack : String(err))
    );

    return plaintext;
  }

  // -------------------------------------------------------------------------
  // private helpers
  // -------------------------------------------------------------------------

  private requireClient(): KmsClient {
    if (!this.client) {
      throw new Error(
        'TokenStore: KMS client is not initialized. Check analytics.kms.keyName config and that @google-cloud/kms is installed.'
      );
    }
    if (!this.keyName) {
      throw new Error(
        'TokenStore: analytics.kms.keyName is not configured.'
      );
    }
    return this.client;
  }

  private async writeAuditRow(
    context: AuditContext | undefined,
    action: 'TOKEN_DECRYPT' | 'TOKEN_DECRYPT_FAILED'
  ): Promise<void> {
    // Per PRD §6: audit row on every decrypt. Never include the token itself.
    await this.db.socialAuditLog.create({
      data: {
        workspaceId: context?.workspaceId ?? 'system',
        userId: context?.userId ?? null,
        platform: context?.platform ?? SocialPlatform.GOGOCASH,
        action,
        requestId: context?.requestId ?? null,
        metadata: context?.reason ? { reason: context.reason } : undefined,
      },
    });
  }

  private coerceToBuffer(
    value: Buffer | string | Uint8Array | null | undefined
  ): Buffer | null {
    if (!value) return null;
    if (Buffer.isBuffer(value)) return value;
    if (typeof value === 'string') return Buffer.from(value, 'base64');
    return Buffer.from(value);
  }

  /**
   * Redact a KMS key name for logging — keep the project + key, drop the ring
   * details that are sensitive in some deployments.
   */
  private redactKeyName(name: string): string {
    const parts = name.split('/');
    if (parts.length >= 8) {
      return `${parts[0]}/${parts[1]}/.../cryptoKeys/${parts[parts.length - 1]}`;
    }
    return name;
  }
}
