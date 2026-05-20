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
  GithubOAuthNotConfiguredError,
  GithubOAuthNotConnectedError,
  GithubOAuthService,
} from './github-oauth.service';

@ObjectType()
export class GithubConnectAuthUrl {
  @Field()
  url!: string;
}

@ObjectType()
export class GithubConnectionType {
  @Field()
  connected!: boolean;

  // MANUT v1.13.0: explicit @Field(() => String) for the nullable
  // login. v1.7.0 and v1.10.2 both shipped startup crashes because
  // NestJS metadata reflection cannot infer a GraphQL type from a
  // `string | null` (or `string | undefined`) union — see CLAUDE.md
  // §6 "GraphQL @Field UndefinedTypeError — broken TWICE now".
  // Always pass an explicit type for nullable / optional @Field
  // declarations.
  @Field(() => String, { nullable: true })
  login?: string;
}

/**
 * Map the typed errors out of the service into messages the frontend
 * can render directly. Mirrors `rethrowFriendly` in
 * `google-oauth.resolver.ts`. We deliberately don't pass raw GitHub
 * error text through — those messages occasionally include token
 * fragments or rate-limit reset times that are noise for the user.
 */
function rethrowFriendly(err: unknown): never {
  if (err instanceof GithubOAuthNotConnectedError) {
    throw new Error(
      'GitHub account is not connected for this workspace. Connect it in Settings → Integrations.'
    );
  }
  if (err instanceof GithubOAuthNotConfiguredError) {
    throw new Error(
      'GitHub OAuth client is not configured on this server. Ask an admin to set GITHUB_OAUTH_CLIENT_ID and GITHUB_OAUTH_CLIENT_SECRET.'
    );
  }
  throw err;
}

@Resolver()
export class GithubOAuthResolver {
  private readonly logger = new Logger(GithubOAuthResolver.name);

  constructor(
    private readonly github: GithubOAuthService,
    private readonly url: URLHelper
  ) {}

  /**
   * Returns the GitHub consent URL. The frontend opens this in a popup
   * (or full-page redirect on popup-blocker); the callback handler at
   * /oauth/github/callback persists the connection and postMessages
   * the result back to the opener.
   *
   * Throws when `GITHUB_OAUTH_CLIENT_ID` / `_SECRET` are not configured
   * so the client can render a helpful "Configure OAuth client" message
   * instead of opening a blank popup.
   */
  @Mutation(() => GithubConnectAuthUrl)
  async connectGithub(
    @CurrentUser() user: CurrentUser | null,
    @Args('workspaceId') workspaceId: string
  ): Promise<GithubConnectAuthUrl> {
    if (!user) {
      throw new AuthenticationRequired();
    }

    try {
      const redirectUri = this.github.resolveRedirectUri(
        this.url.requestOrigin
      );
      const url = await this.github.initiateOAuth(
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
  async disconnectGithub(
    @CurrentUser() user: CurrentUser | null,
    @Args('workspaceId') workspaceId: string
  ): Promise<boolean> {
    if (!user) {
      throw new AuthenticationRequired();
    }
    return this.github.disconnect(user.id, workspaceId);
  }

  // Read-only status probe fired on Settings → Integrations panel
  // mount. Same swallow-and-log pattern as `googleConnection` so a
  // transient DB hiccup doesn't crash the dialog open with a
  // generic INTERNAL_SERVER_ERROR toast.
  @Query(() => GithubConnectionType)
  async githubConnection(
    @CurrentUser() user: CurrentUser | null,
    @Args('workspaceId') workspaceId: string
  ): Promise<GithubConnectionType> {
    if (!user) {
      throw new AuthenticationRequired();
    }
    try {
      const status = await this.github.getStatus(user.id, workspaceId);
      return {
        connected: status.connected,
        login: status.login,
      };
    } catch (err) {
      this.logger.error(
        `githubConnection lookup failed for user=${user.id} workspace=${workspaceId}: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err.stack : undefined
      );
      return { connected: false };
    }
  }
}
