import './config';

import { Module } from '@nestjs/common';

import { ServerConfigModule } from '../../core';
import { DocStorageModule } from '../../core/doc';
import { FeatureModule } from '../../core/features';
import { PermissionModule } from '../../core/permission';
import { QuotaModule } from '../../core/quota';
import { WorkspaceModule } from '../../core/workspaces';
import { IndexerModule } from '../indexer';
import { AdminIndexingController } from './admin-indexing.controller';
import {
  CopilotContextResolver,
  CopilotContextRootResolver,
  CopilotContextService,
} from './context';
import { CopilotController } from './controller';
import { CopilotCronJobs } from './cron';
import { DocReadEventBus } from './doc-read/doc-read-event-bus.service';
import { DocReadStreamController } from './doc-read/doc-read-stream.controller';
import { CopilotEmbeddingJob } from './embedding';
import { EmbeddingHealthService } from './embedding-health';
// Manut M2 (E2.4) — Self-evolution loop. Cron + service + resolver
// registered directly in providers[] so they share the surrounding DI
// scope (PrismaClient + CopilotProviderFactory + MemoryIngestService).
// Same flat-providers pattern as the M5b memory module below.
import { DistillCron } from './evolution/distill.cron';
import { DistillService } from './evolution/distill.service';
import { RateMessageResolver } from './evolution/rate-message.resolver';
import { ChatRequestInterceptorService } from './interceptor';
import { McpApiKeyService } from './mcp/auth';
import { WorkspaceMcpController } from './mcp/controller';
import { WorkspaceMcpProvider } from './mcp/provider';
// Manut Wave 4 (M5b) — Memory MVP. Services are registered directly in
// the providers[] array below so they share the surrounding DI scope
// (PrismaClient + CopilotProviderFactory) without crossing module
// boundaries. Equivalent to importing CopilotMemoryModule but avoids
// the cross-module re-export dance.
import { MemoryEmbedService } from './memory/embed.service';
import { MemoryIngestService } from './memory/ingest.service';
import { MemoryResolver } from './memory/memory.resolver';
import { MemoryRetrieveService } from './memory/retrieve.service';
import { ChatMessageCache } from './message';
import { PromptService } from './prompt';
import { ScenarioClassifier } from './prompt/scenario-classifier';
import { CopilotProviderFactory, CopilotProviders } from './providers';
import {
  CopilotResolver,
  PromptsManagementResolver,
  UserCopilotResolver,
} from './resolver';
import { AuthorizedRetrievalFilterService } from './security';
import { ChatSessionService } from './session';
import { CopilotStorage } from './storage';
import {
  CopilotTranscriptionResolver,
  CopilotTranscriptionService,
} from './transcript';
import { AudioAutoTranscriptionService } from './transcription';
import { CopilotWorkflowExecutors, CopilotWorkflowService } from './workflow';
import {
  CopilotWorkspaceEmbeddingConfigResolver,
  CopilotWorkspaceEmbeddingResolver,
  CopilotWorkspaceService,
} from './workspace';
// Manut M1 — Epic E1.11: WebSocket transport for AI chat. Parallel to the
// SSE controller; flag-gated cutover via `ws_transport` feature flag, with
// SSE staying live for 30 days as fallback per plan decision #23.
import { CopilotChatGateway } from './ws/chat.gateway';
import { MemoryPushService } from './ws/memory-push.service';
import { ToolProgressService } from './ws/tool-progress.service';

@Module({
  imports: [
    DocStorageModule,
    FeatureModule,
    QuotaModule,
    PermissionModule,
    ServerConfigModule,
    WorkspaceModule,
    IndexerModule,
  ],
  providers: [
    // providers
    ...CopilotProviders,
    CopilotProviderFactory,
    // services
    ChatSessionService,
    CopilotResolver,
    ChatMessageCache,
    PromptService,
    ScenarioClassifier,
    CopilotStorage,
    ChatRequestInterceptorService,
    AuthorizedRetrievalFilterService,
    // workflow
    CopilotWorkflowService,
    ...CopilotWorkflowExecutors,
    // context
    CopilotContextResolver,
    CopilotContextService,
    // jobs
    CopilotEmbeddingJob,
    CopilotCronJobs,
    EmbeddingHealthService,
    // transcription
    CopilotTranscriptionService,
    CopilotTranscriptionResolver,
    // audio auto-transcription (β-AI-11)
    AudioAutoTranscriptionService,
    // workspace embeddings
    CopilotWorkspaceService,
    CopilotWorkspaceEmbeddingResolver,
    CopilotWorkspaceEmbeddingConfigResolver,
    // gql resolvers
    UserCopilotResolver,
    PromptsManagementResolver,
    CopilotContextRootResolver,
    // mcp
    WorkspaceMcpProvider,
    McpApiKeyService,
    // Knowledge Graph activation pulses — bus is in-memory pub/sub
    // consumed by the SSE controller below and emitted from copilot
    // tools (doc_read, doc_hybrid_search, doc_keyword_search,
    // doc_semantic_search, doc_edit).
    DocReadEventBus,
    // Manut Wave 4 (M5b) — Memory MVP services. Order matters for
    // readability only; NestJS DI resolves independent of array order.
    MemoryEmbedService,
    MemoryIngestService,
    MemoryRetrieveService,
    // M2 — E2.2 — "What AI knows about me" GraphQL resolver. Reads
    // mn_agent_memories via the shared PrismaClient; auth via
    // AccessController. Registered alongside the other Memory
    // services so it shares the CopilotModule DI scope.
    MemoryResolver,
    // M2 — E2.4 — Self-evolution loop. RateMessageResolver writes
    // 👍/👎 chip clicks as OBSERVATION memories; DistillCron fires
    // Sunday 00:00 UTC and DistillService summarises the week's
    // feedback into a workspace-scoped PLAYBOOK memory that the
    // system-prompt formatter then prepends to every chat turn.
    DistillService,
    DistillCron,
    RateMessageResolver,
    // Manut M1 — Epic E1.11. WS gateway + thin fan-out services for tool
    // progress and memory-push events. Lives alongside the SSE controller
    // (still in `controllers:` above) — both transports run in parallel.
    CopilotChatGateway,
    ToolProgressService,
    MemoryPushService,
  ],
  controllers: [
    CopilotController,
    WorkspaceMcpController,
    AdminIndexingController,
    DocReadStreamController,
  ],
  // Re-export the providers other plugins need to inject. The analytics
  // plugin (plugins/analytics) consumes PromptService + CopilotProviderFactory
  // for Strategist / TrendDetector / AnomalyDetector services — exporting
  // here keeps the DI graph honest without forcing analytics to import the
  // full CopilotModule internals.
  exports: [
    PromptService,
    CopilotProviderFactory,
    // Manut Wave 4 (M5b) — exported so the chat-session lifecycle hook
    // (in session.ts / controller.ts; wired in a follow-up) can inject
    // them. The retrieve service is also surfaced via PromptService's
    // memory-injection helper.
    MemoryEmbedService,
    MemoryIngestService,
    MemoryRetrieveService,
  ],
})
export class CopilotModule {}
