import { Module } from '@nestjs/common';

import { DistillCron } from './distill.cron';
import { DistillService } from './distill.service';
import { RateMessageResolver } from './rate-message.resolver';

/**
 * Manut M2 E2.4 — Self-evolution loop module.
 *
 * Wires together:
 *   - `RateMessageResolver` — GraphQL `rateMessage(messageId, rating)`
 *     mutation that persists 👍/👎 chips as OBSERVATION memories.
 *   - `DistillService` — turns a workspace's recent feedback into a
 *     PLAYBOOK via the existing copilot LLM provider.
 *   - `DistillCron` — fires the service every Sunday 00:00 UTC.
 *
 * The module relies on the surrounding `CopilotModule` for:
 *   - `PrismaClient` (global)
 *   - `AccessController` (re-exported by `CopilotModule`'s imports)
 *   - `MemoryIngestService` (the M5b memory ingest pipeline)
 *   - `CopilotProviderFactory` (LLM dispatch)
 *
 * Per CLAUDE.md DI-metadata scars: the resolver MUST be in the
 * `providers[]` array so NestJS instantiates it as a singleton. Without
 * that, the @Resolver() decorator alone does not register the GraphQL
 * mutation — only the metadata. Same trap that bit the v1.10.x
 * `SuperflowFeatureRegistrar` rollout.
 */
@Module({
  providers: [DistillService, DistillCron, RateMessageResolver],
  exports: [DistillService],
})
export class CopilotEvolutionModule {}
