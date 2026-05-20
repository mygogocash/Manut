import { Injectable, Logger } from '@nestjs/common';

import { Models } from '../../models';
import { readPostHogConnectionEnv } from './manut-pro-config';
import {
  POSTHOG_DEFAULT_HOST,
  POSTHOG_PROVIDER_NAME,
  type PostHogConnectionStatus,
  type PostHogConnectionTestResult,
  type PostHogProjectsResponse,
  type PostHogScope,
} from './types';

export class PostHogConnectionNotConnectedError extends Error {
  constructor() {
    super('PostHog is not connected for this workspace');
    this.name = 'PostHogConnectionNotConnectedError';
  }
}

export class PostHogConnectionInvalidKeyError extends Error {
  constructor(detail: string) {
    super(`PostHog API key is invalid: ${detail}`);
    this.name = 'PostHogConnectionInvalidKeyError';
  }
}

/**
 * PostHog connection scaffold.
 *
 * API-key + host auth (NOT OAuth). The API key is encrypted at rest in
 * `IntegrationConnection.accessToken` (reusing the OAuth encryption
 * helper); the host is plaintext metadata.
 *
 * Connection probe: GET `{host}/api/projects/` with the API key as a
 * Bearer token. A 200 response with a project array confirms the key
 * has read access; we extract the project count for the UI badge.
 *
 * Security posture:
 *  - API key IS the credential. Encrypt at rest, never log.
 *  - Host is NOT a secret — log freely.
 *  - The test probe uses the same auth path as live calls; success
 *    means future read tools will work.
 */
@Injectable()
export class PostHogConnectionService {
  private readonly logger = new Logger(PostHogConnectionService.name);

  constructor(private readonly models: Models) {}

  isConfigured(): boolean {
    return true;
  }

  /**
   * Returns the host that should be pre-filled on the frontend form.
   * Reads `POSTHOG_DEFAULT_HOST` env var, then falls back to the
   * built-in default.
   */
  getDefaultHost(): string {
    return readPostHogConnectionEnv().defaultHost ?? POSTHOG_DEFAULT_HOST;
  }

  /**
   * Persist a PostHog API key + host for the workspace. The key is
   * encrypted before storage. No network IO — call `testConnection`
   * to verify.
   */
  async setConnection(
    userId: string,
    workspaceId: string,
    apiKey: string,
    host?: string
  ): Promise<PostHogConnectionStatus> {
    if (!apiKey || apiKey.trim().length < 10) {
      throw new PostHogConnectionInvalidKeyError(
        'API key must be at least 10 characters'
      );
    }

    const normalisedHost = this.normaliseHost(host ?? this.getDefaultHost());

    await this.models.integrationConnection.upsert({
      userId,
      workspaceId,
      provider: POSTHOG_PROVIDER_NAME,
      // External ID = host (so reconnects to the same instance upsert
      // cleanly). User changing only the key for the same host won't
      // create a duplicate row.
      externalId: normalisedHost,
      displayName: normalisedHost,
      accessToken: apiKey,
      refreshToken: undefined,
      tokenExpiresAt: undefined,
      scopes: ['posthog'],
      metadata: {
        host: normalisedHost,
      },
    });

    this.logger.log(
      `User ${userId} saved PostHog connection to ${normalisedHost} for workspace ${workspaceId}`
    );

    return {
      connected: true,
      host: normalisedHost,
    };
  }

  async getStatus(
    userId: string,
    workspaceId: string
  ): Promise<PostHogConnectionStatus> {
    const conn = await this.models.integrationConnection.getByProvider(
      userId,
      workspaceId,
      POSTHOG_PROVIDER_NAME
    );
    if (!conn) {
      return { connected: false };
    }
    const metadata = (conn.metadata ?? {}) as {
      host?: string;
      projectCount?: number;
    };
    return {
      connected: true,
      host: metadata.host ?? conn.displayName,
      projectCount: metadata.projectCount,
    };
  }

  async disconnect(userId: string, workspaceId: string): Promise<boolean> {
    try {
      await this.models.integrationConnection.delete(
        userId,
        workspaceId,
        POSTHOG_PROVIDER_NAME
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
        `Failed to disconnect PostHog for user ${userId}: ${err instanceof Error ? err.message : String(err)}`
      );
      throw err;
    }
  }

  /**
   * Stateless probe — does NOT persist. Used by the inline "Test"
   * button on the frontend form before the user saves.
   */
  async testConnection(
    apiKey: string,
    host?: string
  ): Promise<PostHogConnectionTestResult> {
    if (!apiKey || apiKey.trim().length < 10) {
      return {
        ok: false,
        error: 'API key must be at least 10 characters',
      };
    }
    const normalisedHost = this.normaliseHost(host ?? this.getDefaultHost());

    try {
      const url = `${normalisedHost}/api/projects/`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
        // Bound the probe so a broken host doesn't hang the request.
        signal: AbortSignal.timeout(5_000),
      });

      if (response.status === 401) {
        return {
          ok: false,
          host: normalisedHost,
          error:
            'PostHog rejected the API key (401). Double-check the key and try again.',
        };
      }
      if (!response.ok) {
        return {
          ok: false,
          host: normalisedHost,
          error: `PostHog returned ${response.status}. Verify the host and API key.`,
        };
      }
      const parsed = (await response.json()) as PostHogProjectsResponse;
      return {
        ok: true,
        host: normalisedHost,
        projectCount: parsed.count ?? parsed.results?.length ?? 0,
      };
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        host: normalisedHost,
        error: `Could not reach ${normalisedHost}: ${raw}`,
      };
    }
  }

  /**
   * Returns the stored (decrypted) API key + host for AI tools.
   */
  async getValidApiKey(
    userId: string,
    workspaceId: string,
    _scope: PostHogScope = 'posthog'
  ): Promise<{ apiKey: string; host: string }> {
    const conn = await this.models.integrationConnection.getByProvider(
      userId,
      workspaceId,
      POSTHOG_PROVIDER_NAME
    );

    if (!conn) {
      throw new PostHogConnectionNotConnectedError();
    }

    const decrypted = this.models.integrationConnection.decryptTokens(conn);
    if (!decrypted) {
      throw new PostHogConnectionNotConnectedError();
    }

    const metadata = (conn.metadata ?? {}) as { host?: string };
    return {
      apiKey: decrypted.accessToken,
      host: metadata.host ?? POSTHOG_DEFAULT_HOST,
    };
  }

  private normaliseHost(host: string): string {
    let trimmed = host.trim();
    if (!/^https?:\/\//i.test(trimmed)) {
      trimmed = `https://${trimmed}`;
    }
    // Strip trailing slash so URL composition (`${host}/api/...`) is
    // deterministic.
    return trimmed.replace(/\/$/, '');
  }
}
