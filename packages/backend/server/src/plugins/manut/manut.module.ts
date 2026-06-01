import type { DynamicModule, OnModuleInit } from '@nestjs/common';
import { Injectable, Module } from '@nestjs/common';

import { ServerConfigModule, ServerService } from '../../core/config';
import { ServerFeature } from '../../core/config/types';
import { DocStorageModule } from '../../core/doc';
import { MailModule } from '../../core/mail';
import { PermissionModule } from '../../core/permission';
import { MnAdapterRegistryService } from './adapters/manut-adapter-registry.service';
import { MnCursorCloudAdapter } from './adapters/manut-cursor-cloud-adapter.service';
import { MnE2bAdapter } from './adapters/manut-e2b-adapter.service';
import { MnHttpWebhookAdapter } from './adapters/manut-http-webhook-adapter.service';
import { MnProcessAdapter } from './adapters/manut-process-adapter.service';
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
import { MnCeoChatResolver } from './manut-ceo-chat.resolver';
import { MnCeoChatService } from './manut-ceo-chat.service';
import { MnCostService } from './manut-cost.service';
import { MnCrmResolver } from './manut-crm.resolver';
import { MnExportSnapshotService } from './manut-export-snapshot.service';
import { MnGoalResolver } from './manut-goal.resolver';
import { MnGoalService } from './manut-goal.service';
import { MnGoalContextService } from './manut-goal-context.service';
import { MnHandoverResolver } from './manut-handover.resolver';
import { MnHandoverService } from './manut-handover.service';
import { MnHeartbeatService } from './manut-heartbeat.service';
import { MnMaximizerResolver } from './manut-maximizer.resolver';
import { MnMaximizerService } from './manut-maximizer.service';
import { MnAgentMemoryResolver } from './manut-memory.resolver';
import { MnAgentMemoryService } from './manut-memory.service';
import { MnOrgChangeResolver } from './manut-org-change.resolver';
import { MnOrgChangeService } from './manut-org-change.service';
import { MnOrgLearningResolver } from './manut-org-learning.resolver';
import { MnOrgLearningService } from './manut-org-learning.service';
import { MnOutcomeVerifierResolver } from './manut-outcome-verifier.resolver';
import { MnOutcomeVerifierService } from './manut-outcome-verifier.service';
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
import { MnTaskCheckoutResolver } from './manut-task-checkout.resolver';
import { MnTaskCheckoutService } from './manut-task-checkout.service';
import { MnTaskCompletionHookService } from './manut-task-completion-hook.service';
import { MnTaskPlanResolver } from './manut-task-plan.resolver';
import { MnTaskPlanService } from './manut-task-plan.service';
import { MnTaskWatchdogCron } from './manut-task-watchdog.cron';
import { MnWorkProductResolver } from './manut-work-product.resolver';
import { MnWorkProductService } from './manut-work-product.service';
import { MnWorkQueueController } from './manut-work-queue.controller';
import { MnWorkQueueResolver } from './manut-work-queue.resolver';
import { MnWorkQueueService } from './manut-work-queue.service';
import { ManutPluginResolver } from './plugin-runtime/manut-plugin.resolver';
import { ManutPluginConfigService } from './plugin-runtime/manut-plugin-config.service';
import { ManutPluginHostRpcService } from './plugin-runtime/manut-plugin-host-rpc.service';
import { ManutPluginInstallerService } from './plugin-runtime/manut-plugin-installer.service';
import { ManutPluginRoutesController } from './plugin-runtime/manut-plugin-routes.controller';
import { ManutPluginRuntimeService } from './plugin-runtime/manut-plugin-runtime.service';
import { ManutPluginSupervisorService } from './plugin-runtime/manut-plugin-supervisor.service';

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
      // M6a — Plugin runtime + IPC + capability gates. Out-of-process
      // workers via child_process.fork; JSON-RPC bridge over stdio;
      // host RPC surface capability-gated against the plugin's
      // manifest. See plugin-runtime/manut-plugin.module.ts for the
      // standalone module wrapper. UI sandboxing is M6b (Paperclip
      // same-origin caveat — see SDK README).
      ManutPluginSupervisorService,
      ManutPluginHostRpcService,
      ManutPluginInstallerService,
      ManutPluginRuntimeService,
      // M6b — per-workspace plugin config service (enable/disable toggle).
      ManutPluginConfigService,
      ManutPluginResolver,
      // M7 — atomic checkout + execution locks. The R0 invariant is
      // single-winner concurrency: `tryCheckout` issues a single raw
      // UPDATE so concurrent callers serialise on the row-lock and at
      // most one walks away with the executionRunId set. The
      // watchdog cron clears stale locks (>2 min RUNNING with no
      // matching heartbeat) and writes a recovery_lock_cleared
      // activity row.
      MnTaskCheckoutService,
      MnTaskCheckoutResolver,
      MnTaskWatchdogCron,
      // M8 — Cloud / sandbox agent adapters. Extends
      // MnAgentAdapterType beyond COPILOT_CHAT_SESSION with four
      // external dispatch surfaces (e2b sandboxes, Cursor cloud
      // agents, HTTP webhooks, allowlisted local processes). The
      // registry resolves MnAgent.adapterType → MnAdapter at
      // invocation time. Each adapter scrubs its secret config
      // fields before logging (apiKey / signingSecret / cursorApiKey
      // / env). All transport failures are wrapped in
      // MnAdapterResult rather than thrown — the heartbeat consumer
      // depends on that stable contract.
      MnE2bAdapter,
      MnCursorCloudAdapter,
      MnHttpWebhookAdapter,
      MnProcessAdapter,
      MnAdapterRegistryService,
      // M9 — Memory / Knowledge surface. Per-agent + per-task durable
      // recall ranked by importance + recency. The service exposes a
      // `renderRecallBlock` helper that the auto-router uses to prepend
      // the top-N memories into the system prompt (wiring deferred to a
      // follow-up commit in session.ts). The garbageCollect path keeps
      // low-importance noise from accumulating.
      MnAgentMemoryService,
      MnAgentMemoryResolver,
      // M11 — Enforced Outcomes. Runs typed predicates declared on
      // MnTask.definitionOfDone and refuses to transition a task into
      // DONE if any predicate is unsatisfied. The verifier is consumed
      // by MnPmResolver via an optional constructor parameter — when
      // absent (test fixtures), the gate degrades to a no-op so
      // existing PM tests don't have to mock it. Predicate kinds:
      // DOC_EXISTS (WorkspaceDoc probe), URL_REACHABLE (HEAD with 10s
      // timeout), WORK_PRODUCT_EXISTS (M10 feature-detected at
      // runtime, gracefully unsatisfied until M10 ships),
      // EMBEDDING_SIMILARITY (v1 stub auto-satisfied with warning),
      // and CUSTOM (always unsatisfied — operators approve manually).
      MnOutcomeVerifierService,
      MnOutcomeVerifierResolver,
      // M10 — Artifacts & Work Products. First-class registry of
      // task / agent outputs (docs, files, URLs, PRs, deployments,
      // CSV exports, screenshots). The artifact itself stays in its
      // source-of-truth system; this table stores only the reference
      // and enough metadata to render and re-open it. M11's
      // WORK_PRODUCT_EXISTS predicate feature-detects this service at
      // runtime, so M10 can ship before any wiring change there.
      MnWorkProductService,
      MnWorkProductResolver,
      // M14 — Work Queues. Per-project intake buckets with a public
      // webhook URL and first-match-wins routing rules. Each inbound
      // POST creates an MnTask + an MnWorkQueueIntake row linking back
      // for audit. The webhook token in the URL path is the credential;
      // optional HMAC via MANUT_INTAKE_SIGNING_SECRET hardens the
      // surface for senders that can co-sign requests.
      MnWorkQueueService,
      MnWorkQueueResolver,
      // M12 — MAXIMIZER MODE. High-autonomy execution policy that
      // composes M3 (approvals), M4 (budgets), M9 (memory), and M11
      // (outcomes). When MnAgent.maximizerMode is true, the dispatch
      // orchestrator auto-delegates capability-matched tool calls to
      // subordinates, batches the rest into 10-call heartbeat groups,
      // forces approval for any call costing >50% of remaining
      // monthly budget, and runs full M11 outcome verification on
      // every DONE transition. Default off so existing agents are
      // unaffected; flip via enableMnAgentMaximizer.
      MnMaximizerService,
      MnMaximizerResolver,
      // M13 — Deep Planning. Revisionable plan documents attached to a
      // task. Plans flow DRAFT → UNDER_REVIEW → APPROVED | REJECTED;
      // approving a new revision auto-supersedes the prior APPROVED
      // plan in the same transaction so the "current plan" invariant
      // (≤1 APPROVED per task) holds even under concurrent decide
      // calls. The service auto-increments revisionNumber inside a
      // transaction to keep the @@unique([taskId, revisionNumber])
      // constraint clean.
      MnTaskPlanService,
      MnTaskPlanResolver,
      // M15 — Self-Organization. Agents propose structural changes
      // (DELEGATION_CHANGE, NEW_ROUTINE, REPORTING_CHANGE,
      // CAPABILITY_GRANT, plus advisory ROLE_ADJUSTMENT and
      // AGENT_HIRE_PROPOSAL). propose() also creates a sibling
      // MnApproval (type=AGENT_ORG_CHANGE) so the existing inbox / SSE
      // gates the human decision. apply() executes the structural
      // mutation and captures priorState onto the payload so revert()
      // can undo it. The propose+approval pair is written in a single
      // transaction so a half-committed proposal cannot exist.
      MnOrgChangeService,
      MnOrgChangeResolver,
      // M16 — Automatic Organizational Learning. Auto-extracts
      // reusable playbooks from completed tasks into MnSkill rows
      // (source=IMPORTED) with a candidate marker embedded in
      // contentMd. Operators approve/reject from a GraphQL inbox;
      // approved rows remain source=IMPORTED so provenance survives.
      // Depends on M5 (MnSkill) + M9 (MnAgentMemory) via PrismaClient
      // directly — never touches MnSkillService / MnAgentMemoryService
      // (peer ownership rule). The completion-hook scaffold is
      // registered too; the auto-on-DONE wiring is a follow-up PR
      // so MnTaskService stays untouched in this milestone.
      MnOrgLearningService,
      MnOrgLearningResolver,
      MnTaskCompletionHookService,
      // M17 — CEO Chat. Top-level chat surface that resolves every USER
      // turn to a typed work object (MnTask / MnApproval / MnTaskPlan /
      // DECISION_RECORDED). Keyword-heuristic intent classification
      // today; a follow-up replaces it with the Vertex auto-router.
      // Conversations are owner-scoped (one chat per signed-in user
      // per workspace) and survive across sessions.
      MnCeoChatService,
      MnCeoChatResolver,
      MnFeatureRegistrar,
    ];

    // Sub-feature: Routines. Gated by its own env flag so it can ship
    // independently of the full Manut module. Adds:
    //   - MnRoutineService     (PR 1) — CRUD service for routines
    //   - MnRoutineResolver    (PR 1) — GraphQL surface
    //   - MnRoutineCron        (PR 2) — @Cron(EVERY_MINUTE) scheduler
    //                                   that fires due routines via BullMQ
    //   - MnRoutineJob         (preview) — BullMQ consumer that acknowledges
    //                                   queued runs without Vertex execution
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
      controllers: [
        MnApprovalsStreamController,
        ManutPluginRoutesController,
        MnWorkQueueController,
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
