import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

import { MemoryEmbedService } from './embed.service';
import type { IngestMemoryInput } from './types';

/**
 * Manut Wave 4 (M5b) — Memory ingestion.
 *
 * The flow:
 *   1. Compute the embedding for the memory's content (Vertex).
 *   2. Insert a row into mn_agent_memories via raw SQL so the
 *      `vector(1024)` column (managed by the migration, NOT yet
 *      reflected in schema.prisma's Float[] surface) gets a real
 *      pgvector value instead of an empty array.
 *
 * We use $executeRaw rather than `prisma.mnAgentMemory.create` because
 * the Prisma client doesn't know about the new pgvector `embedding`
 * column (the existing Float[] is preserved in schema.prisma so client
 * regeneration isn't required for the SQL-only path). The legacy
 * Float[] column is left default (empty) — the new vector column is
 * what the kNN index reads.
 *
 * Important: any failure here MUST NOT crash the calling chat turn.
 * The caller (chat session post-completion hook) should
 * `void ingestService.ingest(...)` and let it run async; we still
 * try/catch internally to ensure no errors propagate.
 */
@Injectable()
export class MemoryIngestService {
  private readonly logger = new Logger(MemoryIngestService.name);

  // Sentinel value for the agentId / projectId / taskId VARCHAR columns when
  // a memory isn't tied to a specific agent run. The `MnAgentMemory` model
  // still has the FK to `MnAgent.id`, so this only works once a sentinel
  // row exists in `mn_agents` — but for the MVP we accept that the caller
  // is responsible for passing real ids. The default is documented to
  // surface that contract clearly.
  private readonly defaultProjectId = 'unscoped';
  private readonly defaultAgentId = 'unscoped';

  constructor(
    private readonly db: PrismaClient,
    private readonly embedService: MemoryEmbedService
  ) {}

  async ingest(input: IngestMemoryInput): Promise<string | null> {
    const content = input.content?.trim();
    if (!content) {
      this.logger.debug('MemoryIngest: empty content, skipping.');
      return null;
    }
    try {
      const embedding = await this.embedService.embed(content);
      if (!embedding) {
        this.logger.debug(
          'MemoryIngest: no embedding produced, skipping write.'
        );
        return null;
      }

      const id = this.generateId();
      const literal = `[${embedding.join(',')}]`;
      const projectId = input.projectId ?? this.defaultProjectId;
      const agentId = input.agentId ?? this.defaultAgentId;
      const taskId = input.taskId ?? null;
      const importance = input.importance ?? 1;
      const pinned = input.pinned ?? false;

      // user-scoped memories carry user_id so retrieval filters correctly.
      // workspace-scoped memories leave user_id NULL so any workspace member
      // can retrieve them.
      const ownerId = input.scope === 'user' ? input.userId : null;

      await this.db.$executeRaw`
        INSERT INTO "mn_agent_memories" (
          "id",
          "workspace_id",
          "project_id",
          "agent_id",
          "task_id",
          "kind",
          "content_md",
          "embedding",
          "scope",
          "pinned",
          "importance",
          "user_id",
          "retrieved_count",
          "created_at",
          "updated_at"
        ) VALUES (
          ${id},
          ${input.workspaceId},
          ${projectId},
          ${agentId},
          ${taskId},
          ${input.kind}::"MnMemoryKind",
          ${content},
          ${literal}::vector,
          ${input.scope},
          ${pinned},
          ${importance},
          ${ownerId},
          0,
          NOW(),
          NOW()
        )
      `;
      return id;
    } catch (error) {
      // Never crash the parent chat turn — memory is best-effort.
      this.logger.warn(
        `MemoryIngest: write failed (workspace=${input.workspaceId}, user=${input.userId}): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return null;
    }
  }

  /**
   * Plain `randomUUID()` would work; we encapsulate id generation so
   * tests can override via Sinon stubbing on the prototype.
   */
  protected generateId(): string {
    return globalThis.crypto?.randomUUID
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}
