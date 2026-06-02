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
  LineVoomOAuthNotConfiguredError,
  LineVoomOAuthNotConnectedError,
  LineVoomOAuthService,
} from './line-voom-oauth.service';

@ObjectType()
export class LineVoomConnectAuthUrl {
  @Field()
  url!: string;
}

@ObjectType()
export class LineVoomConnectionType {
  @Field()
  connected!: boolean;

  @Field(() => Boolean, { nullable: true })
  verified?: boolean;

  @Field(() => String, { nullable: true })
  healthStatus?: 'saved' | 'verified' | 'expired' | 'error';

  // Explicit @Field(() => String) for nullable union — CLAUDE.md §6.
  @Field(() => String, { nullable: true })
  displayName?: string;
}

function rethrowFriendly(err: unknown): never {
  if (err instanceof LineVoomOAuthNotConnectedError) {
    throw new Error(
      'LINE Official Account is not connected. Connect it in Settings → Analytics · Connections.'
    );
  }
  if (err instanceof LineVoomOAuthNotConfiguredError) {
    throw new Error(
      'LINE Official Account OAuth client is not configured on this server. Ask an admin to set LINE_OAUTH_CLIENT_ID and LINE_OAUTH_CLIENT_SECRET.'
    );
  }
  throw err;
}

@Resolver()
export class LineVoomOAuthResolver {
  private readonly logger = new Logger(LineVoomOAuthResolver.name);

  constructor(
    private readonly lineVoom: LineVoomOAuthService,
    private readonly url: URLHelper
  ) {}

  @Mutation(() => LineVoomConnectAuthUrl)
  async connectLineVoom(
    @CurrentUser() user: CurrentUser | null,
    @Args('workspaceId') workspaceId: string
  ): Promise<LineVoomConnectAuthUrl> {
    if (!user) {
      throw new AuthenticationRequired();
    }
    try {
      const redirectUri = this.lineVoom.resolveRedirectUri(
        this.url.requestOrigin
      );
      const url = await this.lineVoom.initiateOAuth(
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
  async disconnectLineVoom(
    @CurrentUser() user: CurrentUser | null,
    @Args('workspaceId') workspaceId: string
  ): Promise<boolean> {
    if (!user) {
      throw new AuthenticationRequired();
    }
    return this.lineVoom.disconnect(user.id, workspaceId);
  }

  @Query(() => LineVoomConnectionType)
  async lineVoomConnection(
    @CurrentUser() user: CurrentUser | null,
    @Args('workspaceId') workspaceId: string
  ): Promise<LineVoomConnectionType> {
    if (!user) {
      throw new AuthenticationRequired();
    }
    try {
      const status = await this.lineVoom.getStatus(user.id, workspaceId);
      return {
        connected: status.connected,
        displayName: status.displayName,
        verified: status.verified,
        healthStatus: status.healthStatus,
      };
    } catch (err) {
      this.logger.error(
        `lineVoomConnection lookup failed for user=${user.id} workspace=${workspaceId}: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err.stack : undefined
      );
      return { connected: false };
    }
  }
}
