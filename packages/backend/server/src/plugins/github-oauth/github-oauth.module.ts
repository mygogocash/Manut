import { Module } from '@nestjs/common';

import { ServerConfigModule } from '../../core';
import { AuthModule } from '../../core/auth';
import { PermissionModule } from '../../core/permission';
import { GithubOAuthController } from './github-oauth.controller';
import { GithubOAuthResolver } from './github-oauth.resolver';
import { GithubOAuthService } from './github-oauth.service';

/**
 * M2 E2.1 — GitHub OAuth scaffold (v1.13.x).
 *
 * Kept as a separate module from `GoogleOAuthModule` (which handles
 * Gmail / Drive) and `OAuthModule` (which handles AFFiNE sign-in) so
 * the three different consent flows don't tangle in shared provider
 * names. Mirrors the v1.10.1 Google OAuth scaffold (CLAUDE.md §6):
 *
 *   - Connect/disconnect plumbing wired end-to-end via the GraphQL
 *     mutations `connectGithub` + `disconnectGithub` and the query
 *     `githubConnection`.
 *   - Callback handler at `/oauth/github/callback` exchanges the code
 *     and persists tokens (encrypted) into the existing
 *     `IntegrationConnection` Prisma table — no migration needed.
 *   - AI-callable tools live in `plugins/copilot/tools/github.ts`
 *     and consume `GithubOAuthService.getValidAccessToken`.
 *
 * Required env vars: `GITHUB_OAUTH_CLIENT_ID`,
 * `GITHUB_OAUTH_CLIENT_SECRET`, optional `GITHUB_OAUTH_REDIRECT_URI`
 * (defaults to `${SERVER_URL}/oauth/github/callback`). Without them
 * the Connect button surfaces a "configure OAuth client" message
 * instead of opening a blank popup. Live import UX is not shipped in
 * this scaffold — the integration card surfaces a "Live import is
 * rolling out soon" footer.
 *
 * Single scope: `read:user repo`. The AI tools (search issues, read
 * issue, search repos, read PR) all fit inside this grant. Future
 * write tools (open issue, comment) would require additional consent.
 */
@Module({
  imports: [AuthModule, ServerConfigModule, PermissionModule],
  providers: [GithubOAuthService, GithubOAuthResolver],
  controllers: [GithubOAuthController],
  exports: [GithubOAuthService],
})
export class GithubOAuthModule {}
