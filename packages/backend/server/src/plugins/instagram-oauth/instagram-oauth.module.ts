import { Module } from '@nestjs/common';

import { ServerConfigModule } from '../../core';
import { AuthModule } from '../../core/auth';
import { PermissionModule } from '../../core/permission';
import { InstagramOAuthController } from './instagram-oauth.controller';
import { InstagramOAuthResolver } from './instagram-oauth.resolver';
import { InstagramOAuthService } from './instagram-oauth.service';

/**
 * Manut Analytics — Instagram OAuth scaffold (Basic Display API).
 *
 * Mirrors the v1.13.x Facebook OAuth scaffold:
 *
 *   - Connect/disconnect plumbing wired end-to-end via the GraphQL
 *     mutations `connectInstagram` + `disconnectInstagram` and the
 *     query `instagramConnection`.
 *   - Callback handler at `/oauth/instagram/callback` exchanges the
 *     code and persists tokens (encrypted) into the existing
 *     `IntegrationConnection` Prisma table — no migration needed.
 *
 * Required env vars: `IG_OAUTH_CLIENT_ID`, `IG_OAUTH_CLIENT_SECRET`,
 * optional `IG_OAUTH_REDIRECT_URI` (defaults to
 * `${SERVER_URL}/oauth/instagram/callback`).
 *
 * Single scope set: `user_profile,user_media`. Read-only.
 *
 * NOTE: This is the Basic Display API path (consumer accounts).
 * Business / Creator accounts integrate via the Facebook Graph
 * scaffold — use `facebook-oauth` for those.
 */
@Module({
  imports: [AuthModule, ServerConfigModule, PermissionModule],
  providers: [InstagramOAuthService, InstagramOAuthResolver],
  controllers: [InstagramOAuthController],
  exports: [InstagramOAuthService],
})
export class InstagramOAuthModule {}
