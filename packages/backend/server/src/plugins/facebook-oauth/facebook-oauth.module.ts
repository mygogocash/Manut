import { Module } from '@nestjs/common';

import { ServerConfigModule } from '../../core';
import { AuthModule } from '../../core/auth';
import { PermissionModule } from '../../core/permission';
import { FacebookOAuthController } from './facebook-oauth.controller';
import { FacebookOAuthResolver } from './facebook-oauth.resolver';
import { FacebookOAuthService } from './facebook-oauth.service';

/**
 * Manut Analytics — Facebook OAuth scaffold.
 *
 * Mirrors the v1.13.x GitHub OAuth scaffold (CLAUDE.md §6):
 *
 *   - Connect/disconnect plumbing wired end-to-end via the GraphQL
 *     mutations `connectFacebook` + `disconnectFacebook` and the query
 *     `facebookConnection`.
 *   - Callback handler at `/oauth/facebook/callback` exchanges the
 *     code and persists tokens (encrypted) into the existing
 *     `IntegrationConnection` Prisma table — no migration needed.
 *   - AI-callable tools are deferred to a follow-up release; when
 *     they ship they'll consume `FacebookOAuthService.getValidAccessToken`.
 *
 * Required env vars: `FB_OAUTH_CLIENT_ID`, `FB_OAUTH_CLIENT_SECRET`,
 * optional `FB_OAUTH_REDIRECT_URI` (defaults to
 * `${SERVER_URL}/oauth/facebook/callback`). Without them the Connect
 * button surfaces a "configure OAuth client" message instead of
 * opening a blank popup.
 *
 * Single scope set: `pages_read_engagement,pages_show_list`. Read-only
 * Page metrics — the future "publish a post" write tools would need a
 * Facebook App Review for `pages_manage_posts`.
 */
@Module({
  imports: [AuthModule, ServerConfigModule, PermissionModule],
  providers: [FacebookOAuthService, FacebookOAuthResolver],
  controllers: [FacebookOAuthController],
  exports: [FacebookOAuthService],
})
export class FacebookOAuthModule {}
