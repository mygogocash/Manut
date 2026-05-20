import { Module } from '@nestjs/common';

import { ServerConfigModule } from '../../core';
import { AuthModule } from '../../core/auth';
import { PermissionModule } from '../../core/permission';
import { GoGoCashConnectionResolver } from './gogocash-connection.resolver';
import { GoGoCashConnectionService } from './gogocash-connection.service';

/**
 * Manut Analytics — GoGoCash internal connection scaffold.
 *
 * API-key auth (NOT OAuth, NOT external). Minimal shape — store an
 * encrypted key, surface only `connected: bool` + a masked prefix.
 * Live ingest deferred.
 *
 * Optional env var: `GOGOCASH_API_KEY` — when set, becomes a
 * workspace-wide default. Useful for self-hosted Manut deployments
 * where every workspace shares one internal credential.
 *
 * Security posture:
 *  - Key is encrypted at rest (reuses the OAuth token encryption helper).
 *  - Never logged — only the masked 6-char prefix.
 *  - Frontend NEVER receives the full key, only a masked label.
 */
@Module({
  imports: [AuthModule, ServerConfigModule, PermissionModule],
  providers: [GoGoCashConnectionService, GoGoCashConnectionResolver],
  exports: [GoGoCashConnectionService],
})
export class GoGoCashConnectionModule {}
