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
  InstagramOAuthNotConfiguredError,
  InstagramOAuthNotConnectedError,
  InstagramOAuthService,
} from './instagram-oauth.service';

@ObjectType()
export class InstagramConnectAuthUrl {
  @Field()
  url!: string;
}

@ObjectType()
export class InstagramConnectionType {
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
  if (err instanceof InstagramOAuthNotConnectedError) {
    throw new Error(
      'Instagram account is not connected. Connect it in Settings → Analytics · Connections.'
    );
  }
  if (err instanceof InstagramOAuthNotConfiguredError) {
    throw new Error(
      'Instagram OAuth client is not configured on this server. Ask an admin to set IG_OAUTH_CLIENT_ID and IG_OAUTH_CLIENT_SECRET.'
    );
  }
  throw err;
}

@Resolver()
export class InstagramOAuthResolver {
  private readonly logger = new Logger(InstagramOAuthResolver.name);

  constructor(
    private readonly instagram: InstagramOAuthService,
    private readonly url: URLHelper
  ) {}

  @Mutation(() => InstagramConnectAuthUrl)
  async connectInstagram(
    @CurrentUser() user: CurrentUser | null,
    @Args('workspaceId') workspaceId: string
  ): Promise<InstagramConnectAuthUrl> {
    if (!user) {
      throw new AuthenticationRequired();
    }
    try {
      const redirectUri = this.instagram.resolveRedirectUri(
        this.url.requestOrigin
      );
      const url = await this.instagram.initiateOAuth(
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
  async disconnectInstagram(
    @CurrentUser() user: CurrentUser | null,
    @Args('workspaceId') workspaceId: string
  ): Promise<boolean> {
    if (!user) {
      throw new AuthenticationRequired();
    }
    return this.instagram.disconnect(user.id, workspaceId);
  }

  @Query(() => InstagramConnectionType)
  async instagramConnection(
    @CurrentUser() user: CurrentUser | null,
    @Args('workspaceId') workspaceId: string
  ): Promise<InstagramConnectionType> {
    if (!user) {
      throw new AuthenticationRequired();
    }
    try {
      const status = await this.instagram.getStatus(user.id, workspaceId);
      return {
        connected: status.connected,
        username: status.username,
        verified: status.verified,
        healthStatus: status.healthStatus,
      };
    } catch (err) {
      this.logger.error(
        `instagramConnection lookup failed for user=${user.id} workspace=${workspaceId}: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err.stack : undefined
      );
      return { connected: false };
    }
  }
}
