import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { MnTaskPlan } from '@prisma/client';
import { MnTaskPlanStatus, PrismaClient } from '@prisma/client';

import { MnTaskPlanDecision } from './manut-task-plan.dto';

/**
 * M13 — Deep Planning service.
 *
 * Plans are revisionable strategy documents attached to a task.
 * Revisions are monotonic per task — `createPlan` reads the current
 * max+1 inside a transaction and writes the new row under the
 * `@@unique([taskId, revisionNumber])` constraint. A retry on the
 * (rare) collision is fine because the unique violation surfaces a
 * `P2002` error.
 *
 * State machine (enforced at the service edge):
 *
 *     DRAFT ──submitForReview──→ UNDER_REVIEW ──decide(APPROVE)──→ APPROVED
 *                                       │
 *                                       └──decide(REJECT)──→ REJECTED
 *
 * `APPROVED` and `REJECTED` are terminal — any further decide attempt
 * raises `BadRequestException`. When a plan transitions to APPROVED,
 * the service auto-flips ANY prior plan on the same task that is
 * currently APPROVED to `SUPERSEDED` so the "current plan" query is
 * unambiguous: it's the row with `status=APPROVED` and the highest
 * `revisionNumber`. The supersede write happens in the same
 * transaction as the approve write so a crash between the two cannot
 * leave two APPROVED revisions on the same task.
 *
 * `reviewerComments` is an append-only JSON array. Every `decidePlan`
 * call pushes one entry:
 *     { decision, comment, decidedBy: { userId? | agentId? }, decidedAt }
 *
 * CLAUDE.md scars honored:
 *  - `@Injectable()` so TypeScript emits `design:paramtypes` for
 *    NestJS DI (v1.12.0 scar).
 *  - `PrismaClient` is a RUNTIME import (not `import type`) because it
 *    is the constructor-injection target (PR #57 incident class).
 *  - The XOR between `authorUserId` and `authorAgentId` is enforced
 *    at write time — Prisma cannot express XOR declaratively.
 *  - Workspace fencing happens at the resolver edge via
 *    `AccessController` against the task's workspaceId. The service
 *    accepts a taskId opaquely and trusts the caller has already
 *    permissioned it.
 */

export interface CreatePlanOptions {
  /** Agent author (XOR with userId). */
  authorAgentId?: string | null;
  /** User author (XOR with agentId). */
  authorUserId?: string | null;
}

export interface DecidePlanOptions {
  decision: MnTaskPlanDecision;
  comment?: string | null;
  /** Reviewer identity for the audit log. XOR with reviewerAgentId. */
  reviewerUserId?: string | null;
  /** Reviewer identity for the audit log. XOR with reviewerUserId. */
  reviewerAgentId?: string | null;
}

/** Maximum plan body length. Tighter than free Text would allow so the
 *  audit log doesn't accumulate giant blobs without an explicit OK. */
export const MAX_PLAN_BODY_LENGTH = 32_000;

