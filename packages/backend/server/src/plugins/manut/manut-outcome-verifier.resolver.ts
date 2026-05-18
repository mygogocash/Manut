import { NotFoundException } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { PrismaClient } from '@prisma/client';

import { CurrentUser } from '../../core/auth';
import { AccessController } from '../../core/permission';
import {
  type MnDoDPredicate,
  MnDoDVerificationResultObjectType,
  SetMnTaskDefinitionOfDoneInput,
} from './manut-outcome-verifier.dto';
import { MnOutcomeVerifierService } from './manut-outcome-verifier.service';

/**
 * M11 — GraphQL surface for the Enforced Outcomes verifier.
 *
 * `verifyMnTaskDone` is a Query because verification is idempotent
 * and side-effect free; the frontend polls it on the task detail
 * panel to render per-predicate status.
 *
 * `setMnTaskDefinitionOfDone` is a Mutation that overwrites the
 * stored predicate array on the task. Pass `null` to clear.
 *
 * Per CLAUDE.md §6 UndefinedTypeError trap: every nullable `@Field`
 * carries an explicit `() => Type`. The single nullable arg in
 * `setMnTaskDefinitionOfDone` is wrapped in an `@InputType()`
 * containing an explicitly-typed `GraphQLJSON` field — same shape as
 * the agent-config DTO that survived the v1.10.2 regression.
 *
 * Per PR #57 (NestJS DI): `PrismaClient`, `AccessController`, and
 * `MnOutcomeVerifierService` are RUNTIME imports (no `import type`)
 * because they're constructor-injection targets.
 */
@Resolver(() => MnDoDVerificationResultObjectType)
export class MnOutcomeVerifierResolver {
  constructor(
    private readonly db: PrismaClient,
    private readonly verifier: MnOutcomeVerifierService,
    private readonly ac: AccessController
  ) {}

  @Query(() => MnDoDVerificationResultObjectType, {
    description:
      'M11 — verify a task against its declared Definition of Done. ' +
      'Runs every predicate and returns a per-predicate breakdown. ' +
      '`satisfied=true` is the AND of every predicate. A task with no ' +
      'predicates returns `hasDefinition=false, satisfied=true` ' +
      '(transition guard is a no-op for un-enforced tasks).',
  })
  async verifyMnTaskDone(
    @CurrentUser() user: CurrentUser,
    @Args('taskId', { type: () => ID }) taskId: string
  ): Promise<MnDoDVerificationResultObjectType> {
    const task = await this.requireTask(taskId);
    await this.ac
      .user(user.id)
      .workspace(task.workspaceId)
      .assert('Workspace.Read');

    const outcome = await this.verifier.verifyTaskDone(taskId);
    return {
      taskId: outcome.taskId,
      satisfied: outcome.satisfied,
      hasDefinition: outcome.hasDefinition,
      results: outcome.results.map(r => ({
        predicate: r.predicate,
        satisfied: r.satisfied,
        kind: r.kind,
        evidence: r.evidence,
        reason: r.reason,
      })),
    };
  }

  @Mutation(() => MnDoDVerificationResultObjectType, {
    description:
      'M11 — set or clear the Definition of Done predicate list for a ' +
      'task. Pass `predicates: null` (or an empty array) to remove the ' +
      'transition guard. Returns the freshly verified outcome so the UI ' +
      'can render predicate-by-predicate status immediately after save.',
  })
  async setMnTaskDefinitionOfDone(
    @CurrentUser() user: CurrentUser,
    @Args('input', { type: () => SetMnTaskDefinitionOfDoneInput })
    input: SetMnTaskDefinitionOfDoneInput
  ): Promise<MnDoDVerificationResultObjectType> {
    const task = await this.requireTask(input.taskId);
    await this.ac
      .user(user.id)
      .workspace(task.workspaceId)
      .assert('Workspace.Settings.Update');

    const predicates: MnDoDPredicate[] | null = input.predicates;
    await this.verifier.setDefinitionOfDone(input.taskId, predicates);

    const outcome = await this.verifier.verifyTaskDone(input.taskId);
    return {
      taskId: outcome.taskId,
      satisfied: outcome.satisfied,
      hasDefinition: outcome.hasDefinition,
      results: outcome.results.map(r => ({
        predicate: r.predicate,
        satisfied: r.satisfied,
        kind: r.kind,
        evidence: r.evidence,
        reason: r.reason,
      })),
    };
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
