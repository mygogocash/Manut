import { Module } from '@nestjs/common';

import { MemoryEmbedService } from './embed.service';
import { MemoryIngestService } from './ingest.service';
import { MemoryRetrieveService } from './retrieve.service';

/**
 * Manut Wave 4 (M5b) — Memory MVP module.
 *
 * Registers the three services required for AI cross-session recall:
 *   - MemoryEmbedService    → Vertex `gemini-embedding-001` wrapper
 *   - MemoryIngestService   → writes memories + their embeddings
 *   - MemoryRetrieveService → top-K kNN over pgvector
 *
 * The module is consumed by the surrounding CopilotModule (one level
 * up); we export all three services so the chat-session lifecycle hook
 * (post-completion ingest) and the prompt-assembly path (pre-turn
 * retrieve) can inject them.
 *
 * `PrismaClient` and `CopilotProviderFactory` are resolved from the
 * surrounding module — both are global / singleton providers.
 *
 * Per CLAUDE.md v1.12.0 DI-metadata scars: every class registered as a
 * provider must carry `@Injectable()`, and DI constructor targets must
 * be runtime imports (no `import type`). See each service file.
 */
@Module({
  providers: [MemoryEmbedService, MemoryIngestService, MemoryRetrieveService],
  exports: [MemoryEmbedService, MemoryIngestService, MemoryRetrieveService],
})
export class CopilotMemoryModule {}
