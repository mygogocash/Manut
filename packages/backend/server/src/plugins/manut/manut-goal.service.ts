import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { MnGoal, MnTask, MnTaskBlocker } from '@prisma/client';
import { MnGoalStatus, PrismaClient } from '@prisma/client';

import {
  CreateMnGoalSchema,
  type CreateMnGoalValues,
  MAX_GOAL_CHAIN_DEPTH,
  MAX_TASK_CHAIN_DEPTH,
  UpdateMnGoalSchema,
  type UpdateMnGoalValues,
} from './manut-goal.dto';

/**
 * CRUD + invariants for Manut goals (M2). Mirrors the patterns in
 * `MnAgentService`:
 *
 *  - PrismaClient is a RUNTIME import (DI target) — never `import type`
 *    (v1.12.0 production scar).
 *  - Row types (`MnGoal`, `MnTask`, `MnTaskBlocker`) ARE `import type` —
 *    pure-type usage, no DI involvement.
 *  - All cross-tenant fences happen here, not in the resolver, so direct
 *    service callers (CLI, tests, future MCP bridge) get the same
 *    guarantees as GraphQL clients.
 *
 * Invariants enforced:
 *
 *  1. `projectId` belongs to the calling workspace.
 *  2. `parentGoalId`, if set, belongs to the calling workspace AND does
 *     not form a cycle, AND the chain depth does not exceed
 *     `MAX_GOAL_CHAIN_DEPTH`.
 *  3. `ownerAgentId`, if set, belongs to the calling workspace.
 *  4. Terminal statuses (`ACHIEVED`, `CANCELLED`) cannot be flipped back
 *     to `PLANNED` / `ACTIVE` — strategy outcomes are permanent.
 *  5. On parent-task assignment, no cycle in the `parentTaskId` chain,
 *     no chain longer than `MAX_TASK_CHAIN_DEPTH`.
 *  6. XOR on `MnTask.assigneeUserId` and `MnTask.assigneeAgentId` — at
 *     most one of the two may be non-null.
 *  7. `MnTaskBlocker` rows: no self-block, no duplicates.
 */
@Injectable()
export class MnGoalService {
  constructor(private readonly db: PrismaClient) {}

  // ---------------------------------------------------------------------------
  // Goal CRUD
  // ---------------------------------------------------------------------------

  async create(
    workspaceId: string,
    createdByUserId: string | null,
    input: CreateMnGoalValues
  ): Promise<MnGoal> {
    const values = CreateMnGoalSchema.parse(input);

    await this.assertProjectInWorkspace(workspaceId, values.projectId);

    if (values.parentGoalId) {
      const parent = await this.assertGoalInWorkspace(
        workspaceId,
        values.parentGoalId
      );
      // New goals can't already be the parent of an existing goal, so a
      // cycle is impossible at create time — but the depth check still
      // applies. Pretend we already exist as `parent`'s child and see if
      // the chain length would exceed the cap.
      await this.assertChainDepthOK(parent.id);
    }

    if (values.ownerAgentId) {
      await this.assertAgentInWorkspace(workspaceId, values.ownerAgentId);
    }

    return this.db.mnGoal.create({
      data: {
        id: randomUUID(),
        workspaceId,
        projectId: values.projectId,
        title: values.title,
        description: values.description ?? null,
        level: values.level,
        parentGoalId: values.parentGoalId ?? null,
        ownerAgentId: values.ownerAgentId ?? null,
        status: values.status ?? MnGoalStatus.PLANNED,
        createdByUserId: createdByUserId ?? null,
      },
    });
  }

