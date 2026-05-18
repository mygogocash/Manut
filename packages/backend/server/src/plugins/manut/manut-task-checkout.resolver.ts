import { NotFoundException } from '@nestjs/common';
import {
  Args,
  Field,
  GraphQLISODateTime,
  ID,
  Int,
  Mutation,
  ObjectType,
  Query,
  registerEnumType,
  Resolver,
} from '@nestjs/graphql';
import { MnExecutionRunStatus, PrismaClient } from '@prisma/client';

import { CurrentUser } from '../../core/auth';
import { AccessController } from '../../core/permission';
import { MnTaskCheckoutService } from './manut-task-checkout.service';

// Register the enum once so the GraphQL schema knows about it.
// `registerEnumType` is idempotent across hot reloads in this codebase.
registerEnumType(MnExecutionRunStatus, {
  name: 'MnExecutionRunStatus',
  description:
    'M7 — Manut execution run lifecycle status. QUEUED → RUNNING → ' +
    'SUCCEEDED | FAILED | CANCELLED | TIMED_OUT.',
});

/**
 * MnExecutionRun rendered for the GraphQL surface. Every nullable
 * field carries an explicit `() => Type` per CLAUDE.md §6 UndefinedTypeError
 * trap (v1.7.0 + v1.10.2 scars).
 */
@ObjectType('MnExecutionRun')
export class MnExecutionRunObjectType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  taskId!: string;

  @Field(() => ID, { nullable: true })
  agentId!: string | null;

  @Field(() => MnExecutionRunStatus)
  status!: MnExecutionRunStatus;

  @Field(() => GraphQLISODateTime)
  startedAt!: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  finishedAt!: Date | null;

  @Field(() => String, { nullable: true })
  error!: string | null;
}

@ObjectType('MnTaskCheckoutResult')
export class MnTaskCheckoutResultObjectType {
  @Field(() => Boolean)
  acquired!: boolean;

  @Field(() => ID, { nullable: true })
  taskId!: string | null;

  @Field(() => ID, { nullable: true })
  executionRunId!: string | null;

  @Field(() => GraphQLISODateTime, { nullable: true })
  executionLockedAt!: Date | null;
}

@Resolver(() => MnExecutionRunObjectType)
export class MnTaskCheckoutResolver {
  constructor(
    private readonly db: PrismaClient,
    private readonly checkout: MnTaskCheckoutService,
    private readonly ac: AccessController
  ) {}

  @Query(() => [MnExecutionRunObjectType], {
    description:
      'M7 — list execution runs for a task, newest first. ' +
      'Requires Workspace.Read on the owning workspace.',
  })
  async mnExecutionRunsForTask(
    @CurrentUser() user: CurrentUser,
    @Args('taskId', { type: () => ID }) taskId: string,
    @Args('limit', { type: () => Int, nullable: true })
    limit?: number | null
  ): Promise<MnExecutionRunObjectType[]> {
    const task = await this.requireTask(taskId);
    await this.ac
      .user(user.id)
      .workspace(task.workspaceId)
      .assert('Workspace.Read');

    const runs = await this.checkout.listRunsForTask(taskId, limit ?? 50);
    return runs as unknown as MnExecutionRunObjectType[];
  }

  @Mutation(() => MnTaskCheckoutResultObjectType, {
    description:
      'M7 — atomically claim the execution lock on a task. Returns ' +
      '`acquired=true` plus updated lock metadata on success; ' +
      '`acquired=false` when another caller holds a non-stale lock.',
  })
  async tryCheckoutMnTask(
    @CurrentUser() user: CurrentUser,
    @Args('taskId', { type: () => ID }) taskId: string,
    @Args('runId', { type: () => ID }) runId: string,
    @Args('executingAgentId', { type: () => ID, nullable: true })
    executingAgentId?: string | null
  ): Promise<MnTaskCheckoutResultObjectType> {
    const task = await this.requireTask(taskId);
    await this.ac
      .user(user.id)
      .workspace(task.workspaceId)
      .assert('Workspace.Settings.Update');

    const updated = await this.checkout.tryCheckout(
      taskId,
      runId,
      executingAgentId ?? null
    );

    if (!updated) {
      return {
        acquired: false,
        taskId,
        executionRunId: null,
        executionLockedAt: null,
      };
    }

    return {
      acquired: true,
      taskId: updated.id,
      executionRunId: updated.executionRunId,
      executionLockedAt: updated.executionLockedAt,
    };
  }

  @Mutation(() => Boolean, {
    description:
      'M7 — release a task checkout. No-op if `runId` does not ' +
      'match the current holder (security: stale processes cannot ' +
      'clobber fresh executions).',
  })
  async releaseMnTaskCheckout(
    @CurrentUser() user: CurrentUser,
    @Args('taskId', { type: () => ID }) taskId: string,
    @Args('runId', { type: () => ID }) runId: string
  ): Promise<boolean> {
    const task = await this.requireTask(taskId);
    await this.ac
      .user(user.id)
      .workspace(task.workspaceId)
      .assert('Workspace.Settings.Update');

    return this.checkout.release(taskId, runId);
  }

  @Mutation(() => MnExecutionRunObjectType, {
    description:
      'M7 — mark an MnExecutionRun row as complete. `status` must be ' +
      'terminal (SUCCEEDED / FAILED / CANCELLED / TIMED_OUT).',
  })
  async markMnExecutionRunComplete(
    @CurrentUser() user: CurrentUser,
    @Args('runId', { type: () => ID }) runId: string,
    @Args('status', { type: () => MnExecutionRunStatus })
    status: MnExecutionRunStatus,
    @Args('error', { type: () => String, nullable: true })
    error?: string | null
  ): Promise<MnExecutionRunObjectType> {
    const run = await this.db.mnExecutionRun.findUnique({
      where: { id: runId },
      include: { task: { include: { project: true } } },
    });
    if (!run) {
      throw new NotFoundException('Execution run not found');
    }
    await this.ac
      .user(user.id)
      .workspace(run.task.project.workspaceId)
      .assert('Workspace.Settings.Update');

    await this.checkout.markRunComplete(runId, status, error ?? null);

    const updated = await this.db.mnExecutionRun.findUniqueOrThrow({
      where: { id: runId },
    });
    return updated as unknown as MnExecutionRunObjectType;
  }

  /**
   * Internal helper — load the task + workspaceId in one round-trip
   * and throw NotFound when missing. Returns a minimal shape (id +
   * workspaceId) so callers can permission-check before any other
   * service work runs.
   */
  private async requireTask(
    taskId: string
  ): Promise<{ id: string; workspaceId: string }> {
    const task = await this.db.mnTask.findUnique({
      where: { id: taskId },
      include: { project: { select: { workspaceId: true } } },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    return { id: task.id, workspaceId: task.project.workspaceId };
  }
}
