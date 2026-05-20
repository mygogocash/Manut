import { Module } from '@nestjs/common';

import { ServerConfigModule } from '../../core';
import { AuthModule } from '../../core/auth';
import { PermissionModule } from '../../core/permission';
import { FigmaOAuthController } from './figma-oauth.controller';
import { FigmaOAuthResolver } from './figma-oauth.resolver';
import { FigmaOAuthService } from './figma-oauth.service';

/**
 * M2 — Figma OAuth scaffold (v1.13.x).
 *
 * Mirrors the v1.13.x GitHub OAuth scaffold (CLAUDE.md §6):
 *
 *   - Connect/disconnect plumbing wired end-to-end via the GraphQL
 *     mutations `connectFigma` + `disconnectFigma` and the query
 *     `figmaConnection`.
 *   - Callback handler at `/oauth/figma/callback` exchanges the code
 *     and persists tokens (encrypted) into the existing
 *     `IntegrationConnection` Prisma table — no migration needed.
 *   - AI-callable tools are deferred to a follow-up release; when
 *     they ship they'll consume `FigmaOAuthService.getValidAccessToken`.
 *
 * Required env vars: `FIGMA_OAUTH_CLIENT_ID`,
 * `FIGMA_OAUTH_CLIENT_SECRET`, optional `FIGMA_OAUTH_REDIRECT_URI`
 * (defaults to `${SERVER_URL}/oauth/figma/callback`). Without them
 * the Connect button surfaces a "configure OAuth client" message
 * instead of opening a blank popup.
 *
 * Single scope: `file_read`. AI tools (when shipped) can list files
 * the user has access to, read file metadata, components, styles,
 * and comments. Write tools would require an additional consent flow
 * with a write-scope set.
 *
 * Unlike GitHub/Linear, Figma tokens expire in 90 days and require
 * refresh. The follow-up that ships AI tools must extend
 * `getValidAccessToken` with the Google scaffold's 5-minute leeway
 * refresh pattern. See `figma-oauth.service.ts` for the TODO marker.
 */
@Module({
  imports: [AuthModule, ServerConfigModule, PermissionModule],
  providers: [FigmaOAuthService, FigmaOAuthResolver],
  controllers: [FigmaOAuthController],
  exports: [FigmaOAuthService],
})
export class FigmaOAuthModule {}
