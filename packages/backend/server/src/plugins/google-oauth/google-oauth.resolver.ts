import {
  Args,
  Field,
  Mutation,
  ObjectType,
  Query,
  registerEnumType,
  Resolver,
} from '@nestjs/graphql';

import { AuthenticationRequired, URLHelper } from '../../base';
import { CurrentUser } from '../../core/auth';
import { GoogleOAuthService } from './google-oauth.service';
import type { GoogleScope } from './types';

/**
 * GraphQL enum mirroring `GoogleScope`. Keeping it local to the resolver
 * lets us evolve the wire shape without leaking into the service.
 */
enum GoogleScopeEnum {
  gmail = 'gmail',
  drive = 'drive',
}

registerEnumType(GoogleScopeEnum, {
  name: 'GoogleScope',
  description:
    'Which Google service the OAuth flow should request access to. v1.10.1: gmail and drive only.',
});

@ObjectType()
export class GoogleConnectAuthUrl {
  @Field()
  url!: string;
}

@ObjectType()
export class GoogleConnectionType {
  @Field(() => GoogleScopeEnum)
  scope!: GoogleScopeEnum;

  @Field()
  connected!: boolean;

  @Field({ nullable: true })
  email?: string;
}

@Resolver()
export class GoogleOAuthResolver {
  constructor(
    private readonly googleOAuth: GoogleOAuthService,
    private readonly url: URLHelper
  ) {}

  /**
   * Returns the Google consent URL for the given scope. The frontend
   * should open this in a popup or full-page redirect; once the user
   * approves, the callback handler at /oauth/google/callback persists
   * the connection.
   *
   * Throws when GOOGLE_OAUTH_CLIENT_ID / SECRET are not configured —
   * surfaced to the client so it can render a helpful "Configure OAuth
   * client in Google Cloud Console" message instead of a blank popup.
   */
  @Mutation(() => GoogleConnectAuthUrl)
  async connectGoogle(
    @CurrentUser() user: CurrentUser | null,
    @Args('workspaceId') workspaceId: string,
    @Args('scope', { type: () => GoogleScopeEnum }) scope: GoogleScopeEnum
  ): Promise<GoogleConnectAuthUrl> {
    if (!user) {
      throw new AuthenticationRequired();
    }

    const redirectUri = this.googleOAuth.resolveRedirectUri(
      this.url.requestOrigin
    );
    const url = await this.googleOAuth.initiateOAuth(
      user.id,
      workspaceId,
      scope as GoogleScope,
      redirectUri
    );
    return { url };
  }

  @Mutation(() => Boolean)
  async disconnectGoogle(
    @CurrentUser() user: CurrentUser | null,
    @Args('workspaceId') workspaceId: string,
    @Args('scope', { type: () => GoogleScopeEnum }) scope: GoogleScopeEnum
  ): Promise<boolean> {
    if (!user) {
      throw new AuthenticationRequired();
    }
    return this.googleOAuth.disconnect(
      user.id,
      workspaceId,
      scope as GoogleScope
    );
  }

  @Query(() => GoogleConnectionType)
  async googleConnection(
    @CurrentUser() user: CurrentUser | null,
    @Args('workspaceId') workspaceId: string,
    @Args('scope', { type: () => GoogleScopeEnum }) scope: GoogleScopeEnum
  ): Promise<GoogleConnectionType> {
    if (!user) {
      throw new AuthenticationRequired();
    }
    const status = await this.googleOAuth.getStatus(
      user.id,
      workspaceId,
      scope as GoogleScope
    );
    return {
      scope,
      connected: status.connected,
      email: status.email,
    };
  }
}
