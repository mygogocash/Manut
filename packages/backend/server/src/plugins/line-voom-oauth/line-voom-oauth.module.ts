import { Module } from '@nestjs/common';

import { ServerConfigModule } from '../../core';
import { AuthModule } from '../../core/auth';
import { PermissionModule } from '../../core/permission';
import { SocialConnectionBridgeService } from '../analytics/connections/social-connection-bridge';
import { LineVoomOAuthController } from './line-voom-oauth.controller';
import { LineVoomOAuthResolver } from './line-voom-oauth.resolver';
import { LineVoomOAuthService } from './line-voom-oauth.service';

/**
 * Manut Analytics — LINE VOOM OAuth scaffold (LINE Login v2.1).
 *
 * Mirrors the v1.13.x Slack OAuth scaffold. Connect/disconnect plumbing
 * wired end-to-end:
 *
 *   - `connectLineVoom` + `disconnectLineVoom` mutations + `lineVoomConnection` query
 *   - Callback at `/oauth/line-voom/callback`
 *   - Tokens persisted (encrypted) — both access + refresh
 *
 * Required env vars: `LINE_OAUTH_CLIENT_ID` (LINE channel ID),
 * `LINE_OAUTH_CLIENT_SECRET` (LINE channel secret), optional
 * `LINE_OAUTH_REDIRECT_URI`.
 *
 * Scope set: `profile openid`. Read-only — basic profile info via
 * `/v2/profile` and the LINE user ID via OIDC claims.
 *
 * NOTE on VOOM analytics: LINE VOOM impression / reaction metrics
 * currently require a LINE Official Account Manager API key, NOT a
 * user OAuth grant. This scaffold implements the user-consent path
 * as the discoverable analog of the other 5 OAuth scaffolds. When
 * VOOM analytics graduate to user-grant scopes, extend this scaffold;
 * otherwise the OA Manager path would be a separate plugin (api-key,
 * not OAuth — model on `gogocash-connection`).
 */
@Module({
  imports: [AuthModule, ServerConfigModule, PermissionModule],
  providers: [
    LineVoomOAuthService,
    LineVoomOAuthResolver,
    SocialConnectionBridgeService,
  ],
  controllers: [LineVoomOAuthController],
  exports: [LineVoomOAuthService],
})
export class LineVoomOAuthModule {}
