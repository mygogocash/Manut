import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  ConnectionStatus as PrismaConnectionStatus,
  SocialPlatform as PrismaSocialPlatform,
} from '@prisma/client';

import { CurrentUser } from '../../../core/auth';
import { AccessController } from '../../../core/permission';
import { BeginOAuthResultObjectType } from '../graphql/analytics.dto';
import {
  ConnectionStatus,
  SocialConnectionObjectType,
  SocialPlatform,
} from './connection.entity';
import { ConnectionService } from './connection.service';

@Resolver(() => SocialConnectionObjectType)
export class ConnectionResolver {
  constructor(
    private readonly connections: ConnectionService,
    private readonly ac: AccessController
  ) {}

  @Query(() => [SocialConnectionObjectType], {
    name: 'connections',
    description: 'List analytics platform connections for a workspace.',
  })
  async listConnections(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => String }) workspaceId: string
  ): Promise<SocialConnectionObjectType[]> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Read');

    const rows = await this.connections.listConnections(workspaceId);
    return rows.map(toConnectionDto);
  }

  @Mutation(() => BeginOAuthResultObjectType, {
    name: 'beginPlatformConnect',
    description:
      'Begin OAuth handshake for a platform. Returns the authorization URL the client must navigate to.',
  })
  async beginPlatformConnect(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => String }) workspaceId: string,
    @Args('platform', { type: () => SocialPlatform }) platform: SocialPlatform
  ): Promise<BeginOAuthResultObjectType> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Read');

    return await this.connections.beginOAuth(
      workspaceId,
      toPrismaPlatform(platform),
      user.id
    );
  }

  @Mutation(() => Boolean, {
    name: 'disconnectPlatform',
    description: 'Disconnect a platform from the workspace (soft-delete).',
  })
  async disconnectPlatform(
    @CurrentUser() user: CurrentUser,
    @Args('connectionId', { type: () => String }) connectionId: string
  ): Promise<boolean> {
    // The service double-checks the row exists; resolver-level ACL is enforced
    // inside the service after we look up the workspace.
    await this.connections.disconnect(connectionId, user.id);
    return true;
  }
}

function toPrismaPlatform(p: SocialPlatform): PrismaSocialPlatform {
  // The GraphQL enum values are string-equal to the Prisma enum values; this
  // cast is a typing-only shim so the compiler accepts the assignment.
  return p as unknown as PrismaSocialPlatform;
}

function toConnectionDto(row: {
  id: string;
  workspaceId: string;
  platform: PrismaSocialPlatform;
  status: PrismaConnectionStatus;
  externalAccountId: string;
  externalAccountName: string;
  scopes: string[];
  connectedByUserId: string;
  expiresAt: Date | null;
  lastSyncAt: Date | null;
  lastErrorAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}): SocialConnectionObjectType {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    platform: row.platform as unknown as SocialPlatform,
    status: row.status as unknown as ConnectionStatus,
    externalAccountId: row.externalAccountId,
    externalAccountName: row.externalAccountName,
    scopes: row.scopes,
    connectedByUserId: row.connectedByUserId,
    expiresAt: row.expiresAt,
    lastSyncAt: row.lastSyncAt,
    lastErrorAt: row.lastErrorAt,
    lastError: row.lastError,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
