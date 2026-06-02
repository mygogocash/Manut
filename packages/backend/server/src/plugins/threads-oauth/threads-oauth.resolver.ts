import { Logger } from '@nestjs/common';
import {
  Args,
  Field,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from '@nestjs/graphql';

import { AuthenticationRequired, URLHelper } from '../../base';
import { CurrentUser } from '../../core/auth';
import {
  ThreadsOAuthNotConfiguredError,
  ThreadsOAuthNotConnectedError,
  ThreadsOAuthService,
} from './threads-oauth.service';

@ObjectType()
export class ThreadsConnectAuthUrl {
  @Field()
  url!: string;
}

@ObjectType()
export class ThreadsConnectionType {
  @Field()
  connected!: boolean;

  @Field(() => Boolean, { nullable: true })
  verified?: boolean;

  @Field(() => String, { nullable: true })
  healthStatus?: 'saved' | 'verified' | 'expired' | 'error';

  // Explicit @Field(() => String) for nullable union — CLAUDE.md §6.
  @Field(() => String, { nullable: true })
  username?: string;
}

function rethrowFriendly(err: unknown): never {
  if (err instanceof ThreadsOAuthNotConnectedError) {
    throw new Error(
      'Threads account is not connected. Connect it in Settings → Analytics · Connections.'
    );
  }
  if (err instanceof ThreadsOAuthNotConfiguredError) {
    throw new Error(
      'Threads OAuth client is not configured on this server. Ask an admin to set THREADS_OAUTH_CLIENT_ID and THREADS_OAUTH_CLIENT_SECRET.'
    );
  }
  throw err;
}

@Resolver()
export class ThreadsOAuthResolver {
  private readonly logger = new Logger(ThreadsOAuthResolver.name);

  constructor(
    private readonly threads: ThreadsOAuthService,
    private readonly url: URLHelper
  ) {}

  @Mutation(() => ThreadsConnectAuthUrl)
  async connectThreads(
    @CurrentUser() user: CurrentUser | null,
    @Args('workspaceId') workspaceId: string
  ): Promise<ThreadsConnectAuthUrl> {
    if (!user) {
      throw new AuthenticationRequired();
    }
    try {
      const redirectUri = this.threads.resolveRedirectUri(
        this.url.requestOrigin
      );
      const url = await this.threads.initiateOAuth(
        user.id,
        workspaceId,
        redirectUri
      );
      return { url };
    } catch (err) {
      rethrowFriendly(err);
    }
  }

  @Mutation(() => Boolean)
  async disconnectThreads(
    @CurrentUser() user: CurrentUser | null,
    @Args('workspaceId') workspaceId: string
  ): Promise<boolean> {
    if (!user) {
      throw new AuthenticationRequired();
    }
    return this.threads.disconnect(user.id, workspaceId);
  }

  @Query(() => ThreadsConnectionType)
  async threadsConnection(
    @CurrentUser() user: CurrentUser | null,
    @Args('workspaceId') workspaceId: string
  ): Promise<ThreadsConnectionType> {
    if (!user) {
      throw new AuthenticationRequired();
    }
    try {
      const status = await this.threads.getStatus(user.id, workspaceId);
      return {
        connected: status.connected,
        username: status.username,
        verified: status.verified,
        healthStatus: status.healthStatus,
      };
    } catch (err) {
      this.logger.error(
        `threadsConnection lookup failed for user=${user.id} workspace=${workspaceId}: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err.stack : undefined
      );
      return { connected: false };
    }
  }
}
