import { Injectable, Logger } from '@nestjs/common';
import type { MnGoal, MnTask } from '@prisma/client';
import { PrismaClient } from '@prisma/client';

import {
  GOAL_CONTEXT_CHAR_CAP,
  MAX_GOAL_CHAIN_DEPTH,
  MAX_TASK_CHAIN_DEPTH,
} from './manut-goal.dto';
import { MnGoalService } from './manut-goal.service';

/**
 * Read-side service that turns a task id into both a human-readable
 * ancestry view (used by the frontend breadcrumb) and a bounded text
 * block suitable for prepending to an AI system message.
 *
 * Why a separate class from `MnGoalService`:
 *
 *  - `MnGoalService` owns the writes + invariants. Keeping the
 *    context-rendering helpers there would balloon that file past 800
 *    lines (CLAUDE.md coding-style cap) and mix write concerns with
 *    read concerns.
 *  - The auto-router calls this service with no caller user context —
 *    it's a system-side injection. Permission checks happen upstream
 *    at the chat-session create path.
 *
 * `PrismaClient` is a RUNTIME import so DI metadata reflects the real
 * class (v1.12.0 production scar).
 */
@Injectable()
export class MnGoalContextService {
  private readonly logger = new Logger('MnGoalContextService');

  constructor(
    private readonly db: PrismaClient,
    private readonly goalService: MnGoalService
  ) {}

  /**
   * Walk a task's ancestry chain — both up the parentTaskId tree AND
   * up the goal tree starting from the task's (or first ancestor's)
   * `goalId`. Returns ordered root → leaf so the UI can map straight
   * into a breadcrumb.
   *
   * Returns null for the task itself rather than throwing — the caller
   * is typically rendering a breadcrumb where "no task" is a valid
   * empty state.
   */
  async taskAncestry(
    workspaceId: string,
    taskId: string
  ): Promise<{
    taskId: string;
    taskTitle: string;
    taskAncestors: Array<{ taskId: string; title: string; depth: number }>;
    goalChain: Array<{
      goalId: string;
      title: string;
      level: MnGoal['level'];
      status: MnGoal['status'];
      depth: number;
    }>;
  } | null> {
    const task = await this.loadTaskInWorkspace(workspaceId, taskId);
    if (!task) return null;

    // 1. Walk up parentTaskId.
    const ancestors: MnTask[] = [];
    let cursor: string | null = task.parentTaskId;
    for (let i = 0; i < MAX_TASK_CHAIN_DEPTH; i++) {
      if (cursor === null) break;
      const parent: MnTask | null = await this.db.mnTask.findUnique({
        where: { id: cursor },
      });
      if (!parent) break;
      ancestors.push(parent);
      cursor = parent.parentTaskId;
    }
    // ancestors is leaf-of-parent → root; reverse to root → leaf, excluding self.
    ancestors.reverse();

    // 2. Find the first goal id reachable from this task — start with
    //    the task's own goalId, then fall back to ancestors in
    //    root → leaf order.
    let firstGoalId: string | null = task.goalId;
    if (firstGoalId === null) {
      for (const ancestor of ancestors) {
        if (ancestor.goalId !== null) {
          firstGoalId = ancestor.goalId;
          break;
        }
      }
    }

    const goalChain = firstGoalId
      ? await this.goalService.ancestryChain(workspaceId, firstGoalId)
      : [];

    return {
      taskId: task.id,
      taskTitle: task.title,
      taskAncestors: ancestors.map((a, idx) => ({
        taskId: a.id,
        title: a.title,
        depth: idx,
      })),
      goalChain,
    };
  }

  /**
   * Build the GOAL CONTEXT block that auto-router prepends to the
   * system message. Bounded by `GOAL_CONTEXT_CHAR_CAP`; truncates from
   * the leaf end with `" … [truncated]"` and logs a warning when the
   * assembled block would have exceeded the cap.
   *
   * Returns null when the task isn't linked to a goal and has no
   * ancestry worth surfacing — callers skip the injection entirely in
   * that case to keep the prompt clean.
   */
  async buildContext(taskId: string): Promise<string | null> {
    // The context call doesn't know the calling workspace — it's
    // invoked from auto-router on an established AiSession. Resolve
    // the workspace via the task's project to keep the same fence.
    const task = await this.db.mnTask.findUnique({ where: { id: taskId } });
    if (!task) return null;
    const project = await this.db.mnProject.findUnique({
      where: { id: task.projectId },
    });
    if (!project) return null;
    const workspaceId = project.workspaceId;

    const ancestry = await this.taskAncestry(workspaceId, taskId);
    if (!ancestry) return null;
    if (
      ancestry.goalChain.length === 0 &&
      ancestry.taskAncestors.length === 0
    ) {
      // Nothing meaningful to surface; skip the injection.
      return null;
    }

    const lines: string[] = ['GOAL CONTEXT:'];

    for (const step of ancestry.goalChain) {
      const indent = '  '.repeat(step.depth);
      lines.push(`${indent}- [${step.level}] ${step.title} (${step.status})`);
    }

    if (ancestry.taskAncestors.length > 0) {
      lines.push('TASK ANCESTRY:');
      for (const step of ancestry.taskAncestors) {
        const indent = '  '.repeat(step.depth);
        lines.push(`${indent}- ${step.title}`);
      }
    }

    lines.push(`CURRENT TASK: ${ancestry.taskTitle}`);

    const assembled = lines.join('\n');

    if (assembled.length <= GOAL_CONTEXT_CHAR_CAP) {
      return assembled;
    }

    // Over the cap — truncate from the leaf end with a marker. Leave
    // 16 chars for " … [truncated]" plus a newline.
    const suffix = ' … [truncated]';
    const sliceLen = GOAL_CONTEXT_CHAR_CAP - suffix.length;
    const truncated = assembled.slice(0, Math.max(0, sliceLen)) + suffix;
    this.logger.warn(
      `goal-context injection truncated for task=${taskId}: ` +
        `assembled=${assembled.length} chars > cap=${GOAL_CONTEXT_CHAR_CAP}`
    );
    return truncated;
  }

  // ---------------------------------------------------------------------------

  private async loadTaskInWorkspace(
    workspaceId: string,
    taskId: string
  ): Promise<MnTask | null> {
    const task = await this.db.mnTask.findUnique({ where: { id: taskId } });
    if (!task) return null;
    const project = await this.db.mnProject.findUnique({
      where: { id: task.projectId },
    });
    if (!project || project.workspaceId !== workspaceId) return null;
    return task;
  }
}

// Re-export the constants here so consumers don't need to know about
// the DTO module for runtime values.
export { GOAL_CONTEXT_CHAR_CAP, MAX_GOAL_CHAIN_DEPTH };
