import { Module } from '@nestjs/common';

import { ServerConfigModule } from '../../core';
import { AuthModule } from '../../core/auth';
import { DocStorageModule } from '../../core/doc';
import { PermissionModule } from '../../core/permission';
import { DriveService } from './drive.service';
import { GmailService } from './gmail.service';
import { GoogleOAuthController } from './google-oauth.controller';
import {
  GoogleIntegrationResolver,
  GoogleOAuthResolver,
} from './google-oauth.resolver';
import { GoogleOAuthService } from './google-oauth.service';

/**
 * Google OAuth + Gmail / Drive integrations.
 *
 * Kept as a separate module from the existing `oauth` plugin (which handles
 * sign-in) and the `connections` plugin (which handles its own multi-provider
 * marketplace). Co-locating these would tangle three different consent flows
 * with three different provider-name conventions.
 *
 * Token storage piggybacks on the existing `IntegrationConnection` Prisma
 * table — no migration needed. Each scope (gmail / drive) gets its own row
 * keyed by `provider = 'google_gmail' | 'google_drive'`.
 *
 * v1.10.1 shipped connect/disconnect plumbing only.
 * v1.10.2 adds:
 *   - {@link GoogleOAuthService.getValidAccessToken} — proactive 5-minute
 *     refresh-token middleware shared by Gmail + Drive
 *   - {@link GmailService} — message search + import-as-doc
 *   - {@link DriveService} — file search + webViewLink for paste-into-doc
 */
@Module({
  imports: [AuthModule, ServerConfigModule, DocStorageModule, PermissionModule],
  providers: [
    GoogleOAuthService,
    GoogleOAuthResolver,
    GmailService,
    DriveService,
    GoogleIntegrationResolver,
  ],
  controllers: [GoogleOAuthController],
  exports: [GoogleOAuthService, GmailService, DriveService],
})
export class GoogleOAuthModule {}
