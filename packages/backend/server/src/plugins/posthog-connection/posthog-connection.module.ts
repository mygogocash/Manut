import { Module } from '@nestjs/common';

import { ServerConfigModule } from '../../core';
import { AuthModule } from '../../core/auth';
import { PermissionModule } from '../../core/permission';
import { PostHogConnectionResolver } from './posthog-connection.resolver';
import { PostHogConnectionService } from './posthog-connection.service';

/**
 * Manut Analytics — PostHog connection scaffold.
 *
 * API-key + host auth (NOT OAuth). Connect/disconnect plumbing wired
 * end-to-end:
 *
 *   - `setPostHogConnection` mutation persists an encrypted API key + host
 *   - `testPostHogConnection` mutation hits `{host}/api/projects/`
 *     without persisting
 *   - `disconnectPostHog` mutation deletes the row
 *   - `postHogConnection` query returns `{ connected, host, projectCount }`
 *
 * No controller — there's no OAuth callback to handle.
 *
 * Optional env var: `POSTHOG_DEFAULT_HOST` overrides the placeholder
 * host (`https://app.posthog.com`) shown on the frontend form.
 *
 * Security posture:
 *  - API key is encrypted at rest (reuses the OAuth token encryption
 *    helper). Host is plaintext metadata since it's not a secret.
 *  - The probe uses Bearer auth — same path as live calls. Success
 *    on the probe means future read tools will work.
 */
@Module({
  imports: [AuthModule, ServerConfigModule, PermissionModule],
  providers: [PostHogConnectionService, PostHogConnectionResolver],
  exports: [PostHogConnectionService],
})
export class PostHogConnectionModule {}
