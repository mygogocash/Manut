import { Logger } from '@nestjs/common';
import {
  Args,
  Field,
  InputType,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from '@nestjs/graphql';

import { AuthenticationRequired, BadRequest } from '../../base';
import { CurrentUser } from '../../core/auth';
import { AccessController } from '../../core/permission';
import {
  GoGoCashConnectionInvalidKeyError,
  GoGoCashConnectionNotConnectedError,
  GoGoCashConnectionService,
} from './gogocash-connection.service';

@InputType()
export class GoGoCashConnectionInputType {
  @Field()
  apiKey!: string;

  // Explicit @Field(() => String) for nullable union — CLAUDE.md §6.
  @Field(() => String, { nullable: true })
  label?: string;
}

@ObjectType()
export class GoGoCashConnectionType {
  @Field()
  connected!: boolean;

  @Field(() => String, { nullable: true })
  label?: string;
}

// Map domain errors to the established UserFriendlyError framework
// (BadRequest extends UserFriendlyError) so they surface as typed,
// friendly GraphQL errors instead of the generic "Unhandled error
// raised" that bare `throw new Error()` produces (finding #13,
// CLAUDE.md error-mapping scar).
function rethrowFriendly(err: unknown): never {
  if (err instanceof GoGoCashConnectionNotConnectedError) {
    throw new BadRequest(
      'GoGoCash is not connected. Add an API key in Settings → Analytics · Connections.'
    );
  }
  if (err instanceof GoGoCashConnectionInvalidKeyError) {
    throw new BadRequest(err.message);
  }
  throw err;
}

@Resolver()
export class GoGoCashConnectionResolver {
  private readonly logger = new Logger(GoGoCashConnectionResolver.name);

  constructor(
    private readonly gogocash: GoGoCashConnectionService,
    private readonly ac: AccessController
  ) {}

  @Mutation(() => GoGoCashConnectionType)
  async setGoGoCashConnection(
    @CurrentUser() user: CurrentUser | null,
    @Args('workspaceId') workspaceId: string,
    @Args('input') input: GoGoCashConnectionInputType
  ): Promise<GoGoCashConnectionType> {
    if (!user) {
      throw new AuthenticationRequired();
    }
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');
    try {
      const status = await this.gogocash.setConnection(
        user.id,
        workspaceId,
        input.apiKey,
        input.label
      );
      return {
        connected: status.connected,
        label: status.label,
      };
    } catch (err) {
      rethrowFriendly(err);
    }
  }

  @Mutation(() => Boolean)
  async disconnectGoGoCash(
    @CurrentUser() user: CurrentUser | null,
    @Args('workspaceId') workspaceId: string
  ): Promise<boolean> {
    if (!user) {
      throw new AuthenticationRequired();
    }
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');
    return this.gogocash.disconnect(user.id, workspaceId);
  }

  @Query(() => GoGoCashConnectionType)
  async goGoCashConnection(
    @CurrentUser() user: CurrentUser | null,
    @Args('workspaceId') workspaceId: string
  ): Promise<GoGoCashConnectionType> {
    if (!user) {
      throw new AuthenticationRequired();
    }
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');
    try {
      const status = await this.gogocash.getStatus(user.id, workspaceId);
      return {
        connected: status.connected,
        label: status.label,
      };
    } catch (err) {
      this.logger.error(
        `goGoCashConnection lookup failed for user=${user.id} workspace=${workspaceId}: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err.stack : undefined
      );
      return { connected: false };
    }
  }
}
