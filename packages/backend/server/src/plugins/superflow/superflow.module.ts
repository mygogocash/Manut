import type { DynamicModule } from '@nestjs/common';
import { Module } from '@nestjs/common';

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
        imports: [PermissionModule, DocStorageModule],
        providers: [SuperflowHandoverResolver, SuperflowHandoverService],
      };
    }

    return {
      module: SuperflowModule,
      imports: [PermissionModule, MailModule, DocStorageModule],
      providers: [
        SuperflowPmResolver,
        SuperflowCrmResolver,
        SuperflowHandoverResolver,
        SuperflowHandoverService,
        SuperflowReminderResolver,
        SuperflowReminderJob,
        SuperflowReminderCron,
      ],
    };
  }
}

/** Opt-in flag; default off so existing installs are unaffected until migration + UI ship together. */
export function isSuperflowModuleEnabled(): boolean {
  return process.env.ENABLE_SUPERFLOW_MODULE === 'true';
}
