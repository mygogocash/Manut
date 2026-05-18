import { randomUUID } from 'node:crypto';

import { Injectable, NotFoundException } from '@nestjs/common';
import type { MnAgentMemory } from '@prisma/client';
import { MnMemoryKind, PrismaClient } from '@prisma/client';

import {
  StoreMnAgentMemorySchema,
  type StoreMnAgentMemoryValues,
} from './manut-memory.dto';

/**
 * CRUD + recall for Manut Agent Memory (M9).
 *
 * Invariants enforced here (NOT in the resolver) so direct service
 * callers (auto-router prepend, future MCP `recall` tool, CLI) get the
 * same guarantees as GraphQL clients:
 *
 *  1. (workspaceId, agentId) is the tenancy fence. Every read scopes by
 *     workspaceId so a leaked agentId from another tenant cannot
 *     dereference a row.
 *  2. `recall` returns rows ordered by `importance DESC, lastRetrievedAt
 *     DESC NULLS LAST, createdAt DESC` so operator-controlled importance
 *     dominates and never-retrieved rows fall to the back without being
 *     dropped entirely.
 *  3. `recall` also touches the row's `retrievedCount` + `lastRetrievedAt`
 *     so the next ranking pass sees the boost. The bump is best-effort —
 *     a write failure does not block the read.
 *  4. `garbageCollect` only deletes rows below `importanceFloor` AND
 *     older than `beforeDate`. High-importance memories are always
 *     preserved regardless of age.
 *
 * CLAUDE.md scars honored:
 *  - `@Injectable()` is present so TS emits `design:paramtypes` and
 *    NestJS DI can resolve `PrismaClient` (v1.12.0 production scar).
 *  - `PrismaClient` and `MnMemoryKind` are RUNTIME imports, not
 *    `import type`, so the constructor parameter metadata reflects the
 *    real class (v1.12.0 production scar).
 *  - Row types like `MnAgentMemory` ARE imported via `import type` —
 *    pure type usage is fine and keeps the runtime bundle smaller.
 */
