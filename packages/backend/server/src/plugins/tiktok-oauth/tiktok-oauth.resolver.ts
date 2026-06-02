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
  TiktokOAuthNotConfiguredError,
  TiktokOAuthNotConnectedError,
  TiktokOAuthService,
} from './tiktok-oauth.service';

@ObjectType()
export class TiktokConnectAuthUrl {
  @Field()
  url!: string;
}

@ObjectType()
export class TiktokConnectionType {
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
  if (err instanceof TiktokOAuthNotConnectedError) {
    throw new Error(
      'TikTok account is not connected. Connect it in Settings → Analytics · Connections.'
    );
  }
  if (err instanceof TiktokOAuthNotConfiguredError) {
    throw new Error(
      'TikTok OAuth client is not configured on this server. Ask an admin to set TIKTOK_OAUTH_CLIENT_ID and TIKTOK_OAUTH_CLIENT_SECRET.'
    );
  }
  throw err;
}

@Resolver()
export class TiktokOAuthResolver {
  private readonly logger = new Logger(TiktokOAuthResolver.name);

  constructor(
    private readonly tiktok: TiktokOAuthService,
    private readonly url: URLHelper
  ) {}

  @Mutation(() => TiktokConnectAuthUrl)
  async connectTiktok(
    @CurrentUser() user: CurrentUser | null,
    @Args('workspaceId') workspaceId: string
  ): Promise<TiktokConnectAuthUrl> {
    if (!user) {
      throw new AuthenticationRequired();
    }
    try {
      const redirectUri = this.tiktok.resolveRedirectUri(
        this.url.requestOrigin
      );
      const url = await this.tiktok.initiateOAuth(
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
  async disconnectTiktok(
    @CurrentUser() user: CurrentUser | null,
    @Args('workspaceId') workspaceId: string
  ): Promise<boolean> {
    if (!user) {
      throw new AuthenticationRequired();
    }
    return this.tiktok.disconnect(user.id, workspaceId);
  }

  @Query(() => TiktokConnectionType)
  async tiktokConnection(
    @CurrentUser() user: CurrentUser | null,
    @Args('workspaceId') workspaceId: string
  ): Promise<TiktokConnectionType> {
    if (!user) {
      throw new AuthenticationRequired();
    }
    try {
      const status = await this.tiktok.getStatus(user.id, workspaceId);
      return {
        connected: status.connected,
        displayName: status.displayName,
        verified: status.verified,
        healthStatus: status.healthStatus,
      };
    } catch (err) {
      this.logger.error(
        `tiktokConnection lookup failed for user=${user.id} workspace=${workspaceId}: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err.stack : undefined
      );
      return { connected: false };
    }
  }
}
