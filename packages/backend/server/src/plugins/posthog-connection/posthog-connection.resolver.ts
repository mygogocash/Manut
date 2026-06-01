import { Logger } from '@nestjs/common';
import {
  Args,
  Field,
  InputType,
  Int,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from '@nestjs/graphql';

import { AuthenticationRequired, BadRequest } from '../../base';
import { CurrentUser } from '../../core/auth';
import { AccessController } from '../../core/permission';
import {
  PostHogConnectionInvalidKeyError,
  PostHogConnectionNotConnectedError,
  PostHogConnectionService,
} from './posthog-connection.service';

@InputType()
export class PostHogConnectionInputType {
  @Field()
  apiKey!: string;

  // Explicit @Field(() => String) for nullable union — CLAUDE.md §6.
  @Field(() => String, { nullable: true })
  host?: string;
}

@ObjectType()
export class PostHogConnectionType {
  @Field()
  connected!: boolean;

  @Field(() => String, { nullable: true })
  host?: string;

  // Explicit Int — NEVER `@Field(() => Number)` (UndefinedTypeError
  // startup crash). CLAUDE.md §6.
  @Field(() => Int, { nullable: true })
  projectCount?: number;
}

@ObjectType()
export class PostHogConnectionTestResultType {
  @Field()
  ok!: boolean;

  @Field(() => String, { nullable: true })
  error?: string;

  @Field(() => String, { nullable: true })
  host?: string;

  @Field(() => Int, { nullable: true })
  projectCount?: number;
}

// Map domain errors to the established UserFriendlyError framework
// (BadRequest extends UserFriendlyError) so they surface as typed,
// friendly GraphQL errors instead of the generic "Unhandled error
// raised" that bare `throw new Error()` produces (finding #13,
// CLAUDE.md error-mapping scar).
function rethrowFriendly(err: unknown): never {
  if (err instanceof PostHogConnectionNotConnectedError) {
    throw new BadRequest(
      'PostHog is not connected. Add an API key in Settings → Analytics · Connections.'
    );
  }
  if (err instanceof PostHogConnectionInvalidKeyError) {
    throw new BadRequest(err.message);
  }
  throw err;
}

@Resolver()
export class PostHogConnectionResolver {
  private readonly logger = new Logger(PostHogConnectionResolver.name);

  constructor(
    private readonly posthog: PostHogConnectionService,
    private readonly ac: AccessController
  ) {}

  @Mutation(() => PostHogConnectionType)
  async setPostHogConnection(
    @CurrentUser() user: CurrentUser | null,
    @Args('workspaceId') workspaceId: string,
    @Args('input') input: PostHogConnectionInputType
  ): Promise<PostHogConnectionType> {
    if (!user) {
      throw new AuthenticationRequired();
    }
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');
    try {
      const status = await this.posthog.setConnection(
        user.id,
        workspaceId,
        input.apiKey,
        input.host
      );
      return {
        connected: status.connected,
        host: status.host,
        projectCount: status.projectCount,
      };
    } catch (err) {
      rethrowFriendly(err);
    }
  }

  @Mutation(() => Boolean)
  async disconnectPostHog(
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
    return this.posthog.disconnect(user.id, workspaceId);
  }

  @Mutation(() => PostHogConnectionTestResultType)
  async testPostHogConnection(
    @CurrentUser() user: CurrentUser | null,
    @Args('input') input: PostHogConnectionInputType
  ): Promise<PostHogConnectionTestResultType> {
    if (!user) {
      throw new AuthenticationRequired();
    }
    const result = await this.posthog.testConnection(input.apiKey, input.host);
    return {
      ok: result.ok,
      error: result.error,
      host: result.host,
      projectCount: result.projectCount,
    };
  }

  @Query(() => PostHogConnectionType)
  async postHogConnection(
    @CurrentUser() user: CurrentUser | null,
    @Args('workspaceId') workspaceId: string
  ): Promise<PostHogConnectionType> {
    if (!user) {
      throw new AuthenticationRequired();
    }
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');
    try {
      const status = await this.posthog.getStatus(user.id, workspaceId);
      return {
        connected: status.connected,
        host: status.host,
        projectCount: status.projectCount,
      };
    } catch (err) {
      this.logger.error(
        `postHogConnection lookup failed for user=${user.id} workspace=${workspaceId}: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err.stack : undefined
      );
      return { connected: false };
    }
  }
}
