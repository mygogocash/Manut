import type { DynamicModule, OnModuleInit } from '@nestjs/common';
import { Injectable, Module } from '@nestjs/common';

import { ServerConfigModule, ServerService } from '../../core/config';
import { ServerFeature } from '../../core/config/types';
import { DocStorageModule } from '../../core/doc';
import { MailModule } from '../../core/mail';
import { PermissionModule } from '../../core/permission';
import { MnAgentResolver } from './manut-agent.resolver';
import { MnAgentService } from './manut-agent.service';
import { MnAgentApiKeyResolver } from './manut-agent-api-key.resolver';
import { MnAgentApiKeyService } from './manut-agent-api-key.service';
import { MnAgentRegistryResolver } from './manut-agent-registry.resolver';
import { MnAgentRegistryService } from './manut-agent-registry.service';
import { MnApprovalResolver } from './manut-approval.resolver';
import { MnApprovalService } from './manut-approval.service';
import { MnApprovalCommentService } from './manut-approval-comment.service';
import { MnApprovalGateService } from './manut-approval-gate.service';
import { MnApprovalStaleCron } from './manut-approval-stale.cron';
import {
  MnApprovalEventBus,
  MnApprovalsStreamController,
} from './manut-approvals-stream.controller';
import { MnBudgetResolver } from './manut-budget.resolver';
import { MnBudgetService } from './manut-budget.service';
import { MnBudgetEnforcerService } from './manut-budget-enforcer.service';
import { MnCostService } from './manut-cost.service';
import { MnCrmResolver } from './manut-crm.resolver';
import { MnExportSnapshotService } from './manut-export-snapshot.service';
import { MnGoalResolver } from './manut-goal.resolver';
import { MnGoalService } from './manut-goal.service';
import { MnGoalContextService } from './manut-goal-context.service';
import { MnHandoverResolver } from './manut-handover.resolver';
import { MnHandoverService } from './manut-handover.service';
import { MnHeartbeatService } from './manut-heartbeat.service';
import { MnPmResolver } from './manut-pm.resolver';
import { MnPortabilityService } from './manut-portability.service';
import { MnReleaseRunsResolver } from './manut-release-runs.resolver';
import { MnReleaseRunsService } from './manut-release-runs.service';
import { MnReminderCron } from './manut-reminder.cron';
import { MnReminderJob } from './manut-reminder.job';
import { MnReminderResolver } from './manut-reminder.resolver';
import { MnRoutineCron } from './manut-routine.cron';
import { MnRoutineJob } from './manut-routine.job';
import { MnRoutineResolver } from './manut-routine.resolver';
import { MnRoutineService } from './manut-routine.service';
import { MnSkillResolver } from './manut-skill.resolver';
import { MnSkillService } from './manut-skill.service';

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
      // M1 agent identity: CRUD, API keys, heartbeats. Gated by the
      // same env flag as the rest of the Manut suite. A standalone
      // DynamicModule wrapping the same providers lives in
      // manut-agent.module.ts for future M2 work that may want to
      // split this out behind its own env flag.
      MnAgentService,
      MnAgentResolver,
      MnAgentApiKeyService,
      MnAgentApiKeyResolver,
      MnHeartbeatService,
      MnReleaseRunsService,
      MnReleaseRunsResolver,
      // M4 budget + cost events. Hot-path enforcer is in
      // MnBudgetEnforcerService (in-memory 30s TTL cache). Cost emission
      // is fire-and-forget from the copilot providers — never blocks the
      // streaming response (CLAUDE.md scar #5).
      MnCostService,
      MnBudgetService,
      MnBudgetEnforcerService,
      MnBudgetResolver,
      // M3 approvals + reviews. Hot-path gate is MnApprovalGateService
      // (in-memory 30s TTL cache; sub-millisecond peek). The cron
      // auto-cancels stale PENDING approvals every 5 minutes
      // (approvalTimeoutMinutes default 30). MnApprovalEventBus is a
      // workspace-scoped SSE pub/sub identical in shape to
      // DocReadEventBus (CLAUDE.md §6e).
      MnApprovalGateService,
      MnApprovalService,
      MnApprovalCommentService,
      MnApprovalResolver,
      MnApprovalStaleCron,
      MnApprovalEventBus,
      // M2 goal hierarchy + task ancestry / blockers. MnGoalContextService
      // is consumed by the auto-router to prepend a GOAL CONTEXT block to
      // the system message when an AiSession has a linked taskId.
      MnGoalService,
      MnGoalContextService,
      MnGoalResolver,
      // M5 skills layer + portability snapshot. MnSkillService owns the
      // (workspaceId, slug) uniqueness + version-bump invariant; the
      // export snapshot service is the SHA-256-keyed receipt store the
      // import/export pipeline writes into. Branch B owns the AGENTS.md
      // parser that bridges these services.
      MnSkillService,
      MnSkillResolver,
      MnExportSnapshotService,
      // M5.2 portability service — AGENTS.md round-trip + tar.gz
      // export/import. Depends on PrismaClient and is consumed by the
      // CLI scripts in src/scripts/manut-{export,import}-workspace.ts.
      MnPortabilityService,
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
      controllers: [MnApprovalsStreamController],
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
