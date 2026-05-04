import { Module } from '@nestjs/common';

import { ServerConfigModule } from '../../core';
import { AuthModule } from '../../core/auth';
import { GoogleOAuthController } from './google-oauth.controller';
import { GoogleOAuthResolver } from './google-oauth.resolver';
import { GoogleOAuthService } from './google-oauth.service';

/**
 * v1.10.1 Google OAuth scaffold for Gmail + Drive integrations.
 *
 * Kept as a separate module from the existing `oauth` plugin (which handles
 * sign-in) and the `connections` plugin (which handles its own multi-provider
 * marketplace). Co-locating these would tangle three different consent flows
 * with three different provider-name conventions.
 *
 * Token storage piggybacks on the existing `IntegrationConnection` Prisma
 * table — no migration needed for v1.10.1. Each scope (gmail / drive) gets
 * its own row keyed by `provider = 'google_gmail' | 'google_drive'`.
 *
 * Live importers (Gmail message reading / Drive file picker) are NOT wired
 * up in this module — those land in v1.10.2+. This module only ships the
 * connect/disconnect/state plumbing.
 */
@Module({
  imports: [AuthModule, ServerConfigModule],
  providers: [GoogleOAuthService, GoogleOAuthResolver],
  controllers: [GoogleOAuthController],
  exports: [GoogleOAuthService],
})
export class GoogleOAuthModule {}