@Injectable()
export class MnAgentMemoryService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Persist a new memory row. Returns the stored row including the
   * default `importance=1` if the caller did not provide one.
   */
  async storeMemory(input: StoreMnAgentMemoryValues): Promise<MnAgentMemory> {
    const values = StoreMnAgentMemorySchema.parse(input);

    return this.db.mnAgentMemory.create({
      data: {
        id: randomUUID(),
        workspaceId: values.workspaceId,
        projectId: values.projectId,
        agentId: values.agentId,
        taskId: values.taskId ?? null,
        kind: values.kind,
        contentMd: values.contentMd,
        importance: values.importance ?? 1,
        embedding: values.embedding ?? [],
      },
    });
  }

  /**
   * Recall memories for an agent, ranked by importance + recency.
   *
   * The optional `taskId` narrows recall to rows pinned to that task
   * AND task-agnostic rows (taskId = null). The optional `query` is
   * reserved for future semantic search; in M9 it is a no-op pass-through
   * so the resolver signature stays stable across the embedding rollout.
   *
   * Side effect: rows that are returned have their `retrievedCount`
   * incremented and `lastRetrievedAt` set to NOW. The increment is
   * best-effort — a failure to write is logged-and-ignored rather than
   * propagated, because the recall result is already in hand and useful.
   */
  async recall(
    workspaceId: string,
    agentId: string,
    options: {
      taskId?: string | null;
      query?: string | null;
      limit?: number;
    } = {}
  ): Promise<MnAgentMemory[]> {
    const limit = Math.max(1, Math.min(options.limit ?? 10, 100));

    const taskFilter =
      options.taskId !== undefined && options.taskId !== null
        ? { OR: [{ taskId: options.taskId }, { taskId: null }] }
        : {};

    const rows = await this.db.mnAgentMemory.findMany({
      where: {
        workspaceId,
        agentId,
        ...taskFilter,
      },
      orderBy: [
        { importance: 'desc' },
        { lastRetrievedAt: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'desc' },
      ],
      take: limit,
    });

    if (rows.length > 0) {
      const ids = rows.map(r => r.id);
      // Best-effort retrieval bump — never block the read.
      this.db.mnAgentMemory
        .updateMany({
          where: { id: { in: ids } },
          data: {
            retrievedCount: { increment: 1 },
            lastRetrievedAt: new Date(),
          },
        })
        .catch(() => undefined);
    }

    return rows;
  }

  /**
   * Get a single row scoped to `workspaceId` so callers cannot
   * dereference an id leaked from another tenant.
   */
  async get(
    workspaceId: string,
    memoryId: string
  ): Promise<MnAgentMemory | null> {
    const row = await this.db.mnAgentMemory.findUnique({
      where: { id: memoryId },
    });
    if (!row || row.workspaceId !== workspaceId) return null;
    return row;
  }

  /**
   * Same as `get`, but throws `NotFoundException` on miss. Used by
   * mutations where we need to fail loudly rather than silently no-op.
   */
  async getOrThrow(
    workspaceId: string,
    memoryId: string
  ): Promise<MnAgentMemory> {
    const row = await this.get(workspaceId, memoryId);
    if (!row) {
      throw new NotFoundException(`Memory '${memoryId}' not found`);
    }
    return row;
  }

  /**
   * Hard-delete a memory row. Memories are operator-managed and not
   * referenced elsewhere, so a true delete is safe (unlike skills,
   * which need soft-delete to keep exports resolving).
   */
  async delete(workspaceId: string, memoryId: string): Promise<void> {
    // getOrThrow doubles as the workspace fence — we cannot delete a
    // row that belongs to another tenant.
    await this.getOrThrow(workspaceId, memoryId);
    await this.db.mnAgentMemory.delete({ where: { id: memoryId } });
  }

  /**
   * Reap low-importance memories older than `beforeDate`. The
   * `importanceFloor` parameter is the EXCLUSIVE threshold — rows with
   * `importance < importanceFloor` are eligible for deletion; rows at
   * or above the floor are always preserved.
   *
   * Default floor is 3, which keeps anything explicitly bumped above
   * the default of 1 (most operator-curated memories) safe from the
   * sweep.
   *
   * Returns the number of rows deleted.
   */
  async garbageCollect(
    agentId: string,
    beforeDate: Date,
    options: { importanceFloor?: number } = {}
  ): Promise<number> {
    const importanceFloor = options.importanceFloor ?? 3;
    const result = await this.db.mnAgentMemory.deleteMany({
      where: {
        agentId,
        importance: { lt: importanceFloor },
        createdAt: { lt: beforeDate },
      },
    });
    return result.count;
  }

  /**
   * List memories for an agent (admin / UI surface — no retrieval
   * bookkeeping side effects). Optionally narrowed by taskId.
   */
  async list(
    workspaceId: string,
    agentId: string,
    options: { taskId?: string | null } = {}
  ): Promise<MnAgentMemory[]> {
    return this.db.mnAgentMemory.findMany({
      where: {
        workspaceId,
        agentId,
        ...(options.taskId !== undefined && options.taskId !== null
          ? { taskId: options.taskId }
          : {}),
      },
      orderBy: [{ importance: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Render a compact memory recall block suitable for prepending to a
   * system prompt. Returns null when the agent has zero memories.
   * Caps each line at 200 chars so a runaway memory cannot blow the
   * prompt budget.
   */
  async renderRecallBlock(
    workspaceId: string,
    agentId: string,
    options: {
      taskId?: string | null;
      limit?: number;
    } = {}
  ): Promise<string | null> {
    const rows = await this.recall(workspaceId, agentId, {
      taskId: options.taskId ?? null,
      limit: options.limit ?? 3,
    });
    if (rows.length === 0) return null;
    const lines = rows.map(row => {
      const head = row.contentMd.split('\n')[0].trim();
      const trimmed = head.length > 200 ? head.slice(0, 197) + '...' : head;
      return `- [${row.kind}] ${trimmed}`;
    });
    return ['MEMORY RECALL', ...lines].join('\n');
  }

  /** Exposed for static smoke tests — never load via reflection. */
  static readonly KINDS: ReadonlyArray<MnMemoryKind> = [
    MnMemoryKind.FACT,
    MnMemoryKind.DECISION,
    MnMemoryKind.OBSERVATION,
    MnMemoryKind.PLAYBOOK,
  ];
}
