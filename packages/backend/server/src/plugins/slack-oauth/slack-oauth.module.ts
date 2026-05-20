import { Module } from '@nestjs/common';

import { ServerConfigModule } from '../../core';
import { AuthModule } from '../../core/auth';
import { PermissionModule } from '../../core/permission';
import { SlackOAuthController } from './slack-oauth.controller';
import { SlackOAuthResolver } from './slack-oauth.resolver';
import { SlackOAuthService } from './slack-oauth.service';

/**
 * M2 — Slack OAuth scaffold (v1.13.x).
 *
 * Kept as a separate module from the AFFiNE sign-in OAuth flow
 * (`plugins/oauth`) so the consent flows don't tangle in shared
 * provider names. Mirrors the v1.13.x GitHub OAuth scaffold
 * (CLAUDE.md §6):
 *
 *   - Connect/disconnect plumbing wired end-to-end via the GraphQL
 *     mutations `connectSlack` + `disconnectSlack` and the query
 *     `slackConnection`.
 *   - Callback handler at `/oauth/slack/callback` exchanges the code
 *     and persists tokens (encrypted) into the existing
 *     `IntegrationConnection` Prisma table — no migration needed.
 *   - AI-callable tools are deferred to a follow-up release; when
 *     they ship they'll consume `SlackOAuthService.getValidAccessToken`
 *     identical in shape to the GitHub tools.
 *
 * Required env vars: `SLACK_OAUTH_CLIENT_ID`,
 * `SLACK_OAUTH_CLIENT_SECRET`, optional `SLACK_OAUTH_REDIRECT_URI`
 * (defaults to `${SERVER_URL}/oauth/slack/callback`). Without them
 * the Connect button surfaces a "configure OAuth client" message
 * instead of opening a blank popup.
 *
 * Single bot-scope grant: `channels:read,chat:read,users:read`. The
 * AI read tools (list channels, fetch message history, resolve user
 * mentions) all fit inside this grant. Future write tools would
 * require additional consent (e.g. `chat:write`).
 */
@Module({
  imports: [AuthModule, ServerConfigModule, PermissionModule],
  providers: [SlackOAuthService, SlackOAuthResolver],
  controllers: [SlackOAuthController],
  exports: [SlackOAuthService],
})
export class SlackOAuthModule {}
