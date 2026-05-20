import { Module } from '@nestjs/common';

import { ServerConfigModule } from '../../core';
import { AuthModule } from '../../core/auth';
import { PermissionModule } from '../../core/permission';
import { LinearOAuthController } from './linear-oauth.controller';
import { LinearOAuthResolver } from './linear-oauth.resolver';
import { LinearOAuthService } from './linear-oauth.service';

/**
 * M2 — Linear OAuth scaffold (v1.13.x).
 *
 * Mirrors the v1.13.x GitHub OAuth scaffold (CLAUDE.md §6):
 *
 *   - Connect/disconnect plumbing wired end-to-end via the GraphQL
 *     mutations `connectLinear` + `disconnectLinear` and the query
 *     `linearConnection`.
 *   - Callback handler at `/oauth/linear/callback` exchanges the code
 *     and persists tokens (encrypted) into the existing
 *     `IntegrationConnection` Prisma table — no migration needed.
 *   - AI-callable tools are deferred to a follow-up release; when
 *     they ship they'll consume `LinearOAuthService.getValidAccessToken`
 *     identical in shape to the GitHub tools.
 *
 * Required env vars: `LINEAR_OAUTH_CLIENT_ID`,
 * `LINEAR_OAUTH_CLIENT_SECRET`, optional `LINEAR_OAUTH_REDIRECT_URI`
 * (defaults to `${SERVER_URL}/oauth/linear/callback`). Without them
 * the Connect button surfaces a "configure OAuth client" message
 * instead of opening a blank popup.
 *
 * Single scope: `read`. The future AI tools (list issues, read issue,
 * list projects, list teams) all fit inside this grant. Write tools
 * (create issue, comment) would require additional consent.
 */
@Module({
  imports: [AuthModule, ServerConfigModule, PermissionModule],
  providers: [LinearOAuthService, LinearOAuthResolver],
  controllers: [LinearOAuthController],
  exports: [LinearOAuthService],
})
export class LinearOAuthModule {}
