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
  FigmaOAuthNotConfiguredError,
  FigmaOAuthNotConnectedError,
  FigmaOAuthService,
} from './figma-oauth.service';

@ObjectType()
export class FigmaConnectAuthUrl {
  @Field()
  url!: string;
}

@ObjectType()
export class FigmaConnectionType {
  @Field()
  connected!: boolean;

  // MANUT v1.13.0+: explicit @Field(() => String) for nullable fields.
  // CLAUDE.md §6 documents two production crashes (v1.7.0, v1.10.2)
  // caused by inferring GraphQL types from nullable TypeScript unions.
  // Always pass an explicit type.
  @Field(() => String, { nullable: true })
  handle?: string;

  @Field(() => String, { nullable: true })
  email?: string;
}

/**
 * Map typed errors out of the service into messages the frontend can
 * render directly. Mirrors `rethrowFriendly` in
 * `github-oauth.resolver.ts`.
 */
function rethrowFriendly(err: unknown): never {
  if (err instanceof FigmaOAuthNotConnectedError) {
    throw new Error(
      'Figma account is not connected for this workspace. Connect it in Settings → Integrations.'
    );
  }
  if (err instanceof FigmaOAuthNotConfiguredError) {
    throw new Error(
      'Figma OAuth client is not configured on this server. Ask an admin to set FIGMA_OAUTH_CLIENT_ID and FIGMA_OAUTH_CLIENT_SECRET.'
    );
  }
  throw err;
}

@Resolver()
export class FigmaOAuthResolver {
  private readonly logger = new Logger(FigmaOAuthResolver.name);

  constructor(
    private readonly figma: FigmaOAuthService,
    private readonly url: URLHelper
  ) {}

  /**
   * Returns the Figma consent URL. The frontend opens this in a popup
   * (or full-page redirect on popup-blocker); the callback handler at
   * /oauth/figma/callback persists the connection and postMessages
   * the result back to the opener.
   */
  @Mutation(() => FigmaConnectAuthUrl)
  async connectFigma(
    @CurrentUser() user: CurrentUser | null,
    @Args('workspaceId') workspaceId: string
  ): Promise<FigmaConnectAuthUrl> {
    if (!user) {
      throw new AuthenticationRequired();
    }

    try {
      const redirectUri = this.figma.resolveRedirectUri(this.url.requestOrigin);
      const url = await this.figma.initiateOAuth(
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
  async disconnectFigma(
    @CurrentUser() user: CurrentUser | null,
    @Args('workspaceId') workspaceId: string
  ): Promise<boolean> {
    if (!user) {
      throw new AuthenticationRequired();
    }
    return this.figma.disconnect(user.id, workspaceId);
  }

  // Read-only status probe fired on Settings → Integrations panel
  // mount. Swallow-and-log so a transient DB hiccup doesn't crash the
  // dialog with a generic INTERNAL_SERVER_ERROR toast.
  @Query(() => FigmaConnectionType)
  async figmaConnection(
    @CurrentUser() user: CurrentUser | null,
    @Args('workspaceId') workspaceId: string
  ): Promise<FigmaConnectionType> {
    if (!user) {
      throw new AuthenticationRequired();
    }
    try {
      const status = await this.figma.getStatus(user.id, workspaceId);
      return {
        connected: status.connected,
        handle: status.handle,
        email: status.email,
      };
    } catch (err) {
      this.logger.error(
        `figmaConnection lookup failed for user=${user.id} workspace=${workspaceId}: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err.stack : undefined
      );
      return { connected: false };
    }
  }
}
