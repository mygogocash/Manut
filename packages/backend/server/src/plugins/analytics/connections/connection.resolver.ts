import { BadRequestException } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  ConnectionStatus as PrismaConnectionStatus,
  SocialPlatform as PrismaSocialPlatform,
} from '@prisma/client';

import { CurrentUser } from '../../../core/auth';
import { AccessController } from '../../../core/permission';
import {
  BeginOAuthResultObjectType,
  CancelPlatformConnectInput,
  FinalizePlatformConnectInput,
} from '../graphql/analytics.dto';
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
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');

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
    // Beginning OAuth is a state-changing action — eventually upserts platform
    // credentials at workspace scope. Restrict to settings-update tier (owner /
    // admin), not the read tier.
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');

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
    // Look up the connection's workspace BEFORE the destructive mutation, then
    // assert settings-update permission on it. Without this, any authenticated
    // user could disconnect any workspace's integrations by guessing IDs.
    const workspaceId =
      await this.connections.getConnectionWorkspaceId(connectionId);

    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');

    await this.connections.disconnect(connectionId, user.id);
    return true;
  }

  @Mutation(() => SocialConnectionObjectType, {
    name: 'finalizePlatformConnect',
    description:
      'Complete a multi-account Meta OAuth flow by binding the chosen page / IG biz / Threads profile.',
  })
  async finalizePlatformConnect(
    @CurrentUser() user: CurrentUser,
    @Args('input', { type: () => FinalizePlatformConnectInput })
    input: FinalizePlatformConnectInput
  ): Promise<SocialConnectionObjectType> {
    // ACL: same tier as begin/disconnect. We resolve the workspace from the
    // cached pending payload — leaking "this pendingId exists" requires the
    // caller to guess a 128-bit UUID, so the existence-vs-permission distinction
    // is acceptable here. Surfacing a generic "session expired" keeps the
    // behaviour identical to a TTL-expired row.
    const workspaceId = await this.connections.getPendingWorkspaceId(
      input.pendingId
    );
    if (!workspaceId) {
      throw new BadRequestException(
        'OAuth session expired or not found — please reconnect.'
      );
    }

    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');

    const row = await this.connections.finalizeConnection(
      input.pendingId,
      input.externalAccountId,
      user.id
    );
    return toConnectionDto(row);
  }

  @Mutation(() => Boolean, {
    name: 'cancelPlatformConnect',
    description:
      'Discard a pending Meta OAuth picker session without binding any account.',
  })
  async cancelPlatformConnect(
    @CurrentUser() user: CurrentUser,
    @Args('input', { type: () => CancelPlatformConnectInput })
    input: CancelPlatformConnectInput
  ): Promise<boolean> {
    const workspaceId = await this.connections.getPendingWorkspaceId(
      input.pendingId
    );
    if (!workspaceId) {
      // Already cleaned up (TTL or another tab finalised) — treat as success
      // so the modal-dismiss UX never shows an error for a stale picker.
      return true;
    }

    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');

    await this.connections.cancelPendingOAuth(input.pendingId, user.id);
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
