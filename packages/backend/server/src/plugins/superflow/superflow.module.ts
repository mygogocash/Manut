import type { DynamicModule, OnModuleInit } from '@nestjs/common';
import { Module } from '@nestjs/common';

import { ServerConfigModule, ServerService } from '../../core/config';
import { ServerFeature } from '../../core/config/types';
import { DocStorageModule } from '../../core/doc';
import { MailModule } from '../../core/mail';
import { PermissionModule } from '../../core/permission';
import { SuperflowCrmResolver } from './superflow-crm.resolver';
import { SuperflowHandoverResolver } from './superflow-handover.resolver';
import { SuperflowHandoverService } from './superflow-handover.service';
import { SuperflowPmResolver } from './superflow-pm.resolver';
import { SuperflowReminderCron } from './superflow-reminder.cron';
import { SuperflowReminderJob } from './superflow-reminder.job';
import { SuperflowReminderResolver } from './superflow-reminder.resolver';

/**
 * Toggles `ServerFeature.Superflow` so the frontend can show/hide the
 * Projects / CRM / Reminders nav entries based on whether the backend
 * has the gated APIs loaded.
 */
class SuperflowFeatureRegistrar implements OnModuleInit {
  constructor(private readonly server: ServerService) {}

  onModuleInit(): void {
    if (isSuperflowModuleEnabled()) {
      this.server.enableFeature(ServerFeature.Superflow);
    } else {
      this.server.disableFeature(ServerFeature.Superflow);
    }
  }
}

/**
 * Superflow product suite (PM, CRM, reminders, notifications).
 *
 * PM/CRM/reminder APIs are gated by `ENABLE_SUPERFLOW_MODULE=true`. The
 * handover inbox remains available because it only writes regular docs and
 * does not depend on the Superflow database migration.
 */
@Module({})
export class SuperflowModule {
  static forRoot(): DynamicModule {
    if (!isSuperflowModuleEnabled()) {
      return {
        module: SuperflowModule,
        imports: [PermissionModule, DocStorageModule, ServerConfigModule],
        providers: [
          SuperflowHandoverResolver,
          SuperflowHandoverService,
          SuperflowFeatureRegistrar,
        ],
      };
    }

    return {
      module: SuperflowModule,
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
        SuperflowFeatureRegistrar,
      ],
    };
  }
}

/** Opt-in flag; default off so existing installs are unaffected until migration + UI ship together. */
export function isSuperflowModuleEnabled(): boolean {
  return process.env.ENABLE_SUPERFLOW_MODULE === 'true';
}
