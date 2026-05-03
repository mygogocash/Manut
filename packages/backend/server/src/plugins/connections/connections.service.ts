import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { SessionCache } from '../../base';
import { Models } from '../../models';
import { getProvider } from './providers/registry.js';

const CONN_STATE_KEY = 'CONN_OAUTH_STATE';
const STATE_TTL_MS = 3600 * 3 * 1000; // 3 hours

export interface OAuthStartState {
  userId: string;
  workspaceId: string;
  provider: string;
  redirectUri: string;
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
   */
  async handleCallback(
    code: string,
    stateToken: string
  ): Promise<{ provider: string; displayName: string }> {
    const state = await this.cache.get<OAuthStartState>(
      `${CONN_STATE_KEY}:${stateToken}`
    );
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
    } catch {
      return false;
    }
  }

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
    return decrypted?.accessToken ?? null;
  }
}