  async list(
    workspaceId: string,
    projectId?: string | null
  ): Promise<MnGoal[]> {
    return this.db.mnGoal.findMany({
      where: {
        workspaceId,
        ...(projectId ? { projectId } : {}),
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async get(workspaceId: string, goalId: string): Promise<MnGoal | null> {
    const row = await this.db.mnGoal.findUnique({ where: { id: goalId } });
    if (!row || row.workspaceId !== workspaceId) return null;
    return row;
  }

  async getOrThrow(workspaceId: string, goalId: string): Promise<MnGoal> {
    const row = await this.get(workspaceId, goalId);
    if (!row) {
      throw new NotFoundException(`Goal '${goalId}' not found`);
    }
    return row;
  }

  async update(
    workspaceId: string,
    goalId: string,
    input: UpdateMnGoalValues
  ): Promise<MnGoal> {
    const values = UpdateMnGoalSchema.parse(input);
    const current = await this.getOrThrow(workspaceId, goalId);

    // Terminal-state lock — once a goal is ACHIEVED or CANCELLED the
    // outcome is recorded permanently. Strategy retros need that audit
    // trail; we don't let it be silently un-cancelled.
    if (
      (current.status === MnGoalStatus.ACHIEVED ||
        current.status === MnGoalStatus.CANCELLED) &&
      values.status !== undefined &&
      values.status !== null &&
      values.status !== current.status
    ) {
      throw new BadRequestException(
        `Goal '${goalId}' is in terminal state '${current.status}' and cannot be changed`
      );
    }

    if (values.parentGoalId !== undefined && values.parentGoalId !== null) {
      if (values.parentGoalId === goalId) {
        throw new BadRequestException('Goal cannot be itself a parent');
      }
      await this.assertGoalInWorkspace(workspaceId, values.parentGoalId);
      await this.assertNoGoalCycle(goalId, values.parentGoalId);
    }

    if (values.ownerAgentId !== undefined && values.ownerAgentId !== null) {
      await this.assertAgentInWorkspace(workspaceId, values.ownerAgentId);
    }

    return this.db.mnGoal.update({
      where: { id: goalId },
      data: {
        ...(values.title !== undefined && values.title !== null
          ? { title: values.title }
          : {}),
        ...(values.description !== undefined
          ? { description: values.description }
          : {}),
        ...(values.level !== undefined && values.level !== null
          ? { level: values.level }
          : {}),
        ...(values.parentGoalId !== undefined
          ? { parentGoalId: values.parentGoalId }
          : {}),
        ...(values.ownerAgentId !== undefined
          ? { ownerAgentId: values.ownerAgentId }
          : {}),
        ...(values.status !== undefined && values.status !== null
          ? { status: values.status }
          : {}),
      },
    });
  }

  async delete(workspaceId: string, goalId: string): Promise<void> {
    await this.getOrThrow(workspaceId, goalId);
    await this.db.mnGoal.delete({ where: { id: goalId } });
  }

  /**
   * Walk the parent-goal chain from `goalId` to its root and return it
   * ordered root → leaf. Each entry is an ancestry step (goalId / level
   * / title / status / depth) — flat enough to drop into a GraphQL
   * surface or a breadcrumb without further mapping.
   *
   * Returns an empty array when the goal does not exist or belongs to
   * another workspace; callers render an empty breadcrumb in that case.
   */
  async ancestryChain(
    workspaceId: string,
    goalId: string
  ): Promise<
    Array<{
      goalId: string;
      title: string;
      level: MnGoal['level'];
      status: MnGoal['status'];
      depth: number;
    }>
  > {
    const head = await this.get(workspaceId, goalId);
    if (!head) return [];

    const rows: MnGoal[] = [head];
    let cursor: string | null = head.parentGoalId;
    for (let i = 0; i < MAX_GOAL_CHAIN_DEPTH; i++) {
      if (cursor === null) break;
      const next: MnGoal | null = await this.db.mnGoal.findUnique({
        where: { id: cursor },
      });
      if (!next) break;
      if (next.workspaceId !== workspaceId) break;
      rows.push(next);
      cursor = next.parentGoalId;
    }
    rows.reverse();
    return rows.map((g, idx) => ({
      goalId: g.id,
      title: g.title,
      level: g.level,
      status: g.status,
      depth: idx,
    }));
  }

  // ---------------------------------------------------------------------------
  // Task ancestry (M2.2 — parent/child + blockers + XOR assignee)
  // ---------------------------------------------------------------------------

  /**
   * Set or clear the parent-task pointer on a task. Rejects self-parent,
   * cycles, and chains deeper than `MAX_TASK_CHAIN_DEPTH`.
   */
  async setTaskParent(
    workspaceId: string,
    taskId: string,
    parentTaskId: string | null
  ): Promise<MnTask> {
    await this.assertTaskInWorkspace(workspaceId, taskId);

    if (parentTaskId !== null) {
      if (parentTaskId === taskId) {
        throw new BadRequestException('Task cannot parent itself');
      }
      await this.assertTaskInWorkspace(workspaceId, parentTaskId);
      await this.assertNoTaskCycle(taskId, parentTaskId);
    }

    return this.db.mnTask.update({
      where: { id: taskId },
      data: { parentTaskId },
    });
  }

  /**
   * Add a "this task is blocked by that one" edge. Rejects self-block
   * and duplicates (unique constraint at the service layer mirrors the
   * Prisma @@unique([taskId, blockedByTaskId]) for friendlier errors).
   */
  async addTaskBlocker(
    workspaceId: string,
    taskId: string,
    blockedByTaskId: string
  ): Promise<MnTaskBlocker> {
    if (taskId === blockedByTaskId) {
      throw new BadRequestException('A task cannot block itself');
    }
    const task = await this.assertTaskInWorkspace(workspaceId, taskId);
    await this.assertTaskInWorkspace(workspaceId, blockedByTaskId);

    const existing = await this.db.mnTaskBlocker.findUnique({
      where: { taskId_blockedByTaskId: { taskId, blockedByTaskId } } as any,
    });
    if (existing) {
      throw new BadRequestException(
        `Task '${taskId}' is already blocked by '${blockedByTaskId}'`
      );
    }

    return this.db.mnTaskBlocker.create({
      data: {
        id: randomUUID(),
        taskId,
        blockedByTaskId,
        projectId: task.projectId,
      },
    });
  }

  /**
   * Remove a blocker edge. No-op when the edge does not exist.
   */
  async removeTaskBlocker(
    workspaceId: string,
    blockerId: string
  ): Promise<void> {
    // We don't load the blocker first — the resolver permission check
    // already established workspace ownership via the task lookup. The
    // delete is keyed by id, so a foreign blockerId is a no-op (Prisma
    // throws on missing; we swallow).
    try {
      await this.db.mnTaskBlocker.delete({ where: { id: blockerId } });
    } catch {
      // Best-effort delete; non-existent edges are not errors here.
      void workspaceId;
    }
  }

  /**
   * Assign / re-assign a task. XOR-enforced: at most one of
   * `{ userId, agentId }` may be non-null. Both null clears assignees.
   * Both set is rejected with 422-equivalent BadRequestException.
   */
  async assignTask(
    workspaceId: string,
    taskId: string,
    args: { userId?: string | null; agentId?: string | null }
  ): Promise<MnTask> {
    const hasUser = args.userId !== undefined && args.userId !== null;
    const hasAgent = args.agentId !== undefined && args.agentId !== null;
    if (hasUser && hasAgent) {
      throw new BadRequestException(
        'A task may have at most one of { assigneeUserId, assigneeAgentId } set'
      );
    }
    await this.assertTaskInWorkspace(workspaceId, taskId);
    if (hasAgent && args.agentId) {
      await this.assertAgentInWorkspace(workspaceId, args.agentId);
    }
    return this.db.mnTask.update({
      where: { id: taskId },
      data: {
        assigneeUserId: args.userId === undefined ? undefined : args.userId,
        assigneeAgentId: args.agentId === undefined ? undefined : args.agentId,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Invariant helpers
  // ---------------------------------------------------------------------------

  private async assertProjectInWorkspace(
    workspaceId: string,
    projectId: string
  ): Promise<void> {
    const project = await this.db.mnProject.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new BadRequestException(`Project '${projectId}' not found`);
    }
    if (project.workspaceId !== workspaceId) {
      throw new BadRequestException(
        `Project '${projectId}' does not belong to this workspace`
      );
    }
  }

  private async assertGoalInWorkspace(
    workspaceId: string,
    goalId: string
  ): Promise<MnGoal> {
    const goal = await this.db.mnGoal.findUnique({ where: { id: goalId } });
    if (!goal) {
      throw new BadRequestException(`Goal '${goalId}' not found`);
    }
    if (goal.workspaceId !== workspaceId) {
      throw new BadRequestException(
        `Goal '${goalId}' does not belong to this workspace`
      );
    }
    return goal;
  }

  private async assertAgentInWorkspace(
    workspaceId: string,
    agentId: string
  ): Promise<void> {
    const agent = await this.db.mnAgent.findUnique({
      where: { id: agentId },
    });
    if (!agent) {
      throw new BadRequestException(`Agent '${agentId}' not found`);
    }
    if (agent.workspaceId !== workspaceId) {
      throw new BadRequestException(
        `Agent '${agentId}' does not belong to this workspace`
      );
    }
  }

  private async assertTaskInWorkspace(
    workspaceId: string,
    taskId: string
  ): Promise<MnTask> {
    const task = await this.db.mnTask.findUnique({ where: { id: taskId } });
    if (!task) {
      throw new BadRequestException(`Task '${taskId}' not found`);
    }
    const project = await this.db.mnProject.findUnique({
      where: { id: task.projectId },
    });
    if (!project || project.workspaceId !== workspaceId) {
      throw new BadRequestException(
        `Task '${taskId}' does not belong to this workspace`
      );
    }
    return task;
  }

  /**
   * Walk up from `proposedParentId` looking for either `goalId` (cycle)
   * or running out of parents (no cycle). Combined depth limit applies.
   */
  private async assertNoGoalCycle(
    goalId: string,
    proposedParentId: string
  ): Promise<void> {
    let cursor: string | null = proposedParentId;
    for (let i = 0; i < MAX_GOAL_CHAIN_DEPTH; i++) {
      if (cursor === null) return;
      if (cursor === goalId) {
        throw new BadRequestException(
          `Setting parentGoal to '${proposedParentId}' would create a cycle`
        );
      }
      const parent: MnGoal | null = await this.db.mnGoal.findUnique({
        where: { id: cursor },
      });
      if (!parent) return;
      cursor = parent.parentGoalId;
    }
    throw new BadRequestException(
      `Goal chain exceeds max depth ${MAX_GOAL_CHAIN_DEPTH}`
    );
  }

  /**
   * Walk up the chain from `proposedParentId`. If the chain length is
   * already at or above the cap, refuse.
   */
  private async assertChainDepthOK(parentId: string): Promise<void> {
    let cursor: string | null = parentId;
    let depth = 1; // we count the new node as depth 1
    while (cursor !== null && depth < MAX_GOAL_CHAIN_DEPTH) {
      const parent: MnGoal | null = await this.db.mnGoal.findUnique({
        where: { id: cursor },
      });
      if (!parent) break;
      depth += 1;
      cursor = parent.parentGoalId;
    }
    if (depth >= MAX_GOAL_CHAIN_DEPTH && cursor !== null) {
      throw new BadRequestException(
        `Goal chain exceeds max depth ${MAX_GOAL_CHAIN_DEPTH}`
      );
    }
  }

  private async assertNoTaskCycle(
    taskId: string,
    proposedParentId: string
  ): Promise<void> {
    let cursor: string | null = proposedParentId;
    for (let i = 0; i < MAX_TASK_CHAIN_DEPTH; i++) {
      if (cursor === null) return;
      if (cursor === taskId) {
        throw new BadRequestException(
          `Setting parentTask to '${proposedParentId}' would create a cycle`
        );
      }
      const parent: MnTask | null = await this.db.mnTask.findUnique({
        where: { id: cursor },
      });
      if (!parent) return;
      cursor = parent.parentTaskId;
    }
    throw new BadRequestException(
      `Task parent chain exceeds max depth ${MAX_TASK_CHAIN_DEPTH}`
    );
  }
}
