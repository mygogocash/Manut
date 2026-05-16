import type { DynamicModule, OnModuleInit } from '@nestjs/common';
import { Injectable, Module } from '@nestjs/common';

import { ServerConfigModule, ServerService } from '../../core/config';
import { ServerFeature } from '../../core/config/types';
import { DocStorageModule } from '../../core/doc';
import { MailModule } from '../../core/mail';
import { PermissionModule } from '../../core/permission';
import { MnAgentRegistryResolver } from './manut-agent-registry.resolver';
import { MnAgentRegistryService } from './manut-agent-registry.service';
import { MnCrmResolver } from './manut-crm.resolver';
import { MnHandoverResolver } from './manut-handover.resolver';
import { MnHandoverService } from './manut-handover.service';
import { MnPmResolver } from './manut-pm.resolver';
import { MnReleaseRunsResolver } from './manut-release-runs.resolver';
import { MnReleaseRunsService } from './manut-release-runs.service';
import { MnReminderCron } from './manut-reminder.cron';
import { MnReminderJob } from './manut-reminder.job';
import { MnReminderResolver } from './manut-reminder.resolver';
import { MnRoutineCron } from './manut-routine.cron';
import { MnRoutineJob } from './manut-routine.job';
import { MnRoutineResolver } from './manut-routine.resolver';
import { MnRoutineService } from './manut-routine.service';

/**
 * Toggles `ServerFeature.Manut` so the frontend can show/hide the
 * Projects / CRM / Reminders nav entries based on whether the backend
 * has the gated APIs loaded.
 *
 * `ServerFeature.Manut` is gated by the same env flag as the module
 * the frontend reads it from the GraphQL server-config contract.
 *
 * `@Injectable()` is required so TypeScript emits the `design:paramtypes`
 * metadata that NestJS DI uses to find `ServerService`. Without it,
 * `this.server` is `undefined` at `onModuleInit` and `.enableFeature()`
 * throws (see incident: ENABLE_MANUT_MODULE flip on 2026-05-14).
 */
@Injectable()
class MnFeatureRegistrar implements OnModuleInit {
  constructor(private readonly server: ServerService) {}

  onModuleInit(): void {
    if (isManutModuleEnabled()) {
      this.server.enableFeature(ServerFeature.Manut);
    } else {
      this.server.disableFeature(ServerFeature.Manut);
    }
  }
}

/**
 * Manut product suite (PM, CRM, reminders, notifications). Historically
 * codenamed "Superflow" — the v1.12.1 rename pass moved every internal
 * class, GraphQL @ObjectType/@InputType, and resolver method to the
 * Manut/Mn family. The only intentional Superflow leftovers are:
 * - ENABLE_SUPERFLOW_MODULE env var (BC alias for ENABLE_MANUT_MODULE)
 * - 'superflow.deliverReminder' BullMQ job name (Redis-persisted, see
 *   packages/backend/server/src/base/job/queue/def.ts)
 * - Documentation in docs/ that records the rename history.
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
          MnHandoverResolver,
          MnHandoverService,
          MnReleaseRunsService,
          MnReleaseRunsResolver,
          MnFeatureRegistrar,
        ],
      };
    }

    const providers: any[] = [
      MnPmResolver,
      MnCrmResolver,
      MnHandoverResolver,
      MnHandoverService,
      MnReminderResolver,
      MnReminderJob,
      MnReminderCron,
      MnAgentRegistryService,
      MnAgentRegistryResolver,
      MnReleaseRunsService,
      MnReleaseRunsResolver,
      MnFeatureRegistrar,
    ];

    // Sub-feature: Routines. Gated by its own env flag so it can ship
    // independently of the full Manut module. Adds:
    //   - MnRoutineService     (PR 1) — CRUD service for routines
    //   - MnRoutineResolver    (PR 1) — GraphQL surface
    //   - MnRoutineCron        (PR 2) — @Cron(EVERY_MINUTE) scheduler
    //                                   that fires due routines via BullMQ
    //   - MnRoutineJob         (PR 2) — BullMQ consumer (stub body;
    //                                   real Vertex execution lands in PR 4)
    if (isManutRoutinesEnabled()) {
      providers.push(
        MnRoutineService,
        MnRoutineResolver,
        MnRoutineCron,
        MnRoutineJob
      );
    }

    return {
      module: ManutModule,
      imports: [
        PermissionModule,
        MailModule,
        DocStorageModule,
        ServerConfigModule,
      ],
      providers,
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

/**
 * Sub-feature flag for Manut Routines (PR 1 of the routines work).
 * Independent of `ENABLE_MANUT_MODULE` so we can roll out routines
 * without touching the wider PM/CRM/Reminders surface — but routines
 * still requires the parent flag because the providers list lives
 * inside the enabled branch of `forRoot()`. Both must be true to
 * load `MnRoutineResolver`.
 */
export function isManutRoutinesEnabled(): boolean {
  return process.env.ENABLE_MANUT_ROUTINES === 'true';
}
