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

import { AuthenticationRequired } from '../../base';
import { CurrentUser } from '../../core/auth';
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

  @Field(() => Number, { nullable: true })
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

  @Field(() => Number, { nullable: true })
  projectCount?: number;
}

function rethrowFriendly(err: unknown): never {
  if (err instanceof PostHogConnectionNotConnectedError) {
    throw new Error(
      'PostHog is not connected. Add an API key in Settings → Analytics · Connections.'
    );
  }
  if (err instanceof PostHogConnectionInvalidKeyError) {
    throw new Error(err.message);
  }
  throw err;
}

@Resolver()
export class PostHogConnectionResolver {
  private readonly logger = new Logger(PostHogConnectionResolver.name);

  constructor(private readonly posthog: PostHogConnectionService) {}

  @Mutation(() => PostHogConnectionType)
  async setPostHogConnection(
    @CurrentUser() user: CurrentUser | null,
    @Args('workspaceId') workspaceId: string,
    @Args('input') input: PostHogConnectionInputType
  ): Promise<PostHogConnectionType> {
    if (!user) {
      throw new AuthenticationRequired();
    }
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
