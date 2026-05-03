import { randomUUID } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';

import { SessionCache } from '../../base';
import { Models } from '../../models';
import { getProvider } from './providers/registry.js';

const CONN_STATE_KEY = 'CONN_OAUTH_STATE';
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const REFRESH_LOCK_TTL_MS = 30 * 1000; // 30s — long enough for any refresh, short enough to recover from a crashed holder
const REFRESH_SKEW_MS = 60 * 1000; // refresh tokens 60s before expiry

export interface OAuthStartState {
  userId: string;
  workspaceId: string;
  provider: string;
  redirectUri: string;
}

/**
 * Thrown when a stored connection's token is expired and the provider does not
 * support refresh — the user must re-connect via OAuth.
 */
export class ConnectionTokenExpiredError extends Error {
  constructor(provider: string) {
    super(`OAuth token for ${provider} has expired and cannot be refreshed.`);
    this.name = 'ConnectionTokenExpiredError';
  }
}

@Injectable()
export class ConnectionsService {
  private readonly logger = new Logger(ConnectionsService.name);

  constructor(
    private readonly models: Models,
    private readonly cache: SessionCache
  ) {}

  /**
   * Save OAuth state and return the auth URL for the provider.
   */
  async initiateOAuth(
    userId: string,
    workspaceId: string,
    providerName: string,
    redirectUri: string
  ): Promise<string> {
    const provider = getProvider(providerName);
    if (!provider) {
      throw new Error(`Unknown provider: ${providerName}`);
    }

    const stateToken = randomUUID();
    const state: OAuthStartState = {
      userId,
      workspaceId,
      provider: providerName,
      redirectUri,
    };
    await this.cache.set(`${CONN_STATE_KEY}:${stateToken}`, state, {
      ttl: STATE_TTL_MS,
    });

    return provider.getAuthorizationUrl(stateToken, redirectUri);
  }

  /**
   * Exchange OAuth code for tokens, fetch user info, and store the connection.
   *
   * The state token is deleted from cache on first use (whether the exchange
   * succeeds or fails) to prevent replay attacks within the TTL window.
   */
  async handleCallback(
    code: string,
    stateToken: string
  ): Promise<{ provider: string; displayName: string }> {
    const stateKey = `${CONN_STATE_KEY}:${stateToken}`;
    const state = await this.cache.get<OAuthStartState>(stateKey);
    // Single-use: delete immediately, before any await on the provider, so a
    // concurrent replay cannot win the race even if the exchange is in flight.
    await this.cache.delete(stateKey);

    if (!state) {
      throw new Error('OAuth state expired or invalid');
    }

    const provider = getProvider(state.provider);
    if (!provider) {
      throw new Error(`Unknown provider: ${state.provider}`);
    }

    const tokens = await provider.exchangeCode(code, state.redirectUri);
    const userInfo = await provider.getUserInfo(tokens.accessToken);

    await this.models.integrationConnection.upsert({
      userId: state.userId,
      workspaceId: state.workspaceId,
      provider: state.provider,
      externalId: userInfo.externalId,
      displayName: userInfo.displayName,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiresAt: tokens.expiresAt,
      scopes: tokens.scopes,
    });

    this.logger.log(
      `User ${state.userId} connected ${state.provider} in workspace ${state.workspaceId}`
    );

    return { provider: state.provider, displayName: userInfo.displayName };
  }

  async listConnections(userId: string, workspaceId: string) {
    const connections = await this.models.integrationConnection.listByWorkspace(
      userId,
      workspaceId
    );
    return connections.map(c => ({
      id: c.id,
      provider: c.provider,
      displayName: c.displayName,
      scopes: c.scopes.split(',').filter(Boolean),
      createdAt: c.createdAt,
    }));
  }

  /**
   * Delete a stored OAuth connection. Returns true on success, false if the
   * connection did not exist. Re-throws on infra errors so the caller can
   * distinguish "not found" from "DB unreachable".
   */
  async disconnectProvider(
    userId: string,
    workspaceId: string,
    provider: string
  ): Promise<boolean> {
    try {
      await this.models.integrationConnection.delete(
        userId,
        workspaceId,
        provider
      );
      return true;
    } catch (err) {
      // Prisma throws P2025 on "Record to delete does not exist."
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: string }).code === 'P2025'
      ) {
        return false;
      }
      this.logger.error(
        `Failed to disconnect ${provider} for user ${userId}: ${err instanceof Error ? err.message : err}`
      );
      throw err;
    }
  }

  /**
   * Get a valid access token for a stored connection. Refreshes if expired and
   * the provider supports refresh; otherwise throws ConnectionTokenExpiredError.
   *
   * Concurrent refreshes are serialized via a distributed cache lock so two
   * requests don't both call the refresh endpoint and invalidate each other.
   * Returns null only if there is no stored connection at all.
   */
  async getAccessToken(
    userId: string,
    workspaceId: string,
    provider: string
  ): Promise<string | null> {
    const connection = await this.models.integrationConnection.getByProvider(
      userId,
      workspaceId,
      provider
    );
    if (!connection) return null;

    const decrypted =
      this.models.integrationConnection.decryptTokens(connection);
    if (!decrypted) return null;

    const expiresAt = decrypted.tokenExpiresAt;
    const isExpiringSoon =
      expiresAt && expiresAt.getTime() - Date.now() < REFRESH_SKEW_MS;

    if (!isExpiringSoon) {
      return decrypted.accessToken;
    }

    // Expired or expiring soon — try to refresh.
    return this.refreshAccessToken(
      userId,
      workspaceId,
      provider,
      decrypted.refreshToken ?? null
    );
  }

  private async refreshAccessToken(
    userId: string,
    workspaceId: string,
    providerName: string,
    refreshToken: string | null
  ): Promise<string> {
    const provider = getProvider(providerName);
    if (!provider || typeof provider.refreshAccessToken !== 'function') {
      throw new ConnectionTokenExpiredError(providerName);
    }
    if (!refreshToken) {
      throw new ConnectionTokenExpiredError(providerName);
    }

    const lockKey = `CONN_REFRESH_LOCK:${userId}:${workspaceId}:${providerName}`;
    const acquired = await this.cache.setnx(lockKey, 1, {
      ttl: REFRESH_LOCK_TTL_MS,
    });

    if (!acquired) {
      // Another request is refreshing. Wait briefly and re-read.
      await new Promise(r => setTimeout(r, 250));
      const fresh = await this.models.integrationConnection.getByProvider(
        userId,
        workspaceId,
        providerName
      );
      const decrypted =
        this.models.integrationConnection.decryptTokens(fresh);
      if (!decrypted) throw new ConnectionTokenExpiredError(providerName);
      return decrypted.accessToken;
    }

    try {
      const tokens = await provider.refreshAccessToken(refreshToken);
      await this.models.integrationConnection.updateTokens(
        userId,
        workspaceId,
        providerName,
        {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken ?? refreshToken,
          tokenExpiresAt: tokens.expiresAt,
        }
      );
      return tokens.accessToken;
    } finally {
      await this.cache.delete(lockKey);
    }
  }
}
