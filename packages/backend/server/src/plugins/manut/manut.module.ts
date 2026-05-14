import type { DynamicModule, OnModuleInit } from '@nestjs/common';
import { Injectable, Module } from '@nestjs/common';

import { ServerConfigModule, ServerService } from '../../core/config';
import { ServerFeature } from '../../core/config/types';
import { DocStorageModule } from '../../core/doc';
import { MailModule } from '../../core/mail';
import { PermissionModule } from '../../core/permission';
import { MnAgentRegistryResolver } from './manut-agent-registry.resolver';
import { MnAgentRegistryService } from './manut-agent-registry.service';
import { SuperflowCrmResolver } from './manut-crm.resolver';
import { SuperflowHandoverResolver } from './manut-handover.resolver';
import { SuperflowHandoverService } from './manut-handover.service';
import { SuperflowPmResolver } from './manut-pm.resolver';
import { MnReleaseRunsResolver } from './manut-release-runs.resolver';
import { MnReleaseRunsService } from './manut-release-runs.service';
import { SuperflowReminderCron } from './manut-reminder.cron';
import { SuperflowReminderJob } from './manut-reminder.job';
import { SuperflowReminderResolver } from './manut-reminder.resolver';

/**
 * Toggles `ServerFeature.Superflow` so the frontend can show/hide the
 * Projects / CRM / Reminders nav entries based on whether the backend
 * has the gated APIs loaded.
 *
 * `ServerFeature.Superflow` retains its 'superflow' enum value because
 * the frontend reads it from the GraphQL server-config contract.
 *
 * `@Injectable()` is required so TypeScript emits the `design:paramtypes`
 * metadata that NestJS DI uses to find `ServerService`. Without it,
 * `this.server` is `undefined` at `onModuleInit` and `.enableFeature()`
 * throws (see incident: ENABLE_MANUT_MODULE flip on 2026-05-14).
 */
@Injectable()
class SuperflowFeatureRegistrar implements OnModuleInit {
  constructor(private readonly server: ServerService) {}

  onModuleInit(): void {
    if (isManutModuleEnabled()) {
      this.server.enableFeature(ServerFeature.Superflow);
    } else {
      this.server.disableFeature(ServerFeature.Superflow);
    }
  }
}

/**
 * Manut product suite (PM, CRM, reminders, notifications). Historically
 * codenamed "Superflow" — internal class identifiers and the GraphQL
 * surface (resolver methods, DTO types, ServerFeature enum value) still
 * carry the Superflow name to preserve the public contract until a
 * coordinated frontend rename ships.
 *
 * PM/CRM/reminder APIs are gated by `ENABLE_MANUT_MODULE=true`
 * (legacy `ENABLE_SUPERFLOW_MODULE` is also honored). The handover inbox
 * remains available because it only writes regular docs and does not
 * depend on the Manut database migration.
 */
@Module({})
export class ManutModule {
  static forRoot(): DynamicModule {
    if (!isManutModuleEnabled()) {
      return {
        module: ManutModule,
        imports: [PermissionModule, DocStorageModule, ServerConfigModule],
        providers: [
          SuperflowHandoverResolver,
          SuperflowHandoverService,
          MnReleaseRunsService,
          MnReleaseRunsResolver,
          SuperflowFeatureRegistrar,
        ],
      };
    }

    return {
      module: ManutModule,
      imports: [
        PermissionModule,
        MailModule,
        DocStorageModule,
        ServerConfigModule,
      ],
      providers: [
        SuperflowPmResolver,
        SuperflowCrmResolver,
        SuperflowHandoverResolver,
        SuperflowHandoverService,
        SuperflowReminderResolver,
        SuperflowReminderJob,
        SuperflowReminderCron,
        MnAgentRegistryService,
        MnAgentRegistryResolver,
        MnReleaseRunsService,
        MnReleaseRunsResolver,
        SuperflowFeatureRegistrar,
      ],
    };
  }
}

/**
 * Opt-in flag; default off so existing installs are unaffected until
 * migration + UI ship together. Reads the new `ENABLE_MANUT_MODULE`
 * env var first, then falls back to the legacy `ENABLE_SUPERFLOW_MODULE`
 * for backward compatibility with VM `.env` files that haven't been
 * updated yet.
 */
export function isManutModuleEnabled(): boolean {
  const value =
    process.env.ENABLE_MANUT_MODULE ?? process.env.ENABLE_SUPERFLOW_MODULE;
  return value === 'true';
}
