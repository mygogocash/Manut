import { Module } from '@nestjs/common';

import { ServerConfigModule } from '../../core';
import { AuthModule } from '../../core/auth';
import { PermissionModule } from '../../core/permission';
import { SocialConnectionBridgeService } from '../analytics/connections/social-connection-bridge';
import { TiktokOAuthController } from './tiktok-oauth.controller';
import { TiktokOAuthResolver } from './tiktok-oauth.resolver';
import { TiktokOAuthService } from './tiktok-oauth.service';

/**
 * Manut Analytics — TikTok OAuth scaffold.
 *
 * Mirrors the v1.13.x Slack OAuth scaffold pattern. Connect/disconnect
 * plumbing wired end-to-end:
 *
 *   - `connectTiktok` + `disconnectTiktok` mutations + `tiktokConnection` query
 *   - Callback at `/oauth/tiktok/callback`
 *   - Tokens persisted (encrypted) — both access + refresh
 *
 * Required env vars: `TIKTOK_OAUTH_CLIENT_ID` (maps to TikTok's
 * `client_key`), `TIKTOK_OAUTH_CLIENT_SECRET`, optional
 * `TIKTOK_OAUTH_REDIRECT_URI`.
 *
 * Scope set: `user.info.basic,video.list`. Read-only.
 *
 * QUIRK: TikTok's OAuth uses `client_key` parameter where the rest of
 * the world uses `client_id`. We normalise on the `_CLIENT_ID` env var
 * name and remap at the URL/body construction site — see
 * `tiktok-oauth.service.ts` and `types.ts` for the rationale.
 */
@Module({
  imports: [AuthModule, ServerConfigModule, PermissionModule],
  providers: [
    TiktokOAuthService,
    TiktokOAuthResolver,
    SocialConnectionBridgeService,
  ],
  controllers: [TiktokOAuthController],
  exports: [TiktokOAuthService],
})
export class TiktokOAuthModule {}
