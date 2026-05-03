import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { CryptoHelper } from '../base';
import { BaseModel } from './base';

export interface CreateIntegrationConnectionInput {
  userId: string;
  workspaceId: string;
  provider: string;
  externalId: string;
  displayName: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  scopes: string[];
  metadata?: Record<string, unknown>;
}

export interface UpdateIntegrationConnectionTokensInput {
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
}

@Injectable()
export class IntegrationConnectionModel extends BaseModel {
  constructor(private readonly crypto: CryptoHelper) {
    super();
  }

  private encryptToken(token: string): string {
    return this.crypto.encrypt(token);
  }

  private decryptToken(token: string): string {
    return this.crypto.decrypt(token);
  }

  async upsert(input: CreateIntegrationConnectionInput) {
    const accessToken = this.encryptToken(input.accessToken);
    const refreshToken = input.refreshToken
      ? this.encryptToken(input.refreshToken)
      : null;

    const data: Prisma.IntegrationConnectionUncheckedCreateInput = {
      userId: input.userId,
      workspaceId: input.workspaceId,
      provider: input.provider,
      externalId: input.externalId,
      displayName: input.displayName,
      accessToken,
      refreshToken,
      tokenExpiresAt: input.tokenExpiresAt ?? null,
      scopes: input.scopes.join(','),
      metadata: (input.metadata as Prisma.InputJsonValue) ?? null,
    };

    const updateData: Prisma.IntegrationConnectionUncheckedUpdateInput = {
      externalId: data.externalId,
      displayName: data.displayName,
      accessToken: data.accessToken,
      tokenExpiresAt: data.tokenExpiresAt,
      scopes: data.scopes,
      metadata: data.metadata,
    };

    if (refreshToken !== null) {
      updateData.refreshToken = refreshToken;
    }

    return this.db.integrationConnection.upsert({
      where: {
        userId_workspaceId_provider: {
          userId: input.userId,
          workspaceId: input.workspaceId,
          provider: input.provider,
        },
      },
      create: data,
      update: updateData,
    });
  }

  async listByWorkspace(userId: string, workspaceId: string) {
    return this.db.integrationConnection.findMany({
      where: { userId, workspaceId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getByProvider(userId: string, workspaceId: string, provider: string) {
    return this.db.integrationConnection.findUnique({
      where: {
        userId_workspaceId_provider: { userId, workspaceId, provider },
      },
    });
  }

  async delete(userId: string, workspaceId: string, provider: string) {
    return this.db.integrationConnection.delete({
      where: {
        userId_workspaceId_provider: { userId, workspaceId, provider },
      },
    });
  }

  decryptTokens(
    connection: Awaited<ReturnType<IntegrationConnectionModel['getByProvider']>>
  ) {
    if (!connection) return null;
    return {
      ...connection,
      accessToken: this.decryptToken(connection.accessToken),
      refreshToken: connection.refreshToken
        ? this.decryptToken(connection.refreshToken)
        : null,
    };
  }
}
