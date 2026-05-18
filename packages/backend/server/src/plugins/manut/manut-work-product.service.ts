import { randomUUID } from 'node:crypto';

import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { MnWorkProduct } from '@prisma/client';
import { PrismaClient } from '@prisma/client';

import {
  CreateMnWorkProductSchema,
  type CreateMnWorkProductValues,
} from './manut-work-product.dto';

/**
 * CRUD for Manut Work Products (M10).
 *
 * Invariants enforced here (NOT in the resolver) so direct service
 * callers (CLI tooling, future MCP bridge, internal background jobs)
 * get the same guarantees as GraphQL clients:
 *
 *   1. Workspace fence — every public method takes `workspaceId` and
 *      asserts the target row resolves to it. A leaked id from another
 *      workspace returns null on read and throws ForbiddenException on
 *      mutation. We never let cross-workspace lookups succeed.
 *   2. Task ownership — `create` resolves the parent task and copies
 *      `workspaceId` + `projectId` from the task row itself so the
 *      caller can't lie about either. Mismatch (task belongs to a
 *      different workspace than the caller's session) throws
 *      ForbiddenException.
 *   3. Agent attribution — when `producedByAgentId` is supplied, the
 *      agent must live in the same workspace as the task. Cross-
 *      workspace producer assignment is rejected.
 *
 * CLAUDE.md scars honored:
 *   - `@Injectable()` is present so TypeScript emits `design:paramtypes`
 *     metadata and NestJS DI can resolve `PrismaClient` (v1.12.0 scar).
 *   - `PrismaClient` is a RUNTIME import (`import { PrismaClient }`),
 *     not `import type`, so the constructor parameter metadata
 *     reflects the real class (v1.12.0 scar).
 *   - Row types like `MnWorkProduct` ARE imported via `import type` —
 *     pure type usage is fine and keeps the runtime bundle smaller.
 */
@Injectable()
export class MnWorkProductService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Create a new work product attributed to a task.
   *
   * The caller supplies the GraphQL `input` which carries `taskId` +
   * the artifact details. We resolve the task row to copy its
   * `workspaceId` + `projectId` onto the new work product — the
   * caller never sets those directly so they cannot diverge from the
   * task's own scope. If `producedByAgentId` is supplied we verify
   * the agent belongs to the same workspace as the task.
   */
  async create(
    workspaceId: string,
    input: CreateMnWorkProductValues
  ): Promise<MnWorkProduct> {
    const values = CreateMnWorkProductSchema.parse(input);

    const task = await this.db.mnTask.findUnique({
      where: { id: values.taskId },
      select: {
        id: true,
        projectId: true,
        project: { select: { workspaceId: true } },
      },
    });
    if (!task) {
      throw new NotFoundException(`Task '${values.taskId}' not found`);
    }
    if (task.project.workspaceId !== workspaceId) {
      // We DELIBERATELY throw Forbidden rather than NotFound here — the
      // distinction matters for the resolver layer's permission check
      // (the caller had read access to this workspaceId but tried to
      // attach to a task that lives elsewhere).
      throw new ForbiddenException(
        `Task '${values.taskId}' does not belong to workspace '${workspaceId}'`
      );
    }

    if (values.producedByAgentId) {
      const agent = await this.db.mnAgent.findUnique({
        where: { id: values.producedByAgentId },
        select: { id: true, workspaceId: true },
      });
      if (!agent) {
        throw new NotFoundException(
          `Agent '${values.producedByAgentId}' not found`
        );
      }
      if (agent.workspaceId !== workspaceId) {
        throw new ForbiddenException(
          `Agent '${values.producedByAgentId}' does not belong to workspace '${workspaceId}'`
        );
      }
    }

    return this.db.mnWorkProduct.create({
      data: {
        id: randomUUID(),
        workspaceId,
        projectId: task.projectId,
        taskId: values.taskId,
        producedByAgentId: values.producedByAgentId ?? null,
        kind: values.kind,
        ref: values.ref,
        byteSize: values.byteSize ?? null,
        title: values.title ?? null,
        description: values.description ?? null,
        metadata: (values.metadata ?? {}) as object,
      },
    });
  }

  /**
   * List work products for a task, newest first. Workspace-fenced —
   * a foreign workspaceId returns an empty array even if the taskId
   * is otherwise valid.
   */
  async listByTask(
    workspaceId: string,
    taskId: string
  ): Promise<MnWorkProduct[]> {
    return this.db.mnWorkProduct.findMany({
      where: { workspaceId, taskId },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  /**
   * Get a single work product by id, scoped to `workspaceId` so
   * callers can't dereference an id leaked from another workspace.
   * Returns null on miss or cross-workspace lookup.
   */
  async get(
    workspaceId: string,
    workProductId: string
  ): Promise<MnWorkProduct | null> {
    const row = await this.db.mnWorkProduct.findUnique({
      where: { id: workProductId },
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
    workProductId: string
  ): Promise<MnWorkProduct> {
    const row = await this.get(workspaceId, workProductId);
    if (!row) {
      throw new NotFoundException(`Work product '${workProductId}' not found`);
    }
    return row;
  }

  /**
   * Hard delete. Workspace-fenced — deleting an id from another
   * workspace throws NotFoundException rather than succeeding. The
   * underlying artifact (doc / file / PR) is NOT touched; we only
   * remove the registry row.
   */
  async delete(workspaceId: string, workProductId: string): Promise<void> {
    // getOrThrow does the workspace fence for us.
    await this.getOrThrow(workspaceId, workProductId);
    await this.db.mnWorkProduct.delete({ where: { id: workProductId } });
  }
}
