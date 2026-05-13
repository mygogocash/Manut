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
import { McpApiKeyService } from './mcp/auth';
import { WorkspaceMcpController } from './mcp/controller';
import { WorkspaceMcpProvider } from './mcp/provider';
import { ChatMessageCache } from './message';
import { PromptService } from './prompt';
import { ScenarioClassifier } from './prompt/scenario-classifier';
import { CopilotProviderFactory, CopilotProviders } from './providers';
import {
  CopilotResolver,
  PromptsManagementResolver,
  UserCopilotResolver,
} from './resolver';
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
    // tools (doc_read, doc_keyword_search, doc_semantic_search,
    // doc_edit).
    DocReadEventBus,
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
  exports: [PromptService, CopilotProviderFactory],
})
export class CopilotModule {}
