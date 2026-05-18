import { NotFoundException } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { MnTaskPlan } from '@prisma/client';
import { PrismaClient } from '@prisma/client';

import { CurrentUser } from '../../core/auth';
import { AccessController } from '../../core/permission';
import {
  CreateMnTaskPlanInput,
  DecideMnTaskPlanInput,
  MnTaskPlanObjectType,
} from './manut-task-plan.dto';
import { MnTaskPlanService } from './manut-task-plan.service';

/**
 * M13 — GraphQL surface for revisionable task plans.
 *
 * Read uses `Workspace.Read`; writes (create / submit / decide) use
 * `Workspace.Settings.Update`. The resolver loads the task → project
 * → workspaceId chain BEFORE invoking the service so unauthorised
 * callers never trigger any database write.
 *
 * Per CLAUDE.md §6 UndefinedTypeError trap (v1.7.0 + v1.10.2 scars):
 * every nullable `@Field` in the DTO carries an explicit `() => Type`.
 *
 * Per PR #57 NestJS DI scar: `PrismaClient`, `AccessController`, and
 * `MnTaskPlanService` are RUNTIME imports (not `import type`) because
 * they are constructor-injection targets.
 */
@Resolver(() => MnTaskPlanObjectType)
export class MnTaskPlanResolver {
  constructor(
    private readonly db: PrismaClient,
    private readonly service: MnTaskPlanService,
    private readonly ac: AccessController
  ) {}

  @Query(() => [MnTaskPlanObjectType], {
    description:
      'M13 — list every revision of a task plan, newest first. The ' +
      'UI renders this as a vertical timeline with status badges.',
  })
  async mnTaskPlans(
    @CurrentUser() user: CurrentUser,
    @Args('taskId', { type: () => ID }) taskId: string
  ): Promise<MnTaskPlanObjectType[]> {
    const workspaceId = await this.requireTaskWorkspace(taskId);
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');
    const plans = await this.service.listPlans(taskId);
    return plans.map(toObjectType);
  }

  @Mutation(() => MnTaskPlanObjectType, {
    description:
      'M13 — create a new DRAFT revision for a task. The service ' +
      'auto-increments revisionNumber inside a transaction so ' +
      'concurrent creates produce distinct revisions.',
  })
  async createMnTaskPlan(
    @CurrentUser() user: CurrentUser,
    @Args('input', { type: () => CreateMnTaskPlanInput })
    input: CreateMnTaskPlanInput
  ): Promise<MnTaskPlanObjectType> {
    const workspaceId = await this.requireTaskWorkspace(input.taskId);
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');

    const plan = await this.service.createPlan(input.taskId, input.bodyMd, {
      authorUserId: user.id,
    });
    return toObjectType(plan);
  }

  @Mutation(() => MnTaskPlanObjectType, {
    description:
      'M13 — move a DRAFT plan to UNDER_REVIEW. Idempotent on already-' +
      'UNDER_REVIEW plans is NOT supported — the service rejects any ' +
      'source state other than DRAFT to keep the state machine honest.',
  })
  async submitMnTaskPlanForReview(
    @CurrentUser() user: CurrentUser,
    @Args('planId', { type: () => ID }) planId: string
  ): Promise<MnTaskPlanObjectType> {
    const planCtx = await this.requirePlanContext(planId);
    await this.ac
      .user(user.id)
      .workspace(planCtx.workspaceId)
      .assert('Workspace.Settings.Update');
    const updated = await this.service.submitForReview(planId);
    return toObjectType(updated);
  }

  @Mutation(() => MnTaskPlanObjectType, {
    description:
      'M13 — APPROVE or REJECT an UNDER_REVIEW plan. APPROVE supersedes ' +
      'any prior APPROVED revision on the same task in the same ' +
      'transaction so the "current plan" invariant holds. Both ' +
      'decisions append an audit entry to reviewerComments.',
  })
  async decideMnTaskPlan(
    @CurrentUser() user: CurrentUser,
    @Args('input', { type: () => DecideMnTaskPlanInput })
    input: DecideMnTaskPlanInput
  ): Promise<MnTaskPlanObjectType> {
    const planCtx = await this.requirePlanContext(input.planId);
    await this.ac
      .user(user.id)
      .workspace(planCtx.workspaceId)
      .assert('Workspace.Settings.Update');
    const updated = await this.service.decidePlan(input.planId, {
      decision: input.decision,
      comment: input.comment ?? null,
      reviewerUserId: user.id,
    });
    return toObjectType(updated);
  }

  /**
   * Resolve the workspaceId of the task this plan belongs to. Used
   * to enforce the workspace permission check before any service call.
   */
  private async requirePlanContext(
    planId: string
  ): Promise<{ workspaceId: string }> {
    const ctx = await this.service.getPlanWithWorkspace(planId);
    if (!ctx) {
      throw new NotFoundException(`Plan ${planId} not found`);
    }
    return { workspaceId: ctx.workspaceId };
  }

  /**
   * Resolve the workspaceId of an arbitrary task. The Prisma include
   * goes task → project → workspaceId in one round-trip.
   */
  private async requireTaskWorkspace(taskId: string): Promise<string> {
    const task = await this.db.mnTask.findUnique({
      where: { id: taskId },
      include: { project: { select: { workspaceId: true } } },
    });
    if (!task) {
      throw new NotFoundException(`Task ${taskId} not found`);
    }
    return task.project.workspaceId;
  }
}

/**
 * Map the Prisma row to the GraphQL ObjectType. We pass the
 * `reviewerComments` value through unchanged — it's `GraphQLJSON` on
 * the schema side so the consumer renders heuristically.
 */
function toObjectType(plan: MnTaskPlan): MnTaskPlanObjectType {
  return {
    id: plan.id,
    taskId: plan.taskId,
    revisionNumber: plan.revisionNumber,
    bodyMd: plan.bodyMd,
    status: plan.status,
    authorAgentId: plan.authorAgentId,
    authorUserId: plan.authorUserId,
    reviewerComments: plan.reviewerComments,
    createdAt: plan.createdAt,
  };
}