@Injectable()
export class MnTaskPlanService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Create a new plan revision in DRAFT state. The service auto-
   * increments `revisionNumber` per task — concurrent createPlan calls
   * serialize on the row-lock of the transaction's max-query and walk
   * away with distinct revision numbers. On the off chance two
   * transactions read the same max before either commits, the unique
   * constraint rejects the second write with `P2002`.
   */
  async createPlan(
    taskId: string,
    bodyMd: string,
    author: CreatePlanOptions
  ): Promise<MnTaskPlan> {
    if (!taskId) {
      throw new BadRequestException('taskId is required');
    }
    if (!bodyMd || !bodyMd.trim()) {
      throw new BadRequestException('Plan body cannot be empty');
    }
    if (bodyMd.length > MAX_PLAN_BODY_LENGTH) {
      throw new BadRequestException(
        `Plan body exceeds ${MAX_PLAN_BODY_LENGTH} characters`
      );
    }
    // XOR — at most one of authorUserId / authorAgentId may be set.
    if (author.authorAgentId && author.authorUserId) {
      throw new BadRequestException(
        'authorAgentId and authorUserId are mutually exclusive'
      );
    }

    const task = await this.db.mnTask.findUnique({
      where: { id: taskId },
      select: { id: true },
    });
    if (!task) {
      throw new NotFoundException(`Task ${taskId} not found`);
    }

    // Compute next revision under a transaction so the max-read +
    // insert are atomic enough to keep the unique constraint clean.
    return this.db.$transaction(async tx => {
      const latest = await tx.mnTaskPlan.findFirst({
        where: { taskId },
        orderBy: { revisionNumber: 'desc' },
        select: { revisionNumber: true },
      });
      const nextRevision = (latest?.revisionNumber ?? 0) + 1;
      return tx.mnTaskPlan.create({
        data: {
          id: randomUUID(),
          taskId,
          revisionNumber: nextRevision,
          bodyMd,
          status: MnTaskPlanStatus.DRAFT,
          authorAgentId: author.authorAgentId ?? null,
          authorUserId: author.authorUserId ?? null,
          reviewerComments: [],
        },
      });
    });
  }

  /**
   * Move a DRAFT plan to UNDER_REVIEW. Any other source state raises
   * BadRequestException — the workflow is strictly forward.
   */
  async submitForReview(planId: string): Promise<MnTaskPlan> {
    const plan = await this.requirePlan(planId);
    if (plan.status !== MnTaskPlanStatus.DRAFT) {
      throw new BadRequestException(
        `Plan ${planId} cannot be submitted from status=${plan.status}; ` +
          `only DRAFT plans are eligible for review`
      );
    }
    return this.db.mnTaskPlan.update({
      where: { id: planId },
      data: { status: MnTaskPlanStatus.UNDER_REVIEW },
    });
  }

  /**
   * Decide an UNDER_REVIEW plan. APPROVE auto-supersedes any prior
   * APPROVED plan on the same task in the same transaction so the
   * "current plan" invariant (at most one APPROVED per task) holds
   * even under concurrent decide calls.
   *
   * Either reviewerUserId or reviewerAgentId may be set (XOR). At
   * least one is required so the audit log captures attribution.
   */
  async decidePlan(
    planId: string,
    options: DecidePlanOptions
  ): Promise<MnTaskPlan> {
    if (options.reviewerAgentId && options.reviewerUserId) {
      throw new BadRequestException(
        'reviewerAgentId and reviewerUserId are mutually exclusive'
      );
    }
    if (!options.reviewerAgentId && !options.reviewerUserId) {
      throw new BadRequestException(
        'decidePlan requires reviewerAgentId or reviewerUserId for audit'
      );
    }

    const plan = await this.requirePlan(planId);
    if (plan.status !== MnTaskPlanStatus.UNDER_REVIEW) {
      throw new BadRequestException(
        `Plan ${planId} cannot be decided from status=${plan.status}; ` +
          `only UNDER_REVIEW plans accept a decision`
      );
    }

    const newStatus =
      options.decision === MnTaskPlanDecision.APPROVE
        ? MnTaskPlanStatus.APPROVED
        : MnTaskPlanStatus.REJECTED;

    const commentEntry: Record<string, unknown> = {
      decision: options.decision,
      comment: options.comment ?? null,
      decidedAt: new Date().toISOString(),
      reviewerUserId: options.reviewerUserId ?? null,
      reviewerAgentId: options.reviewerAgentId ?? null,
    };

    const priorComments = this.normaliseComments(plan.reviewerComments);
    const nextComments = [...priorComments, commentEntry];

    return this.db.$transaction(async tx => {
      // Supersede the prior APPROVED plan on the same task if we're
      // about to approve a new one. Must happen inside the same
      // transaction so a crash between the two writes can't leave two
      // APPROVED revisions live.
      if (newStatus === MnTaskPlanStatus.APPROVED) {
        await tx.mnTaskPlan.updateMany({
          where: {
            taskId: plan.taskId,
            status: MnTaskPlanStatus.APPROVED,
            id: { not: planId },
          },
          data: { status: MnTaskPlanStatus.SUPERSEDED },
        });
      }
      return tx.mnTaskPlan.update({
        where: { id: planId },
        data: {
          status: newStatus,
          reviewerComments: nextComments as object,
        },
      });
    });
  }

  /**
   * List all plans for a task, newest revision first. The frontend
   * renders these as a vertical revision timeline.
   */
  async listPlans(taskId: string): Promise<MnTaskPlan[]> {
    if (!taskId) {
      throw new BadRequestException('taskId is required');
    }
    return this.db.mnTaskPlan.findMany({
      where: { taskId },
      orderBy: { revisionNumber: 'desc' },
    });
  }

  /**
   * Load a plan + the workspaceId of the task it belongs to. Used by
   * the resolver to perform the workspace-fence permission check
   * BEFORE invoking any of the mutating methods above.
   */
  async getPlanWithWorkspace(
    planId: string
  ): Promise<{ plan: MnTaskPlan; workspaceId: string } | null> {
    const row = await this.db.mnTaskPlan.findUnique({
      where: { id: planId },
      include: { task: { include: { project: true } } },
    });
    if (!row) return null;
    return {
      plan: {
        id: row.id,
        taskId: row.taskId,
        revisionNumber: row.revisionNumber,
        bodyMd: row.bodyMd,
        status: row.status,
        authorAgentId: row.authorAgentId,
        authorUserId: row.authorUserId,
        reviewerComments: row.reviewerComments,
        createdAt: row.createdAt,
      },
      workspaceId: row.task.project.workspaceId,
    };
  }

  /**
   * Internal — load a plan or throw NotFound. Returns the row shape
   * the service operations need without dragging joins along.
   */
  private async requirePlan(planId: string): Promise<MnTaskPlan> {
    const plan = await this.db.mnTaskPlan.findUnique({
      where: { id: planId },
    });
    if (!plan) {
      throw new NotFoundException(`Plan ${planId} not found`);
    }
    return plan;
  }

  /**
   * Normalise the stored `reviewerComments` JSON to an array. Defensive
   * coercion so a corrupt row (or one written with a legacy shape)
   * never crashes the append path. We log nothing here — the next
   * write replaces the value with a well-formed array.
   */
  private normaliseComments(stored: unknown): unknown[] {
    if (Array.isArray(stored)) return stored;
    return [];
  }
}
