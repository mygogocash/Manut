import { Injectable, Logger } from '@nestjs/common';

import { Models } from '../../models';
import { readGoGoCashConnectionEnv } from './manut-pro-config';
import {
  GOGOCASH_PROVIDER_NAME,
  type GoGoCashConnectionStatus,
  type GoGoCashScope,
} from './types';

export class GoGoCashConnectionNotConnectedError extends Error {
  constructor() {
    super('GoGoCash is not connected for this workspace');
    this.name = 'GoGoCashConnectionNotConnectedError';
  }
}

export class GoGoCashConnectionInvalidKeyError extends Error {
  constructor(detail: string) {
    super(`GoGoCash API key is invalid: ${detail}`);
    this.name = 'GoGoCashConnectionInvalidKeyError';
  }
}

/**
 * GoGoCash internal connection scaffold.
 *
 * API-key auth (NOT OAuth, NOT external). The platform is Manut-
 * internal, so this scaffold is the minimal possible shape: store the
 * encrypted key, surface only `connected: bool` + a masked label, and
 * fall back to a server-wide `GOGOCASH_API_KEY` env var when no
 * workspace-scoped key is set.
 *
 * Live ingest is deferred — when the AI tools follow-up lands, it
 * consumes `getValidApiKey(userId, workspaceId)` exactly like the
 * other scaffolds.
 */
@Injectable()
export class GoGoCashConnectionService {
  private readonly logger = new Logger(GoGoCashConnectionService.name);

  constructor(private readonly models: Models) {}

  isConfigured(): boolean {
    return true;
  }

  /**
   * Persist a GoGoCash API key for the workspace. The key is
   * encrypted before storage. We do NOT probe an external API to
   * validate — the platform is internal, the contract is stable, and
   * any error surfaces at first ingest. Validation: non-empty + >= 8
   * chars (defensive only).
   */
  async setConnection(
    userId: string,
    workspaceId: string,
    apiKey: string,
    label?: string
  ): Promise<GoGoCashConnectionStatus> {
    if (!apiKey || apiKey.trim().length < 8) {
      throw new GoGoCashConnectionInvalidKeyError(
        'API key must be at least 8 characters'
      );
    }

    const maskedLabel = label ?? this.maskKey(apiKey);

    await this.models.integrationConnection.upsert({
      userId,
      workspaceId,
      provider: GOGOCASH_PROVIDER_NAME,
      // External ID = masked key prefix so re-saves of the same key
      // upsert in place. Re-keying triggers a new external ID and the
      // unique-constraint key on (userId, workspaceId, provider) keeps
      // the row count to one regardless.
      externalId: this.maskKey(apiKey),
      displayName: maskedLabel,
      accessToken: apiKey,
      refreshToken: undefined,
      tokenExpiresAt: undefined,
      scopes: ['gogocash'],
      metadata: {
        label: maskedLabel,
      },
    });

    // CRITICAL: do NOT log the API key itself — log only the masked
    // prefix so we can correlate without leaking the credential.
    this.logger.log(
      `User ${userId} saved GoGoCash connection (key prefix: ${this.maskKey(apiKey)}) for workspace ${workspaceId}`
    );

    return {
      connected: true,
      label: maskedLabel,
    };
  }

  async getStatus(
    userId: string,
    workspaceId: string
  ): Promise<GoGoCashConnectionStatus> {
    const conn = await this.models.integrationConnection.getByProvider(
      userId,
      workspaceId,
      GOGOCASH_PROVIDER_NAME
    );
    if (!conn) {
      // Fall back to the server-wide env var if set — workspaces can
      // see "connected: true" without saving anything explicitly in
      // self-hosted deployments where the admin set GOGOCASH_API_KEY.
      const envKey = readGoGoCashConnectionEnv().serverWideApiKey;
      if (envKey) {
        return {
          connected: true,
          label: `server default (${this.maskKey(envKey)})`,
        };
      }
      return { connected: false };
    }
    const metadata = (conn.metadata ?? {}) as { label?: string };
    return {
      connected: true,
      label: metadata.label ?? conn.displayName,
    };
  }

  async disconnect(userId: string, workspaceId: string): Promise<boolean> {
    try {
      await this.models.integrationConnection.delete(
        userId,
        workspaceId,
        GOGOCASH_PROVIDER_NAME
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
        `Failed to disconnect GoGoCash for user ${userId}: ${err instanceof Error ? err.message : String(err)}`
      );
      throw err;
    }
  }

  /**
   * Returns the stored API key for AI tools. Falls back to the
   * server-wide env var when no workspace-scoped key exists — but
   * only after explicit confirmation that the workspace was given
   * implicit access at creation. For the scaffold, env-var fallback
   * is permitted on all workspaces; future hardening might gate this
   * behind a per-workspace flag.
   */
  async getValidApiKey(
    userId: string,
    workspaceId: string,
    _scope: GoGoCashScope = 'gogocash'
  ): Promise<string> {
    const conn = await this.models.integrationConnection.getByProvider(
      userId,
      workspaceId,
      GOGOCASH_PROVIDER_NAME
    );
    if (conn) {
      const decrypted = this.models.integrationConnection.decryptTokens(conn);
      if (decrypted) {
        return decrypted.accessToken;
      }
    }

    const envKey = readGoGoCashConnectionEnv().serverWideApiKey;
    if (envKey) {
      return envKey;
    }

    throw new GoGoCashConnectionNotConnectedError();
  }

  /**
   * Return the first 6 chars of the API key + ellipsis. Used as the
   * external ID and as the display label so the user can confirm
   * which key is stored without us ever surfacing the full value.
   */
  private maskKey(apiKey: string): string {
    if (apiKey.length <= 6) return '***';
    return `${apiKey.slice(0, 6)}…`;
  }
}
