import { Injectable } from '@nestjs/common';
import {
  ConnectionStatus as PrismaConnectionStatus,
  PrismaClient,
  SocialPlatform as PrismaSocialPlatform,
} from '@prisma/client';

import { CryptoHelper } from '../../../base';

export const LEGACY_SOCIAL_TOKEN_PREFIX = 'legacy-crypto:';

export type SocialConnectionHealthStatus =
  | 'saved'
  | 'verified'
  | 'expired'
  | 'error';

export interface SocialConnectionHealth {
  verified: boolean;
  healthStatus: SocialConnectionHealthStatus;
}

@Injectable()
export class SocialConnectionBridgeService {
  constructor(
    private readonly db: PrismaClient,
    private readonly crypto: CryptoHelper
  ) {}

  async upsertFromIntegration(input: {
    userId: string;
    workspaceId: string;
    platform: PrismaSocialPlatform;
    externalAccountId: string;
    externalAccountName: string;
    accessToken: string;
    refreshToken?: string | null;
    expiresAt?: Date | null;
    scopes: string[];
  }) {
    return await this.db.socialConnection.upsert({
      where: {
        workspaceId_platform_externalAccountId: {
          workspaceId: input.workspaceId,
          platform: input.platform,
          externalAccountId: input.externalAccountId,
        },
      },
      create: {
        workspaceId: input.workspaceId,
        platform: input.platform,
        status: PrismaConnectionStatus.ACTIVE,
        accessTokenEnc: this.encryptLegacy(input.accessToken),
        refreshTokenEnc: input.refreshToken
          ? this.encryptLegacy(input.refreshToken)
          : null,
        scopes: input.scopes,
        externalAccountId: input.externalAccountId,
        externalAccountName: input.externalAccountName,
        connectedByUserId: input.userId,
        expiresAt: input.expiresAt ?? null,
        lastErrorAt: null,
        lastError: null,
      },
      update: {
        status: PrismaConnectionStatus.ACTIVE,
        accessTokenEnc: this.encryptLegacy(input.accessToken),
        refreshTokenEnc: input.refreshToken
          ? this.encryptLegacy(input.refreshToken)
          : null,
        scopes: input.scopes,
        externalAccountName: input.externalAccountName,
        connectedByUserId: input.userId,
        expiresAt: input.expiresAt ?? null,
        lastErrorAt: null,
        lastError: null,
      },
    });
  }

  async pauseFromIntegration(input: {
    userId: string;
    workspaceId: string;
    platform: PrismaSocialPlatform;
  }): Promise<number> {
    const result = await this.db.socialConnection.updateMany({
      where: {
        workspaceId: input.workspaceId,
        platform: input.platform,
        connectedByUserId: input.userId,
        status: { not: PrismaConnectionStatus.PAUSED },
      },
      data: { status: PrismaConnectionStatus.PAUSED },
    });
    return result.count;
  }

  async getHealthForIntegration(input: {
    userId: string;
    workspaceId: string;
    platform: PrismaSocialPlatform;
    externalAccountId: string;
  }): Promise<SocialConnectionHealth> {
    const row = await this.db.socialConnection.findFirst({
      where: {
        workspaceId: input.workspaceId,
        platform: input.platform,
        connectedByUserId: input.userId,
        externalAccountId: input.externalAccountId,
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!row) {
      return { verified: false, healthStatus: 'saved' };
    }

    switch (row.status) {
      case PrismaConnectionStatus.ACTIVE:
        return { verified: true, healthStatus: 'verified' };
      case PrismaConnectionStatus.EXPIRED:
        return { verified: false, healthStatus: 'expired' };
      case PrismaConnectionStatus.ERROR:
        return { verified: false, healthStatus: 'error' };
      default:
        return { verified: false, healthStatus: 'saved' };
    }
  }

  private encryptLegacy(token: string): string {
    return `${LEGACY_SOCIAL_TOKEN_PREFIX}${this.crypto.encrypt(token)}`;
  }
}
