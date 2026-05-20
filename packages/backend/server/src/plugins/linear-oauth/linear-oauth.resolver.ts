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
  LinearOAuthNotConfiguredError,
  LinearOAuthNotConnectedError,
  LinearOAuthService,
} from './linear-oauth.service';

@ObjectType()
export class LinearConnectAuthUrl {
  @Field()
  url!: string;
}

@ObjectType()
export class LinearConnectionType {
  @Field()
  connected!: boolean;

  // MANUT v1.13.0+: explicit @Field(() => String) for nullable fields.
  // CLAUDE.md §6 documents two production crashes (v1.7.0, v1.10.2)
  // caused by inferring GraphQL types from nullable TypeScript unions.
  // Always pass an explicit type.
  @Field(() => String, { nullable: true })
  displayName?: string;

  @Field(() => String, { nullable: true })
  organizationName?: string;
}

/**
 * Map typed errors out of the service into messages the frontend can
 * render directly. Mirrors `rethrowFriendly` in
 * `github-oauth.resolver.ts`.
 */
function rethrowFriendly(err: unknown): never {
  if (err instanceof LinearOAuthNotConnectedError) {
    throw new Error(
      'Linear workspace is not connected. Connect it in Settings → Integrations.'
    );
  }
  if (err instanceof LinearOAuthNotConfiguredError) {
    throw new Error(
      'Linear OAuth client is not configured on this server. Ask an admin to set LINEAR_OAUTH_CLIENT_ID and LINEAR_OAUTH_CLIENT_SECRET.'
    );
  }
  throw err;
}

@Resolver()
export class LinearOAuthResolver {
  private readonly logger = new Logger(LinearOAuthResolver.name);

  constructor(
    private readonly linear: LinearOAuthService,
    private readonly url: URLHelper
  ) {}

  /**
   * Returns the Linear consent URL. The frontend opens this in a popup
   * (or full-page redirect on popup-blocker); the callback handler at
   * /oauth/linear/callback persists the connection and postMessages
   * the result back to the opener.
   */
  @Mutation(() => LinearConnectAuthUrl)
  async connectLinear(
    @CurrentUser() user: CurrentUser | null,
    @Args('workspaceId') workspaceId: string
  ): Promise<LinearConnectAuthUrl> {
    if (!user) {
      throw new AuthenticationRequired();
    }

    try {
      const redirectUri = this.linear.resolveRedirectUri(
        this.url.requestOrigin
      );
      const url = await this.linear.initiateOAuth(
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
  async disconnectLinear(
    @CurrentUser() user: CurrentUser | null,
    @Args('workspaceId') workspaceId: string
  ): Promise<boolean> {
    if (!user) {
      throw new AuthenticationRequired();
    }
    return this.linear.disconnect(user.id, workspaceId);
  }

  // Read-only status probe fired on Settings → Integrations panel
  // mount. Swallow-and-log so a transient DB hiccup doesn't crash the
  // dialog with a generic INTERNAL_SERVER_ERROR toast.
  @Query(() => LinearConnectionType)
  async linearConnection(
    @CurrentUser() user: CurrentUser | null,
    @Args('workspaceId') workspaceId: string
  ): Promise<LinearConnectionType> {
    if (!user) {
      throw new AuthenticationRequired();
    }
    try {
      const status = await this.linear.getStatus(user.id, workspaceId);
      return {
        connected: status.connected,
        displayName: status.displayName,
        organizationName: status.organizationName,
      };
    } catch (err) {
      this.logger.error(
        `linearConnection lookup failed for user=${user.id} workspace=${workspaceId}: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err.stack : undefined
      );
      return { connected: false };
    }
  }
}
