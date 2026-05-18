import {
  Field,
  GraphQLISODateTime,
  ID,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { MnTaskPlanStatus } from '@prisma/client';
import { GraphQLJSON } from 'graphql-scalars';

/**
 * M13 — Deep Planning DTOs.
 *
 * Plans flow `DRAFT → UNDER_REVIEW → APPROVED | REJECTED` and an
 * already-APPROVED plan is auto-flipped to `SUPERSEDED` when a new
 * APPROVED plan lands on the same task. Revisions are monotonic per
 * task — the service auto-increments under a transaction.
 *
 * Per CLAUDE.md §6 UndefinedTypeError trap (v1.7.0 + v1.10.2 scars):
 * EVERY nullable / optional `@Field` carries an explicit `() => Type`.
 * Do NOT remove the type arrows when refactoring this file — that's
 * exactly the regression class that has shipped to production twice.
 *
 * `reviewerComments` is `GraphQLJSON` because the shape is a
 * free-form append-only audit log and we don't want to ossify it into
 * an `@ObjectType`. Consumers are expected to render heuristically.
 */

registerEnumType(MnTaskPlanStatus, {
  name: 'MnTaskPlanStatus',
  description:
    'M13 — Plan lifecycle state. DRAFT and UNDER_REVIEW are the only ' +
    'mutable states; APPROVED, REJECTED, and SUPERSEDED are terminal.',
});

/**
 * Plan-decision discriminator. APPROVE flips the prior APPROVED plan
 * (if any) on the same task to SUPERSEDED; REJECT marks the current
 * revision as terminal so the author has to draft a new revision to
 * try again.
 */
export enum MnTaskPlanDecision {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

registerEnumType(MnTaskPlanDecision, {
  name: 'MnTaskPlanDecision',
  description:
    'M13 — Reviewer decision discriminator. APPROVE moves UNDER_REVIEW → ' +
    'APPROVED and supersedes prior APPROVED revisions; REJECT moves ' +
    'UNDER_REVIEW → REJECTED.',
});

@InputType()
export class CreateMnTaskPlanInput {
  @Field(() => ID)
  taskId!: string;

  @Field(() => String)
  bodyMd!: string;
}

@InputType()
export class DecideMnTaskPlanInput {
  @Field(() => ID)
  planId!: string;

  @Field(() => MnTaskPlanDecision)
  decision!: MnTaskPlanDecision;

  @Field(() => String, { nullable: true })
  comment?: string | null;
}

@ObjectType('MnTaskPlan')
export class MnTaskPlanObjectType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  taskId!: string;

  @Field(() => Int)
  revisionNumber!: number;

  @Field(() => String)
  bodyMd!: string;

  @Field(() => MnTaskPlanStatus)
  status!: MnTaskPlanStatus;

  @Field(() => ID, { nullable: true })
  authorAgentId!: string | null;

  @Field(() => ID, { nullable: true })
  authorUserId!: string | null;

  /**
   * Append-only audit log of reviewer decisions + comments. Each entry
   * is a free-form JSON object — see `MnTaskPlanService.decidePlan` for
   * the shape produced by the service.
   */
  @Field(() => GraphQLJSON)
  reviewerComments!: unknown;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;
}
