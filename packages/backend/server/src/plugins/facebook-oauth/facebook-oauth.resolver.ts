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
import { AccessController } from '../../core/permission';
import {
  FacebookOAuthNotConfiguredError,
  FacebookOAuthNotConnectedError,
  FacebookOAuthService,
} from './facebook-oauth.service';

@ObjectType()
export class FacebookConnectAuthUrl {
  @Field()
  url!: string;
}

@ObjectType()
export class FacebookConnectionType {
  @Field()
  connected!: boolean;

  // MANUT v1.13.0+: explicit @Field(() => String) for the nullable
  // displayName. NestJS metadata reflection cannot infer a GraphQL
  // type from `string | null | undefined` — CLAUDE.md §6 documents
  // two production crashes (v1.7.0, v1.10.2) caused by skipping this.
  @Field(() => String, { nullable: true })
  displayName?: string;
}

/**
 * Map typed errors out of the service into messages the frontend can
 * render directly. Mirrors `rethrowFriendly` in `slack-oauth.resolver.ts`.
 */
function rethrowFriendly(err: unknown): never {
  if (err instanceof FacebookOAuthNotConnectedError) {
    throw new Error(
      'Facebook account is not connected. Connect it in Settings → Analytics · Connections.'
    );
  }
  if (err instanceof FacebookOAuthNotConfiguredError) {
    throw new Error(
      'Facebook OAuth client is not configured on this server. Ask an admin to set FB_OAUTH_CLIENT_ID and FB_OAUTH_CLIENT_SECRET.'
    );
  }
  throw err;
}

@Resolver()
export class FacebookOAuthResolver {
  private readonly logger = new Logger(FacebookOAuthResolver.name);

  constructor(
    private readonly facebook: FacebookOAuthService,
    private readonly url: URLHelper,
    private readonly ac: AccessController
  ) {}

  @Mutation(() => FacebookConnectAuthUrl)
  async connectFacebook(
    @CurrentUser() user: CurrentUser | null,
    @Args('workspaceId') workspaceId: string
  ): Promise<FacebookConnectAuthUrl> {
    if (!user) {
      throw new AuthenticationRequired();
    }
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');

    try {
      const redirectUri = this.facebook.resolveRedirectUri(
        this.url.requestOrigin
      );
      const url = await this.facebook.initiateOAuth(
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
  async disconnectFacebook(
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
    return this.facebook.disconnect(user.id, workspaceId);
  }

  @Query(() => FacebookConnectionType)
  async facebookConnection(
    @CurrentUser() user: CurrentUser | null,
    @Args('workspaceId') workspaceId: string
  ): Promise<FacebookConnectionType> {
    if (!user) {
      throw new AuthenticationRequired();
    }
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');
    try {
      const status = await this.facebook.getStatus(user.id, workspaceId);
      return {
        connected: status.connected,
        displayName: status.displayName,
      };
    } catch (err) {
      this.logger.error(
        `facebookConnection lookup failed for user=${user.id} workspace=${workspaceId}: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err.stack : undefined
      );
      return { connected: false };
    }
  }
}
