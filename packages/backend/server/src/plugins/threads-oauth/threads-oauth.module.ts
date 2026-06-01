import { Module } from '@nestjs/common';

import { ServerConfigModule } from '../../core';
import { AuthModule } from '../../core/auth';
import { PermissionModule } from '../../core/permission';
import { SocialConnectionBridgeService } from '../analytics/connections/social-connection-bridge';
import { ThreadsOAuthController } from './threads-oauth.controller';
import { ThreadsOAuthResolver } from './threads-oauth.resolver';
import { ThreadsOAuthService } from './threads-oauth.service';

/**
 * Manut Analytics — Threads OAuth scaffold (Meta).
 *
 * Mirrors the v1.13.x Instagram scaffold. Connect/disconnect plumbing
 * wired end-to-end:
 *
 *   - `connectThreads` + `disconnectThreads` mutations + `threadsConnection` query
 *   - Callback at `/oauth/threads/callback`
 *   - Tokens persisted (encrypted) into existing `IntegrationConnection`
 *
 * Required env vars: `THREADS_OAUTH_CLIENT_ID`,
 * `THREADS_OAUTH_CLIENT_SECRET`, optional `THREADS_OAUTH_REDIRECT_URI`.
 *
 * Scope set: `threads_basic,threads_content_publish`. The publish
 * scope is forward-looking — included per spec even though no write
 * tools ship yet — so users see the publish-capable nature of the
 * consent at first grant. Re-consent flows will resurface this scope
 * via `auth_type=rerequest` if denied.
 */
@Module({
  imports: [AuthModule, ServerConfigModule, PermissionModule],
  providers: [
    ThreadsOAuthService,
    ThreadsOAuthResolver,
    SocialConnectionBridgeService,
  ],
  controllers: [ThreadsOAuthController],
  exports: [ThreadsOAuthService],
})
export class ThreadsOAuthModule {}
