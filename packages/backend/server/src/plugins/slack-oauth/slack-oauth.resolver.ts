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
  SlackOAuthNotConfiguredError,
  SlackOAuthNotConnectedError,
  SlackOAuthService,
} from './slack-oauth.service';

@ObjectType()
export class SlackConnectAuthUrl {
  @Field()
  url!: string;
}

@ObjectType()
export class SlackConnectionType {
  @Field()
  connected!: boolean;

  // MANUT v1.13.0+: explicit @Field(() => String) for the nullable
  // teamName. NestJS metadata reflection cannot infer a GraphQL type
  // from `string | null | undefined` — CLAUDE.md §6 documents two
  // production crashes (v1.7.0, v1.10.2) caused by skipping this.
  // Always pass an explicit type to @Field for nullable / optional /
  // union declarations.
  @Field(() => String, { nullable: true })
  teamName?: string;
}

/**
 * Map typed errors out of the service into messages the frontend can
 * render directly. Mirrors `rethrowFriendly` in
 * `github-oauth.resolver.ts`. Raw Slack error text isn't passed
 * through — those messages occasionally include team IDs or
 * rate-limit reset times that are noise for the user.
 */
function rethrowFriendly(err: unknown): never {
  if (err instanceof SlackOAuthNotConnectedError) {
    throw new Error(
      'Slack workspace is not connected. Connect it in Settings → Integrations.'
    );
  }
  if (err instanceof SlackOAuthNotConfiguredError) {
    throw new Error(
      'Slack OAuth client is not configured on this server. Ask an admin to set SLACK_OAUTH_CLIENT_ID and SLACK_OAUTH_CLIENT_SECRET.'
    );
  }
  throw err;
}

@Resolver()
export class SlackOAuthResolver {
  private readonly logger = new Logger(SlackOAuthResolver.name);

  constructor(
    private readonly slack: SlackOAuthService,
    private readonly url: URLHelper
  ) {}

  /**
   * Returns the Slack consent URL. The frontend opens this in a popup
   * (or full-page redirect on popup-blocker); the callback handler at
   * /oauth/slack/callback persists the connection and postMessages
   * the result back to the opener.
   *
   * Throws when `SLACK_OAUTH_CLIENT_ID` / `_SECRET` are not configured
   * so the client can render a helpful "Configure OAuth client" message
   * instead of opening a blank popup.
   */
  @Mutation(() => SlackConnectAuthUrl)
  async connectSlack(
    @CurrentUser() user: CurrentUser | null,
    @Args('workspaceId') workspaceId: string
  ): Promise<SlackConnectAuthUrl> {
    if (!user) {
      throw new AuthenticationRequired();
    }

    try {
      const redirectUri = this.slack.resolveRedirectUri(this.url.requestOrigin);
      const url = await this.slack.initiateOAuth(
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
  async disconnectSlack(
    @CurrentUser() user: CurrentUser | null,
    @Args('workspaceId') workspaceId: string
  ): Promise<boolean> {
    if (!user) {
      throw new AuthenticationRequired();
    }
    return this.slack.disconnect(user.id, workspaceId);
  }

  // Read-only status probe fired on Settings → Integrations panel
  // mount. Swallow-and-log so a transient DB hiccup doesn't crash the
  // dialog with a generic INTERNAL_SERVER_ERROR toast.
  @Query(() => SlackConnectionType)
  async slackConnection(
    @CurrentUser() user: CurrentUser | null,
    @Args('workspaceId') workspaceId: string
  ): Promise<SlackConnectionType> {
    if (!user) {
      throw new AuthenticationRequired();
    }
    try {
      const status = await this.slack.getStatus(user.id, workspaceId);
      return {
        connected: status.connected,
        teamName: status.teamName,
      };
    } catch (err) {
      this.logger.error(
        `slackConnection lookup failed for user=${user.id} workspace=${workspaceId}: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err.stack : undefined
      );
      return { connected: false };
    }
  }
}
